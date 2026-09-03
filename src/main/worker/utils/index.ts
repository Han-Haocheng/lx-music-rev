import { Worker } from 'node:worker_threads'
import * as Comlink from 'comlink'
import nodeEndpoint from 'comlink/dist/esm/node-adapter'
import { dialog } from 'electron'
import { log } from '@common/utils'

export type DBSeriveTypes = Comlink.Remote<LX.WorkerDBSeriveListTypes>

// dbService worker 崩溃退避（main-security #3）：
// worker 异常退出时先自动重建并重新初始化数据库；若在 WORKER_CRASH_WINDOW_MS（60s）内
// 再次崩溃（超过 1 次）则不再自动重建，弹系统对话框提示用户重启应用，避免重建死循环
const WORKER_CRASH_WINDOW_MS = 60_000
const WORKER_CRASH_MAX_IN_WINDOW = 1
const workerCrashTimes: number[] = []

export const createDBServiceWorker = () => {
  const worker: Worker = new Worker(new URL(
    /* webpackChunkName: 'dbService.worker' */
    '../dbService',
    import.meta.url,
  ))
  const proxy = Comlink.wrap<LX.WorkerDBSeriveListTypes>(nodeEndpoint(worker))

  // worker 内未捕获异常：记录日志（随后线程以非 0 码退出，由下方 exit 分支处理重建）
  worker.on('error', (err) => {
    log.error('[dbService worker] error:', err)
  })

  // worker 异常退出：调用方全部通过 global.lx.worker.dbService 动态取用（模块内无人缓存死代理），
  // 因此可以安全重建——新建 worker → 替换全局代理 → 重新执行数据库 init 恢复连接
  worker.on('exit', (code) => {
    if (code === 0) return
    log.error(`[dbService worker] 异常退出: code=${code}`)
    if (global.lx?.isSkipTrayQuit) return
    const now = Date.now()
    workerCrashTimes.push(now)
    while (workerCrashTimes.length && now - workerCrashTimes[0] > WORKER_CRASH_WINDOW_MS) workerCrashTimes.shift()
    if (workerCrashTimes.length > WORKER_CRASH_MAX_IN_WINDOW) {
      log.error('[dbService worker] 短时间内连续崩溃，已停止自动重建，请用户重启应用')
      dialog.showErrorBox(
        '数据库服务异常 / Database service crashed',
        '数据库后台服务在短时间内反复崩溃，已停止自动恢复。\n请重启应用以恢复正常使用。\n\nThe database worker crashed repeatedly and automatic recovery has been stopped. Please restart the app.',
      )
      return
    }
    rebuildDBServiceWorker(proxy)
  })

  return proxy
}

// 重建 dbService worker：替换全局代理后调用 init 重新打开数据库（新 worker 内为全新模块状态）
const rebuildDBServiceWorker = (crashedProxy: DBSeriveTypes) => {
  log.warn('[dbService worker] 崩溃，正在自动重建 worker 并重新初始化数据库')
  const newProxy = createDBServiceWorker()
  if (global.lx?.worker?.dbService === crashedProxy) {
    global.lx.worker.dbService = newProxy
  }
  void newProxy.init(global.lxDataPath).then((dbFileExists) => {
    log.warn(`[dbService worker] 重建成功，数据库重新初始化完成（dbFileExists=${dbFileExists}）`)
  }).catch((err) => {
    log.error('[dbService worker] 重建后重新初始化数据库失败:', err)
    dialog.showErrorBox(
      '数据库服务异常 / Database service crashed',
      `数据库 worker 已重建，但重新打开数据库失败：${String(err)}\n\n请重启应用。\n\nThe database worker was rebuilt but re-opening the database failed. Please restart the app.`,
    )
  })
}

