import { getDB } from '../../db'
import {
  createListQueryStatement,
  createListInsertStatement,
  createListDeleteStatement,
  createListClearStatement,
  createListUpdateStatement,
  createListPositionQueryStatement,
  createListUpdatePositionStatement,
  createMusicInfoQueryStatement,
  createMusicInfoInsertStatement,
  createMusicInfoUpdateStatement,
  createMusicInfoDeleteStatement,
  createMusicInfoDeleteByListIdStatement,
  createMusicInfoOrderStatement,
  createMusicInfoOrderInsertStatement,
  createMusicInfoOrderDeleteStatement,
  createMusicInfoOrderDeleteByListIdStatement,
  createMusicInfoOrdersByListIdQueryStatement,
  createMusicInfoOrderUpdateStatement,
  createMusicInfoOrderShiftStatement,
  createMusicInfoClearStatement,
  createMusicInfoOrderClearStatement,
  createMusicInfoByListAndMusicInfoIdQueryStatement,
  createMusicInfoByMusicInfoIdQueryStatement,
} from './statements'
import { planMinimalOrders } from './orderPlanner'
import type { CurrentOrderRow, MusicInfoOrderTarget } from './orderPlanner'

const idFixRxp = /\.0$/
/**
 * 获取用户列表
 * @returns
 */
export const queryAllUserList = () => {
  const list = createListQueryStatement().all() as LX.DBService.UserListInfo[]
  for (const info of list) {
    // 兼容v2.3.0之前版本插入数字类型的ID导致其意外在末尾追加 .0 的问题
    if (info.sourceListId?.endsWith?.('.0')) {
      info.sourceListId = info.sourceListId.replace(idFixRxp, '')
    }
  }
  return list
}

/**
 * 批量插入用户列表
 * @param lists 列表
 * @param isClear 是否清空列表
 */
export const insertUserLists = (lists: LX.DBService.UserListInfo[], isClear: boolean = false) => {
  const db = getDB()
  const listClearStatement = createListClearStatement()
  const listInsertStatement = createListInsertStatement()
  db.transaction((lists: LX.DBService.UserListInfo[]) => {
    if (isClear) listClearStatement.run()
    for (const list of lists) {
      listInsertStatement.run({
        id: list.id,
        name: list.name,
        source: list.source,
        sourceListId: list.sourceListId,
        locationUpdateTime: list.locationUpdateTime,
        position: list.position,
      })
    }
  })(lists)
}

/**
 * 批量删除用户列表及列表内歌曲
 * @param listIds 列表id
 */
export const deleteUserLists = (listIds: string[]) => {
  const db = getDB()
  const listDeleteStatement = createListDeleteStatement()
  const musicInfoDeleteByListIdStatement = createMusicInfoDeleteByListIdStatement()
  const musicInfoOrderDeleteByListIdStatement = createMusicInfoOrderDeleteByListIdStatement()
  db.transaction((listIds: string[]) => {
    for (const id of listIds) {
      listDeleteStatement.run(id)
      musicInfoDeleteByListIdStatement.run(id)
      musicInfoOrderDeleteByListIdStatement.run(id)
    }
  })(listIds)
}

/**
 * 批量更新用户列表
 * @param lists 列表
 */
export const updateUserLists = (lists: LX.DBService.UserListInfo[]) => {
  const db = getDB()
  const listUpdateStatement = createListUpdateStatement()
  db.transaction((lists: LX.DBService.UserListInfo[]) => {
    for (const list of lists) listUpdateStatement.run(list)
  })(lists)
}

/**
 * 批量更新用户列表位置（最小化：只写 position/locationUpdateTime 发生变化的行）
 * 旧实现（updateUserListsPosition）为清空整表后逐行重插，此处仅 diff 受影响行。
 * @param lists 新的完整用户列表（position 已按新顺序就位）
 * @param movedLists 本次被移动的列表（其 locationUpdateTime 已在内存中更新，需要一并落库）
 */
export const updateUserListsPositionMinimal = (lists: LX.DBService.UserListInfo[], movedLists: LX.DBService.UserListInfo[]) => {
  const db = getDB()
  const listPositionQueryStatement = createListPositionQueryStatement()
  const listUpdatePositionStatement = createListUpdatePositionStatement()
  db.transaction((lists: LX.DBService.UserListInfo[], movedLists: LX.DBService.UserListInfo[]) => {
    const dbPositionMap = new Map<string, number>()
    for (const row of listPositionQueryStatement.all() as Array<{ id: string, position: number }>) {
      dbPositionMap.set(row.id, row.position)
    }
    const movedIdSet = new Set<string>(movedLists.map(list => list.id))
    for (const list of lists) {
      const oldPosition = dbPositionMap.get(list.id)
      if (oldPosition == null) continue
      if (oldPosition !== list.position || movedIdSet.has(list.id)) {
        listUpdatePositionStatement.run({
          id: list.id,
          position: list.position,
          locationUpdateTime: list.locationUpdateTime,
        })
      }
    }
  })(lists, movedLists)
}


/**
 * 批量添加歌曲
 * @param list
 */
export const insertMusicInfoList = (list: LX.DBService.MusicInfo[]) => {
  const musicInfoInsertStatement = createMusicInfoInsertStatement()
  const musicInfoOrderInsertStatement = createMusicInfoOrderInsertStatement()
  const db = getDB()
  db.transaction((musics: LX.DBService.MusicInfo[]) => {
    for (const music of musics) {
      musicInfoInsertStatement.run(music)
      musicInfoOrderInsertStatement.run({
        listId: music.listId,
        musicInfoId: music.id,
        order: music.order,
      })
    }
  })(list)
}

/**
 * 尝试最小化更新列表内已有歌曲的 order（通常一次区间平移即完成），
 * 失败（行数/集合与预期不一致等异常态）返回 false，由调用方回退旧的"清空重插"保证端态等价。
 * 必须在调用方的 db.transaction 事务内执行。
 * @param listId 列表Id
 * @param target 期望的最终 <musicInfoId, order>（order 即最终值）
 * @returns 是否已应用最小更新
 */
const applyListOrdersMinimal = (listId: string, target: MusicInfoOrderTarget[]): boolean => {
  const ordersQueryStatement = createMusicInfoOrdersByListIdQueryStatement()
  const orderUpdateStatement = createMusicInfoOrderUpdateStatement()
  const orderShiftStatement = createMusicInfoOrderShiftStatement()
  const current = ordersQueryStatement.all(listId) as CurrentOrderRow[]
  const plan = planMinimalOrders(current, target)
  if (!plan.ok) return false
  for (const op of plan.ops) {
    if (op.type == 'shift') {
      orderShiftStatement.run({ listId, lo: op.lo, hi: op.hi, delta: op.delta })
    } else {
      orderUpdateStatement.run({ listId, musicInfoId: op.musicInfoId, order: op.order })
    }
  }
  return true
}

const toOrderTargets = (listAll: LX.DBService.MusicInfo[]): MusicInfoOrderTarget[] => {
  return listAll.map(info => ({ musicInfoId: info.id, order: info.order }))
}

/**
 * 批量添加歌曲并刷新排序
 * 旧实现：清空列表全部 order 行后逐行重插整列表（O(n) 写）。
 * 新实现：已有歌曲整体最小化平移（区间 UPDATE），仅新增歌曲做 INSERT。
 * @param list 新增歌曲
 * @param listId 列表Id
 * @param listAll 原始列表歌曲，列表去重后
 */
export const insertMusicInfoListAndRefreshOrder = (list: LX.DBService.MusicInfo[], listId: string, listAll: LX.DBService.MusicInfo[]) => {
  const musicInfoInsertStatement = createMusicInfoInsertStatement()
  const musicInfoOrderInsertStatement = createMusicInfoOrderInsertStatement()
  const musicInfoOrderDeleteByListIdStatement = createMusicInfoOrderDeleteByListIdStatement()

  const db = getDB()
  db.transaction(() => {
    if (applyListOrdersMinimal(listId, toOrderTargets(listAll))) {
      for (const music of list) {
        musicInfoInsertStatement.run(music)
        musicInfoOrderInsertStatement.run({
          listId: music.listId,
          musicInfoId: music.id,
          order: music.order,
        })
      }
    } else {
      // 异常态（现有行与缓存不一致等）回退旧逻辑：清空整列表 order 后重插
      musicInfoOrderDeleteByListIdStatement.run(listId)
      for (const music of list) {
        musicInfoInsertStatement.run(music)
        musicInfoOrderInsertStatement.run({
          listId: music.listId,
          musicInfoId: music.id,
          order: music.order,
        })
      }
      for (const music of listAll) {
        musicInfoOrderInsertStatement.run({
          listId: music.listId,
          musicInfoId: music.id,
          order: music.order,
        })
      }
    }
  })()
}

/**
 * 批量更新歌曲
 * @param list
 */
export const updateMusicInfos = (list: LX.DBService.MusicInfo[]) => {
  const musicInfoUpdateStatement = createMusicInfoUpdateStatement()
  const db = getDB()
  db.transaction((musics: LX.DBService.MusicInfo[]) => {
    for (const music of musics) {
      musicInfoUpdateStatement.run(music)
    }
  })(list)
}

/**
 * 获取列表内的歌曲
 * @param listId 列表Id
 * @returns 列表歌曲
 */
export const queryMusicInfoByListId = (listId: string) => {
  const musicInfoQueryStatement = createMusicInfoQueryStatement()
  return musicInfoQueryStatement.all({ listId }) as LX.DBService.MusicInfo[]
}

/**
 * 批量移动歌曲
 * @param fromId 源列表Id
 * @param ids 要移动的歌曲
 * @param musicInfos 音乐信息
 */
export const moveMusicInfo = (fromId: string, ids: string[], musicInfos: LX.DBService.MusicInfo[]) => {
  const musicInfoInsertStatement = createMusicInfoInsertStatement()
  const musicInfoOrderInsertStatement = createMusicInfoOrderInsertStatement()
  const musicInfoDeleteStatement = createMusicInfoDeleteStatement()
  const musicInfoOrderDeleteStatement = createMusicInfoOrderDeleteStatement()
  // const musicInfoOrderDeleteByListIdStatement = createMusicInfoOrderDeleteByListIdStatement()

  const db = getDB()
  db.transaction((fromId: string, ids: string[], musicInfos: LX.DBService.MusicInfo[]) => {
    // musicInfoOrderDeleteByListIdStatement.run(fromId)
    for (const id of ids) {
      musicInfoDeleteStatement.run({ listId: fromId, id })
      musicInfoOrderDeleteStatement.run({ listId: fromId, id })
    }
    for (const music of musicInfos) {
      musicInfoInsertStatement.run(music)
      musicInfoOrderInsertStatement.run({
        listId: music.listId,
        musicInfoId: music.id,
        order: music.order,
      })
    }
  })(fromId, ids, musicInfos)
}

/**
 * 批量移动歌曲并刷新排序
 * 旧实现：清空目标列表全部 order 行后逐行重插整列表（O(n) 写）。
 * 新实现：目标列表已有歌曲整体最小化平移（区间 UPDATE），仅被移动歌曲做 INSERT。
 * @param fromId 源列表Id
 * @param ids 要移动的歌曲id，原始选择的歌曲
 * @param musicInfos 要移动的歌曲，目标列表去重后
 * @param toListAll 目标列表歌曲
 */
export const moveMusicInfoAndRefreshOrder = (fromId: string, ids: string[], toId: string, musicInfos: LX.DBService.MusicInfo[], toListAll: LX.DBService.MusicInfo[]) => {
  const musicInfoInsertStatement = createMusicInfoInsertStatement()
  const musicInfoDeleteStatement = createMusicInfoDeleteStatement()
  const musicInfoOrderDeleteStatement = createMusicInfoOrderDeleteStatement()
  const musicInfoOrderInsertStatement = createMusicInfoOrderInsertStatement()
  const musicInfoOrderDeleteByListIdStatement = createMusicInfoOrderDeleteByListIdStatement()

  const db = getDB()
  db.transaction(() => {
    for (const id of ids) {
      musicInfoDeleteStatement.run({ listId: fromId, id })
      musicInfoOrderDeleteStatement.run({ listId: fromId, id })
    }
    if (applyListOrdersMinimal(toId, toOrderTargets(toListAll))) {
      for (const music of musicInfos) {
        musicInfoInsertStatement.run(music)
        musicInfoOrderInsertStatement.run({
          listId: music.listId,
          musicInfoId: music.id,
          order: music.order,
        })
      }
    } else {
      // 异常态（目标列表现有行与缓存不一致等）回退旧逻辑：清空目标列表 order 后重插
      musicInfoOrderDeleteByListIdStatement.run(toId)
      for (const music of musicInfos) {
        musicInfoInsertStatement.run(music)
        musicInfoOrderInsertStatement.run({
          listId: music.listId,
          musicInfoId: music.id,
          order: music.order,
        })
      }
      for (const music of toListAll) {
        musicInfoOrderInsertStatement.run({
          listId: music.listId,
          musicInfoId: music.id,
          order: music.order,
        })
      }
    }
  })()
}

/**
 * 批量移除列表内音乐
 * @param listId 列表id
 * @param ids 音乐id
 */
export const removeMusicInfos = (listId: string, ids: string[]) => {
  const musicInfoDeleteStatement = createMusicInfoDeleteStatement()
  const musicInfoOrderDeleteStatement = createMusicInfoOrderDeleteStatement()
  const db = getDB()
  db.transaction((listId: string, ids: string[]) => {
    for (const id of ids) {
      musicInfoDeleteStatement.run({ listId, id })
      musicInfoOrderDeleteStatement.run({ listId, id })
    }
  })(listId, ids)
}

/**
 * 清空列表内歌曲
 * @param listId 列表id
 */
export const removeMusicInfoByListId = (ids: string[]) => {
  const db = getDB()
  const musicInfoDeleteByListIdStatement = createMusicInfoDeleteByListIdStatement()
  const musicInfoOrderDeleteByListIdStatement = createMusicInfoOrderDeleteByListIdStatement()
  db.transaction((ids: string[]) => {
    for (const id of ids) {
      musicInfoDeleteByListIdStatement.run(id)
      musicInfoOrderDeleteByListIdStatement.run(id)
    }
  })(ids)
}

/**
 * 创建根据列表Id与音乐id查询音乐信息
 * @param listId 列表id
 * @param musicInfoId 音乐id
 * @returns
 */
export const queryMusicInfoByListIdAndMusicInfoId = (listId: string, musicInfoId: string) => {
  const musicInfoByListAndMusicInfoIdQueryStatement = createMusicInfoByListAndMusicInfoIdQueryStatement()
  return musicInfoByListAndMusicInfoIdQueryStatement.get({ listId, musicInfoId }) as LX.DBService.MusicInfo | null
}

/**
 * 创建根据音乐id查询所有列表的音乐信息
 * @param id 音乐id
 * @returns
 */
export const queryMusicInfoByMusicInfoId = (id: string) => {
  const musicInfoByMusicInfoIdQueryStatement = createMusicInfoByMusicInfoIdQueryStatement()
  return musicInfoByMusicInfoIdQueryStatement.all(id) as LX.DBService.MusicInfo[]
}

/**
 * 批量更新歌曲位置
 * 旧实现：清空列表全部 order 行后逐行重插（O(n) 写）。
 * 新实现：最小化更新——拖拽/置顶等多数场景仅平移受影响的连续区间；异常态回退旧逻辑。
 * @param listId 列表id
 * @param musicInfoOrders 音乐顺序
 */
export const updateMusicInfoOrder = (listId: string, musicInfoOrders: LX.DBService.MusicInfoOrder[]) => {
  const db = getDB()
  const musicInfoOrderInsertStatement = createMusicInfoOrderInsertStatement()
  const musicInfoOrderDeleteByListIdStatement = createMusicInfoOrderDeleteByListIdStatement()
  db.transaction(() => {
    if (applyListOrdersMinimal(listId, musicInfoOrders)) return
    musicInfoOrderDeleteByListIdStatement.run(listId)
    for (const orderInfo of musicInfoOrders) musicInfoOrderInsertStatement.run(orderInfo)
  })()
}

/**
 * 覆盖列表内的歌曲
 * @param listId 列表id
 * @param musicInfos 歌曲列表
 */
export const overwriteMusicInfo = (listId: string, musicInfos: LX.DBService.MusicInfo[]) => {
  const db = getDB()
  const musicInfoDeleteByListIdStatement = createMusicInfoDeleteByListIdStatement()
  const musicInfoOrderDeleteByListIdStatement = createMusicInfoOrderDeleteByListIdStatement()
  const musicInfoInsertStatement = createMusicInfoInsertStatement()
  const musicInfoOrderInsertStatement = createMusicInfoOrderInsertStatement()
  db.transaction((listId: string, musicInfos: LX.DBService.MusicInfo[]) => {
    musicInfoDeleteByListIdStatement.run(listId)
    musicInfoOrderDeleteByListIdStatement.run(listId)
    for (const musicInfo of musicInfos) {
      musicInfoInsertStatement.run(musicInfo)
      musicInfoOrderInsertStatement.run({
        listId: musicInfo.listId,
        musicInfoId: musicInfo.id,
        order: musicInfo.order,
      })
    }
  })(listId, musicInfos)
}

/**
 * 覆盖整个列表
 * @param lists 列表
 * @param musicInfos 歌曲列表
 */
export const overwriteListData = (lists: LX.DBService.UserListInfo[], musicInfos: LX.DBService.MusicInfo[]) => {
  const db = getDB()
  const listClearStatement = createListClearStatement()
  const listInsertStatement = createListInsertStatement()
  const musicInfoClearStatement = createMusicInfoClearStatement()
  const musicInfoInsertStatement = createMusicInfoInsertStatement()
  const musicInfoOrderClearStatement = createMusicInfoOrderClearStatement()
  const musicInfoOrderInsertStatement = createMusicInfoOrderInsertStatement()
  db.transaction((lists: LX.DBService.UserListInfo[], musicInfos: LX.DBService.MusicInfo[]) => {
    listClearStatement.run()
    for (const list of lists) {
      listInsertStatement.run({
        id: list.id,
        name: list.name,
        source: list.source,
        sourceListId: list.sourceListId,
        locationUpdateTime: list.locationUpdateTime,
        position: list.position,
      })
    }
    musicInfoClearStatement.run()
    musicInfoOrderClearStatement.run()
    for (const musicInfo of musicInfos) {
      musicInfoInsertStatement.run(musicInfo)
      musicInfoOrderInsertStatement.run({
        listId: musicInfo.listId,
        musicInfoId: musicInfo.id,
        order: musicInfo.order,
      })
    }
  })(lists, musicInfos)
}


/**
 * 获取列表内音乐的排序
 * @param listId 列表id
 * @param musicInfoId 音乐id
 * @returns 音乐排序信息
 */
export const getMusicInfoOrder = (listId: string, musicInfoId: string) => {
  const musicInfoOrderStatement = createMusicInfoOrderStatement()
  return musicInfoOrderStatement.get({ listId, musicInfoId })
}

