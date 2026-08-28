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
  // Electron 44 起 clipboard API 为异步实现，调用方无需等待
  void clipboard.writeText(str).catch(err => {
    console.warn('写入剪贴板失败:', err)
  })
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
