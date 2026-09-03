import { net } from 'electron'

/**
 * WebDAV/HTTP 传输层
 * 使用 Electron net.request：自动跟随应用设置的代理，且无渲染层 CORS 限制。
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
      clientRequest = net.request({ method: options.method, url: options.url })
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
