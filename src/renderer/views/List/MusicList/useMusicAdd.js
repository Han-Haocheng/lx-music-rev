import { ref, nextTick } from '@common/utils/vueTools'

export default ({ selectedList, list }) => {
  const isShowListAdd = ref(false)
  const isShowListAddMultiple = ref(false)
  const selectedAddMusicInfo = ref(null)

  const handleShowMusicAddModal = (index, single) => {
    if (selectedList.value.length && !single) {
      isShowListAddMultiple.value = true
    } else {
      selectedAddMusicInfo.value = list.value[index]
      nextTick(() => {
        isShowListAdd.value = true
      })
    }
  }

  return {
    isShowListAdd,
    isShowListAddMultiple,
    selectedAddMusicInfo,
    handleShowMusicAddModal,
  }
}
