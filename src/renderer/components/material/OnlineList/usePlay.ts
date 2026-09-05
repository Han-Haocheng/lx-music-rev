// import { useCommit } from '@common/utils/vueTools'
import { addTempPlayList } from '@renderer/store/player/action'
import { type Ref } from '@common/utils/vueTools'
import { playList } from '@renderer/core/player'
import { LIST_IDS } from '@common/constants'

export default ({ selectedList, props, removeAllSelect }: {
  selectedList: Ref<LX.Music.MusicInfoOnline[]>
  props: {
    list: LX.Music.MusicInfoOnline[]
  }
  removeAllSelect: () => void
}) => {
  let clickTime = 0
  let clickIndex = -1

  // 播放列表是独立会话队列：点歌即把当前在线列表固化为队列并播放（不再写入试听列表）；
  // 上下曲/队列操作只作用于该会话队列，与试听/收藏等持久列表解耦
  const handlePlayMusic = async(index: number, single: boolean) => {
    if (!props.list.length) return
    if (selectedList.value.length && !single) removeAllSelect()
    playList(LIST_IDS.PLAY_SESSION, index, props.list)
  }

  const handlePlayMusicLater = (index: number, single: boolean) => {
    if (selectedList.value.length && !single) {
      addTempPlayList(selectedList.value.map(s => ({ listId: LIST_IDS.PLAY_LATER, musicInfo: s })))
      removeAllSelect()
    } else {
      addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo: props.list[index] }])
    }
  }

  const doubleClickPlay = (index: number) => {
    if (
      window.performance.now() - clickTime > 400 ||
      clickIndex !== index
    ) {
      clickTime = window.performance.now()
      clickIndex = index
      return
    }
    void handlePlayMusic(index, true)
    clickTime = 0
    clickIndex = -1
  }

  return {
    handlePlayMusic,
    handlePlayMusicLater,
    doubleClickPlay,
  }
}
