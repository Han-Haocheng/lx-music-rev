import { app, dialog } from 'electron'
import './utils/logInit'
import '@common/error'
import {
  initGlobalData,
  initSingleInstanceHandle,
  applyElectronEnvParams,
  setUserDataPath,
  registerDeeplink,
  listenerAppEvent,
} from './app'
import { isLinux, log } from '@common/utils'
import { initAppSetting } from '@main/app'
import registerModules from '@main/modules'

// 初始化应用
// open-url / activate / whenReady 均可能触发 init，使用 initing 锁保证
// 初始化只并发执行一次，避免数据库、设置被重复初始化以及主窗口被重复创建
let initing = false
const init = async() => {
  console.log('init')
  if (initing) return
  initing = true
  try {
    await initAppSetting()
    registerModules()
    global.lx.event_app.app_inited()
  } catch (err) {
    // 初始化失败时给出提示，并允许下次触发（如再次启动应用、activate）时重试
    log.error('App init failed:', err)
    dialog.showErrorBox('应用初始化失败', `${String(err)}\n\n初始化失败，请重启应用或查看日志文件获取详细信息。`)
  } finally {
    // eslint-disable-next-line require-atomic-updates -- initing 初始化锁在同步代码段内更新，不存在竞态
    initing = false
  }
}

initGlobalData()
initSingleInstanceHandle(init)
applyElectronEnvParams()
setUserDataPath()
registerDeeplink(init)
listenerAppEvent(init)


// https://github.com/electron/electron/issues/16809
void app.whenReady().then(() => {
  if (isLinux) {
    setTimeout(() => {
      void init()
    }, 300)
  } else {
    void init()
  }
})
