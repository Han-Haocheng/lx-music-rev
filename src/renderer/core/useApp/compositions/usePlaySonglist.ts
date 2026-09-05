import { playList } from '@renderer/core/player'
import { setTempList } from '@renderer/store/list/action'
import { tempListMeta } from '@renderer/store/list/state'
import { LIST_IDS } from '@common/constants'
import { getListDetail, getListDetailAll } from '@renderer/store/songList/action'

const getListPlayIndex = (list: LX.Music.MusicInfoOnline[], index?: number) => {
  if (index == null) {
    index = 1
  } else {
    if (index < 1) index = 1
    else if (index > list.length) index = list.length
  }
  return index - 1
}

export default () => {
  const playSongListDetail = async(source: LX.OnlineSource, link: string, playIndex?: number) => {
    // console.log(source, link, playIndex)
    if (link == null) return
    let isPlayingList = false
    const id = decodeURIComponent(link)
    const playListId = `${source}__${decodeURIComponent(link)}`
    let list = (await getListDetail(id, source, 1)).list
    if (playIndex == null || list.length > playIndex) {
      isPlayingList = true
      await setTempList(playListId, list)
      // 播放列表是独立会话队列：歌单内容即队列（temp 表保留写入仅作兼容，队列不依赖它）
      playList(LIST_IDS.PLAY_SESSION, getListPlayIndex(list, playIndex), list)
    }
    list = await getListDetailAll(id, source)
    if (isPlayingList) {
      if (tempListMeta.id == playListId) await setTempList(playListId, list)
    } else {
      await setTempList(playListId, list)
      playList(LIST_IDS.PLAY_SESSION, getListPlayIndex(list, playIndex), list)
    }
  }

  return async(source: LX.OnlineSource, link: string, playIndex?: number) => {
    try {
      await playSongListDetail(source, link, playIndex)
    } catch (err) {
      console.error(err)
      throw new Error('Get play list failed.')
    }
  }
}
