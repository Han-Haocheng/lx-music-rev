import { getPlayInfo, getPlayQueueBundle } from '@renderer/utils/ipc'
import music from '@renderer/utils/musicSdk'
import { log } from '@common/utils'
import { getListMusics, getUserLists, registerAction } from '@renderer/store/list/action'
import { LIST_IDS } from '@common/constants'


import useInitUserApi from './useInitUserApi'
import { play, playList } from '@renderer/core/player'
import { onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { playMusicInfo } from '@renderer/store/player/state'
import { initDislikeInfo, registerRemoteDislikeAction } from '@renderer/core/dislikeList'

const initPrevPlayInfo = async() => {
  const info = await getPlayInfo()
  window.lx.restorePlayInfo = null
  if (!info?.listId || info.index < 0) return
  // 会话播放队列（歌单/收藏夹分组/在线列表等任何来源）随播放持久化到 playQueue 数据键，
  // 重启时优先按该快照完整恢复（含来源列表 id 与歌曲清单）；
  // 无快照时仅真实持久列表（本地音乐/旧用户列表等）可按整表恢复，会话/收藏池不回退整表
  const bundle = await getPlayQueueBundle()
  if (bundle && bundle.playerListId == info.listId && bundle.list.length > 0 && bundle.list[info.index]) {
    window.lx.restorePlayInfo = info
    playList(info.listId, info.index, bundle.list)
  } else {
    if (info.listId == LIST_IDS.PLAY_SESSION || info.listId == LIST_IDS.LOVE) return
    const list = await getListMusics(info.listId)
    if (!list[info.index]) return
    window.lx.restorePlayInfo = info
    playList(info.listId, info.index)
  }

  if (appSetting['player.startupAutoPlay']) {
    const musicInfo = playMusicInfo.musicInfo
    if (!musicInfo) return
    setTimeout(() => {
      if (musicInfo.id == playMusicInfo.musicInfo?.id) play()
    })
  }
}

export default () => {
  const initUserApi = useInitUserApi()

  let unregister: null | (() => void) = null
  let unregisterDislikeEvent: null | (() => void) = null

  onBeforeUnmount(() => {
    if (unregister) unregister()
    if (unregisterDislikeEvent) unregisterDislikeEvent()
  })

  return async() => {
    await Promise.all([
      initUserApi(), // 自定义API
    ]).catch(err => {
      log.error(err)
    })
    void music.init() // 初始化音乐sdk
    unregister = registerAction((ids) => {
      window.app_event.myListUpdate(ids)
    })
    window.lxData.userLists = await getUserLists() // 获取用户列表
    unregisterDislikeEvent = registerRemoteDislikeAction()
    await initDislikeInfo() // 获取不喜欢列表
    await initPrevPlayInfo().catch(err => {
      log.error(err)
    }) // 初始化上次的歌曲播放信息
  }
}
