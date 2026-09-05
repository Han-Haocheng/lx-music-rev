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
  // 按来源标识判重（同一网络列表不可重复收藏；此前按名称判重会在歌单改名后重复收藏）
  const targetGroup = favoriteGroups.find(g => g.sourceListId == getListId(id))
  if (targetGroup) {
    const confirm = await dialog.confirm({
      message: window.i18n.t('duplicate_list_tip', { name: targetGroup.name }),
      cancelButtonText: window.i18n.t('lists__import_part_button_cancel'),
      confirmButtonText: window.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    // 已收藏过该网络列表，不重复收录
    return
  }
  // 同名分组：无来源的自建分组 → 绑定来源并并入歌曲（不覆盖歌曲，之后可「与源同步」）；已绑定其它来源 → 中止避免覆盖
  const sameNameGroup = favoriteGroups.find(g => g.name == name)
  if (sameNameGroup) {
    if (sameNameGroup.source && sameNameGroup.sourceListId != getListId(id)) {
      void dialog({ message: window.i18n.t('favorite_group_dup_name_tip', { name: sameNameGroup.name }) })
      return
    }
    const list = await getListDetailAll(id)
    if (!list.length) return
    await addListMusics(LIST_IDS.LOVE, list)
    for (const musicInfo of list) await setMusicGroupIds(musicInfo.id, [sameNameGroup.id])
    if (!sameNameGroup.source) await setFavoriteGroupSource(sameNameGroup.id, source, getListId(id))
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
    // 播放列表是独立会话队列：歌单内容即队列（temp 表保留写入仅作兼容，队列不依赖它）
    playList(LIST_IDS.PLAY_SESSION, index, list)
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
    playList(LIST_IDS.PLAY_SESSION, index, fullList)
  }
}
