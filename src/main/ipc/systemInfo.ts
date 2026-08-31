import { ipcMain, app } from 'electron'
import type { SystemSummary, AppInfo } from '../../shared/types'
import { getSystemSummary } from '../lib/systemInfoLib'
import { isElevated, relaunchAsAdmin } from '../lib/elevation'

export function registerSystemInfoIpc(): void {
  ipcMain.handle('system:summary', async (): Promise<SystemSummary> => {
    return getSystemSummary()
  })

  ipcMain.handle('system:appInfo', async (): Promise<AppInfo> => {
    return { name: 'CleanShelf', version: app.getVersion(), company: 'Alcode' }
  })

  ipcMain.handle('system:isAdmin', async (): Promise<boolean> => {
    return isElevated()
  })

  ipcMain.handle(
    'system:relaunchAsAdmin',
    async (): Promise<{ started: boolean; message: string }> => {
      if (!app.isPackaged) {
        return {
          started: false,
          message: 'إعادة التشغيل كمسؤول متاحة في النسخة المثبَّتة فقط، وليس في وضع التطوير.'
        }
      }
      relaunchAsAdmin()
      return { started: true, message: 'جارٍ إعادة التشغيل بصلاحيات المدير…' }
    }
  )
}
