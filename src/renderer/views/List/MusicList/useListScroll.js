import { onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { setListPosition, getListPosition } from '@renderer/utils/data'
import { appSetting } from '@renderer/store/setting'

export default ({ props, listRef, list, handleRestoreScroll }) => {
  const route = useRoute()
  const router = useRouter()

  // 滚动位置存储键：默认按 listId；收藏分组视图通过 scroll-key 区分视图，
  // 避免"全部"与各分组互相覆盖/错误恢复对方的滚动位置（如带着"全部"的深滚动进入短分组被压到底部）
  const getPositionKey = () => props.scrollKey ?? props.listId

  const saveListPosition = () => {
    setListPosition(getPositionKey(), listRef.value?.getScrollTop() || 0)
  }

  const handleScrollList = (index, isAnimation, callback = () => {}) => {
    listRef.value.scrollToIndex(index, -150, isAnimation, callback)
  }

  const restoreScroll = async(index, isAnimation) => {
    // console.log(index, isAnimation)
    if (!list.value.length) return
    if (index == null) {
      const key = getPositionKey()
      let location = await getListPosition(key) || 0
      // 等待期间已切换视图则丢弃过期恢复
      if (getPositionKey() != key) return
      if (appSetting['list.isSaveScrollLocation'] && location != null) {
        listRef.value?.scrollTo(location)
      }
      return
    }

    handleScrollList(index, isAnimation)
  }

  onMounted(() => {
    handleRestoreScroll(route.query.scrollIndex, false)
    if (route.query.scrollIndex != null) {
      // 清掉定位参数，避免刷新重复恢复（当前页面即列表视图：收藏页 / 本地音乐页）
      router.replace({ path: route.path })
    }
  })
  onBeforeUnmount(() => {
    saveListPosition()
  })

  return {
    saveListPosition,
    restoreScroll,
  }
}
