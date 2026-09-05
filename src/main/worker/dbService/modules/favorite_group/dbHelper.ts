import { getDB } from '../../db'
import {
  createQueryGroupsStatement,
  createInsertGroupStatement,
  createUpdateGroupStatement,
  createDeleteGroupStatement,
  createDeleteGroupMusicsStatement,
  createQueryGroupMusicsStatement,
  createQueryMusicGroupIdsStatement,
  createDeleteMusicGroupStatement,
  createInsertGroupMusicStatement,
  createDeleteMusicGroupRowsByMusicInfoIdStatement,
  createClearMusicGroupRowsStatement,
  createQueryGroupSourceStatement,
  createInsertGroupSourceStatement,
  createUpdateGroupSourceStatement,
  createDeleteGroupSourceStatement,
  createLoveMusicInfoQueryStatement,
  createLoveMusicInfoInsertStatement,
  createLoveMusicInfoOrderInsertStatement,
  createLoveMaxOrderQueryStatement,
  createLoveMusicInfoDeleteStatement,
  createLoveMusicInfoOrderDeleteStatement,
} from './statements'

export const queryFavoriteGroups = (): LX.DBService.FavoriteGroupInfo[] => {
  return createQueryGroupsStatement().all() as LX.DBService.FavoriteGroupInfo[]
}

export const insertFavoriteGroups = (groups: LX.DBService.FavoriteGroupInfo[]) => {
  const db = getDB()
  const insertStatement = createInsertGroupStatement()
  db.transaction((groups: LX.DBService.FavoriteGroupInfo[]) => {
    for (const group of groups) insertStatement.run(group)
  })(groups)
}

export const updateFavoriteGroup = (group: LX.DBService.FavoriteGroupInfo) => {
  createUpdateGroupStatement().run(group)
}

export const deleteFavoriteGroup = (id: string) => {
  const db = getDB()
  db.transaction((id: string) => {
    createDeleteGroupStatement().run(id)
    createDeleteGroupMusicsStatement().run(id)
    createDeleteGroupSourceStatement().run(id)
  })(id)
}

export const queryGroupMusics = (groupId: string): string[] => {
  const rows = createQueryGroupMusicsStatement().all(groupId) as Array<{ musicInfoId: string }>
  return rows.map(row => row.musicInfoId)
}

export const queryMusicGroupIds = (musicInfoId: string): string[] => {
  const rows = createQueryMusicGroupIdsStatement().all(musicInfoId) as Array<{ groupId: string }>
  return rows.map(row => row.groupId)
}

/** 全量替换某首歌的归属分组 */
export const updateMusicGroups = (musicInfoId: string, groupIds: string[]) => {
  const db = getDB()
  const deleteStatement = createDeleteMusicGroupStatement()
  const insertStatement = createInsertGroupMusicStatement()
  db.transaction(({ musicInfoId, groupIds }: { musicInfoId: string, groupIds: string[] }) => {
    const existed = createQueryMusicGroupIdsStatement().all(musicInfoId) as Array<{ groupId: string }>
    for (const row of existed) {
      deleteStatement.run({ groupId: row.groupId, musicInfoId })
    }
    for (const groupId of groupIds) {
      insertStatement.run({ groupId, musicInfoId })
    }
  })({ musicInfoId, groupIds })
}

/** 批量删除多首歌曲的收藏分组映射行（歌曲离开 LOVE 列表时清理，防止孤儿映射） */
export const deleteMusicGroupRowsByMusicInfoIds = (ids: string[]) => {
  const db = getDB()
  const deleteStatement = createDeleteMusicGroupRowsByMusicInfoIdStatement()
  db.transaction((ids: string[]) => {
    for (const id of ids) deleteStatement.run(id)
  })(ids)
}

/** 清空全部收藏分组映射行（LOVE 列表被整表清空时调用，此时所有映射失效） */
export const clearAllMusicGroupRows = () => {
  createClearMusicGroupRowsStatement().run()
}

export const queryGroupSource = (groupId: string): LX.DBService.FavoriteGroupSource | undefined => {
  return createQueryGroupSourceStatement().get(groupId)
}

export const upsertGroupSource = (info: LX.DBService.FavoriteGroupSource) => {
  const existed = createQueryGroupSourceStatement().get(info.groupId)
  if (existed) createUpdateGroupSourceStatement().run(info)
  else createInsertGroupSourceStatement().run(info)
}

export const deleteGroupSource = (groupId: string) => {
  createDeleteGroupSourceStatement().run(groupId)
}

/** 与远程源同步分组：覆盖语义（组内全部歌曲替换为源歌单内容，含手动添加的歌曲） */
export const syncGroupMusics = (groupId: string, musicInfos: LX.Music.MusicInfo[]) => {
  const db = getDB()
  const oldIds = queryGroupMusics(groupId)
  const groupMusicDeleteStatement = createDeleteGroupMusicsStatement()
  const loveMusicQueryStatement = createLoveMusicInfoQueryStatement()
  const loveMusicInsertStatement = createLoveMusicInfoInsertStatement()
  const loveOrderInsertStatement = createLoveMusicInfoOrderInsertStatement()
  const loveMaxOrderQueryStatement = createLoveMaxOrderQueryStatement()
  const loveMusicDeleteStatement = createLoveMusicInfoDeleteStatement()
  const loveOrderDeleteStatement = createLoveMusicInfoOrderDeleteStatement()
  const groupMusicInsertStatement = createInsertGroupMusicStatement()
  db.transaction((groupId: string, musicInfos: LX.Music.MusicInfo[]) => {
    // 1. 旧组歌曲：若非其它组共有则从 LOVE 移除（覆盖：手动添加的也一并清除）；组映射全部清空
    for (const id of oldIds) {
      const otherGroups = queryMusicGroupIds(id).filter(g => g != groupId)
      if (!otherGroups.length) {
        loveMusicDeleteStatement.run(id)
        loveOrderDeleteStatement.run(id)
      }
    }
    groupMusicDeleteStatement.run(groupId)
    // 2. 写入源歌单歌曲到 LOVE 并按顺序归组
    let maxOrder = (loveMaxOrderQueryStatement.get() as { m: number | null }).m ?? -1
    for (const mi of musicInfos) {
      if (!loveMusicQueryStatement.get(mi.id)) {
        maxOrder += 1
        const record: LX.DBService.MusicInfo = { id: mi.id, listId: 'love', name: mi.name, singer: mi.singer, source: mi.source, interval: mi.interval ?? null, meta: JSON.stringify(mi.meta), order: maxOrder }
        loveMusicInsertStatement.run(record)
        loveOrderInsertStatement.run({ listId: 'love', musicInfoId: mi.id, order: maxOrder })
      }
      groupMusicInsertStatement.run({ groupId, musicInfoId: mi.id })
    }
  })(groupId, musicInfos)
}
