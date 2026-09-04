import { appSetting, updateSetting } from '@renderer/store/setting'

export interface ListSortScheme {
  /** 排序方案：custom = 自定义（添加/拖拽顺序）；其余为字段排序 */
  sortType: 'custom' | 'name' | 'singer' | 'albumName' | 'interval'
  /** 字段排序方向；custom 时为 null */
  sortOrder: 'asc' | 'desc' | null
  /** 是否曾手动排列（拖拽/调整位置），作为"变更自定义方案前确认"的依据 */
  customTouched: boolean
}

/** 方案存储为 appSetting 单个 JSON 字符串键（Record<listId, ListSortScheme>），覆盖 default/love/local/用户列表全部列表类型 */
const defaultScheme = (): ListSortScheme => ({ sortType: 'custom', sortOrder: null, customTouched: false })

export const getSortScheme = (listId: string): ListSortScheme => {
  try {
    const raw = appSetting['list.sortSchemes']
    const map = raw ? JSON.parse(raw) : {}
    return { ...defaultScheme(), ...(map[listId] ?? {}) }
  } catch (err) {
    return defaultScheme()
  }
}

export const setSortScheme = (listId: string, patch: Partial<ListSortScheme>) => {
  try {
    const raw = appSetting['list.sortSchemes']
    const map = raw ? JSON.parse(raw) : {}
    map[listId] = { ...defaultScheme(), ...(map[listId] ?? {}), ...patch }
    updateSetting({ 'list.sortSchemes': JSON.stringify(map) })
  } catch (err) {
    updateSetting({ 'list.sortSchemes': JSON.stringify({ [listId]: { ...defaultScheme(), ...patch } }) })
  }
}
