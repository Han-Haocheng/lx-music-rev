// 使用 Node 内置 node:sqlite，摆脱原生 better-sqlite3 依赖。
// 运行时通过 require 加载，避免类型声明与 electron 依赖的 @types/node/sqlite 冲突。
const { DatabaseSync }: { DatabaseSync: any } = require('node:sqlite')


export class DBStatement {
  constructor(private stmt: any) {}

  run(...params: any[]) {
    return this.stmt.run(...params)
  }

  get(...params: any[]) {
    return this.stmt.get(...params)
  }

  all(...params: any[]) {
    return this.stmt.all(...params)
  }
}

export class DB {
  private db: any

  constructor(path: string) {
    this.db = new DatabaseSync(path)
  }

  // 该泛型参数仅用于兼容 better-sqlite3 的调用签名（<[...]>），不做严格推断
  prepare<T = any>(sql: string): DBStatement {
    return new DBStatement(this.db.prepare(sql))
  }

  exec(sql: string) {
    this.db.exec(sql)
  }

  close() {
    this.db.close()
  }

  pragma(sql: string) {
    this.db.exec(`PRAGMA ${sql}`)
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    const self = this
    return ((...args: any[]) => {
      self.db.exec('BEGIN')
      try {
        const result = fn(...args)
        self.db.exec('COMMIT')
        return result
      } catch (err) {
        self.db.exec('ROLLBACK')
        throw err
      }
    }) as T
  }
}
