import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { registerCleanerIpc } from './ipc/cleaner'
import { registerUninstallerIpc } from './ipc/uninstaller'
import { registerFileManagerIpc } from './ipc/fileManager'
import { registerTagEditorIpc } from './ipc/tagEditor'
import { registerStartupIpc } from './ipc/startup'
import { registerSystemInfoIpc } from './ipc/systemInfo'
import { registerDialogIpc } from './ipc/dialogs'
import { registerSystemToolsIpc } from './ipc/systemTools'
import { registerExtrasIpc } from './ipc/extras'
import { readSettings, getSettingsSync } from './lib/settingsLib'
import { syncTray, focusMainWindow } from './lib/tray'

const isDev = !app.isPackaged
let quitting = false

// يلزم ويندوز لإظهار الإشعارات باسم التطبيق لا باسم electron
app.setAppUserModelId('com.alcode.cleanshelf')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'CleanShelf',
    backgroundColor: '#0d1424',
    // النسخة المحزومة تأخذ أيقونتها من الملف التنفيذي نفسه؛ هذه لوضع التطوير فقط
    ...(isDev ? { icon: path.join(__dirname, '../../build/icon.png') } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    if (process.env['CLEANSHELF_SMOKE_TEST'] === '1') {
      import('./smokeTest').then(({ runSmokeTest }) => runSmokeTest(win))
    }
  })

  // "التصغير إلى شريط النظام": الإغلاق يخفي النافذة بدل إنهاء التطبيق
  win.on('close', (event) => {
    if (quitting || !getSettingsSync().minimizeToTray) return
    event.preventDefault()
    win.hide()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.on('before-quit', () => {
  quitting = true
})

app.whenReady().then(async () => {
  registerCleanerIpc()
  registerUninstallerIpc()
  registerFileManagerIpc()
  registerTagEditorIpc()
  registerStartupIpc()
  registerSystemInfoIpc()
  registerDialogIpc()
  registerSystemToolsIpc()
  registerExtrasIpc()

  const settings = await readSettings()
  createWindow()

  syncTray(settings.minimizeToTray, {
    show: focusMainWindow,
    smartClean: () => {
      focusMainWindow()
      BrowserWindow.getAllWindows()[0]?.webContents.send('app:command', 'smartClean')
    }
  })

  app.on('activate', () => {
    const existing = BrowserWindow.getAllWindows()[0]
    if (existing) focusMainWindow()
    else createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
