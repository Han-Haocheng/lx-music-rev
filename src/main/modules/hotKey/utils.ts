import { globalShortcut } from 'electron'
import { HOTKEY_COMMON, HOTKEY_DESKTOP_LYRIC, HOTKEY_PLAYER } from '@common/hotKey'
import { log } from '@common/utils'

// 已知全局热键动作白名单（common/hotKey.ts 中定义的全部 action，形如 "common_min"/"player_next"/"desktop_lyric_toggle_visible"）：
// 启动时遍历存储的全局热键配置逐个注册，配置里可能残留未知 action（旧版本遗留等），
// 这类动作注册后没有任何监听响应，只会白白占用系统全局键，故注册前过滤，只保留已知动作
const knownHotkeyActions = new Set<string>([
  ...Object.values(HOTKEY_COMMON),
  ...Object.values(HOTKEY_PLAYER),
  ...Object.values(HOTKEY_DESKTOP_LYRIC),
].map(item => item.action))
const isKnownHotkeyAction = (info?: LX.HotKey) => {
  const action = info?.action
  return !!action && knownHotkeyActions.has(action)
}

export const handleKeyDown = (key: string) => {
  if (!global.lx.hotKey.enable) return
  global.lx.event_app.hot_key_down({ type: 'global', key })
}

const transformedKeyRxp = /(^|\+)[a-z]/g

export const transformedKey = (key: string): string => {
  if (key.includes('arrow')) key = key.replace(/arrow/g, '')
  return key.replace('mod', 'CommandOrControl').replace(transformedKeyRxp, l => l.toUpperCase())
}

export const registerHotkey = ({ key, info }: LX.RegisterKeyInfo): boolean => {
  // 白名单过滤：未知 action 不注册系统全局键（覆盖启动 init、启用重注册及渲染层 register IPC 各入口）
  if (!isKnownHotkeyAction(info)) {
    log.warn(`Ignore registering global hotkey with unknown action: action=${info?.action}, key=${key}`)
    return false
  }
  let targetKey = global.lx.hotKey.state.get(key)
  if (targetKey?.status) return true
  const transKey = transformedKey(key)
  // console.log('Register key:', transKey)
  if (targetKey) {
    targetKey.info = info
  } else {
    targetKey = {
      status: false,
      info,
    }
    global.lx.hotKey.state.set(key, targetKey)
  }
  const status = targetKey.status = globalShortcut.isRegistered(transKey)
    ? false
    : globalShortcut.register(transKey, () => {
      handleKeyDown(key)
    })
  return status
}

export const unRegisterHotkey = (key: string) => {
  let transKey = transformedKey(key)
  // console.log('Unregister key:', transKey)
  globalShortcut.unregister(transKey)
  global.lx.hotKey.state.delete(key)
}

export const unRegisterHotkeyAll = () => {
  global.lx.hotKey.state.clear()
  globalShortcut.unregisterAll()
}


const handleRegisterHotkey = (data: LX.RegisterKeyInfo) => {
  const ret = registerHotkey(data)
  // 未知动作已由 registerHotkey 过滤告警，这里只记录已知动作注册失败（如键位被其它应用占用）的情况
  if (!ret && isKnownHotkeyAction(data.info)) log.info('Register hot key failed:', data.key)
}


export const init = (isForce = false) => {
  unRegisterHotkeyAll()
  if (!isForce && !global.lx.hotKey.config.global.enable) return
  // global.lx.hotKey.state = {}
  // console.log(global.lx.hotKey.config.global.keys)
  for (const key of Object.keys(global.lx.hotKey.config.global.keys)) {
    try {
      handleRegisterHotkey({ key, info: global.lx.hotKey.config.global.keys[key] })
    } catch (err) {
      log.info(err)
    }
  }
}
