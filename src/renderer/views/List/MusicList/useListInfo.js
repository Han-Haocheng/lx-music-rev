import { ref, watch, computed, onBeforeUnmount } from '@common/utils/vueTools'
import { playMusicInfo, playInfo } from '@renderer/store/player/state'
import { getListMusics } from '@renderer/store/list/action'
import { appSetting } from '@renderer/store/setting'
import { perfMark, perfMeasure } from '@common/utils/common'


export default ({ props, onLoadedList }) => {
  const rightClickSelectedIndex = ref(-1)
  const selectedIndex = ref(-1)
  const dom_listContent = ref(null)
  const listRef = ref(null)

  const excludeListIds = computed(() => ([props.listId]))


  const list = ref([])
  const handleListIdChange = id => {
    if (props.musicList) return
    getListMusics(id).then(l => {
      if (id != props.listId || props.musicList) return // 期间已切换目标或已切到 musicList 模式则丢弃
      perfMeasure('1. 路由→数据就绪（IPC/缓存）', 'switch:route')
      perfMark('switch:dataReady')
      list.value = [...l]
      perfMeasure('2. 数据→列表赋值（浅拷贝）', 'switch:dataReady')
      perfMark('switch:assigned')
      onLoadedList()
      perfMeasure('3. 赋值→onLoadedList（滚动恢复）', 'switch:assigned')
    })
  }
  // music-list 模式（收藏分组视图/外部传入列表）
  watch(() => props.musicList, l => {
    if (l) {
      list.value = [...l]
      onLoadedList()
      return
    }
    handleListIdChange(props.listId)
  }, { immediate: true })
  // list-id 模式（主列表页/收藏全部）
  watch(() => props.listId, id => {
    if (props.musicList) return
    perfMark('switch:route')
    handleListIdChange(id)
  })

  const playerInfo = computed(() => ({
    isPlayList: playMusicInfo.listId == props.listId,
    playIndex: playInfo.playIndex,
  }))

  const setSelectedIndex = index => {
    selectedIndex.value = index
  }

  const isShowSource = computed(() => appSetting['list.isShowSource'])

  const handleMyListUpdate = (ids) => {
    if (!ids.includes(props.listId)) return
    getListMusics(props.listId).then(l => {
      list.value = [...l]
    })
  }

  window.app_event.on('myListUpdate', handleMyListUpdate)

  onBeforeUnmount(() => {
    window.app_event.off('myListUpdate', handleMyListUpdate)
  })

  return {
    rightClickSelectedIndex,
    selectedIndex,
    dom_listContent,
    listRef,
    list,
    playerInfo,
    setSelectedIndex,
    isShowSource,
    excludeListIds,
  }
}
