import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'

let tray: Tray | null = null

function trayIconPath(): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'tray')
    : path.join(__dirname, '../../build/tray')
  // اسم ينتهي بـ Template يجعل ماك يلوّنه تلقائيًا حسب شريط القوائم
  return path.join(base, process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png')
}

export interface TrayActions {
  show: () => void
  smartClean: () => void
}

/** ينشئ أيقونة شريط النظام أو يزيلها حسب الإعداد — استدعاؤه آمن مرارًا. */
export function syncTray(enabled: boolean, actions: TrayActions): void {
  if (!enabled) {
    tray?.destroy()
    tray = null
    return
  }
  if (tray) return

  let image = nativeImage.createFromPath(trayIconPath())
  if (image.isEmpty()) image = nativeImage.createEmpty()
  tray = new Tray(image)
  tray.setToolTip('CleanShelf')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'فتح CleanShelf', click: actions.show },
      { label: 'تنظيف ذكي الآن', click: actions.smartClean },
      { type: 'separator' },
      { label: 'خروج', click: () => app.quit() }
    ])
  )
  tray.on('click', actions.show)
}

export function focusMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
