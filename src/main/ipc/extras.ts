import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import fs from 'node:fs/promises'
import type {
  AppSettings,
  BrowserDataItem,
  BrowserClearResult,
  HealthReport,
  OldDownload,
  ShredProgress,
  ShredResult,
  SystemReport
} from '../../shared/types'
import { readSettings, writeSettings } from '../lib/settingsLib'
import { scanBrowserData, clearBrowserData } from '../lib/privacyLib'
import { shredPaths } from '../lib/shredderLib'
import { findOldDownloads, downloadsPath } from '../lib/downloadsLib'
import { buildSystemReport } from '../lib/reportLib'
import { computeHealth } from '../lib/healthLib'
import { syncTray, focusMainWindow } from '../lib/tray'

export function registerExtrasIpc(): void {
  // ---------- الإعدادات ----------
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => readSettings())
  ipcMain.handle('settings:set', async (_event, patch: Partial<AppSettings>): Promise<AppSettings> => {
    const next = await writeSettings(patch)
    syncTray(next.minimizeToTray, {
      show: focusMainWindow,
      smartClean: () => {
        focusMainWindow()
        BrowserWindow.getAllWindows()[0]?.webContents.send('app:command', 'smartClean')
      }
    })
    return next
  })

  // ---------- صحة الجهاز ----------
  ipcMain.handle('health:compute', async (): Promise<HealthReport> => computeHealth())

  // ---------- خصوصية المتصفح ----------
  ipcMain.handle('privacy:scan', async (): Promise<BrowserDataItem[]> => scanBrowserData())
  ipcMain.handle('privacy:clear', async (_event, items: BrowserDataItem[]): Promise<BrowserClearResult[]> =>
    clearBrowserData(items)
  )

  // ---------- الممزّق الآمن ----------
  let shredCancelled = false
  ipcMain.handle('shred:cancel', async () => {
    shredCancelled = true
  })
  ipcMain.handle('shred:run', async (event, paths: string[], passes: number): Promise<ShredResult[]> => {
    shredCancelled = false
    const win = BrowserWindow.fromWebContents(event.sender)
    return shredPaths(paths, passes, {
      onProgress: (p: ShredProgress) => win?.webContents.send('shred:progress', p),
      shouldCancel: () => shredCancelled
    })
  })

  // ---------- التنزيلات القديمة ----------
  ipcMain.handle('downloads:findOld', async (_event, days: number): Promise<OldDownload[]> =>
    findOldDownloads(Math.max(1, Math.round(days)))
  )
  ipcMain.handle('downloads:path', async (): Promise<string> => downloadsPath())

  // ---------- تقرير النظام ----------
  ipcMain.handle('report:build', async (): Promise<SystemReport> => buildSystemReport())
  ipcMain.handle(
    'report:save',
    async (event, markdown: string): Promise<{ saved: boolean; path?: string }> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const stamp = new Date().toISOString().slice(0, 10)
      const result = await dialog.showSaveDialog(win ?? undefined!, {
        defaultPath: `CleanShelf-Report-${stamp}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }]
      })
      if (result.canceled || !result.filePath) return { saved: false }
      await fs.writeFile(result.filePath, markdown, 'utf8')
      return { saved: true, path: result.filePath }
    }
  )

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    if (/^https:\/\//.test(url)) await shell.openExternal(url)
  })
}
