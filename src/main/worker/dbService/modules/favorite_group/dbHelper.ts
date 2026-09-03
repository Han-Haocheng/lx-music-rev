import { getDB } from '../../db'
import {
  createQueryGroupsStatement,
  createInsertGroupStatement,
  createUpdateGroupStatement,
  createDeleteGroupStatement,
  createDeleteGroupMusicsStatement,
  createQueryGroupMusicsStatement,
  createQueryMusicGroupIdsStatement,
  createDeleteMusicGroupStatement,
  createInsertGroupMusicStatement,
} from './statements'

export const queryFavoriteGroups = (): LX.DBService.FavoriteGroupInfo[] => {
  return createQueryGroupsStatement().all() as LX.DBService.FavoriteGroupInfo[]
}

export const insertFavoriteGroups = (groups: LX.DBService.FavoriteGroupInfo[]) => {
  const db = getDB()
  const insertStatement = createInsertGroupStatement()
  db.transaction((groups: LX.DBService.FavoriteGroupInfo[]) => {
    for (const group of groups) insertStatement.run(group)
  })(groups)
}

export const updateFavoriteGroup = (group: LX.DBService.FavoriteGroupInfo) => {
  createUpdateGroupStatement().run(group)
}

export const deleteFavoriteGroup = (id: string) => {
  const db = getDB()
  db.transaction((id: string) => {
    createDeleteGroupStatement().run(id)
    createDeleteGroupMusicsStatement().run(id)
  })(id)
}

export const queryGroupMusics = (groupId: string): string[] => {
  const rows = createQueryGroupMusicsStatement().all(groupId) as Array<{ musicInfoId: string }>
  return rows.map(row => row.musicInfoId)
}

export const queryMusicGroupIds = (musicInfoId: string): string[] => {
  const rows = createQueryMusicGroupIdsStatement().all(musicInfoId) as Array<{ groupId: string }>
  return rows.map(row => row.groupId)
}

/** 全量替换某首歌的归属分组 */
export const updateMusicGroups = (musicInfoId: string, groupIds: string[]) => {
  const db = getDB()
  const deleteStatement = createDeleteMusicGroupStatement()
  const insertStatement = createInsertGroupMusicStatement()
  db.transaction(({ musicInfoId, groupIds }: { musicInfoId: string, groupIds: string[] }) => {
    const existed = createQueryMusicGroupIdsStatement().all(musicInfoId) as Array<{ groupId: string }>
    for (const row of existed) {
      deleteStatement.run({ groupId: row.groupId, musicInfoId })
    }
    for (const groupId of groupIds) {
      insertStatement.run({ groupId, musicInfoId })
    }
  })({ musicInfoId, groupIds })
}
