import fs from 'node:fs'
import path from 'node:path'
import { app, net, type Session } from 'electron'
// electron-devtools-installer 的唯一依赖 unzip-crx-3，
// 可同时解压 CRX2/CRX3（Cr24 开头）及纯 ZIP（PK 开头）格式的扩展文件
import unzip from 'unzip-crx-3'

const getExtensionsDir = () => path.join(app.getPath('userData'), 'extensions')

const downloadFile = async(url: string, session: Session, filePath: string) => {
  return new Promise<void>((resolve, reject) => {
    const request = net.request({ url, session })
    request.on('response', (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        request.abort()
        reject(new Error('HTTP ' + res.statusCode))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      res.on('end', () => {
        void fs.promises.writeFile(filePath, Buffer.concat(chunks)).then(() => { resolve() }, reject)
      })
      res.on('error', (err: Error) => { reject(err) })
    })
    request.on('error', reject)
    request.end()
  })
}

const changePermissions = (dir: string) => {
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name)
    fs.chmodSync(filePath, 0o755)
    if (fs.statSync(filePath).isDirectory()) changePermissions(filePath)
  }
}

const installingPromises = new Map<string, Promise<void>>()

/**
 * 下载并安装 Chrome 扩展到指定 session（仅用于开发模式）
 *
 * Chrome 网上应用店已不再为旧版 prodversion（如固定的 32）提供扩展文件，
 * 必须传入当前 Electron 对应的 Chromium 版本号才能正确返回扩展内容，
 * 否则返回的响应不是 CRX/ZIP 文件，解压时会报 "Invalid header: Does not start with Cr24"。
 */
export const installDevToolsExtension = async(extensionId: string, targetSession: Session): Promise<string> => {
  const extensionsDir = getExtensionsDir()
  const extensionDir = path.join(extensionsDir, extensionId)
  if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
    let installing = installingPromises.get(extensionId)
    if (!installing) {
      installing = (async() => {
        fs.mkdirSync(extensionsDir, { recursive: true })
        const crxPath = path.join(extensionsDir, extensionId + '.crx')
        const url = 'https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&x=id%3D' + extensionId + '%26uc&prodversion=' + process.versions.chrome
        let attempt = 0
        while (true) {
          try {
            await downloadFile(url, targetSession, crxPath)
            // 清理可能残留的未解压完整的旧目录，避免解压结果不完整
            fs.rmSync(extensionDir, { recursive: true, force: true })
            await unzip(crxPath, extensionDir)
            changePermissions(extensionDir)
            break
          } catch (err) {
            if (++attempt >= 3) throw err
            await new Promise<void>((resolve) => setTimeout(resolve, 200))
          }
        }
        fs.rmSync(crxPath, { force: true })
      })()
      installingPromises.set(extensionId, installing)
      void installing.finally(() => { installingPromises.delete(extensionId) })
    }
    await installing
  }
  let extension = targetSession.getExtension(extensionId)
  if (!extension) extension = await targetSession.loadExtension(extensionDir)
  return extension.name
}
