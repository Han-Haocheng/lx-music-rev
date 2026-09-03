import { getDB } from './db'
import type { DB, DBStatement } from './nodeSqliteAdapter'

let cachedDb: DB | null = null
const statementCache = new Map<string, DBStatement>()

/**
 * 获取（并缓存）一条预编译语句。
 * node:sqlite 每次 prepare 都有 SQL 解析/计划开销；对每首歌切换都要执行的查询
 * （歌曲 URL/歌词/列表内歌曲/收藏存在性检查等）复用预编译语句可显著降低热路径耗时。
 * dbService worker 常驻单连接，模块级缓存安全；连接被重建（db.ts 的 init 二次执行，
 * 如数据库校验失败备份后重开）时通过 DB 实例身份对比自动清空，避免继续持有已关闭连接上的语句。
 */
export const cachedStatement = (sql: string): DBStatement => {
  const db = getDB()
  if (db !== cachedDb) {
    statementCache.clear()
    cachedDb = db
  }
  let stmt = statementCache.get(sql)
  if (stmt == null) {
    stmt = db.prepare(sql)
    statementCache.set(sql, stmt)
  }
  return stmt
}

