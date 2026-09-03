import { readdir } from 'node:fs/promises'
import { joinPath } from '@common/utils/nodejs'
import { addListMusics } from '@renderer/store/list/action'
import { fetchingListStatus } from '@renderer/store/list/state'
import { showSelectDialog } from '@renderer/utils/ipc'
import { dialog } from '@renderer/plugins/Dialog'

/**
 * 本地音乐列表
 * 独立列表 ID，歌曲数据存放在播放列表数据表（musicInfo + listId），不占用用户列表（userLists）
 */
export const LOCAL_LIST_ID = 'local'

/** 导入本地文件允许的音频扩展名（与导入对话框过滤一致） */
const LOCAL_AUDIO_EXTS = ['mp3', 'flac', 'ogg', 'oga', 'wav', 'm4a']

const isAudioFile = (fileName: string): boolean => {
  const index = fileName.lastIndexOf('.')
  const ext = index > -1 ? fileName.substring(index + 1).toLowerCase() : ''
  return LOCAL_AUDIO_EXTS.includes(ext)
}

/**
 * 递归扫描目录，收集所有音频文件路径（跳过无法访问的目录）
 */
const scanAudioFiles = async(dirPath: string): Promise<string[]> => {
  const results: string[] = []
  const stack = [dirPath]
  while (stack.length) {
    const current = stack.pop()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch (err) {
      console.log(err)
      continue
    }
    for (const entry of entries) {
      const fullPath = joinPath(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile() && isAudioFile(entry.name)) {
        results.push(fullPath)
      }
    }
  }
  return results
}

const addLocalMusics = async(filePaths: string[]) => {
  // 分批解析元数据并写入列表，避免文件过多时阻塞
  for (let i = 0; i < filePaths.length; i += 200) {
    const paths = filePaths.slice(i, i + 200)
    const musicInfos = await window.lx.worker.main.createLocalMusicInfos(paths)
    if (!musicInfos.length) continue
    await addListMusics(LOCAL_LIST_ID, musicInfos)
  }
}

/**
 * 导入本地音乐文件（多选，过滤音频扩展名）
 */
export const importLocalFiles = async() => {
  const { canceled, filePaths } = await showSelectDialog({
    title: window.i18n.t('lists__add_local_file_desc'),
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media File', extensions: LOCAL_AUDIO_EXTS },
    ],
  })
  if (canceled || !filePaths.length) return

  fetchingListStatus[LOCAL_LIST_ID] = true
  try {
    await addLocalMusics(filePaths)
  } finally {
    fetchingListStatus[LOCAL_LIST_ID] = false
  }
}

/**
 * 扫描文件夹：选择目录后递归收集音频文件并导入
 */
export const scanLocalFolder = async() => {
  const { canceled, filePaths } = await showSelectDialog({
    title: window.i18n.t('local_music__scan_folder_desc'),
    properties: ['openDirectory'],
  })
  if (canceled || !filePaths.length) return

  fetchingListStatus[LOCAL_LIST_ID] = true
  try {
    const musicPaths = await scanAudioFiles(filePaths[0])
    if (!musicPaths.length) return
    await addLocalMusics(musicPaths)
  } catch (err) {
    console.log(err)
    void dialog({
      message: window.i18n.t('local_music__scan_failed'),
    })
  } finally {
    fetchingListStatus[LOCAL_LIST_ID] = false
  }
}
