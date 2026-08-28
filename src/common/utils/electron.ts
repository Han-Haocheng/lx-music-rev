import { shell, clipboard } from 'electron'


/**
 * 在资源管理器中打开目录
 * @param {string} dir
 */
export const openDirInExplorer = (dir: string) => {
  shell.showItemInFolder(dir)
}


/**
 * 在浏览器打开URL
 * @param {*} url
 */
export const openUrl = async(url: string) => {
  if (!/^https?:\/\//.test(url)) return
  await shell.openExternal(url)
}


/**
 * 复制文本到剪贴板
 * @param str
 */
export const clipboardWriteText = (str: string) => {
  // Electron 43（当前锁定版本）clipboard 为同步 API；44 起改为异步，若日后升级 44
  // 需改为 void clipboard.writeText(str) 并处理 Promise
  clipboard.writeText(str)
}

/**
 * 从剪贴板读取文本
 * @returns
 */
export const clipboardReadText = async(): Promise<string> => {
  return clipboard.readText()
}


export const encodePath = (path: string) => {
  // https://github.com/lyswhut/lx-music-desktop/issues/963
  // https://github.com/lyswhut/lx-music-desktop/issues/1461
  return path.replaceAll('%', '%25').replaceAll('#', '%23')
}
