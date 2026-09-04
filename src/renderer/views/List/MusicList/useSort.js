import { updateListMusicsPosition } from '@renderer/store/list/action'
import { getSortScheme, setSortScheme } from '@renderer/store/list/sortScheme'
import { dialog } from '@renderer/plugins/Dialog'

export default ({ props, list }) => {
  let sortingTask = null

  /**
   * 表头点击排序：持久化到该列表的排序方案 + 物理顺序（order 表全量置换，orderPlanner 已最小化写入）。
   * 若列表当前为"自定义且曾手动排列"，先弹确认。
   */
  const handleHeaderSort = async(column) => {
    if (!column || !props.allowCustomSort || sortingTask) return
    const task = (async() => {
      const scheme = getSortScheme(props.listId)
      const sortOrder = scheme.sortType == column
        ? (scheme.sortOrder == 'asc' ? 'desc' : 'asc')
        : 'asc'
      if (scheme.sortType == 'custom' && scheme.customTouched) {
        const isConfirm = await dialog.confirm(window.i18n.t('music_sort_custom_confirm'))
        if (!isConfirm) return
      }
      const sorted = await window.lx.worker.main.sortListMusicInfo([...list.value], sortOrder == 'asc' ? 'up' : 'down', column, window.i18n.locale)
      if (!sorted.length) return
      await updateListMusicsPosition({ listId: props.listId, position: 0, ids: sorted.map(m => m.id) })
      setSortScheme(props.listId, { sortType: column, sortOrder })
    })()
    sortingTask = task
    try {
      await task
    } finally {
      if (sortingTask === task) sortingTask = null
    }
  }

  return {
    handleHeaderSort,
  }
}
