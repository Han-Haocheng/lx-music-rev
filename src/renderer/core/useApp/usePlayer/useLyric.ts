import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { debounce } from '@common/utils/common'
import {
  pause,
  play,
  setLyric,
  stop,
  init,
  sendInfo,
  setPlaybackRate,
} from '@renderer/core/lyric'
import { getLyricInfo } from '@renderer/core/music'
import { appSetting } from '@renderer/store/setting'
import { playMusicInfo } from '@renderer/store/player/state'
import { setMusicInfo } from '@renderer/store/player/action'

const handleApplyPlaybackRate = debounce(setPlaybackRate, 300)

// 简繁转换发生在取词层（core/music 的 buildLyricInfo），当前歌词为旧设置下的转换结果；
// 播放中切换 isS2t 时按当前设置重取当前歌曲歌词（DB 缓存/文件均为未转换原文，重取即重转），
// 再走切换歌曲时同一条刷新链路（store 歌词字段 + lyricUpdated 事件）即时刷新显示。
// version 计数丢弃过期结果：连续切换或期间切歌时仅应用最后一次请求
let lyricS2tFetchVersion = 0

export default () => {
  init()

  const setPlayInfo = () => {
    stop()
    sendInfo()
  }

  watch(() => appSetting['player.isShowLyricTranslation'], setLyric)
  watch(() => appSetting['player.isShowLyricRoma'], setLyric)
  watch(() => appSetting['player.isSwapLyricTranslationAndRoma'], setLyric)
  watch(() => appSetting['player.isPlayLxlrc'], setLyric)

  watch(() => appSetting['player.isS2t'], async() => {
    const musicInfo = playMusicInfo.musicInfo
    if (!musicInfo) return
    const version = ++lyricS2tFetchVersion
    try {
      const lyricInfo = await getLyricInfo({ musicInfo })
      // 期间设置再次变化或已切歌时丢弃本次结果
      if (version != lyricS2tFetchVersion || musicInfo.id != playMusicInfo.musicInfo?.id) return
      setMusicInfo({
        lrc: lyricInfo.lyric,
        tlrc: lyricInfo.tlyric,
        lxlrc: lyricInfo.lxlyric,
        rlrc: lyricInfo.rlyric,
        rawlrc: lyricInfo.rawlrcInfo.lyric,
      })
      window.app_event.lyricUpdated()
    } catch (err) {
      console.warn(err)
    }
  })

  window.app_event.on('play', play)
  window.app_event.on('pause', pause)
  window.app_event.on('stop', stop)
  window.app_event.on('error', pause)
  window.app_event.on('musicToggled', setPlayInfo)
  window.app_event.on('lyricUpdated', setLyric)
  window.app_event.on('setPlaybackRate', handleApplyPlaybackRate)

  onBeforeUnmount(() => {
    window.app_event.off('play', play)
    window.app_event.off('pause', pause)
    window.app_event.off('stop', stop)
    window.app_event.off('error', pause)
    window.app_event.off('musicToggled', setPlayInfo)
    window.app_event.off('lyricUpdated', setLyric)
    window.app_event.off('setPlaybackRate', handleApplyPlaybackRate)
  })
}
