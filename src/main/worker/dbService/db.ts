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


// 打开、初始化数据库
export const init = (lxDataPath: string): boolean | null => {
  const databasePath = path.join(lxDataPath, 'lx.data.db')
  // 使用 Node 内置 node:sqlite（DatabaseSync），不再依赖原生 better-sqlite3
  // （摆脱 native 模块的 ABI 重建与打包预编译绑定）
  const dbFileExists = fs.existsSync(databasePath)
  db = new DB(databasePath)
  if (!dbFileExists) initTables(db)

  db.pragma('journal_mode = WAL')

  if (dbFileExists) migrateData(db)

  // https://www.sqlite.org/pragma.html#pragma_optimize
  if (dbFileExists) db.exec('PRAGMA optimize;')
  if (!verifyDB(db)) {
    db.close()
    return null
  }

  // https://www.sqlite.org/lang_vacuum.html
  // db.exec('VACUUM "main"')

  process.on('exit', () => { db.close() })
  console.log('db inited')
  // require('./test')
  return dbFileExists
}

// 获取数据库实例
export const getDB = (): DB => db
