import { toRaw, markRawList } from '@common/utils/vueTools'
// import { qualityList } from '@renderer/store'
import { clearPlayedList } from '@renderer/store/player/action'
import { appSetting } from '@renderer/store/setting'
import { dislikeInfo } from '@renderer/store/dislikeList'
import { setPowerSaveBlocker as setPowerSaveBlockerRemote } from '@renderer/utils/ipc'
import type { FilterMusicListItem, FilterMusicPlayedListItem } from '@renderer/worker/main/list'

// export const getPlayType = (highQuality: boolean, musicInfo: LX.Music.MusicInfo | LX.Download.ListItem): LX.Quality | null => {
//   if ('progress' in musicInfo || musicInfo.source == 'local') return null
//   let type: LX.Quality = '128k'
//   let list = qualityList.value[musicInfo.source]
//   if (highQuality && musicInfo.meta._qualitys['320k'] && list?.includes('320k')) type = '320k'
//   return type
// }

/**
 * 构建跨 worker 传输的最小化列表项载荷（入参为 toRaw 后的原列表项）
 * 仅包含 worker 侧判定所需的字段（id/name/singer/isComplate 与类型标记），
 * 避免大列表切歌时整列表结构化克隆
 */
const createFilterListItem = (info: LX.Music.MusicInfo | LX.Download.ListItem): FilterMusicListItem => 'progress' in info
  ? { type: 'download', id: info.id, isComplate: info.isComplate }
  : { type: 'music', id: info.id, name: info.name, singer: info.singer }

/**
 * 过滤列表中已播放的歌曲
 */
export const filterList = async({ playedList, listId, list, playerMusicInfo, isNext }: {
  playedList: LX.Player.PlayMusicInfo[]
  listId: string
  list: Array<LX.Music.MusicInfo | LX.Download.ListItem>
  playerMusicInfo?: LX.Music.MusicInfo | LX.Download.ListItem
  isNext: boolean
}) => {
  // if (this.list.listName === null) return
  // console.log(isCheckFile)
  // 调用前固化原始列表快照，worker 返回下标后据此按下标映射回完整对象（与旧实现均基于调用时快照）
  const rawList = list.map(m => toRaw(m))
  let { filteredList, canPlayList, playerIndex } = await window.lx.worker.main.filterMusicList({
    listId,
    list: rawList.map(createFilterListItem),
    playedList: playedList.map(({ listId, isTempPlay, musicInfo }): FilterMusicPlayedListItem => ({ listId, isTempPlay, musicInfoId: musicInfo.id })),
    // savePath: appSetting['download.savePath'],
    playerMusicInfo: playerMusicInfo ? { id: playerMusicInfo.id } : undefined,
    dislikeInfo: { names: toRaw(dislikeInfo.names), musicNames: toRaw(dislikeInfo.musicNames), singerNames: toRaw(dislikeInfo.singerNames) },
    isNext,
  })

  // worker 返回原列表下标，按快照映射回完整对象并克隆，
  // 与旧实现（worker 返回结构化克隆副本）保持行为等价
  const mapList = (indexes: number[]) => indexes.map(index => structuredClone(rawList[index]))
  if (!filteredList.length && playedList.length) {
    clearPlayedList()
    return { filteredList: markRawList(mapList(canPlayList)), playerIndex }
  }
  return { filteredList: markRawList(mapList(filteredList)), playerIndex }
}

let timeout: NodeJS.Timeout | null = null
const clearTimer = () => {
  if (!timeout) return
  clearTimeout(timeout)
  timeout = null
}
export const setPowerSaveBlocker = (enabled: boolean, force = false) => {
  if (enabled) {
    clearTimer()
    if (!force && !appSetting['player.powerSaveBlocker']) return
    setPowerSaveBlockerRemote(true)
  } else if (force) {
    clearTimer()
    setPowerSaveBlockerRemote(false)
  } else {
    if (timeout) return
    timeout = setTimeout(() => {
      setPowerSaveBlockerRemote(false)
    }, 60_000 * 1.5)
  }
}
