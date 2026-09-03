/**
 * This file is used specifically and only for development. It installs
 * `electron-debug` & `vue-devtools`. There shouldn't be any need to
 *  modify this file, but it can be used to extend your development
 *  environment.
 */

import { app, type BrowserWindow } from 'electron'
import electronDebug from 'electron-debug'
import { installDevToolsExtension } from './utils/installDevTools'
import { openDevTools } from './utils'

// Install `electron-debug` with `devtron`
electronDebug({
  showDevTools: false,
  devToolsMode: 'undocked',
})

// Vue DevTools 扩展 ID
const VUEJS_DEVTOOLS_ID = 'nhdogjmejiglipccpnnnanhbledajbpd'

// Install `vue-devtools`
app.on('ready', () => {
  const installExtension = (win: BrowserWindow, winName: string) => {
    openDevTools(win.webContents)
    installDevToolsExtension(VUEJS_DEVTOOLS_ID, win.webContents.session)
      .catch((err: Error) => {
        console.warn('[' + winName + '] An error occurred: ', err)
      })
  }

  global.lx.event_app.on('main_window_created', (win: BrowserWindow) => {
    installExtension(win, 'main window')
  })
  global.lx.event_app.on('desktop_lyric_window_created', (win: BrowserWindow) => {
    installExtension(win, 'lyric window')
  })
})

// Require `main` process to boot app
require('./index')
