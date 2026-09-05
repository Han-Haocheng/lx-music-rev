import { net, session } from 'electron'

/**
 * WebDAV/HTTP 传输层
 * 使用 Electron net.request，且无渲染层 CORS 限制。
 * 代理：显式复用主窗口所在 partition（persist:win-main）的 session——winMain 创建主窗口时
 * 已对该 partition 调 session.setProxy 应用代理设置（见 winMain/main.ts），配置变更也会
 * 通过 updated_config 更新到该 session，故此处请求自动跟随应用代理。
 */

const REQUEST_TIMEOUT = 30000

export interface RequestOptions {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string | Buffer
}

export interface RequestResult {
  status: number
  body: Buffer
  headers: Record<string, string | string[]>
}

export const requestWebdav = async(options: RequestOptions): Promise<RequestResult> => {
  return new Promise((resolve, reject) => {
    let clientRequest: Electron.ClientRequest
    try {
      clientRequest = net.request({
        method: options.method,
        url: options.url,
        // 复用应用代理 session（partition 与 winMain 主窗口一致）
        session: session.fromPartition('persist:win-main'),
      })
    } catch (err) {
      reject(err)
      return
    }
    const timer = setTimeout(() => {
      clientRequest.abort()
      reject(new Error('连接超时'))
    }, REQUEST_TIMEOUT)
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      clientRequest.setHeader(key, value)
    }
    clientRequest.on('response', (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk))
      })
      response.on('end', () => {
        clearTimeout(timer)
        resolve({
          status: response.statusCode,
          body: Buffer.concat(chunks),
          headers: response.headers,
        })
      })
      response.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
    clientRequest.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(getErrorMessage(err)))
    })
    if (options.body != null) clientRequest.write(options.body)
    clientRequest.end()
  })
}

const getErrorMessage = (err: Error & { code?: string }) => {
  switch (err.code) {
    case 'ERR_NETWORK_CHANGED':
    case 'ERR_INTERNET_DISCONNECTED':
      return '网络连接失败'
    case 'ERR_NAME_NOT_RESOLVED':
      return '无法解析服务器地址'
    case 'ERR_CONNECTION_REFUSED':
      return '连接被拒绝（服务器不可达）'
    case 'ERR_TIMED_OUT':
      return '连接超时'
    default:
      return err.message || '网络错误'
  }
}

export const buildAuthHeader = (username: string, password: string) =>
  'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')

/**
 * 校验并构造远端文件 URL
 */
export const buildFileUrl = (baseUrl: string, remotePath: string, fileName: string) => {
  const trimmed = baseUrl.trim()
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('服务器地址必须以 http:// 或 https:// 开头')
  const base = trimmed.replace(/\/+$/, '')
  const dir = remotePath
    .split('/')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  if (!dir) throw new Error('远程目录不能为空')
  return `${base}/${dir}/${encodeURIComponent(fileName)}`
}

export const buildDirUrl = (fileUrl: string) => fileUrl.slice(0, fileUrl.lastIndexOf('/'))
