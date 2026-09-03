import fs from 'fs'
import path from 'path'
import tables, { DB_VERSION } from './tables'
import verifyDB from './verifyDB'
import migrateData from './migrate'
import { DB } from './nodeSqliteAdapter'

let db: DB


const initTables = (db: DB) => {
  db.exec(`
    ${Array.from(tables.values()).join('\n')}
    INSERT INTO "main"."db_info" ("field_name", "field_value") VALUES ('version', '${DB_VERSION}');
  `)
}

// 关闭已打开/部分打开的数据库连接（main-security #3：打开/迁移抛错时释放句柄，
// 让上层能把损坏文件改名备份；重复关闭同一连接会抛错，逐个 try/catch 忽略）
const closeDB = (target: DB | null = db) => {
  if (!target) return
  try {
    target.close()
  } catch {}
}

// 进程退出时关闭数据库连接；dbService worker 常驻单连接，模块级只注册一次，
// init 多次执行时在替换连接前已关闭旧连接（见 init），不会重复 close
process.on('exit', () => { closeDB() })


// 打开、初始化数据库
// 打开/迁移抛错（数据库文件损坏无法解析、迁移过程异常等）时会先关闭句柄再向上抛出，
// 由主进程的 initDBWithAutoRecovery（app.ts）执行「备份损坏文件为时间戳 .bak → 重新初始化」恢复；
// 连续两次失败才交由上层通用弹窗提示
export const init = (lxDataPath: string): boolean | null => {
  const databasePath = path.join(lxDataPath, 'lx.data.db')
  // 使用 Node 内置 node:sqlite（DatabaseSync），不再依赖原生 better-sqlite3
  // （摆脱 native 模块的 ABI 重建与打包预编译绑定）
  const dbFileExists = fs.existsSync(databasePath)
  let opened: DB | null = null
  try {
    opened = new DB(databasePath)
    if (!dbFileExists) initTables(opened)

    opened.pragma('journal_mode = WAL')

    if (dbFileExists) migrateData(opened)

    // https://www.sqlite.org/pragma.html#pragma_optimize
    if (dbFileExists) opened.exec('PRAGMA optimize;')
    if (!verifyDB(opened)) {
      // 表结构校验失败：文件可打开但结构不符，由 app.ts 弹窗提示并备份后重新 init
      closeDB(opened)
      return null
    }

    // https://www.sqlite.org/lang_vacuum.html
    // db.exec('VACUUM "main"')

    closeDB()
    db = opened
    // require('./test')
    return dbFileExists
  } catch (err) {
    closeDB(opened)
    throw err
  }
}

// 获取数据库实例（init 成功后才可用）
export const getDB = (): DB => db
