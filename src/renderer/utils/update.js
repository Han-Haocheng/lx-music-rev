import { httpGet } from './request'
import pkg from '../../../package.json'

// TODO add Notice

const author = pkg.author.name
const name = pkg.name

// 更新检查源：author/name 取自 package.json，指向本仓库 master 的 publish/version.json
// 如需自建源（CDN / npm 信息包 / gitee 镜像），在下面按优先级追加即可
const address = [
  [`https://raw.githubusercontent.com/${author}/${name}/master/publish/version.json`, 'direct'],
  [`https://cdn.jsdelivr.net/gh/${author}/${name}/publish/version.json`, 'direct'],
  [`https://fastly.jsdelivr.net/gh/${author}/${name}/publish/version.json`, 'direct'],
  [`https://gcore.jsdelivr.net/gh/${author}/${name}/publish/version.json`, 'direct'],
  // [`https://your-cdn.example.com/${name}/version.json`, 'direct'],
]

const request = async(url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 10000,
    }, (err, resp, body) => {
      if (err || resp.statusCode != 200) {
        ++retryNum >= 3
          ? reject(err || new Error(resp.statusMessage || resp.statusCode))
          : request(url, retryNum).then(resolve).catch(reject)
      } else resolve(body)
    })
  })
}

const getDirectInfo = async(url) => {
  return request(url).then(info => {
    if (info.version == null) throw new Error('failed')
    return info
  })
}

export const getVersionInfo = async(index = 0) => {
  const [url, source] = address[index]
  let promise
  switch (source) {
    case 'direct':
      promise = getDirectInfo(url)
      break
  }

  return promise.catch(async(err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

// getVersionInfo().then(info => {
//   console.log(info)
// })
