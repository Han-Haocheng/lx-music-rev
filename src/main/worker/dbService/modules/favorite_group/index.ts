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

/** 删除收藏分组（连带清空组内歌曲映射） */
export const favoriteGroupRemove = (id: string) => {
  deleteFavoriteGroup(id)
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
