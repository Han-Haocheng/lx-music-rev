import fs from 'node:fs'
import crypto from 'node:crypto'
import { log } from '@common/utils'
import { getStatus } from '../server'
import { sendServerStatus } from '@main/modules/winMain'


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

/**
 * 同步动作推送失败时，把错误上报到设置页状态栏
 * 正常路径（启动/停止服务）会清空 message，不会残留误导
 */
export const sendSyncError = (message: string) => {
  const status = getStatus()
  status.message = message
  sendServerStatus(status)
}
