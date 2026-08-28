import { SYNC_CLOSE_CODE, SYNC_CODE } from '@common/constants_sync'
import { registerDislikeActionEvent } from '@main/modules/sync/dislikeEvent'
import { sendSyncMessage } from '../../client'

let unregisterLocalListAction: (() => void) | null

export const registerEvent = (socket: LX.Sync.Client.Socket) => {
  // socket = _socket
  // socket.onClose(() => {
  //   unregisterLocalListAction?.()
  //   unregisterLocalListAction = null
  // })
  unregisterEvent()
  unregisterLocalListAction = registerDislikeActionEvent((action) => {
    if (!socket.moduleReadys?.dislike) return
    void socket.remoteQueueDislike.onDislikeSyncAction(action).catch(err => {
      sendSyncMessage(SYNC_CODE.syncActionFailed)
      socket.moduleReadys.dislike = false
      socket.close(SYNC_CLOSE_CODE.failed)
      console.log(err.message)
    })
  })
}

export const unregisterEvent = () => {
  unregisterLocalListAction?.()
  unregisterLocalListAction = null
}
