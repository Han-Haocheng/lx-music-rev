import { onBeforeUnmount } from '@common/utils/vueTools'
import {
  onPlaying,
  onPause,
  onEnded,
  onError,
  onLoadeddata,
  onLoadstart,
  onCanplay,
  onEmptied,
  onWaiting,
  getErrorCode,
} from '@renderer/plugins/player'


export default () => {
  const rOnPlaying = onPlaying(() => {
    window.app_event.playerPlaying()
    window.app_event.play()
  })
  const rOnPause = onPause(() => {
    window.app_event.playerPause()
    window.app_event.pause()
  })
  const rOnEnded = onEnded(() => {
    window.app_event.playerEnded()
    // window.app_event.pause()
  })
  const rOnError = onError(() => {
    const errorCode = getErrorCode()
    window.app_event.error(errorCode)
    window.app_event.playerError(errorCode)
  })
  const rOnLoadeddata = onLoadeddata(() => {
    window.app_event.playerLoadeddata()
  })
  const rOnLoadstart = onLoadstart(() => {
    window.app_event.playerLoadstart()
  })
  const rOnCanplay = onCanplay(() => {
    window.app_event.playerCanplay()
  })
  const rOnEmptied = onEmptied(() => {
    window.app_event.playerEmptied()
    // window.app_event.stop()
  })
  const rOnWaiting = onWaiting(() => {
    window.app_event.pause()
    window.app_event.playerWaiting()
  })


  onBeforeUnmount(() => {
    rOnPlaying()
    rOnPause()
    rOnEnded()
    rOnError()
    rOnLoadeddata()
    rOnLoadstart()
    rOnCanplay()
    rOnEmptied()
    rOnWaiting()
  })
}
