import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/songList/action'
import { listDetailInfo } from '@renderer/store/songList/state'

export default () => {
  const listRef = ref<any>(null)

  const getListData = async(source: LX.OnlineSource, id: string, page: number, refresh: boolean) => {
    await getAndSetListDetail(id, source, page, refresh).then(() => {
      setTimeout(() => {
        if (listRef.value) listRef.value.scrollToTop()
      })
    })
  }

  return {
    listRef,
    listDetailInfo,
    getListData,
  }
}
