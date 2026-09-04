// 副作用导入：useDrag.js 模块加载时会把 Sortable 的 AutoScroll 插件挂载到 Sortable
// （Sortable.mount 对同名插件重复挂载会直接抛错，故复用该模块完成一次性挂载，不自行 mount）
import '@renderer/utils/compositions/useDrag'
import Sortable from 'sortablejs/modular/sortable.core.esm'
import { ref, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { updateListMusicsPosition } from '@renderer/store/list/action'
import { getSortScheme, setSortScheme } from '@renderer/store/list/sortScheme'
import { dialog } from '@renderer/plugins/Dialog'

/**
 * 依据拖拽手势结果计算重排后的全量 id 顺序（纯函数，不改原数组）：
 * - 单行移动：movingIds 仅含被拖行；多选整块移动：movingIds 为选中的全部歌曲，
 *   并保持其在列表内的相对顺序整块迁移；
 * - 目标位置按"目标行之前/之后"（targetIndex/insertAfter）折算到剔除被移动项后的插入点；
 * - 顺序无变化时返回 null，调用方据此跳过落库。
 * @param {*} list 当前全量列表
 * @param {*} param1 { movingIds, targetIndex, insertAfter }
 * @returns { string[] | null } 新的全量 id 顺序
 */
export const buildDragReorderedIds = (list, { movingIds, targetIndex, insertAfter }) => {
  const originIds = list.map(m => m.id)
  if (targetIndex == null || targetIndex < 0 || targetIndex >= originIds.length) return null
  const movingSet = new Set(movingIds)
  const moving = originIds.filter(id => movingSet.has(id))
  if (!moving.length || moving.length === originIds.length) return null
  const insertAt = insertAfter ? targetIndex + 1 : targetIndex
  let position = insertAt
  for (let i = 0; i < insertAt; i++) {
    if (movingSet.has(originIds[i])) position--
  }
  const others = originIds.filter(id => !movingSet.has(id))
  position = Math.max(0, Math.min(position, others.length))
  const nextIds = [...others.slice(0, position), ...moving, ...others.slice(position)]
  for (let i = 0; i < nextIds.length; i++) {
    if (nextIds[i] !== originIds[i]) return nextIds
  }
  return null
}

/**
 * 虚拟列表行拖拽排序（受控模式）：
 * base-virtualized-list 的行是绝对定位（top=index*itemHeight）且仅可视行在 DOM，
 * 行 DOM 顺序≠数据顺序，不能让 SortableJS 重排 DOM——onMove 恒返回 false 阻止其插入，
 * 仅借其手势（onStart/onMove/onEnd）采集起始行、目标行（行节点 data-index 属性）与前后关系，
 * onEnd 计算新顺序后经 onCommit 提交落库。
 * 预览：拖动行加 ghostClass（row-drag-source）半透明；目标行加 row-drag-target /
 * row-drag-target-after 高亮插入边。自动滚动由 Sortable AutoScroll 插件处理
 * （滚动容器取指针下最近的可滚动父级，即虚拟列表滚动容器）。
 * @param {*} param0 { listRef, list, selectedList, selectedSet, enabled, onCommit }
 */
export const useRowDragSort = ({ listRef, list, selectedList, selectedSet, enabled, onCommit }) => {
  let sortable = null
  let targetEl = null
  let dragState = null

  const clearTargetMark = () => {
    if (!targetEl) return
    targetEl.classList.remove('row-drag-target', 'row-drag-target-after')
    targetEl = null
  }

  const getItemIndex = (itemEl) => {
    return itemEl ? Number.parseInt(itemEl.dataset.index, 10) : Number.NaN
  }

  const handleDragStart = (evt) => {
    const fromIndex = getItemIndex(evt.item)
    const item = Number.isNaN(fromIndex) ? null : list.value[fromIndex]
    if (!item) return
    // 拖动选中块内某行 = 整块移动；否则仅移动该行
    dragState = {
      movingIds: selectedSet.value.has(item) && selectedList.value.length > 1
        ? selectedList.value.map(m => m.id)
        : [item.id],
      targetIndex: null,
      insertAfter: false,
    }
  }

  const handleDragMove = (evt) => {
    if (!dragState) return false
    const related = evt.related
    const targetIndex = getItemIndex(related)
    if (Number.isNaN(targetIndex)) return false
    if (targetEl !== related) {
      clearTargetMark()
      targetEl = related
    }
    dragState.targetIndex = targetIndex
    dragState.insertAfter = !!evt.willInsertAfter
    targetEl.classList.add(dragState.insertAfter ? 'row-drag-target-after' : 'row-drag-target')
    return false // 阻止 SortableJS 重排 DOM，拖拽预览完全由自定义 class 承担
  }

  const handleDragEnd = (evt) => {
    clearTargetMark()
    evt.item?.classList.remove('row-drag-source')
    const state = dragState
    dragState = null
    if (!state || state.targetIndex == null) return
    // ESC/拖出窗口等取消动作（dropEffect none）不提交
    if (evt.originalEvent?.dataTransfer?.dropEffect === 'none') return
    const ids = buildDragReorderedIds(list.value, state)
    if (ids) onCommit(ids)
  }

  onMounted(() => {
    const dom_list = listRef.value?.$el?.querySelector(':scope > .list')
    if (!dom_list) return
    sortable = Sortable.create(dom_list, {
      animation: 0,
      disabled: true,
      handle: '.drag-handle',
      ghostClass: 'row-drag-source',
      scrollSensitivity: 60,
      scrollSpeed: 12,
      onStart: handleDragStart,
      onMove: handleDragMove,
      onEnd: handleDragEnd,
    })
  })

  watch(enabled, (val) => {
    sortable?.option('disabled', !val)
  }, { immediate: true })

  onBeforeUnmount(() => {
    sortable?.destroy()
    sortable = null
    clearTargetMark()
    dragState = null
  })
}

export default ({ props, list }) => {
  let sortingTask = null
  const isSorting = ref(false)

  // 表头排序与拖拽排序共用一把互斥锁：同一时刻只允许一个顺序写入任务
  const trackOrderTask = (task) => {
    sortingTask = task
    isSorting.value = true
    return task.catch(err => {
      console.warn(err)
    }).finally(() => {
      if (sortingTask === task) {
        sortingTask = null
        isSorting.value = false
      }
    })
  }

  /**
   * 表头点击排序：持久化到该列表的排序方案 + 物理顺序（order 表全量置换，orderPlanner 已最小化写入）。
   * 若列表当前为"自定义且曾手动排列"，先弹确认。
   */
  const handleHeaderSort = (column) => {
    if (!column || !props.allowCustomSort || sortingTask) return
    return trackOrderTask((async() => {
      const scheme = getSortScheme(props.listId)
      const sortOrder = scheme.sortType == column
        ? (scheme.sortOrder == 'asc' ? 'desc' : 'asc')
        : 'asc'
      if (scheme.sortType == 'custom' && scheme.customTouched) {
        const isConfirm = await dialog.confirm(window.i18n.t('music_sort_custom_confirm'))
        if (!isConfirm) return
      }
      const sorted = await window.lx.worker.main.sortListMusicInfo([...list.value], sortOrder == 'asc' ? 'up' : 'down', column, window.i18n.locale)
      if (!sorted.length) return
      await updateListMusicsPosition({ listId: props.listId, position: 0, ids: sorted.map(m => m.id) })
      setSortScheme(props.listId, { sortType: column, sortOrder })
    })())
  }

  /**
   * 拖拽排序提交：按新顺序全量置换列表物理顺序，并把排序方案标记为自定义（曾手动排列）。
   * @param {*} ids 重排后的全量歌曲 id 顺序
   */
  const commitDragOrder = (ids) => {
    if (!props.allowCustomSort || sortingTask || !ids?.length) return
    return trackOrderTask((async() => {
      await updateListMusicsPosition({ listId: props.listId, position: 0, ids })
      setSortScheme(props.listId, { sortType: 'custom', sortOrder: null, customTouched: true })
    })())
  }

  return {
    handleHeaderSort,
    commitDragOrder,
    isSorting,
  }
}
