import { getDB } from '../../db'
import { FAVORITE_GROUP_DEFAULT_ID } from '@common/constants'
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
  createQueryLoveOrphanIdsStatement,
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
    // 收藏夹=容器语义：先捕获组内歌曲，组映射清空后再不属于任何收藏夹的歌曲从 LOVE 一并移出
    const memberIds = queryGroupMusics(id)
    createDeleteGroupStatement().run(id)
    createDeleteGroupMusicsStatement().run(id)
    createDeleteGroupSourceStatement().run(id)
    const groupIdsQuery = createQueryMusicGroupIdsStatement()
    const loveDelete = createLoveMusicInfoDeleteStatement()
    const loveOrderDelete = createLoveMusicInfoOrderDeleteStatement()
    for (const musicInfoId of memberIds) {
      if (!groupIdsQuery.all(musicInfoId).length) {
        loveDelete.run(musicInfoId)
        loveOrderDelete.run(musicInfoId)
      }
    }
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

/** 全量替换某首歌的归属分组；歌曲在 LOVE 中且不归属任何分组 = 取消收藏（一并移出 LOVE），避免无容器孤儿歌曲 */
export const updateMusicGroups = (musicInfoId: string, groupIds: string[]) => {
  const db = getDB()
  const deleteStatement = createDeleteMusicGroupStatement()
  const insertStatement = createInsertGroupMusicStatement()
  const loveQuery = createLoveMusicInfoQueryStatement()
  const loveDelete = createLoveMusicInfoDeleteStatement()
  const loveOrderDelete = createLoveMusicInfoOrderDeleteStatement()
  db.transaction(({ musicInfoId, groupIds }: { musicInfoId: string, groupIds: string[] }) => {
    const existed = createQueryMusicGroupIdsStatement().all(musicInfoId) as Array<{ groupId: string }>
    for (const row of existed) {
      deleteStatement.run({ groupId: row.groupId, musicInfoId })
    }
    if (!groupIds.length && loveQuery.get(musicInfoId)) {
      loveDelete.run(musicInfoId)
      loveOrderDelete.run(musicInfoId)
      return
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

/** 查询 LOVE 中未归任何收藏分组的歌曲 id（历史存量/整库恢复残留，即「无容器」歌曲） */
export const queryLoveOrphanIds = (): string[] => {
  const rows = createQueryLoveOrphanIdsStatement().all() as Array<{ musicInfoId: string }>
  return rows.map(row => row.musicInfoId)
}

/** 孤儿歌曲迁移：归入默认兜底收藏夹（id 固定 FAVORITE_GROUP_DEFAULT_ID，用户可改名/删除）；返回归组歌曲数 */
export const migrateLoveOrphans = (name: string): number => {
  const orphanIds = queryLoveOrphanIds()
  if (!orphanIds.length) return 0
  const db = getDB()
  return db.transaction((name: string): number => {
    const groups = queryFavoriteGroups()
    if (!groups.some(g => g.id == FAVORITE_GROUP_DEFAULT_ID)) {
      createInsertGroupStatement().run({ id: FAVORITE_GROUP_DEFAULT_ID, name, position: groups.length })
    }
    const insertGroupMusic = createInsertGroupMusicStatement()
    for (const musicInfoId of orphanIds) {
      insertGroupMusic.run({ groupId: FAVORITE_GROUP_DEFAULT_ID, musicInfoId })
    }
    return orphanIds.length
  })(name)
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
