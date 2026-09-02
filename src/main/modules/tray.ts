import { Tray, Menu, nativeImage } from 'electron'
import { isLinux, isMac, isWin } from '@common/utils'
import { createSniTray, destroySniTray, setSniIcon, setSniMenu, setSniMenuRefreshHandler, setSniTitle, setSniToolTip } from './traySniLinux'
import type { TraySniMenuItem } from './traySniLinux'
import path from 'node:path'
import {
  hideWindow as hideMainWindow,
  isExistWindow as isExistMainWindow,
  isShowWindow as isShowMainWindow,
  sendTaskbarButtonClick,
  showWindow as showMainWindow,
} from './winMain'
import { quitApp } from '@main/app'
import { TRAY_AUTO_ID } from '@common/constants'

let tray: Electron.Tray | null
let isEnableTray: boolean = false
let themeId: number
let isShowStatusBarLyric: boolean = false

const playerState = {
  empty: false,
  collect: false,
  play: false,
  next: true,
  prev: true,
}

const watchConfigKeys = [
  'desktopLyric.enable',
  'desktopLyric.isLock',
  'desktopLyric.isAlwaysOnTop',
  'tray.themeId',
  'tray.enable',
  'player.isShowStatusBarLyric',
  'common.langId',
] satisfies Array<keyof LX.AppSetting>

const themeList = [
  {
    id: 0,
    fileName: 'trayTemplate',
    isNative: true,
  },
  {
    id: 1,
    fileName: 'tray_origin',
    isNative: false,
  },
  {
    id: 2,
    fileName: 'tray_black',
    isNative: false,
  },
]

const messages = {
  'en-us': {
    collect: 'Love',
    uncollect: 'Unlove',
    play: 'Play',
    pause: 'Pause',
    next: 'Next Song',
    prev: 'Prev Song',
    hide_win_main: 'Hide Main Window',
    show_win_main: 'Show Main Window',
    hide_win_lyric: 'Hide Lyric Window',
    show_win_lyric: 'Show Lyric Window',
    lock_win_lyric: 'Lock Lyric Window',
    unlock_win_lyric: 'Unlock Lyric Window',
    top_win_lyric: 'On-top Lyric Window',
    untop_win_lyric: 'Un-top Lyric Window',
    show_statusbar_lyric: 'Show Lyrics on Statusbar',
    hide_statusbar_lyric: 'Hide Lyrics on Statusbar',
    exit: 'Exit',
    music_name: 'Title: ',
    music_singer: 'Artist: ',
  },
  'zh-cn': {
    collect: '收藏',
    uncollect: '取消收藏',
    play: '播放',
    pause: '暂停',
    next: '下一曲',
    prev: '上一曲',
    hide_win_main: '隐藏主界面',
    show_win_main: '显示主界面',
    hide_win_lyric: '关闭桌面歌词',
    show_win_lyric: '开启桌面歌词',
    lock_win_lyric: '锁定桌面歌词',
    unlock_win_lyric: '解锁桌面歌词',
    top_win_lyric: '置顶歌词',
    untop_win_lyric: '取消置顶',
    show_statusbar_lyric: '显示状态栏歌词',
    hide_statusbar_lyric: '隐藏状态栏歌词',
    exit: '退出',
    music_name: '歌曲名: ',
    music_singer: '艺术家: ',
  },
  'zh-tw': {
    collect: '收藏',
    uncollect: '取消收藏',
    play: '播放',
    pause: '暫停',
    next: '下一曲',
    prev: '上一曲',
    hide_win_main: '隱藏軟體視窗',
    show_win_main: '顯示軟體視窗',
    hide_win_lyric: '關閉歌詞視窗',
    show_win_lyric: '開啟歌詞視窗',
    lock_win_lyric: '鎖定歌詞視窗',
    unlock_win_lyric: '解鎖歌詞視窗',
    top_win_lyric: '置頂歌詞視窗',
    untop_win_lyric: '取消置頂歌詞視窗',
    show_statusbar_lyric: '顯示狀態列歌詞',
    hide_statusbar_lyric: '隱藏狀態列歌詞',
    exit: '退出',
    music_name: '標題: ',
    music_singer: '演出者: ',
  },
} as const
type Messages = typeof messages
type Langs = keyof Messages
const i18n = {
  message: messages['zh-cn'] as Messages[Langs],
  fallbackLocale: 'en-us' as 'en-us',
  getMessage(key: keyof Messages[Langs]) {
    return this.message[key]
  },
  setLang(lang?: Langs | null) {
    this.message = lang
      ? messages[lang] ?? messages[this.fallbackLocale]
      : messages[this.fallbackLocale]
  },
}

const getIconPath = (id: number) => {
  let theme = id == TRAY_AUTO_ID
    ? global.lx.theme.shouldUseDarkColors
      ? themeList[0] : themeList[2]
    : themeList.find(item => item.id === id) ?? themeList[0]
  return path.join(global.staticPath, 'images/tray', theme.fileName + (isWin ? '.ico' : '.png'))
}

export const createTray = () => {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  if ((tray && !tray.isDestroyed()) || !global.lx.appSetting['tray.enable']) return

  // Linux：KDE Plasma 6 的 StatusNotifierWatcher 忽略 Electron 的
  // “服务名+对象路径”注册形式且固定查询 /StatusNotifierItem 根路径，
  // 官方修复（electron#53214）只进 44.x，本 fork 固定 43.4.1（44 在 Wayland 下窗口无法显示），
  // 故 Linux 下不用 Electron Tray，改用自实现的 StatusNotifierItem（见 traySniLinux.ts）。
  // 左键点击（Activate）→ 显示主窗口；右键弹出 dbusmenu 菜单。
  if (isLinux) {
    isSniActive = true
    // KDE 弹出菜单前（AboutToShow）刷新菜单并广播 LayoutUpdated，驱动 KDE 重新拉取布局
    setSniMenuRefreshHandler(() => {
      createMenu()
    })
    void createSniTray(() => {
      showMainWindow()
    })
    return
  }
  // 托盘
  tray = new Tray(nativeImage.createFromPath(getIconPath(global.lx.appSetting['tray.themeId'])))

  tray.setIgnoreDoubleClickEvents(true)
  tray.on('click', () => {
    showMainWindow()
  })
}

let isSniActive = false

export const destroyTray = () => {
  if (isLinux) {
    if (!isSniActive) return
    destroySniTray()
    isSniActive = false
    isEnableTray = false
    isShowStatusBarLyric = false
    return
  }
  if (!tray) return
  tray.destroy()
  isEnableTray = false
  isShowStatusBarLyric = false
  tray = null
}

const handleUpdateConfig = (setting: Partial<LX.AppSetting>) => {
  global.lx.event_app.update_config(setting)
}

let menuItemIdSeed = 0
const nextMenuItemId = () => ++menuItemIdSeed

const createPlayerMenu = (): TraySniMenuItem[] => {
  const menu: TraySniMenuItem[] = []
  menu.push({
    id: nextMenuItemId(),
    label: i18n.getMessage(playerState.play ? 'pause' : 'play'),
    onClick: () => {
      sendTaskbarButtonClick(playerState.play ? 'pause' : 'play')
    },
  })
  menu.push({
    id: nextMenuItemId(),
    label: i18n.getMessage('prev'),
    onClick: () => {
      sendTaskbarButtonClick('prev')
    },
  })
  menu.push({
    id: nextMenuItemId(),
    label: i18n.getMessage('next'),
    onClick: () => {
      sendTaskbarButtonClick('next')
    },
  })
  menu.push({
    id: nextMenuItemId(),
    label: i18n.getMessage(playerState.collect ? 'uncollect' : 'collect'),
    onClick: () => {
      sendTaskbarButtonClick(playerState.collect ? 'unCollect' : 'collect')
    },
  })
  return menu
}

export const createMenu = () => {
  menuItemIdSeed = 0
  const menu: TraySniMenuItem[] = createPlayerMenu()
  if (playerState.empty) for (const m of menu) m.enabled = false
  menu.push({ id: nextMenuItemId(), type: 'separator' })
  menu.push({
    id: nextMenuItemId(),
    label: i18n.getMessage(global.lx.appSetting['desktopLyric.enable'] ? 'hide_win_lyric' : 'show_win_lyric'),
    onClick: () => {
      handleUpdateConfig({ 'desktopLyric.enable': !global.lx.appSetting['desktopLyric.enable'] })
    },
  })
  menu.push({
    id: nextMenuItemId(),
    label: i18n.getMessage(global.lx.appSetting['desktopLyric.isLock'] ? 'unlock_win_lyric' : 'lock_win_lyric'),
    onClick: () => {
      handleUpdateConfig({ 'desktopLyric.isLock': !global.lx.appSetting['desktopLyric.isLock'] })
    },
  })
  menu.push({
    id: nextMenuItemId(),
    label: i18n.getMessage(global.lx.appSetting['desktopLyric.isAlwaysOnTop'] ? 'untop_win_lyric' : 'top_win_lyric'),
    onClick: () => {
      handleUpdateConfig({ 'desktopLyric.isAlwaysOnTop': !global.lx.appSetting['desktopLyric.isAlwaysOnTop'] })
    },
  })
  if (isMac) {
    menu.push({ id: nextMenuItemId(), type: 'separator' })
    menu.push({
      id: nextMenuItemId(),
      label: i18n.getMessage(isShowStatusBarLyric ? 'hide_statusbar_lyric' : 'show_statusbar_lyric'),
      onClick: () => {
        handleUpdateConfig({ 'player.isShowStatusBarLyric': !isShowStatusBarLyric })
      },
    })
  }
  menu.push({ id: nextMenuItemId(), type: 'separator' })
  if (isExistMainWindow()) {
    const isShow = isShowMainWindow()
    menu.push({
      id: nextMenuItemId(),
      label: i18n.getMessage(isShow ? 'hide_win_main' : 'show_win_main'),
      onClick: () => {
        isShow ? hideMainWindow() : showMainWindow()
      },
    })
  }
  menu.push({
    id: nextMenuItemId(),
    label: i18n.getMessage('exit'),
    onClick: () => {
      quitApp()
    },
  })
  if (isLinux) {
    setSniMenu(menu)
    return
  }
  if (!tray) return
  const contextMenu = Menu.buildFromTemplate(menu.map(item => ({
    label: item.label,
    type: item.type ?? 'normal',
    enabled: item.enabled !== false,
    click: item.onClick,
  })))
  tray.setContextMenu(contextMenu)
}

export const setTrayImage = (themeId: number) => {
  if (isLinux) {
    setSniIcon(getIconPath(themeId))
    return
  }
  if (!tray) return
  tray.setImage(nativeImage.createFromPath(getIconPath(themeId)))
}

const setLyric = (lyricLineText?: string) => {
  if (!isShowStatusBarLyric || lyricLineText == null) return
  if (isLinux) {
    setSniTitle(lyricLineText)
    return
  }
  if (tray) tray.setTitle(lyricLineText)
}

const defaultTip = 'LX Music'
const buildTip = () => {
  let name = global.lx.player_status.name
  let tip: string
  if (name) {
    if (name.length > 20) name = name.substring(0, 20) + '...'
    let singer = global.lx.player_status.singer
    if (singer?.length > 20) singer = singer.substring(0, 20) + '...'

    tip = `${defaultTip}\n${i18n.getMessage('music_name')}${name}${singer ? `\n${i18n.getMessage('music_singer')}${singer}` : ''}`
  } else tip = defaultTip
  return tip
}
const setTip = () => {
  const tip = buildTip()
  if (isLinux) {
    setSniToolTip(tip)
    return
  }
  if (!tray) return
  tray.setToolTip(tip)
}

const init = () => {
  if (themeId != global.lx.appSetting['tray.themeId']) {
    themeId = global.lx.appSetting['tray.themeId']
    setTrayImage(themeId)
  }
  if (isEnableTray !== global.lx.appSetting['tray.enable']) {
    isEnableTray = global.lx.appSetting['tray.enable']
    global.lx.appSetting['tray.enable'] ? createTray() : destroyTray()
  }
  if (isShowStatusBarLyric !== global.lx.appSetting['player.isShowStatusBarLyric']) {
    isShowStatusBarLyric = global.lx.appSetting['player.isShowStatusBarLyric']
    if (isShowStatusBarLyric) {
      setLyric(global.lx.player_status.lyricLineText)
    } else {
      if (isLinux) setSniTitle('')
      else tray?.setTitle('')
    }
  }
  setTip()
  createMenu()
}

export default () => {
  global.lx.event_app.on('updated_config', (keys, setting) => {
    if (!watchConfigKeys.some(key => keys.includes(key))) return

    if (keys.includes('common.langId')) i18n.setLang(setting['common.langId'])

    init()
  })

  global.lx.event_app.on('main_window_ready_to_show', () => {
    createMenu()
  })
  global.lx.event_app.on('main_window_show', () => {
    createMenu()
  })
  if (!isWin) {
    global.lx.event_app.on('main_window_focus', () => {
      createMenu()
    })
    global.lx.event_app.on('main_window_blur', () => {
      createMenu()
    })
  }
  global.lx.event_app.on('main_window_hide', () => {
    createMenu()
  })
  global.lx.event_app.on('main_window_close', () => {
    // 退出流程由 quitApp 统一处理：先显示主窗口使托盘菜单收起，再注销托盘，最后退出进程。
    // 此处为兜底注销（quitApp 已注销过则为幂等空操作），保证任何路径下托盘都会被清理。
    destroyTray()
  })

  global.lx.event_app.on('app_inited', () => {
    i18n.setLang(global.lx.appSetting['common.langId'])
    init()
  })

  global.lx.event_app.on('system_theme_change', () => {
    if (global.lx.appSetting['tray.themeId'] != TRAY_AUTO_ID) return
    setTrayImage(global.lx.appSetting['tray.themeId'])
  })

  global.lx.event_app.on('player_status', (status) => {
    let updated = false
    if (status.status) {
      switch (status.status) {
        case 'paused':
          playerState.play = false
          playerState.empty &&= false
          setLyric('')
          break
        case 'error':
          playerState.play = false
          playerState.empty &&= false
          setLyric('')
          break
        case 'playing':
          playerState.play = true
          playerState.empty &&= false
          setLyric(global.lx.player_status.lyricLineText)
          break
        case 'stoped':
          playerState.play &&= false
          playerState.empty = true
          setLyric('')
          break
      }
      updated = true
    } else {
      setLyric(status.lyricLineText)
    }
    if (status.name != null) setTip()
    if (status.singer != null) setTip()
    if (status.collect != null) {
      playerState.collect = status.collect
      updated = true
    }
    if (updated) init()
  })
}
