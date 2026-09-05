import path from 'node:path'
import net from 'node:net'
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { app, shell, screen, nativeTheme, dialog } from 'electron'
import type { RenderProcessGoneDetails, WebContents } from 'electron'
import { URL_SCHEME_RXP } from '@common/constants'
import { getProxy, getTheme, initHotKey, initSetting, parseEnvParams, isOpenFile } from './utils'
import { navigationUrlWhiteList } from '@common/config'
import defaultSetting from '@common/defaultSetting'
import { isExistWindow as isExistMainWindow, showWindow as showMainWindow } from './modules/winMain'
import { destroyTray } from './modules/tray'
import { createAppEvent, createDislikeEvent, createListEvent } from '@main/event'
import { isLinux, isMac, log } from '@common/utils'
import createWorkers from './worker'
import { migrateDBData } from './utils/migrate'
import { openDirInExplorer } from '@common/utils/electron'
import { setProxyByHost } from '@common/utils/request'

export const initGlobalData = () => {
  const envParams = parseEnvParams()
  // envParams.cmdParams.dt = !!envParams.cmdParams.dt

  global.envParams = {
    cmdParams: envParams.cmdParams,
    deeplink: envParams.deeplink,
    openFiles: envParams.openFiles ?? [],
  }
  global.lx = {
    inited: false,
    isSkipTrayQuit: false,
    // mainWindowClosed: true,
    event_app: createAppEvent(),
    event_list: createListEvent(),
    event_dislike: createDislikeEvent(),
    appSetting: defaultSetting,
    worker: createWorkers(),
    hotKey: {
      enable: true,
      config: {
        local: {
          enable: false,
          keys: {},
        },
        global: {
          enable: false,
          keys: {},
        },
      },
      state: new Map(),
    },
    theme: {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      theme: {
        id: '',
        name: '',
        isDark: false,
        colors: {},
      },
    },
    player_status: {
      status: 'stoped',
      name: '',
      singer: '',
      albumName: '',
      picUrl: '',
      progress: 0,
      duration: 0,
      playbackRate: 1,
      lyricLineText: '',
      lyricLineAllText: '',
      lyric: '',
      tlyric: '',
      rlyric: '',
      lxlyric: '',
      collect: false,
      volume: 0,
      mute: false,
    },
  }

  global.staticPath =
    process.env.NODE_ENV !== 'production'
      ? webpackStaticPath
      : path.join(__dirname, 'static')
}

// ===== 单实例锁残留自救（Linux） =====
// Electron 在 Linux 用 userData/SingletonLock（socket 文件）实现单实例；
// 若上次进程卡死/崩溃后僵死未退出（或异常终止未清理），锁不会释放，新进程会直接退出——表现为「打不开新进程」。
// 通过探测锁 socket 活性判断残留（无进程监听即残留），清理后重试获取锁。
const getSingletonLockFile = (): string | null => {
  if (process.platform !== 'linux') return null // Windows/macOS 用系统命名对象，进程退出自动释放
  return path.join(app.getPath('userData'), 'SingletonLock')
}

const isSingletonLockAlive = async(lockFile: string): Promise<boolean> => new Promise(resolve => {
  const socket = net.connect({ path: lockFile })
  const done = (alive: boolean) => {
    socket.destroy()
    resolve(alive)
  }
  socket.setTimeout(1200)
  socket.once('connect', () => { done(true) })
  socket.once('error', () => { done(false) })
  socket.once('timeout', () => { done(false) })
})

const recoverStaleSingletonLock = async(): Promise<boolean> => {
  const lockFile = getSingletonLockFile()
  if (!lockFile || !existsSync(lockFile)) return true
  if (await isSingletonLockAlive(lockFile)) return false // 确有实例在跑，保持退出
  // 残留锁：清理锁文件与配套 socket/cookie 后由调用方重试获取
  for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try { unlinkSync(path.join(path.dirname(lockFile), name)) } catch {}
  }
  return true
}

export const initSingleInstanceHandle = (startApp: () => void) => {
  // 单例应用程序
  const acquireLock = () => app.requestSingleInstanceLock()
  const registerSecondInstance = () => {
    app.on('second-instance', (event, argv, cwd) => {
      const envParams = parseEnvParams(argv)
      if (isExistMainWindow()) {
        if (envParams.deeplink) {
          global.envParams.deeplink = envParams.deeplink
          global.lx.event_app.deeplink(global.envParams.deeplink)
          return
        }
        if (envParams.openFiles.length) {
          global.envParams.openFiles = envParams.openFiles
          global.lx.event_app.open_files(envParams.openFiles)
          if (envParams.cmdParams.hidden !== true) showMainWindow()
          return
        }
        if (envParams.cmdParams.hidden !== true) {
          showMainWindow()
        }
        return
      }
      // 主窗口不存在：应用可能仍在初始化中（启动过程中再次运行）或窗口已被关闭（macOS）。
      // 此时不应退出进程，否则启动中的应用会被二次启动直接终止；
      // 改为确保应用完成初始化并创建窗口，正在退出时则忽略本次请求。
      if (global.lx.isSkipTrayQuit) return
      if (envParams.deeplink) global.envParams.deeplink = envParams.deeplink
      if (envParams.openFiles.length) global.envParams.openFiles = envParams.openFiles
      startApp()
    })
  }

  if (acquireLock()) {
    registerSecondInstance()
    return
  }
  // 首次获取失败：Linux 下可能残留上次卡死/崩溃进程的锁——探测 socket 活性并清理后重试一次；
  // 仍失败说明确有实例在运行（正常多开保护），退出
  void recoverStaleSingletonLock().then(recovered => {
    if (recovered && acquireLock()) {
      registerSecondInstance()
      return
    }
    log.warn('[single-instance] 已有实例在运行，本实例退出')
    app.quit()
    process.exit(0)
  })
}

export const applyElectronEnvParams = () => {
  // Is disable hardware acceleration
  if (global.envParams.cmdParams.dha) app.disableHardwareAcceleration()
  if (global.envParams.cmdParams.dhmkh) app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')

  // fix linux transparent fail. https://github.com/electron/electron/issues/25153#issuecomment-843688494
  if (process.platform == 'linux') app.commandLine.appendSwitch('use-gl', 'egl')

  // https://github.com/electron/electron/issues/22691
  app.commandLine.appendSwitch('wm-window-animations-disabled')

  // GPU sandbox is disabled on Linux to avoid compatibility issues with certain GPU drivers
  // This is safe for a local music player app
  if (process.platform == 'linux') app.commandLine.appendSwitch('disable-gpu-sandbox')

  // proxy
  if (global.envParams.cmdParams['proxy-server']) {
    app.commandLine.appendSwitch('proxy-server', global.envParams.cmdParams['proxy-server'])
    app.commandLine.appendSwitch('proxy-bypass-list', global.envParams.cmdParams['proxy-bypass-list'] ?? '<local>')
  }
}

export const setUserDataPath = () => {
  // windows平台下如果应用目录下存在 portable 文件夹则将数据存在此文件下
  if (process.platform == 'win32') {
    const portablePath = path.join(path.dirname(app.getPath('exe')), '/portable')
    if (existsSync(portablePath)) {
      app.setPath('appData', portablePath)
      const appDataPath = path.join(portablePath, '/userData')
      if (!existsSync(appDataPath)) mkdirSync(appDataPath)
      app.setPath('userData', appDataPath)
    }
  }

  const userDataPath = app.getPath('userData')
  global.lxOldDataPath = userDataPath
  global.lxDataPath = path.join(userDataPath, 'LxDatas')
  if (!existsSync(global.lxDataPath)) mkdirSync(global.lxDataPath)
}

export const registerDeeplink = (startApp: () => void) => {
  if (process.env.NODE_ENV !== 'production' && process.platform === 'win32') {
    // Set the path of electron.exe and your app.
    // These two additional parameters are only available on windows.
    // console.log(process.execPath, process.argv)
    app.setAsDefaultProtocolClient('lx-music-rev', process.execPath, process.argv.slice(1))
    app.setAsDefaultProtocolClient('lxmusic', process.execPath, process.argv.slice(1))
  } else {
    app.setAsDefaultProtocolClient('lx-music-rev')
    app.setAsDefaultProtocolClient('lxmusic')
  }

  // deep link
  app.on('open-url', (event, url) => {
    if (!URL_SCHEME_RXP.test(url)) return
    event.preventDefault()
    global.envParams.deeplink = url
    if (isExistMainWindow()) {
      if (global.envParams.deeplink) global.lx.event_app.deeplink(global.envParams.deeplink)
      else showMainWindow()
    } else {
      startApp()
    }
  })

  // macOS：作为系统默认音频打开程序时，Finder 双击文件触发（可能早于 ready，须在 will-finish-launching 注册）
  app.on('will-finish-launching', () => {
    app.on('open-file', (event, filePath) => {
      event.preventDefault()
      if (!isOpenFile(filePath)) return
      global.envParams.openFiles = [...new Set([...(global.envParams.openFiles ?? []), filePath])]
      if (isExistMainWindow()) {
        global.lx.event_app.open_files([filePath])
        showMainWindow()
      } else {
        startApp()
      }
    })
  })
}

// ===== 渲染进程崩溃自动恢复（main-security #4）=====
// 同一 webContents 在 CRASH_RECOVERY_WINDOW_MS（60s）内发生第 2 次及以上崩溃时停止自动 reload，
// 改为弹系统对话框提示用户重启应用，避免「崩溃 → 自动 reload → 再崩溃」的白屏死循环；
// 窗口时间过后计数重置，可再次进入自动恢复。
const CRASH_RECOVERY_WINDOW_MS = 60_000
// 窗口内允许自动 reload 的崩溃次数上限：超过（即第 2 次起）不再自动 reload
const CRASH_RECOVERY_MAX_IN_WINDOW = 1
interface RendererCrashState {
  crashTimes: number[]
  isStopped: boolean
}
const rendererCrashStates = new Map<number, RendererCrashState>()

// 记录并评估一次渲染进程崩溃：非正常退出时自动 reload；窗口内连续崩溃则停止自动恢复并提示重启
const handleRendererProcessGone = (contents: WebContents, details: RenderProcessGoneDetails) => {
  if (contents.isDestroyed()) return
  if (details.reason === 'clean-exit') return
  log.warn(`WebContents(${contents.id}) 渲染进程异常退出: reason=${details.reason}, exitCode=${details.exitCode}`)
  let state = rendererCrashStates.get(contents.id)
  if (!state) {
    state = { crashTimes: [], isStopped: false }
    rendererCrashStates.set(contents.id, state)
    contents.once('destroyed', () => {
      rendererCrashStates.delete(contents.id)
    })
  }
  const now = Date.now()
  if (state.isStopped) {
    // 距上次崩溃已超过窗口期（应用恢复稳定）时解除停止状态，允许再次自动恢复
    const lastCrashTime = state.crashTimes[state.crashTimes.length - 1]
    if (lastCrashTime != null && now - lastCrashTime <= CRASH_RECOVERY_WINDOW_MS) return
    state.isStopped = false
    state.crashTimes = []
  }
  state.crashTimes.push(now)
  while (state.crashTimes.length && now - state.crashTimes[0] > CRASH_RECOVERY_WINDOW_MS) state.crashTimes.shift()
  if (state.crashTimes.length > CRASH_RECOVERY_MAX_IN_WINDOW) {
    state.isStopped = true
    log.error(`WebContents(${contents.id}) 在 ${CRASH_RECOVERY_WINDOW_MS / 1000}s 内多次崩溃，已停止自动恢复`)
    dialog.showErrorBox(
      '渲染进程反复崩溃 / Renderer crashed repeatedly',
      '播放器窗口渲染进程在短时间内反复崩溃，已停止自动恢复。\n请重启应用以恢复正常使用。\n\nThe renderer process crashed repeatedly and automatic recovery has been stopped. Please restart the app.',
    )
    return
  }
  log.warn(`WebContents(${contents.id}) 渲染进程崩溃，自动 reload 恢复（60s 内第 ${state.crashTimes.length} 次）`)
  contents.reload()
}

export const listenerAppEvent = (startApp: () => void) => {
  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      if (process.env.NODE_ENV !== 'production') {
        return
      }
      if (!navigationUrlWhiteList.some(url => url.test(navigationUrl))) {
        event.preventDefault()
      }
    })
    contents.setWindowOpenHandler(({ url }) => {
      if (!/^devtools/.test(url) && /^https?:\/\//.test(url)) {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      // Strip away preload scripts if unused or verify their location is legitimate
      delete webPreferences.preload
      // delete webPreferences.preloadURL

      // Disable Node.js integration
      webPreferences.nodeIntegration = false

      // Verify URL being loaded
      if (!navigationUrlWhiteList.some(url => url.test(params.src))) {
        event.preventDefault()
      }
    })

    // 渲染进程崩溃自动恢复：白屏时自动 reload（带 60s 窗口退避），连续崩溃改为提示重启
    contents.on('render-process-gone', (_event, details) => {
      handleRendererProcessGone(contents, details)
    })
    // 渲染进程无响应：仅记录日志，不弹窗打扰用户
    contents.on('unresponsive', () => {
      if (contents.isDestroyed()) return
      log.warn(`WebContents(${contents.id}) 渲染进程无响应 (unresponsive)`)
    })

    // disable create dictionary
    // https://github.com/lyswhut/lx-music-desktop/issues/773
    contents.session.setSpellCheckerDictionaryDownloadURL('http://0.0.0.0')
  })

  // 主进程级监听 GPU/Utility 等子进程崩溃（不含渲染进程）：记录日志便于排查
  app.on('child-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return
    log.warn(`子进程异常退出: type=${details.type}, reason=${details.reason}, exitCode=${details.exitCode}${details.serviceName ? `, service=${details.serviceName}` : ''}`)
  })

  app.on('activate', () => {
    if (isExistMainWindow()) {
      showMainWindow()
    } else {
      startApp()
    }
  })

  app.on('before-quit', () => {
    global.lx.isSkipTrayQuit = true
  })
  app.on('window-all-closed', () => {
    if (isMac) return

    app.quit()
  })

  const initScreenParams = () => {
    global.envParams.workAreaSize = screen.getPrimaryDisplay().workAreaSize
  }
  app.on('ready', () => {
    screen.on('display-metrics-changed', initScreenParams)
    initScreenParams()
  })

  nativeTheme.addListener('updated', () => {
    const shouldUseDarkColors = nativeTheme.shouldUseDarkColors
    if (shouldUseDarkColors == global.lx.theme.shouldUseDarkColors) return
    global.lx.theme.shouldUseDarkColors = shouldUseDarkColors
    global.lx?.event_app.system_theme_change(shouldUseDarkColors)
  })

  const setProxy = () => {
    const proxy = getProxy()
    if (proxy) {
      setProxyByHost(proxy.host, proxy.port ? String(proxy.port) : undefined)
    } else setProxyByHost()
  }
  global.lx.event_app.on('updated_config', (keys, setting) => {
    if (keys.includes('network.proxy.enable') || (global.lx.appSetting['network.proxy.enable'] && keys.some(k => k.includes('network.proxy.')))) {
      setProxy()
    }

    if (keys.includes('player.volume')) {
      global.lx.event_app.player_status({ volume: Math.trunc(setting['player.volume']! * 100) })
    }
    if (keys.includes('player.isMute')) {
      global.lx.event_app.player_status({ mute: setting['player.isMute'] })
    }
  })
  global.lx.event_app.on('app_inited', () => {
    setProxy()
  })
}

const initTheme = () => {
  global.lx.theme = getTheme()
  const themeConfigKeys = ['theme.id', 'theme.lightId', 'theme.darkId']
  global.lx.event_app.on('updated_config', (keys) => {
    let requireUpdate = false
    for (const key of keys) {
      if (themeConfigKeys.includes(key)) {
        requireUpdate = true
        break
      }
    }
    if (requireUpdate) {
      global.lx.theme = getTheme()
      global.lx.event_app.theme_change()
    }
  })
  global.lx.event_app.on('system_theme_change', () => {
    if (global.lx.appSetting['theme.id'] == 'auto') {
      global.lx.theme = getTheme()
      global.lx.event_app.theme_change()
    }
  })
}

// 把损坏的数据库文件（含 -wal/-shm 伴生文件）重命名备份为带时间戳的 .bak（main-security #3）
// 逐个 try/catch：伴生文件可能不存在，不影响主文件备份
const backupDBFiles = (backupPath: string) => {
  const dbPath = path.join(global.lxDataPath, 'lx.data.db')
  try {
    renameSync(dbPath, backupPath)
  } catch {}
  try {
    renameSync(`${dbPath}-wal`, `${backupPath}-wal`)
  } catch {}
  try {
    renameSync(`${dbPath}-shm`, `${backupPath}-shm`)
  } catch {}
}

const backupDB = (backupPath: string) => {
  backupDBFiles(backupPath)
  openDirInExplorer(backupPath)
}

// 打开数据库并自动恢复（main-security #3）：
// db 打开/迁移抛错（多为数据库文件损坏无法解析）时，先备份损坏文件为时间戳 .bak，
// 再重新 init（worker 内 new DatabaseSync + migrate 重建全新库）并 log.warn 告知已恢复；
// 重建仍失败才向上抛出，由 index.ts 初始化失败的通用弹窗提示
const initDBWithAutoRecovery = async(): Promise<boolean | null> => {
  try {
    return await global.lx.worker.dbService.init(global.lxDataPath)
  } catch (err) {
    log.warn('数据库打开或迁移失败，尝试备份损坏文件后重建:', err)
    const backupPath = path.join(global.lxDataPath, `lx.data.db.${Date.now()}.bak`)
    backupDBFiles(backupPath)
    try {
      const dbFileExists = await global.lx.worker.dbService.init(global.lxDataPath)
      log.warn(`数据库已重建并初始化成功（原数据将丢失），损坏的数据库已备份到：${backupPath}`)
      return dbFileExists
    } catch (err2) {
      log.error('备份损坏文件后重建数据库仍失败:', err2)
      throw err2
    }
  }
}

let isInitialized = false
export const initAppSetting = async() => {
  if (!global.lx.inited) {
    const config = await initHotKey()
    global.lx.hotKey.config.local = config.local
    global.lx.hotKey.config.global = config.global
    global.lx.inited = true
  }

  if (!isInitialized) {
    // init 内部对打开/迁移失败做了「备份损坏文件 → 重建」自动恢复，此处只处理表结构校验失败分支
    let dbFileExists = await initDBWithAutoRecovery()
    if (dbFileExists === null) {
      const backupPath = path.join(global.lxDataPath, `lx.data.db.${Date.now()}.bak`)
      dialog.showMessageBoxSync({
        type: 'warning',
        message: 'Database verify failed',
        detail: `数据库表结构校验失败，我们将把有问题的数据库备份到：${backupPath}\n若此问题导致你的数据丢失，你可以尝试从备份文件找回它们。\n\nThe database table structure verification failed, we will back up the problematic database to: ${backupPath}\nIf this problem causes your data to be lost, you can try to retrieve them from the backup file.`,
      })
      backupDB(backupPath)
      dbFileExists = await global.lx.worker.dbService.init(global.lxDataPath)
    }
    global.lx.appSetting = (await initSetting()).setting
    if (!dbFileExists) await migrateDBData().catch(err => { log.error(err) })
    initTheme()
    if (global.envParams.cmdParams.dt == null) {
      // Wayland 合成器下透明窗口不可见（KWin/Chromium 限制），强制使用不透明模式
      const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY
      global.envParams.cmdParams.dt = !global.lx.appSetting['common.transparentWindow'] || (isLinux && isWayland)
    }
    // eslint-disable-next-line require-atomic-updates -- 初始化由 index.ts 的 initing 锁保护，不会并发执行
    isInitialized = true
  }
}

export const quitApp = () => {
  if (global.lx.isSkipTrayQuit) return
  global.lx.isSkipTrayQuit = true
  // 1. 先显示主窗口：使托盘菜单失去焦点并收起，
  //    避免在菜单仍展开时注销托盘（StatusNotifierItem）导致桌面环境报错
  showMainWindow()
  // 2. 再注销托盘：等待托盘菜单真正关闭后再销毁
  setTimeout(() => {
    destroyTray()
    // 3. 最后结束进程
    app.quit()
  }, 100)
}

export const forceQuitApp = () => {
  // 强制退出：不触发窗口关闭流程，直接结束进程；退出前注销托盘避免任务栏残留图标
  // 注意：与 quitApp 不同，此路径不等待托盘菜单收起（当前无调用方从托盘菜单触发强制退出）
  destroyTray()
  app.exit(0)
}
