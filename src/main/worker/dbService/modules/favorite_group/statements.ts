import { getDB } from '../../db'

export const createQueryGroupsStatement = () => {
  const db = getDB()
  return db.prepare<[]>(`
    SELECT "id", "name", "position"
    FROM favorite_groups
    ORDER BY "position" ASC
  `)
}

export const createInsertGroupStatement = () => {
  const db = getDB()
  return db.prepare<[LX.DBService.FavoriteGroupInfo]>(`
    INSERT INTO "main"."favorite_groups" ("id", "name", "position")
    VALUES (@id, @name, @position)
  `)
}

export const createUpdateGroupStatement = () => {
  const db = getDB()
  return db.prepare<[LX.DBService.FavoriteGroupInfo]>(`
    UPDATE "main"."favorite_groups"
    SET "name"=@name
    WHERE "id"=@id
  `)
}

export const createDeleteGroupStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(`
    DELETE FROM "main"."favorite_groups"
    WHERE "id"=?
  `)
}

export const createDeleteGroupMusicsStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(`
    DELETE FROM "main"."favorite_group_musics"
    WHERE "groupId"=?
  `)
}

export const createQueryGroupMusicsStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(`
    SELECT "musicInfoId"
    FROM favorite_group_musics
    WHERE "groupId"=?
  `)
}

export const createQueryMusicGroupIdsStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(`
    SELECT "groupId"
    FROM favorite_group_musics
    WHERE "musicInfoId"=?
  `)
}

export const createDeleteMusicGroupStatement = () => {
  const db = getDB()
  return db.prepare<[{ groupId: string, musicInfoId: string }]>(`
    DELETE FROM "main"."favorite_group_musics"
    WHERE "groupId"=@groupId AND "musicInfoId"=@musicInfoId
  `)
}

export const createInsertGroupMusicStatement = () => {
  const db = getDB()
  return db.prepare<[{ groupId: string, musicInfoId: string }]>(`
    INSERT INTO "main"."favorite_group_musics" ("groupId", "musicInfoId")
    VALUES (@groupId, @musicInfoId)
  `)
}

export const createDeleteMusicGroupRowsByMusicInfoIdStatement = () => {
  const db = getDB()
  return db.prepare<[string]>(`
    DELETE FROM "main"."favorite_group_musics"
    WHERE "musicInfoId"=?
  `)
}

export const createClearMusicGroupRowsStatement = () => {
  const db = getDB()
  return db.prepare<[]>(`
    DELETE FROM "main"."favorite_group_musics"
  `)
}
