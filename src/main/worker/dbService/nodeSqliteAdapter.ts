// 使用 Node 内置 node:sqlite，摆脱原生 better-sqlite3 依赖。
// 运行时通过 require 加载，避免类型声明与 electron 依赖的 @types/node/sqlite 冲突。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync }: { DatabaseSync: any } = require('node:sqlite')


export class DBStatement {
  constructor(private readonly stmt: any) {}

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
  private readonly db: any

  constructor(path: string) {
    this.db = new DatabaseSync(path)
  }

  // 该泛型参数仅用于兼容 better-sqlite3 的调用签名（prepare<[...]>），不做严格推断
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prepare<_T = any>(sql: string): DBStatement {
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

  // eslint-disable-next-line space-before-function-paren
  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      this.db.exec('BEGIN')
      try {
        const result = fn(...args)
        this.db.exec('COMMIT')
        return result
      } catch (err) {
        this.db.exec('ROLLBACK')
        throw err
      }
    }) as T
  }
}
