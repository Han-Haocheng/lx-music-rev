import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { WEBDAV } from '@common/constants_sync'
import { getLocalListData, setLocalListData } from '../listEvent'
import { getLocalDislikeData, setLocalDislikeData } from '../dislikeEvent'
import log from '../log'

/**
 * WebDAV 同步数据文件格式
 * 与内置同步一致：同步「我的列表 + 不喜欢列表」，全量快照。
 */
export interface WebdavSyncData {
  version: number
  updatedAt: number
  lists: LX.Sync.List.ListData
  dislikeRules: LX.Dislike.DislikeRules
}

/** 汇总本地数据为快照（JSON 序列化前） */
export const buildSyncData = async(): Promise<WebdavSyncData> => {
  return {
    version: WEBDAV.version,
    updatedAt: Date.now(),
    lists: await getLocalListData(),
    dislikeRules: await getLocalDislikeData(),
  }
}

/** 解析并校验远端快照，损坏/版本不符时抛错 */
export const parseSyncData = (raw: string): WebdavSyncData => {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('远端数据文件已损坏（JSON 解析失败）')
  }
  if (typeof data !== 'object' || data === null) throw new Error('远端数据文件格式不正确')
  const d = data as Partial<WebdavSyncData>
  if (d.version !== WEBDAV.version || d.lists == null || typeof d.updatedAt !== 'number') {
    throw new Error(`远端数据文件版本不兼容（需要 v${WEBDAV.version}）`)
  }
  return d as WebdavSyncData
}

/** 应用远端快照：先备份当前本地数据，再全量覆盖列表与不喜欢列表 */
export const applySyncData = async(data: WebdavSyncData) => {
  let current: WebdavSyncData | null = null
  try {
    current = await buildSyncData()
  } catch (err) {
    log.warn('[webdav] build local backup failed', err)
  }
  await setLocalListData(data.lists)
  await setLocalDislikeData(data.dislikeRules)
  if (current) {
    try {
      mkdirSync(global.lxDataPath, { recursive: true })
      const backupPath = path.join(global.lxDataPath, 'webdav-local-backup.json')
      writeFileSync(backupPath, JSON.stringify(current))
      log.info('[webdav] local data backed up to', backupPath)
    } catch (err) {
      log.warn('[webdav] local backup write failed', err)
    }
  }
}
