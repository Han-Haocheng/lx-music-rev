import fs from 'node:fs'
import crypto from 'node:crypto'
import { log } from '@common/utils'


const fileNameRxp = /[\\/:*?#"<>|]/g
export const filterFileName = (name: string): string => name.replace(fileNameRxp, '')

/**
 * 创建 MD5 hash
 * @param {*} str
 */
export const toMD5 = (str: string) => crypto.createHash('md5').update(str).digest('hex')

export const checkAndCreateDirSync = (path: string) => {
  if (fs.existsSync(path)) return
  try {
    fs.mkdirSync(path, { recursive: true })
  } catch (err) {
    // 目录创建失败（如权限/磁盘错误）只记录日志，不再让主进程直接崩溃
    log.error('创建目录失败:', path, err)
  }
}
