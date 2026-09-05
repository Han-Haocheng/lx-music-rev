import { mainHandle } from '@common/mainIpc'
import { PLAYER_EVENT_NAME } from '@common/ipcNames'

// 列表操作事件（公共，只注册一次）
export default () => {
  mainHandle<LX.List.UserListInfo[]>(PLAYER_EVENT_NAME.list_get, async() => {
    return global.lx.worker.dbService.getAllUserList()
  })
  mainHandle<LX.List.ListActionDataOverwrite>(PLAYER_EVENT_NAME.list_data_overwire, async({ params: listData }) => {
    await global.lx.event_list.list_data_overwrite(listData, false)
  })
  mainHandle<LX.List.ListActionAdd>(PLAYER_EVENT_NAME.list_add, async({ params: { position, listInfos } }) => {
    await global.lx.event_list.list_create(position, listInfos, false)
  })
  mainHandle<LX.List.ListActionRemove>(PLAYER_EVENT_NAME.list_remove, async({ params: ids }) => {
    await global.lx.event_list.list_remove(ids, false)
  })
  mainHandle<LX.List.ListActionUpdate>(PLAYER_EVENT_NAME.list_update, async({ params: listInfos }) => {
    await global.lx.event_list.list_update(listInfos, false)
  })
  mainHandle<LX.List.ListActionUpdatePosition>(PLAYER_EVENT_NAME.list_update_position, async({ params: { position, ids } }) => {
    await global.lx.event_list.list_update_position(position, ids, false)
  })
  mainHandle<string, LX.Music.MusicInfo[]>(PLAYER_EVENT_NAME.list_music_get, async({ params: listId }) => {
    return global.lx.worker.dbService.getListMusics(listId)
  })
  mainHandle<LX.List.ListActionMusicAdd>(PLAYER_EVENT_NAME.list_music_add, async({ params: { id, musicInfos, addMusicLocationType } }) => {
    await global.lx.event_list.list_music_add(id, musicInfos, addMusicLocationType, false)
  })
  mainHandle<LX.List.ListActionMusicMove>(PLAYER_EVENT_NAME.list_music_move, async({ params: { fromId, toId, musicInfos, addMusicLocationType } }) => {
    await global.lx.event_list.list_music_move(fromId, toId, musicInfos, addMusicLocationType, false)
  })
  mainHandle<LX.List.ListActionMusicRemove>(PLAYER_EVENT_NAME.list_music_remove, async({ params: { listId, ids } }) => {
    await global.lx.event_list.list_music_remove(listId, ids, false)
  })
  mainHandle<LX.List.ListActionMusicUpdate>(PLAYER_EVENT_NAME.list_music_update, async({ params: musicInfos }) => {
    await global.lx.event_list.list_music_update(musicInfos, false)
  })
  mainHandle<LX.List.ListActionMusicUpdatePosition>(PLAYER_EVENT_NAME.list_music_update_position, async({ params: { listId, position, ids } }) => {
    await global.lx.event_list.list_music_update_position(listId, position, ids, false)
  })
  mainHandle<LX.List.ListActionMusicOverwrite>(PLAYER_EVENT_NAME.list_music_overwrite, async({ params: { listId, musicInfos } }) => {
    await global.lx.event_list.list_music_overwrite(listId, musicInfos, false)
  })
  mainHandle<LX.List.ListActionMusicClear>(PLAYER_EVENT_NAME.list_music_clear, async({ params: listId }) => {
    await global.lx.event_list.list_music_clear(listId, false)
  })
  mainHandle<LX.List.ListActionCheckMusicExistList, boolean>(PLAYER_EVENT_NAME.list_music_check_exist, async({ params: { listId, musicInfoId } }) => {
    return global.lx.worker.dbService.checkListExistMusic(listId, musicInfoId)
  })
  mainHandle<string, string[]>(PLAYER_EVENT_NAME.list_music_get_list_ids, async({ params: musicInfoId }) => {
    return global.lx.worker.dbService.getMusicExistListIds(musicInfoId)
  })
  mainHandle<[], LX.DBService.FavoriteGroupInfo[]>(PLAYER_EVENT_NAME.favorite_group_get, async() => {
    return global.lx.worker.dbService.favoriteGroupGet()
  })
  mainHandle<{ name: string, id: string }>(PLAYER_EVENT_NAME.favorite_group_add, async({ params: { name, id } }) => {
    await global.lx.worker.dbService.favoriteGroupAdd(name, id)
  })
  mainHandle<{ id: string, name: string }>(PLAYER_EVENT_NAME.favorite_group_update, async({ params: { id, name } }) => {
    await global.lx.worker.dbService.favoriteGroupUpdate(id, name)
  })
  mainHandle<{ id: string }>(PLAYER_EVENT_NAME.favorite_group_remove, async({ params: { id } }) => {
    await global.lx.worker.dbService.favoriteGroupRemove(id)
  })
  mainHandle<string, string[]>(PLAYER_EVENT_NAME.favorite_group_music_get, async({ params: musicInfoId }) => {
    return global.lx.worker.dbService.favoriteGroupMusicGet(musicInfoId)
  })
  mainHandle<{ musicInfoId: string, groupIds: string[] }>(PLAYER_EVENT_NAME.favorite_group_music_set, async({ params: { musicInfoId, groupIds } }) => {
    await global.lx.worker.dbService.favoriteGroupMusicSet(musicInfoId, groupIds)
  })
  mainHandle<string, string[]>(PLAYER_EVENT_NAME.favorite_group_music_list_get, async({ params: groupId }) => {
    return global.lx.worker.dbService.favoriteGroupMusicListGet(groupId)
  })
  mainHandle<string, LX.DBService.FavoriteGroupSource | null>(PLAYER_EVENT_NAME.favorite_group_source_get, async({ params: groupId }) => {
    return global.lx.worker.dbService.favoriteGroupSourceGet(groupId)
  })
  mainHandle<{ groupId: string, source: string, sourceListId: string }>(PLAYER_EVENT_NAME.favorite_group_source_set, async({ params: { groupId, source, sourceListId } }) => {
    await global.lx.worker.dbService.favoriteGroupSourceSet(groupId, source, sourceListId)
  })
  mainHandle<{ groupId: string, musicInfos: LX.Music.MusicInfo[] }>(PLAYER_EVENT_NAME.favorite_group_sync_musics, async({ params: { groupId, musicInfos } }) => {
    await global.lx.worker.dbService.favoriteGroupSyncMusics(groupId, musicInfos)
  })
}
