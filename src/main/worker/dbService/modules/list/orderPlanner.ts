// 最小化 order 表重写规划器（纯函数，不依赖 DB/模块状态，便于独立验证）。
// 背景：列表内"移动/置顶/拖拽/批量排序"等操作，旧实现一律 DELETE 该列表全部 order 行后逐行
// INSERT（O(n) 写）。本模块把"当前 order 行 -> 目标 order 行"的转换规划为一组最小化 SQL 原语：
//   - 区间平移（一条 SQL 让一段连续 order 同时 +/- 常数，多数场景一次只影响受拖动波及的区间）
//   - 单行更新（数量少或无法区间化的行）
// 规划器不执行任何 DB 操作；调用方在事务内按返回顺序执行 op 即可。返回 ok:false 时调用方应
// 回退到旧的"清空重插"逻辑以保证端态完全一致。
// 关键约束：区间(shift)与逐行(update)两种 op 的先后顺序不可颠倒——update 按 id 定位、不受
// 区间扫描影响，而 shift 按 order 取值区间定位，若 update 先落位可能被后续 shift 误伤。

export interface CurrentOrderRow {
  musicInfoId: string
  order: number
}

export interface MusicInfoOrderTarget {
  musicInfoId: string
  order: number
}

export type MinimalOrderOp =
  | { type: 'update', musicInfoId: string, order: number }
  // 对当前 order 落在 [lo, hi] 的行整体加 delta：UPDATE ... SET "order"="order"+delta WHERE "order" BETWEEN lo AND hi
  | { type: 'shift', lo: number, hi: number, delta: number }

export type MinimalOrderPlan =
  | { ok: true, ops: MinimalOrderOp[] }
  | { ok: false }

/**
 * 规划把 listId 的 order 表从 current（按 order 升序）更新到 target 的最小写操作序列。
 * 要求（否则返回 ok:false 由调用方走旧全量路径，保证端态等价）：
 *  - 行数与 id 集合完全一致（不含新增/删除行）
 *  - current 的 order 值严格递增（无重复，BETWEEN 区间才不与行身份混淆）
 *  - target 的 order 值互不重复（最终值唯一）
 * 安全执行顺序：多段区间时所有"搬移区段"先 +K 移出取值空间(stage)、再 -K+delta 落回
 * 目标(finalize)；若只有一个区间（最常见：整段 +1/-m 平移），一条直接 shift 即可避免双写。
 * 区间平移整体先于逐行 update 执行；op 数组已按该顺序排列，调用方依序执行即可
 * （同一列表内不存在唯一约束，事务中瞬时重复值无害，最终值互异）。
 */
export const planMinimalOrders = (current: CurrentOrderRow[], target: MusicInfoOrderTarget[]): MinimalOrderPlan => {
  if (current.length !== target.length) return { ok: false }

  const targetOrderMap = new Map<string, number>()
  const seenTargetIds = new Set<string>()
  const seenTargetOrders = new Set<number>()
  for (const item of target) {
    if (seenTargetIds.has(item.musicInfoId)) return { ok: false }
    seenTargetIds.add(item.musicInfoId)
    if (seenTargetOrders.has(item.order)) return { ok: false }
    seenTargetOrders.add(item.order)
    targetOrderMap.set(item.musicInfoId, item.order)
  }

  const curIdSet = new Set<string>()
  for (const row of current) {
    if (curIdSet.has(row.musicInfoId)) return { ok: false }
    curIdSet.add(row.musicInfoId)
  }
  if (curIdSet.size !== targetOrderMap.size) return { ok: false }
  for (const id of curIdSet) {
    if (!targetOrderMap.has(id)) return { ok: false }
  }

  // current 按 order 升序且无重复（防止 BETWEEN 区间误伤非目标行）
  const sorted = [...current].sort((a, b) => a.order - b.order)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].order === sorted[i - 1].order) return { ok: false }
  }
  if (sorted.length && sorted[0].order < 0) return { ok: false }

  let maxCurrent = -Infinity
  let maxTarget = -Infinity
  const deltas = sorted.map((row) => {
    const targetOrder = targetOrderMap.get(row.musicInfoId)!

    maxCurrent = Math.max(maxCurrent, row.order)
    maxTarget = Math.max(maxTarget, targetOrder)
    return targetOrder - row.order
  })

  // stage 常数：让"搬移段"暂时落到远超当前/目标取值空间的区间，杜绝区间扫描互相踩踏
  const stageOffset = Math.max(maxCurrent, maxTarget) + sorted.length + 2

  const stageOps: MinimalOrderOp[] = []
  const finalizeOps: MinimalOrderOp[] = []
  const plainShiftOps: MinimalOrderOp[] = []
  const updateOps: MinimalOrderOp[] = []

  // 收集需要区间平移的 run（>=3 行才用区间 SQL；1~2 行用按 id 的逐行 UPDATE）
  const bandRuns: Array<{ lo: number, hi: number, delta: number }> = []
  const smallRuns: Array<{ from: number, to: number }> = []
  let i = 0
  while (i < sorted.length) {
    const delta = deltas[i]
    if (delta === 0) {
      i++
      continue
    }
    let j = i
    while (j + 1 < sorted.length && deltas[j + 1] === delta) j++
    const runLen = j - i + 1
    if (runLen >= 3) bandRuns.push({ lo: sorted[i].order, hi: sorted[j].order, delta })
    else smallRuns.push({ from: i, to: j })
    i = j + 1
  }

  // 单个区间平移直接执行即可（无其他区间扫描与之互踩，避免 stage/finalize 双写整段行）；
  // 多个区间因目标区间可能落入彼此的源区间，需用 stage(+K) 移出取值空间再落回，杜绝误伤。
  // 区间平移必须全部先于逐行 UPDATE 执行（UPDATE 按 id 定位不受区间扫描影响，反之会误伤）
  if (bandRuns.length === 1) {
    const run = bandRuns[0]
    plainShiftOps.push({ type: 'shift', lo: run.lo, hi: run.hi, delta: run.delta })
  } else {
    for (const run of bandRuns) {
      stageOps.push({ type: 'shift', lo: run.lo, hi: run.hi, delta: stageOffset })
      finalizeOps.push({ type: 'shift', lo: run.lo + stageOffset, hi: run.hi + stageOffset, delta: run.delta - stageOffset })
    }
  }
  for (const run of smallRuns) {
    for (let k = run.from; k <= run.to; k++) {
      updateOps.push({ type: 'update', musicInfoId: sorted[k].musicInfoId, order: targetOrderMap.get(sorted[k].musicInfoId)! })
    }
  }

  return { ok: true, ops: [...stageOps, ...finalizeOps, ...plainShiftOps, ...updateOps] }
}
