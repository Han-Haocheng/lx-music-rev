import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import { markRaw, markRawList } from '@common/utils/vueTools'
import { boards, type Board, listDetailInfo, type ListDetailInfo } from './state'

const cache = new Map<string, any>()
// 排行榜数据缓存：加 FIFO 容量上限，避免长会话浏览大量榜单导致内存持续增长
// 超出上限时按插入顺序淘汰最旧缓存项；get 命中不刷新、不淘汰
const cacheMaxSize = 40
const setCache = (key: string, data: any) => {
  cache.set(key, data)
  if (cache.size > cacheMaxSize) {
    const firstEntry = cache.keys().next()
    if (!firstEntry.done) cache.delete(firstEntry.value)
  }
}

export const setBoard = (board: Board, source: LX.OnlineSource) => {
  boards[source] = markRaw(board)
}

export const setListDetail = (result: ListDetailInfo, id: string, page: number) => {
  listDetailInfo.list = markRaw([...result.list])
  listDetailInfo.id = id
  listDetailInfo.source = result.source
  if (page == 1 || (result.total && result.list.length)) listDetailInfo.total = result.total
  else listDetailInfo.total = result.limit * page
  listDetailInfo.limit = result.limit
  listDetailInfo.page = page

  if (result.list.length) listDetailInfo.noItemLabel = ''
  else if (page == 1) listDetailInfo.noItemLabel = window.i18n.t('no_item')
}
export const clearListDetail = () => {
  listDetailInfo.list = []
  listDetailInfo.id = ''
  listDetailInfo.source = null
  listDetailInfo.total = 0
  listDetailInfo.limit = 30
  listDetailInfo.page = 1
  listDetailInfo.key = null
  listDetailInfo.noItemLabel = ''
}

export const getBoardsList = async(source: LX.OnlineSource) => {
  // const source = (await getLeaderboardSetting()).source as LX.OnlineSource
  return musicSdk[source]?.leaderboard.getBoards() as Promise<Board>
}

/**
 * 获取排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetail = async(id: string, page: number, isRefresh = false): Promise<ListDetailInfo> => {
  // let [source, bangId] = tabId.split('__')
  // if (!bangId) return
  let key = `${id}__${page}`

  if (!isRefresh && cache.has(key)) return cache.get(key)

  const [source, bangId] = id.split('__') as [LX.OnlineSource, string]

  return musicSdk[source]?.leaderboard?.getList(bangId, page).then((result: ListDetailInfo) => {
    result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
    setCache(key, result)
    return result
  })
}


/**
 * 获取排行榜内全部歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetailAll = async(id: string, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  const [source, bangId] = id.split('__') as [LX.OnlineSource, string]
  // console.log(source, id)
  // 与 getListDetail 共用同一缓存 key（完整榜单 id + 页号），单页浏览与全量加载互相命中、避免重复请求
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const loadData = (page: number): Promise<ListDetailInfo> => {
    let key = `${id}__${page}`
    if (isRefresh && cache.has(key)) cache.delete(key)
    return cache.has(key)
      ? Promise.resolve(cache.get(key))
      : musicSdk[source]?.leaderboard.getList(bangId, page).then((result: ListDetailInfo) => {
        result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
        setCache(key, result)
        return result
      }) ?? Promise.reject(new Error('source not found' + source))
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return loadData(1).then((result: ListDetailInfo) => {
    if (result.total <= result.limit) return result.list

    let maxPage = Math.ceil(result.total / result.limit)
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const loadDetail = (loadPage = 2): Promise<ListDetailInfo['list']> => {
      return loadPage == maxPage
        ? loadData(loadPage).then((result: ListDetailInfo) => result.list)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        : loadData(loadPage).then((result1: ListDetailInfo) => loadDetail(++loadPage).then((result2: ListDetailInfo['list']) => [...result1.list, ...result2]))
    }
    return loadDetail().then(result2 => [...result.list, ...result2])
  }).then((list: ListDetailInfo['list']) => deduplicationList(list))
}


/**
 * 获取并设置排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getAndSetListDetail = async(id: string, page: number, isRefresh = false) => {
  // let [source, bangId] = tabId.split('__')
  // if (!bangId) return
  let key = `${id}__${page}`

  if (!isRefresh && listDetailInfo.key == key && listDetailInfo.list.length) return

  listDetailInfo.key = key
  listDetailInfo.noItemLabel = window.i18n.t('list__loading')

  return getListDetail(id, page, isRefresh).then((result: ListDetailInfo) => {
    if (key != listDetailInfo.key) return
    setListDetail(result, id, page)
  }).catch((error: any) => {
    clearListDetail()
    listDetailInfo.noItemLabel = window.i18n.t('list__load_failed')
    console.warn(error)
    throw error
  })
}
