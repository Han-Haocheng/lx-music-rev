import { ref, watch, computed, onBeforeUnmount } from '@common/utils/vueTools'
import { playMusicInfo } from '@renderer/store/player/state'
import { getListMusics } from '@renderer/store/list/action'
import { appSetting } from '@renderer/store/setting'


export default ({ props, onLoadedList }) => {
  const rightClickSelectedIndex = ref(-1)
  const selectedIndex = ref(-1)
  const dom_listContent = ref(null)
  const listRef = ref(null)

  const excludeListIds = computed(() => ([props.listId]))


  const list = ref([])
  // setup 同步阶段的 immediate 触发时，onLoadedList 依赖的后续 setup 声明（restoreScroll）尚未初始化，
  // 直接同步调用会 TDZ 崩溃（挂载即传入非空 musicList 时命中）；延后到微任务（setup 完成）执行，
  // 挂载后的列表切换仍保持同步调用语义
  let isSetupPhase = true
  const handleListIdChange = id => {
    if (props.musicList) return
    getListMusics(id).then(l => {
      if (id != props.listId || props.musicList) return // 期间已切换目标或已切到 musicList 模式则丢弃
      list.value = [...l]
      onLoadedList()
    })
  }
  // music-list 模式（收藏分组视图/外部传入列表）
  watch(() => props.musicList, l => {
    if (l) {
      list.value = [...l]
      if (isSetupPhase) queueMicrotask(onLoadedList)
      else onLoadedList()
      return
    }
    handleListIdChange(props.listId)
  }, { immediate: true })
  queueMicrotask(() => {
    isSetupPhase = false
  })
  // list-id 模式（主列表页/收藏全部）
  watch(() => props.listId, id => {
    if (props.musicList) return
    handleListIdChange(id)
  })

  // 当前播放行定位：按歌曲 id 在当前视图列表内查找，而非直接用全局播放索引——
  // 收藏分组视图的列表是「全部收藏」子集，直接按索引比对会把播放标识错位显示到其它分组/视图的同位置歌曲上
  const playerInfo = computed(() => {
    const isPlayList = playMusicInfo.listId == props.listId
    let playIndex = -1
    if (isPlayList && playMusicInfo.musicInfo) {
      const currentId = playMusicInfo.musicInfo.id
      playIndex = list.value.findIndex(m => m.id == currentId)
    }
    return {
      isPlayList,
      playIndex,
    }
  })

  const setSelectedIndex = index => {
    selectedIndex.value = index
  }

  const isShowSource = computed(() => appSetting['list.isShowSource'])

  const handleMyListUpdate = (ids) => {
    if (!ids.includes(props.listId)) return
    // music-list 模式（收藏分组视图）：列表内容由外部数据驱动，
    // 直接读 store 会用整份列表覆盖分组视图渲染
    if (props.musicList) return
    getListMusics(props.listId).then(l => {
      // 等待期间已切到 music-list 模式则丢弃
      if (props.musicList) return
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
