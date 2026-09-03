import { SYNC_CLOSE_CODE, SYNC_CODE } from '@common/constants_sync'
import { registerListActionEvent } from '@main/modules/sync/listEvent'
import { sendSyncMessage } from '../../client'
import log from '../../../log'

let unregisterLocalListAction: (() => void) | null

export const registerEvent = (socket: LX.Sync.Client.Socket) => {
  // socket = _socket
  // socket.onClose(() => {
  //   unregisterLocalListAction?.()
  //   unregisterLocalListAction = null
  // })
  unregisterEvent()
  unregisterLocalListAction = registerListActionEvent((action) => {
    if (!socket.moduleReadys?.list) return
    void socket.remoteQueueList.onListSyncAction(action).catch(err => {
      sendSyncMessage(SYNC_CODE.syncActionFailed)
      socket.moduleReadys.list = false
      socket.close(SYNC_CLOSE_CODE.failed)
      log.warn(err.message)
    })
  })
}

export const unregisterEvent = () => {
  unregisterLocalListAction?.()
  unregisterLocalListAction = null
}
