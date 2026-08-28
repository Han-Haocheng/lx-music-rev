// 使用 Node 内置 node:sqlite，摆脱原生 better-sqlite3 依赖。
// 运行时通过 require 加载，避免类型声明与 electron 依赖的 @types/node/sqlite 冲突。
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync }: { DatabaseSync: any } = require('node:sqlite')


const namedParamRxp = /(?:[:@$])([A-Za-z_][A-Za-z0-9_]*)/g
const getSqlParamNames = (sql: string) => {
  const names = new Set<string>()
  let match
  namedParamRxp.lastIndex = 0
  while ((match = namedParamRxp.exec(sql))) names.add(match[1])
  return names
}

export class DBStatement {
  private readonly sqlParamNames: Set<string>

  constructor(private readonly stmt: any, sql: string) {
    this.sqlParamNames = getSqlParamNames(sql)
  }

  // better-sqlite3 会静默忽略绑定对象中 SQL 不存在的命名参数，
  // 而 node:sqlite 对此直接抛 "Unknown named parameter"。这里过滤多余键以兼容原行为。
  private filterParams(params: any[]): any[] {
    if (!this.sqlParamNames.size) return params
    const last = params[params.length - 1]
    if (last && typeof last === 'object' && !Array.isArray(last) && !Buffer.isBuffer(last)) {
      const obj = last as Record<string, unknown>
      const keys = Object.keys(obj)
      if (!keys.some(k => k.startsWith(':') || k.startsWith('@') || k.startsWith('$'))) {
        if (keys.some(k => !this.sqlParamNames.has(k))) {
          const filtered: Record<string, unknown> = {}
          for (const key of keys) {
            if (this.sqlParamNames.has(key)) filtered[key] = obj[key]
          }
          return [...params.slice(0, -1), filtered]
        }
      }
    }
    return params
  }

  run(...params: any[]) {
    return this.stmt.run(...this.filterParams(params))
  }

  get(...params: any[]) {
    return this.stmt.get(...this.filterParams(params))
  }

  all(...params: any[]) {
    return this.stmt.all(...this.filterParams(params))
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
    return new DBStatement(this.db.prepare(sql), sql)
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
