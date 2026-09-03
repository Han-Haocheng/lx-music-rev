import { ref, computed, onBeforeUnmount } from '@common/utils/vueTools'
import { playMusicInfo } from '@renderer/store/player/state'
import { collectMusic, uncollectMusic } from '@renderer/core/player'
import { getListMusicsFromCache } from '@renderer/store/list/action'
import { loveList } from '@renderer/store/list/state'

export default () => {
  const loveListMusics = ref(getListMusicsFromCache(loveList.id))

  const isLoved = computed(() => {
    const musicInfo = playMusicInfo.musicInfo
    if (!musicInfo) return false
    const id = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.id : musicInfo.id
    return loveListMusics.value.some(item => item.id == id)
  })

  const handleMyListUpdate = (ids) => {
    if (!ids.includes(loveList.id)) return
    loveListMusics.value = getListMusicsFromCache(loveList.id)
  }

  window.app_event.on('myListUpdate', handleMyListUpdate)

  onBeforeUnmount(() => {
    window.app_event.off('myListUpdate', handleMyListUpdate)
  })

  const toggleLove = () => {
    if (!playMusicInfo.musicInfo) return
    if (isLoved.value) {
      uncollectMusic()
    } else {
      collectMusic()
    }
  }

  return {
    isLoved,
    toggleLove,
  }
}
