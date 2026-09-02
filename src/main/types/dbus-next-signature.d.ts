declare module 'dbus-next/lib/signature' {
  /**
   * 解析 DBus 类型签名，返回 dbus-next 内部使用的签名树。
   * 仅用于 dbus-next 服务端 introspection 生成（$introspect 遍历树并 collapse 回签名串）。
   */
  export function parseSignature(signature: string): any[]
  export function collapseSignature(tree: any): string
}