// 从 CHANGELOG.md 提取指定版本的条目正文，作为 GitHub Release 说明
// 用法: node extract-changelog.mjs <version>
// 回退：CHANGELOG 无该版本（或正文为空）时，生成自上一个 v 标签以来的提交列表
// 输出到 stdout（CI 中重定向到 --notes-file）
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const version = process.argv[2]
if (!version) {
  console.error('usage: node extract-changelog.mjs <version>')
  process.exit(1)
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const md = fs.readFileSync('CHANGELOG.md', 'utf8')
const lines = md.split('\n')
const startIdx = lines.findIndex((l) => l.startsWith(`## [${version}]`))

let body = ''
if (startIdx !== -1) {
  const rest = lines.slice(startIdx + 1)
  const endIdx = rest.findIndex((l) => l.startsWith('## ['))
  body = (endIdx === -1 ? rest : rest.slice(0, endIdx)).join('\n').trim()
}

if (!body) {
  let prevTag = ''
  try {
    const tags = execFileSync('git', ['tag', '--list', 'v*', '--sort=-creatordate'], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)
    const curIdx = tags.indexOf(`v${version}`)
    prevTag = curIdx === -1 ? (tags[0] ?? '') : (tags[curIdx + 1] ?? '')
  } catch {}
  const args = ['log', '--pretty=format:- %s (%h)']
  if (prevTag) args.push(`${prevTag}..HEAD`)
  args.push('-30')
  const log = execFileSync('git', args, { encoding: 'utf8' }).trim()
  body = prevTag
    ? `> CHANGELOG.md 中暂无 [${version}] 条目，以下为自 ${prevTag} 以来的提交：

${log}`
    : `> CHANGELOG.md 中暂无 [${version}] 条目，以下为最近提交：

${log}`
}

process.stdout.write(body + '\n')
