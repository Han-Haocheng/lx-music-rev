import { reactive } from '@common/utils/vueTools'
import { rendererInvoke } from '@common/rendererIpc'
import { PLAYER_EVENT_NAME } from '@common/ipcNames'
import { FAVORITE_GROUP_DEFAULT_ID } from '@common/constants'
import { getListDetailAll as getSongListDetail } from '@renderer/store/songList/action'
import { getListDetailAll as getBoardListDetail } from '@renderer/store/leaderboard/action'

export interface FavoriteGroupInfo {
  id: string
  name: string
  position: number
  /** 来源标记：非空表示该分组来自远端歌单（可「与源同步」） */
  source?: LX.OnlineSource
  sourceListId?: string
  locationUpdateTime?: number | null
}

export const favoriteGroups = reactive<FavoriteGroupInfo[]>([])

const groupMusicsCache = new Map<string, string[]>()

const groupSourcesCache = new Map<string, { source: string, sourceListId: string }>()

export const initFavoriteGroups = async() => {
  const groups = await rendererInvoke<FavoriteGroupInfo[]>(PLAYER_EVENT_NAME.favorite_group_get)
  favoriteGroups.splice(0, favoriteGroups.length, ...groups)
  // 拉取分组来源标记（远端歌单收藏分组的「与源同步」依据）；
  // 单个分组查询失败（如主进程 handler 缺失的旧版本）仅跳过该组，不阻塞收藏页加载
  groupSourcesCache.clear()
  await Promise.all(favoriteGroups.map(async(group) => {
    try {
      const info = await rendererInvoke<string, { source: string, sourceListId: string } | null>(PLAYER_EVENT_NAME.favorite_group_source_get, group.id)
      if (info) {
        group.source = info.source as LX.OnlineSource
        group.sourceListId = info.sourceListId
        groupSourcesCache.set(group.id, info)
      }
    } catch (err) {
      console.warn('[favoriteGroup] 拉取分组来源失败，跳过:', err)
    }
  }))
}

export const addFavoriteGroup = async(name: string, source?: LX.OnlineSource, sourceListId?: string): Promise<string> => {
  const id = `favgroup_${Date.now()}`
  await rendererInvoke(PLAYER_EVENT_NAME.favorite_group_add, { name, id })
  const group: FavoriteGroupInfo = { id, name, position: favoriteGroups.length }
  if (source && sourceListId) {
    group.source = source
    group.sourceListId = sourceListId
    await rendererInvoke(PLAYER_EVENT_NAME.favorite_group_source_set, { groupId: id, source, sourceListId })
    groupSourcesCache.set(id, { source, sourceListId })
  }
  favoriteGroups.push(group)
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
  groupSourcesCache.delete(id)
}

/** 设置分组的来源标记（如歌单收藏：source / sourceListId） */
export const setFavoriteGroupSource = async(groupId: string, source: LX.OnlineSource, sourceListId: string) => {
  await rendererInvoke(PLAYER_EVENT_NAME.favorite_group_source_set, { groupId, source, sourceListId })
  const group = favoriteGroups.find(g => g.id == groupId)
  if (group) {
    group.source = source
    group.sourceListId = sourceListId
  }
  groupSourcesCache.set(groupId, { source, sourceListId })
}

/** 与远程源同步分组：拉取源歌单最新歌曲并覆盖组内歌曲（覆盖语义，含手动添加的歌曲） */
export const syncFavoriteGroup = async(groupId: string): Promise<number> => {
  const group = favoriteGroups.find(g => g.id == groupId)
  const source = group?.source
  const sourceListId = group?.sourceListId
  if (!source || !sourceListId) throw new Error('group has no source: ' + groupId)
  const list = /^board__/.test(sourceListId)
    ? await getBoardListDetail(sourceListId.replace(/^board__/, ''), true)
    : await getSongListDetail(sourceListId, source, true)
  if (!list.length) throw new Error('empty source list: ' + sourceListId)
  await rendererInvoke(PLAYER_EVENT_NAME.favorite_group_sync_musics, { groupId, musicInfos: list })
  clearGroupMusicsCache(groupId)
  if (group) group.locationUpdateTime = Date.now()
  return list.length
}

/** 默认兜底收藏夹 id：LOVE 孤儿歌曲自动归入（用户可改名/删除，删除后若再出现孤儿会按此 id 重建） */
export { FAVORITE_GROUP_DEFAULT_ID }

/** LOVE 孤儿歌曲迁移：归入默认兜底收藏夹（返回归组歌曲数，0 = 无孤儿） */
export const migrateOrphanMusics = async(name: string): Promise<number> => {
  return rendererInvoke<string, number>(PLAYER_EVENT_NAME.favorite_group_orphan_migrate, name)
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
