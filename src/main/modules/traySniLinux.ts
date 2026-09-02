import * as dbus from 'dbus-next'
import { Variant } from 'dbus-next'
import { parseSignature } from 'dbus-next/lib/signature'
import { env as processEnv } from 'node:process'
import { nativeImage } from 'electron'
import { log } from '@common/utils'

const { Interface } = dbus.interface

const SNI_IFACE = 'org.kde.StatusNotifierItem'
const MENU_IFACE = 'com.canonical.dbusmenu'
const SNI_PATH = '/StatusNotifierItem'
const MENU_PATH = '/org/lxmusic/TrayMenu'

export interface TraySniMenuItem {
  id: number
  label?: string
  type?: 'normal' | 'separator'
  enabled?: boolean
  onClick?: () => void
}

let bus: dbus.MessageBus | null = null
let serviceName = ''
let sniIface: SNIInterface | null = null
let menuIface: MenuInterface | null = null
let menuItems: TraySniMenuItem[] = []
let menuRevision = 1
let iconPixmaps: Array<[number, number, Buffer]> = []
let tooltipText = 'LX Music'
let trayTitle = ''
let activateHandler: (() => void) | null = null
let menuRefreshHandler: (() => void) | null = null

const toArgb = (img: Electron.NativeImage): [number, number, Buffer] => {
  const bmp = img.toBitmap() // BGRA premultiplied
  const { width, height } = img.getSize()
  const out = Buffer.alloc(width * height * 4)
  const n = width * height
  for (let i = 0; i < n; i++) {
    const b = bmp[i * 4], g = bmp[i * 4 + 1], r = bmp[i * 4 + 2], a = bmp[i * 4 + 3]
    out[i * 4] = a
    if (a === 0) { out[i * 4 + 1] = out[i * 4 + 2] = out[i * 4 + 3] = 0; continue }
    out[i * 4 + 1] = Math.min(255, Math.round(r * 255 / a))
    out[i * 4 + 2] = Math.min(255, Math.round(g * 255 / a))
    out[i * 4 + 3] = Math.min(255, Math.round(b * 255 / a))
  }
  return [width, height, out]
}

export const setSniIcon = (pngPath: string) => {
  iconPixmaps = []
  for (const file of [pngPath, pngPath.replace(/\.png$/, '@2x.png')]) {
    const img = nativeImage.createFromPath(file)
    if (!img.isEmpty()) iconPixmaps.push(toArgb(img))
  }
  if (sniIface) Interface.emitPropertiesChanged(sniIface, { IconPixmap: iconPixmaps }, [])
}

// 与 Electron setToolTip 传同一段文本；SNI 规范拆分为 (title, description)
export const setSniToolTip = (tip: string) => {
  tooltipText = tip
  if (sniIface) Interface.emitPropertiesChanged(sniIface, { ToolTip: [tooltipText, iconPixmaps, tooltipText.split('\n')[0], tooltipText] }, [])
}

export const setSniTitle = (title: string) => {
  trayTitle = title
  if (sniIface) Interface.emitPropertiesChanged(sniIface, { Title: trayTitle }, [])
}

// KDE 弹出托盘菜单前会发 AboutToShow；按 dbusmenu 协议，菜单持有方应
// 在此刷新菜单并发出 LayoutUpdated，KDE 收到后才重新 GetLayout。
export const setSniMenuRefreshHandler = (handler: () => void) => { menuRefreshHandler = handler }

export const setSniMenu = (items: TraySniMenuItem[]) => {
  menuItems = items
  menuRevision++
  if (menuIface) {
    menuIface.emitMenuUpdate(menuRevision, 0)
  }
}

const registerMembers = (klass: any, members: { methods?: Record<string, any>, properties?: Record<string, any>, signals?: Record<string, any> }) => {
  const proto = klass.prototype
  if (members.methods) {
    proto.$methods = proto.$methods || {}
    for (const key of Object.keys(members.methods)) {
      const m = members.methods[key]
      // introspection 需要真实的签名树（可迭代），不能用 {length} 之类的假对象
      m.inSignatureTree = parseSignature(m.inSignature || '')
      m.outSignatureTree = parseSignature(m.outSignature || '')
    }
    Object.assign(proto.$methods, members.methods)
  }
  if (members.properties) { proto.$properties = proto.$properties || {}; Object.assign(proto.$properties, members.properties) }
  if (members.signals) {
    proto.$signals = proto.$signals || {}
    for (const key of Object.keys(members.signals)) {
      members.signals[key].signatureTree = parseSignature(members.signals[key].signature || '')
    }
    Object.assign(proto.$signals, members.signals)
  }
}

// ---------- SNI interface ----------
class SNIInterface extends Interface {
  constructor() {
    super(SNI_IFACE)
    registerMembers(SNIInterface, {
      methods: {
        Activate: { name: 'Activate', inSignature: 'ii', outSignature: '', fn: () => { activateHandler?.() } },
        SecondaryActivate: { name: 'SecondaryActivate', inSignature: 'ii', outSignature: '', fn: () => { activateHandler?.() } },
        ContextMenu: { name: 'ContextMenu', inSignature: 'ii', outSignature: '', fn: () => {} },
        Scroll: { name: 'Scroll', inSignature: 'is', outSignature: '', fn: () => {} },
      },
      properties: {
        Category: { name: 'Category', signature: 's', access: 'read' },
        Id: { name: 'Id', signature: 's', access: 'read' },
        Title: { name: 'Title', signature: 's', access: 'read' },
        Status: { name: 'Status', signature: 's', access: 'read' },
        WindowId: { name: 'WindowId', signature: 'i', access: 'read' },
        IconName: { name: 'IconName', signature: 's', access: 'read' },
        IconPixmap: { name: 'IconPixmap', signature: 'a(iiay)', access: 'read' },
        OverlayIconName: { name: 'OverlayIconName', signature: 's', access: 'read' },
        OverlayIconPixmap: { name: 'OverlayIconPixmap', signature: 'a(iiay)', access: 'read' },
        AttentionIconName: { name: 'AttentionIconName', signature: 's', access: 'read' },
        AttentionIconPixmap: { name: 'AttentionIconPixmap', signature: 'a(iiay)', access: 'read' },
        AttentionMovieName: { name: 'AttentionMovieName', signature: 's', access: 'read' },
        ToolTip: { name: 'ToolTip', signature: '(sa(iiay)ss)', access: 'read' },
        ItemIsMenu: { name: 'ItemIsMenu', signature: 'b', access: 'read' },
        Menu: { name: 'Menu', signature: 'o', access: 'read' },
      },
    })
  }
  get Category() { return 'ApplicationStatus' }
  get Id() { return 'lx-music-rev' }
  get Title() { return trayTitle }
  get Status() { return 'Active' }
  get WindowId() { return 0 }
  get IconName() { return '' }
  get IconPixmap() { return iconPixmaps }
  get OverlayIconName() { return '' }
  get OverlayIconPixmap() { return [] }
  get AttentionIconName() { return '' }
  get AttentionIconPixmap() { return [] }
  get AttentionMovieName() { return '' }
  get ToolTip() { return [tooltipText, iconPixmaps, tooltipText.split('\n')[0], tooltipText] }
  get ItemIsMenu() { return false }
  get Menu() { return MENU_PATH }
}

// ---------- dbusmenu interface ----------
class MenuInterface extends Interface {
  private static buildItemProps(item: TraySniMenuItem): Record<string, Variant> {
    const props: Record<string, Variant> = item.type === 'separator'
      ? { type: new Variant('s', 'separator') }
      : { label: new Variant('s', item.label ?? '') }
    if (item.enabled === false) props.enabled = new Variant('b', false)
    return props
  }
  constructor() {
    super(MENU_IFACE)
    const self = this
    registerMembers(MenuInterface, {
      methods: {
        GetLayout: { name: 'GetLayout', inSignature: 'iias', outSignature: 'u(ia{sv}av)', fn: (parentId: number, recursionDepth: number, propNames: string[]) => self.buildLayout(parentId) },
        GetGroupProperties: { name: 'GetGroupProperties', inSignature: 'ai', outSignature: 'a(ia{sv})', fn: (ids: number[]) => self.buildGroupProps(ids) },
        GetProperty: { name: 'GetProperty', inSignature: 'is', outSignature: 'v', fn: () => new Variant('s', '') },
        Event: { name: 'Event', inSignature: 'isvu', outSignature: '', fn: (id: number, eventId: string, data: unknown, timestamp: number) => self.handleEvent(id, eventId) },
        EventGroup: { name: 'EventGroup', inSignature: 'a(isv)', outSignature: '', fn: () => {} },
        AboutToShow: { name: 'AboutToShow', inSignature: 'i', outSignature: '', fn: () => { menuRefreshHandler?.() } },
      },
      signals: {
        LayoutUpdated: { name: 'LayoutUpdated', signature: 'ui' },
        ItemsPropertiesUpdated: { name: 'ItemsPropertiesUpdated', signature: 'a(ia{sv})ai' },
      },
    })
  }
  buildLayout(parentId: number): [number, [number, Record<string, Variant>, Variant[]]] {
    const rootProps: Record<string, Variant> = { 'children-display': new Variant('s', 'submenu') }
    const children: Variant[] = menuItems.map(item => new Variant('(ia{sv}av)', [item.id, MenuInterface.buildItemProps(item), []]))
    return [menuRevision, [0, rootProps, children]]
  }
  buildGroupProps(ids: number[]): Array<[number, Record<string, Variant>]> {
    const result: Array<[number, Record<string, Variant>]> = []
    for (const id of ids) {
      const item = menuItems.find(i => i.id === id)
      if (item) result.push([id, MenuInterface.buildItemProps(item)])
    }
    return result
  }
  handleEvent(id: number, eventId: string) {
    if (eventId !== 'clicked') return
    menuItems.find(i => i.id === id)?.onClick?.()
  }
  emitMenuUpdate(revision: number, parentId: number) {
    const options = this.constructor.prototype.$signals['LayoutUpdated']
    // $emitter 为 dbus-next 内部实现（d.ts 未声明），通过 any 桥接
    ;(this as any).$emitter.emit('signal', options, [revision, parentId])
  }
}

const registerWithWatcher = async() => {
  if (!bus) return
  const proxy = await bus.getProxyObject('org.kde.StatusNotifierWatcher', '/StatusNotifierWatcher')
  const watcher = proxy.getInterface('org.kde.StatusNotifierWatcher')
  await watcher.RegisterStatusNotifierItem(serviceName)
}

export const createSniTray = async(onShowWindow: () => void) => {
  if (bus) return
  activateHandler = onShowWindow
  try {
    const busAddress =
      processEnv.DBUS_SESSION_BUS_ADDRESS
      ?? (processEnv.XDG_RUNTIME_DIR ? `unix:path=${processEnv.XDG_RUNTIME_DIR}/bus` : undefined)
    bus = dbus.sessionBus(busAddress ? { busAddress } : undefined)

    serviceName = `org.freedesktop.StatusNotifierItem-${process.pid}-1`
    let reply = await bus.requestName(serviceName, dbus.NameFlag.DO_NOT_QUEUE)
    if (reply !== dbus.RequestNameReply.PRIMARY_OWNER) {
      serviceName = `org.freedesktop.StatusNotifierItem-${process.pid}-2`
      reply = await bus.requestName(serviceName, dbus.NameFlag.DO_NOT_QUEUE)
    }
    sniIface = new SNIInterface()
    menuIface = new MenuInterface()
    bus.export(SNI_PATH, sniIface)
    bus.export(MENU_PATH, menuIface)
    // 注册给 KDE watcher；watcher 可能尚未就绪，重试几次
    for (let i = 0; i < 5; i++) {
      try { await registerWithWatcher(); return } catch (err) { log.error('register watcher retry', err); await new Promise(r => setTimeout(r, 400)) }
    }
  } catch (err) {
    log.error('tray sni create failed:', err)
    destroySniTray()
  }
}

export const destroySniTray = () => {
  activateHandler = null
  menuRefreshHandler = null
  if (bus && serviceName) {
    try { void bus.releaseName(serviceName) } catch {}
  }
  try { bus?.disconnect() } catch {}
  bus = null
  sniIface = null
  menuIface = null
  menuItems = []
}
