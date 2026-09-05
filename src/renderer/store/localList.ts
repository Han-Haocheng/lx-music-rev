import { readdir } from 'node:fs/promises'
import { joinPath } from '@common/utils/nodejs'
import { addListMusics } from '@renderer/store/list/action'
import { fetchingListStatus } from '@renderer/store/list/state'
import { appSetting, updateSetting } from '@renderer/store/setting'

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

/**
 * 导入本地音频文件到本地音乐列表（分批解析元数据，避免文件过多时阻塞）；
 * 供扫描导入与系统文件关联「双击音乐文件打开播放」链路复用
 */
export const addLocalMusics = async(filePaths: string[]) => {
  // 分批解析元数据并写入列表，避免文件过多时阻塞
  for (let i = 0; i < filePaths.length; i += 200) {
    const paths = filePaths.slice(i, i + 200)
    const musicInfos = await window.lx.worker.main.createLocalMusicInfos(paths)
    if (!musicInfos.length) continue
    await addListMusics(LOCAL_LIST_ID, musicInfos)
  }
}

/** 归一化路径用于比较：统一分隔符、去尾部斜杠；Windows（盘符路径）不区分大小写 */
const normalizePathForCompare = (p: string): string => {
  let normalized = p.replace(/[\\/]+/g, '/').replace(/\/+$/, '')
  if (/^[a-zA-Z]:[/]/.test(normalized)) normalized = normalized.toLowerCase()
  return normalized
}

/** 判断 ancestor 是否为 descendant 的祖先目录（含自身）；基于归一化路径的分隔符边界 */
const isAncestorOrSame = (ancestor: string, descendant: string): boolean => {
  const a = normalizePathForCompare(ancestor)
  const b = normalizePathForCompare(descendant)
  if (a === b) return true
  return b.startsWith(a + '/')
}

export interface ScanFolderResult {
  ok: boolean
  reason: 'added' | 'duplicate' | 'covered' | 'conflict'
}

/**
 * 加入允许扫描文件夹清单（唯一性 + 不可嵌套）：
 * - duplicate：与清单中路径相同
 * - covered：清单中已有其祖先目录（已被覆盖扫描，无需重复）
 * - conflict：清单中已有其子目录（嵌套冗余，先移除子目录再添加）
 */
export const addScanFolderToSettings = (folder: string): ScanFolderResult => {
  const dir = folder.replace(/[\\/]+$/, '')
  if (!dir) return { ok: false, reason: 'conflict' }
  const folders = [...(appSetting['local.scanFolders'] ?? [])]
  for (const existing of folders) {
    if (normalizePathForCompare(existing) === normalizePathForCompare(dir)) return { ok: false, reason: 'duplicate' }
    if (isAncestorOrSame(existing, dir)) return { ok: false, reason: 'covered' }
    if (isAncestorOrSame(dir, existing)) return { ok: false, reason: 'conflict' }
  }
  folders.push(dir)
  updateSetting({ 'local.scanFolders': folders })
  return { ok: true, reason: 'added' }
}

/** 从允许扫描文件夹清单移除 */
export const removeScanFolderFromSettings = (folder: string) => {
  updateSetting({ 'local.scanFolders': (appSetting['local.scanFolders'] ?? []).filter(f => f !== folder) })
}

/** 扫描全部允许的文件夹并增量入库（幂等：歌曲 id=绝对路径，DB 层去重） */
export const scanAllFolders = async(): Promise<{ folderCount: number, fileCount: number }> => {
  const folders = appSetting['local.scanFolders'] ?? []
  fetchingListStatus[LOCAL_LIST_ID] = true
  try {
    let fileCount = 0
    for (const folder of folders) {
      const paths = await scanAudioFiles(folder)
      if (!paths.length) continue
      fileCount += paths.length
      await addLocalMusics(paths)
    }
    return { folderCount: folders.length, fileCount }
  } finally {
    fetchingListStatus[LOCAL_LIST_ID] = false
  }
}

