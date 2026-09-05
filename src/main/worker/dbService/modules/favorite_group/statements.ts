import { getDB } from '../../db'
import { cachedStatement } from '../../stmtCache'

export const createQueryGroupsStatement = () => {
  const db = getDB()
  return db.prepare<[]>(
    `
    SELECT "id", "name", "position"
    FROM favorite_groups
    ORDER BY "position" ASC
  `)
}

export const createInsertGroupStatement = () => {
  const db = getDB()
  return db.prepare<[LX.DBService.FavoriteGroupInfo]>(
    `
    INSERT INTO "main"."favorite_groups" ("id", "name", "position")
    VALUES (@id, @name, @position)
  `)
}

export const createUpdateGroupStatement = () => {
  const db = getDB()
  return db.prepare<[LX.DBService.FavoriteGroupInfo]>(
    `
    UPDATE "main"."favorite_groups"
    SET "name"=@name
    WHERE "id"=@id
  `)
}

export const createDeleteGroupStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(
    `
    DELETE FROM "main"."favorite_groups"
    WHERE "id"=?
  `)
}

export const createDeleteGroupMusicsStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(
    `
    DELETE FROM "main"."favorite_group_musics"
    WHERE "groupId"=?
  `)
}

export const createQueryGroupMusicsStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(
    `
    SELECT "musicInfoId"
    FROM favorite_group_musics
    WHERE "groupId"=?
  `)
}

export const createQueryMusicGroupIdsStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(
    `
    SELECT "groupId"
    FROM favorite_group_musics
    WHERE "musicInfoId"=?
  `)
}

export const createDeleteMusicGroupStatement = () => {
  const db = getDB()
  return db.prepare<[{ groupId: string, musicInfoId: string }]>(
    `
    DELETE FROM "main"."favorite_group_musics"
    WHERE "groupId"=@groupId AND "musicInfoId"=@musicInfoId
  `)
}

export const createInsertGroupMusicStatement = () => {
  const db = getDB()
  return db.prepare<[{ groupId: string, musicInfoId: string }]>(
    `
    INSERT INTO "main"."favorite_group_musics" ("groupId", "musicInfoId")
    VALUES (@groupId, @musicInfoId)
  `)
}

export const createDeleteMusicGroupRowsByMusicInfoIdStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(
    `
    DELETE FROM "main"."favorite_group_musics"
    WHERE "musicInfoId"=?
  `)
}

export const createClearMusicGroupRowsStatement = () => {
  const db = getDB()
  return db.prepare<[]>(
    `
    DELETE FROM "main"."favorite_group_musics"
  `)
}

// ===== 分组来源（favorite_group_sources，1.3.1+） =====
export const createQueryGroupSourceStatement = () => {
  return cachedStatement('SELECT "groupId", "source", "sourceListId", "locationUpdateTime" FROM "main"."favorite_group_sources" WHERE "groupId"=?')
}

export const createInsertGroupSourceStatement = () => {
  const db = getDB()
  return db.prepare<[LX.DBService.FavoriteGroupSource]>('INSERT INTO "main"."favorite_group_sources" ("groupId", "source", "sourceListId", "locationUpdateTime") VALUES (@groupId, @source, @sourceListId, @locationUpdateTime)')
}

export const createUpdateGroupSourceStatement = () => {
  const db = getDB()
  return db.prepare<[LX.DBService.FavoriteGroupSource]>('UPDATE "main"."favorite_group_sources" SET "source"=@source, "sourceListId"=@sourceListId, "locationUpdateTime"=@locationUpdateTime WHERE "groupId"=@groupId')
}

export const createDeleteGroupSourceStatement = () => {
  const db = getDB()
  return db.prepare<[string]>('DELETE FROM "main"."favorite_group_sources" WHERE "groupId"=?')
}

// ===== 分组同步写入（love 表歌曲操作，列结构参照 list 模块） =====
export const createLoveMusicInfoQueryStatement = () => {
  return cachedStatement('SELECT "id" FROM "main"."my_list_music_info" WHERE "listId"=\'love\' AND "id"=?')
}

export const createLoveMusicInfoInsertStatement = () => {
  const db = getDB()
  return db.prepare<[LX.DBService.MusicInfo]>('INSERT OR IGNORE INTO "main"."my_list_music_info" ("id", "listId", "name", "singer", "source", "interval", "meta") VALUES (@id, \'love\', @name, @singer, @source, @interval, @meta)')
}

export const createLoveMusicInfoOrderInsertStatement = () => {
  const db = getDB()
  return db.prepare<[LX.DBService.MusicInfoOrder]>('INSERT OR IGNORE INTO "main"."my_list_music_info_order" ("listId", "musicInfoId", "order") VALUES (@listId, @musicInfoId, @order)')
}

export const createLoveMaxOrderQueryStatement = () => {
  return cachedStatement('SELECT MAX("order") AS m FROM "main"."my_list_music_info_order" WHERE "listId"=\'love\'')
}

export const createLoveMusicInfoDeleteStatement = () => {
  const db = getDB()
  return db.prepare<[string]>('DELETE FROM "main"."my_list_music_info" WHERE "listId"=\'love\' AND "id"=?')
}

export const createLoveMusicInfoOrderDeleteStatement = () => {
  const db = getDB()
  return db.prepare<[string]>('DELETE FROM "main"."my_list_music_info_order" WHERE "listId"=\'love\' AND "musicInfoId"=?')
}
export const createQueryLoveOrphanIdsStatement = () => {
  return cachedStatement('SELECT "id" AS "musicInfoId" FROM "main"."my_list_music_info" WHERE "listId"=\'love\' AND "id" NOT IN (SELECT "musicInfoId" FROM "main"."favorite_group_musics")')
}
