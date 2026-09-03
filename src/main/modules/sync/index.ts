// import Event from './event/event'

import { disconnectServer } from './client'
import { stopServer } from './server'
import {
  enable as enableWebdav,
  testConnection as webdavTest,
  push as webdavPush,
  pull as webdavPull,
  getStatus as getWebdavStatus,
} from './webdav'
import log from './log'

// import eventNames from './event/name'
export {
  startServer,
  stopServer,
  getStatus as getServerStatus,
  generateCode,
  getDevices as getServerDevices,
  removeDevice as removeServerDevice,
} from './server'

export {
  connectServer,
  disconnectServer,
  getStatus as getClientStatus,
} from './client'

export {
  enableWebdav,
  webdavTest,
  webdavPush,
  webdavPull,
  getWebdavStatus,
}

export default () => {
  global.lx.event_app.on('main_window_close', () => {
    if (global.lx.appSetting['sync.mode'] == 'server') {
      void stopServer()
    } else if (global.lx.appSetting['sync.mode'] == 'client') {
      void disconnectServer()
    } else if (global.lx.appSetting['sync.mode'] == 'webdav' && global.lx.appSetting['sync.webdav.autoUploadOnQuit']) {
      void webdavPush().catch(err => {
        log.warn('[webdav] auto upload on quit failed', err)
      })
    }
  })
}
