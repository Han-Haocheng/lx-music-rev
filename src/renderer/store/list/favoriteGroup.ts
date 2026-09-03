import { reactive } from '@common/utils/vueTools'
import { rendererInvoke } from '@common/rendererIpc'
import { PLAYER_EVENT_NAME } from '@common/ipcNames'

export interface FavoriteGroupInfo {
  id: string
  name: string
  position: number
}

export const favoriteGroups = reactive<FavoriteGroupInfo[]>([])

const groupMusicsCache = new Map<string, string[]>()

export const initFavoriteGroups = async() => {
  const groups = await rendererInvoke<FavoriteGroupInfo[]>(PLAYER_EVENT_NAME.favorite_group_get)
  favoriteGroups.splice(0, favoriteGroups.length, ...groups)
}

export const addFavoriteGroup = async(name: string): Promise<string> => {
  const id = `favgroup_${Date.now()}`
  await rendererInvoke(PLAYER_EVENT_NAME.favorite_group_add, { name, id })
  favoriteGroups.push({ id, name, position: favoriteGroups.length })
  return id
}

export const updateFavoriteGroup = async(id: string, name: string) => {
  await rendererInvoke(PLAYER_EVENT_NAME.favorite_group_update, { id, name })
  const group = favoriteGroups.find(g => g.id == id)
  if (group) group.name = name
}

export const removeFavoriteGroup = async(id: string) => {
  await rendererInvoke(PLAYER_EVENT_NAME.favorite_group_remove, { id })
  const index = favoriteGroups.findIndex(g => g.id == id)
  if (index > -1) favoriteGroups.splice(index, 1)
  groupMusicsCache.delete(id)
}

/** 获取某首歌归属的分组 id 列表 */
export const getMusicGroupIds = async(musicInfoId: string): Promise<string[]> => {
  return rendererInvoke<string, string[]>(PLAYER_EVENT_NAME.favorite_group_music_get, musicInfoId)
}

/** 设置某首歌归属的分组（全量替换） */
export const setMusicGroupIds = async(musicInfoId: string, groupIds: string[]) => {
  await rendererInvoke(PLAYER_EVENT_NAME.favorite_group_music_set, { musicInfoId, groupIds })
  for (const [groupId, ids] of groupMusicsCache) {
    const set = new Set(ids)
    if (groupIds.includes(groupId)) {
      if (!set.has(musicInfoId)) set.add(musicInfoId)
    } else {
      set.delete(musicInfoId)
    }
    groupMusicsCache.set(groupId, Array.from(set))
  }
}

/** 获取某分组的歌曲 id 列表（带缓存） */
export const getGroupMusics = async(groupId: string): Promise<string[]> => {
  if (groupMusicsCache.has(groupId)) return groupMusicsCache.get(groupId)!
  const ids = await rendererInvoke<string, string[]>(PLAYER_EVENT_NAME.favorite_group_music_list_get, groupId)
  groupMusicsCache.set(groupId, ids)
  return ids
}

export const clearGroupMusicsCache = (groupId?: string) => {
  if (groupId) {
    groupMusicsCache.delete(groupId)
  } else {
    groupMusicsCache.clear()
  }
}
