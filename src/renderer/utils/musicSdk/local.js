// 本地音乐 API 模块
// 实现 getMusicUrl / getLyric / getPic，匹配 core/music/utils.ts 中 apis('local') 的调用契约：
//   getMusicUrl(songInfo, type).promise → { url, type }
//   getLyric(songInfo).promise          → LX.Music.LyricInfo（{ lyric, tlyric?, rlyric?, lxlyric? }）
//   getPic(songInfo).promise            → 封面 url（data url / 临时文件路径 / 空字符串）
// songInfo 为 toOldMusicInfo 后的本地音乐信息（source == 'local' 时 filePath/songmid 为文件路径）
import { encodePath } from '@common/utils/common'
import { getLocalMusicFileLyric, getLocalMusicFilePic } from '@renderer/utils/music'

const getFilePath = songInfo => songInfo?.filePath ||
  songInfo?.songmid ||
  songInfo?.meta?.filePath ||
  ''

const reject = (message = 'local file path not found') => ({
  promise: Promise.reject(new Error(message)),
})

const getMusicUrl = (songInfo, type) => {
  const filePath = getFilePath(songInfo)
  // 渲染层 webSecurity 关闭，file:// 可直接用于 <audio> 播放与 <img> 展示，无需自定义协议
  return filePath
    ? {
        promise: Promise.resolve({
          url: encodePath(filePath),
          type: type ?? '128k',
        }),
      }
    : reject()
}

const getLyric = songInfo => {
  const filePath = getFilePath(songInfo)
  return filePath
    ? {
        // 读取同目录同名 .lrc/.krc 或文件内嵌歌词；缺失时兜底为空歌词
        promise: getLocalMusicFileLyric(filePath).then(lyricInfo => lyricInfo ?? { lyric: '' }),
      }
    : reject()
}

const getPic = songInfo => {
  const filePath = getFilePath(songInfo)
  return filePath
    ? {
        // 返回内嵌封面（data url）或同目录 .jpg/.png 封面；缺失时返回空字符串
        promise: getLocalMusicFilePic(filePath).then(pic => pic ?? ''),
      }
    : reject()
}

export default {
  getMusicUrl,
  getLyric,
  getPic,
}
