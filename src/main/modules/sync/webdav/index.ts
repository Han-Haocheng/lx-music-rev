import { WEBDAV } from '@common/constants_sync'
import { buildSyncData, parseSyncData, applySyncData } from './data'
import { requestWebdav, buildAuthHeader, buildFileUrl, buildDirUrl } from './request'
import log from '../log'

/**
 * WebDAV 数据同步
 * 模式：上传 = 本地覆盖远端（远端旧文件保留为 sync-data.prev.json）
 *      下载 = 远端覆盖本地（本地数据先备份到数据目录 webdav-local-backup.json）
 * 同步数据范围：我的列表 + 不喜欢列表（与内置同步一致）
 */

let status: LX.Sync.WebdavStatus = {
  status: false,
  enabled: false,
  message: '',
}

const setStatus = (next: LX.Sync.WebdavStatus) => {
  status = next
}

/** 串行化 push/pull/test，避免并发覆盖 */
let taskQueue: Promise<unknown> = Promise.resolve()
const runExclusive = async<T>(task: () => Promise<T>): Promise<T> => {
  const next = taskQueue.then(task, task)
  taskQueue = next.catch(() => undefined)
  return next
}

const getConfig = () => {
  const s = global.lx.appSetting
  const url = s['sync.webdav.url'].trim()
  if (!url) throw new Error('请先填写 WebDAV 服务器地址')
  return {
    url,
    username: s['sync.webdav.username'].trim(),
    password: s['sync.webdav.password'],
    remotePath: (s['sync.webdav.remotePath'] || WEBDAV.defaultRemotePath).trim() || WEBDAV.defaultRemotePath,
  }
}

const authError = (statusCode: number) => {
  if (statusCode === 401 || statusCode === 403) return new Error('认证失败：请检查用户名与密码')
  if (statusCode === 407) return new Error('代理认证失败：请检查系统代理设置')
  return null
}

const parseLastModified = (headers: Record<string, string | string[]>) => {
  const value = headers?.['last-modified']
  if (value == null) return undefined
  const time = Date.parse(Array.isArray(value) ? value[0] : value)
  return Number.isNaN(time) ? undefined : time
}

/** 测试连接：GET 远端数据文件，404 也视为可达 */
const doTest = async(): Promise<LX.Sync.WebdavStatus> => {
  try {
    const cfg = getConfig()
    const url = buildFileUrl(cfg.url, cfg.remotePath, WEBDAV.dataFileName)
    const auth = buildAuthHeader(cfg.username, cfg.password)
    const res = await requestWebdav({ method: 'GET', url, headers: { Authorization: auth } })
    const authErr = authError(res.status)
    if (authErr) throw authErr
    if (res.status >= 400 && res.status !== 404) throw new Error(`服务器异常（HTTP ${res.status}）`)
    const next: LX.Sync.WebdavStatus = {
      status: true,
      enabled: status.enabled,
      message: res.status === 404 ? '连接成功（远端暂无数据）' : '连接成功',
      lastSyncAt: status.lastSyncAt,
      remoteUpdatedAt: parseLastModified(res.headers),
    }
    setStatus(next)
    return next
  } catch (err) {
    const next: LX.Sync.WebdavStatus = {
      status: false,
      enabled: status.enabled,
      message: (err as Error).message || '连接失败',
    }
    setStatus(next)
    return next
  }
}

/** 上传：本地全量快照覆盖远端，远端旧数据保留为 .prev 文件 */
const doPush = async(): Promise<LX.Sync.WebdavStatus> => {
  try {
    const cfg = getConfig()
    const auth = buildAuthHeader(cfg.username, cfg.password)
    const url = buildFileUrl(cfg.url, cfg.remotePath, WEBDAV.dataFileName)
    // 保留远端旧数据
    const old = await requestWebdav({ method: 'GET', url, headers: { Authorization: auth } })
    if (old.status === 200) {
      const backupUrl = buildFileUrl(cfg.url, cfg.remotePath, WEBDAV.backupFileName)
      const backupRes = await requestWebdav({ method: 'PUT', url: backupUrl, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: old.body })
      if (backupRes.status >= 400 && backupRes.status !== 405) log.warn('[webdav] backup remote file failed, http', backupRes.status)
    }
    const data = await buildSyncData()
    let res = await requestWebdav({ method: 'PUT', url, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (res.status === 409) {
      // 远端目录不存在：尝试 MKCOL 建目录后重试一次
      const dirUrl = buildDirUrl(url)
      await requestWebdav({ method: 'MKCOL', url: dirUrl, headers: { Authorization: auth } }).catch(() => undefined)
      res = await requestWebdav({ method: 'PUT', url, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    }
    const authErr = authError(res.status)
    if (authErr) throw authErr
    if (res.status >= 400) throw new Error(`上传失败（HTTP ${res.status}）`)
    const next: LX.Sync.WebdavStatus = {
      status: true,
      enabled: status.enabled,
      message: `数据已上传（${new Date(data.updatedAt).toLocaleString()}）`,
      lastSyncAt: data.updatedAt,
      remoteUpdatedAt: data.updatedAt,
    }
    setStatus(next)
    return next
  } catch (err) {
    const next: LX.Sync.WebdavStatus = {
      status: false,
      enabled: status.enabled,
      message: (err as Error).message || '上传失败',
    }
    setStatus(next)
    return next
  }
}

/** 下载：远端全量快照覆盖本地，应用前本地数据先备份 */
const doPull = async(): Promise<LX.Sync.WebdavStatus> => {
  try {
    const cfg = getConfig()
    const auth = buildAuthHeader(cfg.username, cfg.password)
    const url = buildFileUrl(cfg.url, cfg.remotePath, WEBDAV.dataFileName)
    const res = await requestWebdav({ method: 'GET', url, headers: { Authorization: auth } })
    const authErr = authError(res.status)
    if (authErr) throw authErr
    if (res.status === 404) throw new Error('远端暂无数据文件，请先在其他设备上传')
    if (res.status >= 400) throw new Error(`下载失败（HTTP ${res.status}）`)
    const data = parseSyncData(res.body.toString('utf8'))
    await applySyncData(data)
    const next: LX.Sync.WebdavStatus = {
      status: true,
      enabled: status.enabled,
      message: `数据已下载并应用（${new Date(data.updatedAt).toLocaleString()}）`,
      lastSyncAt: Date.now(),
      remoteUpdatedAt: data.updatedAt,
    }
    setStatus(next)
    return next
  } catch (err) {
    const next: LX.Sync.WebdavStatus = {
      status: false,
      enabled: status.enabled,
      message: (err as Error).message || '下载失败',
    }
    setStatus(next)
    return next
  }
}

/** 启用/停用（不建立常驻连接，仅记录状态并做一次连通性测试） */
export const enable = async(data: { enable: boolean }): Promise<LX.Sync.WebdavStatus> => {
  const next: LX.Sync.WebdavStatus = {
    ...status,
    enabled: data.enable,
  }
  setStatus(next)
  if (data.enable) return runExclusive(doTest)
  return next
}

export const testConnection = async(): Promise<LX.Sync.WebdavStatus> => runExclusive(doTest)
export const push = async(): Promise<LX.Sync.WebdavStatus> => runExclusive(doPush)
export const pull = async(): Promise<LX.Sync.WebdavStatus> => runExclusive(doPull)

export const getStatus = (): LX.Sync.WebdavStatus => status
