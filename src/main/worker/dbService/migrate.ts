import type { DB } from './nodeSqliteAdapter'
import tables, { DB_VERSION } from './tables'

// 收藏分组表（v1.2.0+）：老库确保存在（存在则跳过，保持 sqlite_master SQL 与 tables 一致以通过 verifyDB）
const ensureFavoriteGroupTables = (db: DB) => {
  const queryByName = (name: string) => {
    return db.prepare<[string]>('SELECT name FROM "main".sqlite_master WHERE type=\'table\' AND name=?;').get(name) != null
  }
  if (!queryByName('favorite_groups')) db.exec(tables.get('favorite_groups')!)
  if (!queryByName('favorite_group_musics')) db.exec(tables.get('favorite_group_musics')!)
  const queryIndexByName = (name: string) => {
    return db.prepare<[string]>('SELECT name FROM "main".sqlite_master WHERE type=\'index\' AND name=?;').get(name) != null
  }
  if (!queryIndexByName('index_favorite_group_musics')) db.exec(tables.get('index_favorite_group_musics')!)
}

const migrateV1 = (db: DB) => {
  // 修复 v2.4.0 的默认数据库版本号不对的问题
  const existsTable = db.prepare('SELECT name FROM "main".sqlite_master WHERE type=\'table\' AND name=\'dislike_list\';').get()
  if (!existsTable) {
    const sql = tables.get('dislike_list')!
    db.exec(sql)
  }
}

interface UserListRow { id: string, name: string, position: number }
interface MusicInfoRow { id: string, name: string, singer: string, source: string, interval: string | null, meta: string }

/**
 * 自建列表退役数据迁移（一次性、幂等）：
 * 将存量「我的列表」（my_list 及其歌曲）全部并入「我的收藏」——
 * 同名收藏分组存在则复用，否则按列表名创建分组；歌曲去重写入 love 列表并归入该分组；
 * 完成后清空自建列表数据。旧备份恢复链路仍写 my_list，本迁移在每次数据库打开时执行，保证恢复后自动并入收藏。
 */
export const migrateUserListsToFavoriteGroups = (db: DB) => {
  const userLists = db.prepare<[]>('SELECT "id", "name", "position" FROM "main"."my_list" ORDER BY "position" ASC').all() as UserListRow[]
  if (!userLists.length) return

  const groupQuery = db.prepare<[string]>('SELECT "id" FROM "main"."favorite_groups" WHERE "name"=?')
  const groupInsert = db.prepare<{ id: string, name: string, position: number }>('INSERT INTO "main"."favorite_groups" ("id", "name", "position") VALUES (@id, @name, @position)')
  const groupMusicInsert = db.prepare<{ groupId: string, musicInfoId: string }>('INSERT OR IGNORE INTO "main"."favorite_group_musics" ("groupId", "musicInfoId") VALUES (@groupId, @musicInfoId)')
  const musicQuery = db.prepare<[string]>('SELECT m."id", m."name", m."singer", m."source", m."interval", m."meta" FROM "main"."my_list_music_info" m LEFT JOIN "main"."my_list_music_info_order" o ON o."musicInfoId"=m."id" AND o."listId"=? WHERE m."listId"=? ORDER BY o."order" ASC')
  const loveMusicQuery = db.prepare<[string]>('SELECT "id" FROM "main"."my_list_music_info" WHERE "listId"=\'love\' AND "id"=?')
  const musicInsert = db.prepare<MusicInfoRow>('INSERT OR IGNORE INTO "main"."my_list_music_info" ("id", "listId", "name", "singer", "source", "interval", "meta") VALUES (@id, \'love\', @name, @singer, @source, @interval, @meta)')
  const orderInsert = db.prepare<{ listId: string, musicInfoId: string, order: number }>('INSERT OR IGNORE INTO "main"."my_list_music_info_order" ("listId", "musicInfoId", "order") VALUES (@listId, @musicInfoId, @order)')
  const maxOrderQuery = db.prepare<[]>('SELECT MAX("order") AS m FROM "main"."my_list_music_info_order" WHERE "listId"=\'love\'')
  const maxGroupPositionQuery = db.prepare<[]>('SELECT MAX("position") AS m FROM "main"."favorite_groups"')

  try {
    db.transaction(() => {
      let maxOrder = (maxOrderQuery.get() as { m: number | null }).m ?? -1
      let groupPosition = (maxGroupPositionQuery.get() as { m: number | null }).m ?? -1

      for (const list of userLists) {
        // 同名分组复用，否则创建
        const existed = groupQuery.get(list.name) as { id: string } | undefined
        let groupId = existed?.id
        if (!groupId) {
          groupId = 'favgroup_mig_' + list.id
          groupPosition += 1
          groupInsert.run({ id: groupId, name: list.name, position: groupPosition })
        }
        // 歌曲：去重写入 love 并归入分组
        const musics = musicQuery.all(list.id, list.id) as MusicInfoRow[]
        for (const music of musics) {
          if (!loveMusicQuery.get(music.id)) {
            musicInsert.run(music)
            maxOrder += 1
            orderInsert.run({ listId: 'love', musicInfoId: music.id, order: maxOrder })
          }
          groupMusicInsert.run({ groupId, musicInfoId: music.id })
        }
      }
      // 清理自建列表数据
      const listIds = userLists.map(l => l.id)
      const listIdsLiteral = listIds.map(id => "'" + id.replace(/'/g, "''") + "'").join(',')
      db.exec('DELETE FROM "main"."my_list"')
      db.exec('DELETE FROM "main"."my_list_music_info_order" WHERE "listId" IN (' + listIdsLiteral + ')')
      db.exec('DELETE FROM "main"."my_list_music_info" WHERE "listId" IN (' + listIdsLiteral + ')')
    })()
  } catch (err) {
    // 迁移失败不抛出：避免上层误判整库损坏触发备份重建，保留数据下次启动重试
    console.warn('[dbService] 自建列表并入收藏分组迁移失败（保留数据，下次启动重试）:', err)
  }
}

export default (db: DB) => {
  ensureFavoriteGroupTables(db)
  // 自建列表退役：每次打开数据库时执行存量自建列表到收藏分组的并入迁移（幂等）
  migrateUserListsToFavoriteGroups(db)
  // PRAGMA user_version = x
  // console.log(db.prepare('PRAGMA user_version').get().user_version)
  // https://github.com/WiseLibs/better-sqlite3/issues/668#issuecomment-1145285728
  const version = (db.prepare<[string]>('SELECT "field_value" FROM "main"."db_info" WHERE "field_name" = ?').get('version') as { field_value: string }).field_value
  switch (version) {
    case '1':
      migrateV1(db)
      db.prepare('UPDATE "main"."db_info" SET "field_value"=@value WHERE "field_name"=@name').run({ name: 'version', value: DB_VERSION })
      break
  }
}
