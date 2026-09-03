import { log as writeLog } from '@common/utils'

export default {
  r_info(...params: any[]) {
    writeLog.info(...params)
  },
  r_warn(...params: any[]) {
    writeLog.warn(...params)
  },
  r_error(...params: any[]) {
    writeLog.error(...params)
  },
  info(...params: any[]) {
    // if (global.lx.isEnableSyncLog) writeLog.info(...params)
    // 同步模块统一日志框架自身的 console 输出通道
    // eslint-disable-next-line no-console -- 日志框架实现需要直接输出
    console.log(...params)
  },
  warn(...params: any[]) {
    // if (global.lx.isEnableSyncLog) writeLog.warn(...params)
    console.warn(...params)
  },
  error(...params: any[]) {
    // if (global.lx.isEnableSyncLog) writeLog.error(...params)
    console.warn(...params)
  },
}
