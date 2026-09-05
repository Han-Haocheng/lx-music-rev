import { tempListMeta } from '@renderer/store/list/state'
import { dialog } from '@renderer/plugins/Dialog'
import { getListDetail, getListDetailAll } from '@renderer/store/leaderboard/action'
import { addListMusics, setTempList } from '@renderer/store/list/action'
import { favoriteGroups, addFavoriteGroup, setMusicGroupIds } from '@renderer/store/list/favoriteGroup'
import { playList } from '@renderer/core/player/action'
import { LIST_IDS } from '@common/constants'

const getListId = (id: string) => `board__${id}`

export const addSongListDetail = async(id: string, name: string, source: LX.OnlineSource) => {
  // 自建列表已退役：收藏歌单 = 歌曲收藏进「我的收藏」并归入同名收藏分组
  // console.log(this.listDetail.info)
  // if (!this.listDetail.info.name) return
  const targetGroup = favoriteGroups.find(g => g.name == name)
  if (targetGroup) {
    const confirm = await dialog.confirm({
      message: window.i18n.t('duplicate_list_tip', { name: targetGroup.name }),
      cancelButtonText: window.i18n.t('lists__import_part_button_cancel'),
      confirmButtonText: window.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    // 已收藏过同名歌单，不重复收录
    return
  }

  const list = await getListDetailAll(id)
  if (!list.length) return
  // 分组记录来源（board 榜）+ 歌曲入收藏并归组：后续可右键「与源同步」覆盖更新
  const groupId = await addFavoriteGroup(name, source, getListId(id))
  await addListMusics(LIST_IDS.LOVE, list)
  for (const musicInfo of list) await setMusicGroupIds(musicInfo.id, [groupId])
}

export const playSongListDetail = async(id: string, list?: LX.Music.MusicInfoOnline[], index: number = 0) => {
  let isPlayingList = false
  // console.log(list)
  const listId = getListId(id)
  if (!list?.length) list = (await getListDetail(id, 1)).list
  if (list?.length) {
    await setTempList(listId, [...list])
    playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(id)
  if (!fullList.length) return
  if (isPlayingList) {
    if (tempListMeta.id == listId) {
      await setTempList(listId, [...fullList])
    }
  } else {
    await setTempList(listId, [...fullList])
    playList(LIST_IDS.TEMP, index)
  }
}
