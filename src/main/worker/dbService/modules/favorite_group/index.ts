import {
  queryFavoriteGroups,
  insertFavoriteGroups,
  updateFavoriteGroup,
  deleteFavoriteGroup,
  queryGroupMusics,
  queryMusicGroupIds,
  updateMusicGroups,
  deleteMusicGroupRowsByMusicInfoIds,
  clearAllMusicGroupRows,
  queryGroupSource,
  upsertGroupSource,
  migrateLoveOrphans,
  syncGroupMusics,
} from './dbHelper'

/** 获取全部收藏分组 */
export const favoriteGroupGet = (): LX.DBService.FavoriteGroupInfo[] => {
  return queryFavoriteGroups()
}

/** 新建收藏分组（追加到末尾） */
export const favoriteGroupAdd = (name: string, id: string) => {
  const groups = queryFavoriteGroups()
  insertFavoriteGroups([{ id, name, position: groups.length }])
}

/** 重命名收藏分组 */
export const favoriteGroupUpdate = (id: string, name: string) => {
  const group = queryFavoriteGroups().find(item => item.id == id)
  if (!group) return
  updateFavoriteGroup({ ...group, name })
}

/** 删除收藏分组（清空组内映射与来源标记；组内歌曲不再属于任何分组时从 LOVE 一并移出） */
export const favoriteGroupRemove = (id: string) => {
  deleteFavoriteGroup(id)
}

/** LOVE 孤儿歌曲迁移：归入默认兜底收藏夹；返回归组歌曲数（0 = 无孤儿） */
export const favoriteGroupOrphanMigrate = (name: string): number => {
  return migrateLoveOrphans(name)
}

/** 获取某首歌归属的分组 id 列表 */
export const favoriteGroupMusicGet = (musicInfoId: string): string[] => {
  return queryMusicGroupIds(musicInfoId)
}

/** 设置某首歌归属的分组（全量替换） */
export const favoriteGroupMusicSet = (musicInfoId: string, groupIds: string[]) => {
  updateMusicGroups(musicInfoId, groupIds)
}

/** 获取某分组的歌曲 id 列表 */
export const favoriteGroupMusicListGet = (groupId: string): string[] => {
  return queryGroupMusics(groupId)
}

/** 批量删除歌曲的收藏分组映射（歌曲离开 LOVE 列表时由列表模块调用，防止孤儿映射） */
export const favoriteGroupMusicRowsRemove = (musicInfoIds: string[]) => {
  deleteMusicGroupRowsByMusicInfoIds(musicInfoIds)
}

/** 清空全部收藏分组映射（LOVE 列表被整表清空时由列表模块调用） */
export const favoriteGroupMusicRowsClearAll = () => {
  clearAllMusicGroupRows()
}

/** 获取分组的来源标记（无来源返回 null） */
export const favoriteGroupSourceGet = (groupId: string): LX.DBService.FavoriteGroupSource | null => {
  return queryGroupSource(groupId) ?? null
}

/** 设置分组的来源标记（远端歌单收藏/手动绑定） */
export const favoriteGroupSourceSet = (groupId: string, source: string, sourceListId: string) => {
  upsertGroupSource({ groupId, source, sourceListId, locationUpdateTime: null })
}

/** 与远程源同步分组歌曲（覆盖语义） */
export const favoriteGroupSyncMusics = (groupId: string, musicInfos: LX.Music.MusicInfo[]) => {
  syncGroupMusics(groupId, musicInfos)
}
