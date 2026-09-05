import { onBeforeUnmount } from '@common/utils/vueTools'
import { clearEnvParamsOpenFiles, focusWindow, onOpenFiles } from '@renderer/utils/ipc'
import { dialog } from '@renderer/plugins/Dialog'
import { LOCAL_LIST_ID, addLocalMusics } from '@renderer/store/localList'
import { getListMusics } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'

const OPEN_FILE_EXTS = ['mp3', 'flac', 'ogg', 'oga', 'wav', 'm4a']

const isAudioFile = (filePath: string): boolean => {
  const index = filePath.lastIndexOf('.')
  if (index < 1) return false
  return OPEN_FILE_EXTS.includes(filePath.substring(index + 1).toLowerCase())
}

/**
 * 系统文件关联处理：文件管理器（或 Finder）双击音频文件启动/激活应用时，
 * 将文件导入本地音乐列表并从该文件开始播放（已在列表中的文件跳过重复导入，直接定位播放）。
 * 首次启动：读取 get_env_params 中的 openFiles；运行中再次被调用：监听 open_files 事件（second-instance / open-file）。
 */
export default () => {
  let isInited = false

  const getFilePath = (musicInfo: LX.Music.MusicInfo): string | undefined => {
    const meta = musicInfo.meta as { filePath?: string } | undefined
    return meta?.filePath
  }

  const handleOpenFiles = async(filePaths: string[]) => {
    const paths = filePaths.filter(isAudioFile)
    if (!paths.length) return
    try {
      const currentList = await getListMusics(LOCAL_LIST_ID)
      const existing = new Set(currentList.map(getFilePath).filter(Boolean) as string[])
      const newPaths = paths.filter(p => !existing.has(p))
      if (newPaths.length) await addLocalMusics(newPaths)
      const list = newPaths.length ? await getListMusics(LOCAL_LIST_ID) : currentList
      const targetPath = paths[0]
      const index = list.findIndex(m => getFilePath(m) == targetPath)
      if (index > -1) await playList(LOCAL_LIST_ID, index)
    } catch {
      dialog({ message: window.i18n.t('local_music__open_files_failed') })
      focusWindow()
    }
  }

  const rOpenFiles = onOpenFiles(async({ params: filePaths }) => {
    if (!isInited) return
    clearEnvParamsOpenFiles()
    await handleOpenFiles(filePaths)
  })

  onBeforeUnmount(() => {
    rOpenFiles()
  })

  return async(envParams: LX.EnvParams) => {
    if (envParams.openFiles?.length) {
      clearEnvParamsOpenFiles()
      await handleOpenFiles(envParams.openFiles)
    }
    isInited = true
  }
}
