import { ipcMain } from 'electron'

// ================= IPC 发送方校验（main-security #2） =================
// 所有经 mainOn/mainOnce/mainHandle/mainHandleOnce 接收的 IPC 都必须来自已登记的
// 应用程序窗口 webContents：
//  - role='app'（主窗口/歌词窗口，运行可信应用代码）：放行全部通道；
//  - role='userApi'（userApi 窗口，执行第三方用户脚本的运行环境）：仅放行其专属
//    userApi_* 通道（前缀与 src/main/modules/userApi/rendererEvent/name.js 命名一致），
//    杜绝该窗口调用 quit_update/open_dev_tools/quit/save_data/hotKey 等危险通道。
// 其余未登记 webContents（第三方/子窗口/DevTools 等）一律拦截。
// 窗口创建后调用 registerBrowserWindowIpcSender 登记；webContents 销毁时自动注销。

/** 应用程序窗口 webContents 的 IPC 发送角色 */
export type IpcSenderRole = 'app' | 'userApi'

/** userApi 窗口专属通道前缀（与 userApi/rendererEvent/name.js 的命名前缀保持一致） */
const USER_API_CHANNEL_PREFIX = 'userApi_'

const senderRoles = new Map<number, IpcSenderRole>()

/**
 * 登记应用程序窗口为合法 IPC 发送方
 * @param win 已创建的窗口（webContents 即刻可用）
 * @param role 'app'=主窗口/歌词窗口；'userApi'=第三方用户脚本窗口（仅放行 userApi_* 通道）
 */
export const registerBrowserWindowIpcSender = (win: Electron.BrowserWindow, role: IpcSenderRole = 'app'): void => {
  const webContents = win.webContents
  senderRoles.set(webContents.id, role)
  webContents.once('destroyed', () => {
    senderRoles.delete(webContents.id)
  })
}

/** 注销 IPC 发送方（一般由 webContents 销毁事件自动处理） */
export const unregisterIpcSender = (webContents: Electron.WebContents): void => {
  senderRoles.delete(webContents.id)
}

const isIpcSenderAllowed = (channel: string, event: { sender: Electron.WebContents, senderFrame: Electron.WebFrameMain | null }): boolean => {
  const { sender, senderFrame } = event
  if (!sender || sender.isDestroyed()) return false
  const role = senderRoles.get(sender.id)
  if (!role) return false
  if (senderFrame) {
    // 排除子帧发送的 IPC（正常仅主帧可发；senderFrame 为空时无法判定则不据此拦截）
    try {
      if (senderFrame.frameTreeNodeId !== sender.mainFrame.frameTreeNodeId) return false
    } catch {
      return false
    }
  }
  if (role === 'app') return true
  return channel.startsWith(USER_API_CHANNEL_PREFIX)
}

const handleDeniedSender = (channel: string, sender: Electron.WebContents): void => {
  // 校验失败：记录日志并静默拒绝，不向渲染层抛出（避免界面报错/未处理的 promise 拒绝）
  console.warn(`[mainIpc] 拦截未授权 IPC：channel="${channel}" senderId=${sender?.id ?? 'unknown'}`)
}

export function mainOn(name: string, listener: LX.IpcMainEventListener): void
export function mainOn<T>(name: string, listener: LX.IpcMainEventListenerParams<T>): void
export function mainOn<T>(name: string, listener: LX.IpcMainEventListenerParams<T>): void {
  ipcMain.on(name, (event, params) => {
    if (!isIpcSenderAllowed(name, event)) {
      handleDeniedSender(name, event.sender)
      return
    }
    listener({ event, params })
  })
}

export function mainOnce(name: string, listener: LX.IpcMainEventListener): void
export function mainOnce<T>(name: string, listener: LX.IpcMainEventListenerParams<T>): void
export function mainOnce<T>(name: string, listener: LX.IpcMainEventListenerParams<T>): void {
  ipcMain.once(name, (event, params) => {
    if (!isIpcSenderAllowed(name, event)) {
      handleDeniedSender(name, event.sender)
      return
    }
    listener({ event, params })
  })
}

export const mainOff = (name: string, listener: (...args: any[]) => void) => {
  ipcMain.removeListener(name, listener)
}

export const mainOffAll = (name: string) => {
  ipcMain.removeAllListeners(name)
}

export function mainHandle(name: string, listener: LX.IpcMainInvokeEventListener): void
export function mainHandle<T>(name: string, listener: LX.IpcMainInvokeEventListenerParams<T>): void
export function mainHandle<V>(name: string, listener: LX.IpcMainInvokeEventListenerValue<V>): void
export function mainHandle<T, V>(name: string, listener: LX.IpcMainInvokeEventListenerParamsValue<T, V>): void
export function mainHandle<T, V>(name: string, listener: LX.IpcMainInvokeEventListenerParamsValue<T, V>): void {
  ipcMain.handle(name, async(event, params) => {
    if (!isIpcSenderAllowed(name, event)) {
      handleDeniedSender(name, event.sender)
      return
    }
    return listener({ event, params })
  })
}

export function mainHandleOnce(name: string, listener: LX.IpcMainInvokeEventListener): void
export function mainHandleOnce<T>(name: string, listener: LX.IpcMainInvokeEventListenerParams<T>): void
export function mainHandleOnce<V>(name: string, listener: LX.IpcMainInvokeEventListenerValue<V>): void
export function mainHandleOnce<T, V>(name: string, listener: LX.IpcMainInvokeEventListenerParamsValue<T, V>): void
export function mainHandleOnce<T, V>(name: string, listener: LX.IpcMainInvokeEventListenerParamsValue<T, V>): void {
  ipcMain.handleOnce(name, async(event, params) => {
    if (!isIpcSenderAllowed(name, event)) {
      handleDeniedSender(name, event.sender)
      return
    }
    return listener({ event, params })
  })
}
export const mainHandleRemove = (name: string) => {
  ipcMain.removeHandler(name)
}

export function mainSend(window: Electron.BrowserWindow, name: string): void
export function mainSend<T>(window: Electron.BrowserWindow, name: string, params: T): void
export function mainSend<T>(window: Electron.BrowserWindow, name: string, params?: T): void {
  window.webContents.send(name, params)
}
