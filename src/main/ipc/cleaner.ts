import { ipcMain, BrowserWindow } from 'electron'
import type { CleanerScanResult, CleanProgress, CleanerCategory, SmartCleanResult } from '../../shared/types'
import { CATEGORY_DEFS, scanCategory, clearDirectoryContents } from '../lib/cleanerCategories'
import { appendHistory } from '../lib/historyLib'
import { isElevated } from '../lib/elevation'
import { notify } from '../lib/notify'

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 بايت'
  const units = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت', 'تيرابايت']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export async function scanAllCategories(): Promise<CleanerScanResult> {
  const categories: CleanerCategory[] = await Promise.all(
    CATEGORY_DEFS.map(async (def) => {
      try {
        const { sizeBytes, fileCount } = await scanCategory(def)
        return {
          id: def.id,
          labelKey: def.labelKey,
          path: null,
          sizeBytes,
          fileCount,
          scanned: true,
          risk: def.risk,
          requiresAdmin: def.requiresAdmin
        }
      } catch (err) {
        return {
          id: def.id,
          labelKey: def.labelKey,
          path: null,
          sizeBytes: 0,
          fileCount: 0,
          scanned: false,
          error: (err as Error).message,
          risk: def.risk,
          requiresAdmin: def.requiresAdmin
        }
      }
    })
  )
  const totalBytes = categories.reduce((sum, c) => sum + c.sizeBytes, 0)
  return { categories, totalBytes }
}

/** ينظّف الفئات المطلوبة بالترتيب ويبثّ التقدّم للنافذة، ثم يسجّل في السجل ويُشعر. */
export async function cleanCategories(
  win: BrowserWindow | null,
  categoryIds: string[]
): Promise<number> {
  let totalFreedBytes = 0
  for (const id of categoryIds) {
    const def = CATEGORY_DEFS.find((c) => c.id === id)
    if (!def) continue
    win?.webContents.send('cleaner:progress', { categoryId: id, done: false, freedBytes: 0 } satisfies CleanProgress)
    try {
      let freed = 0
      if (def.customClean) {
        freed = await def.customClean()
      } else {
        const { existingPaths } = await scanCategory(def)
        for (const p of existingPaths) freed += await clearDirectoryContents(p)
      }
      totalFreedBytes += freed
      win?.webContents.send('cleaner:progress', { categoryId: id, done: true, freedBytes: freed } satisfies CleanProgress)
    } catch (err) {
      win?.webContents.send('cleaner:progress', {
        categoryId: id,
        done: true,
        freedBytes: 0,
        error: (err as Error).message
      } satisfies CleanProgress)
    }
  }

  if (categoryIds.length > 0) {
    await appendHistory({ timestamp: new Date().toISOString(), freedBytes: totalFreedBytes, categories: categoryIds })
    await notify('اكتمل التنظيف', `تم تحرير ${formatBytes(totalFreedBytes)} من المساحة`)
  }
  return totalFreedBytes
}

/**
 * التنظيف الذكي: كل الفئات الآمنة التي فيها بيانات ولا تحتاج صلاحيات غير متاحة —
 * لا يلمس أبدًا فئات "انتبه" حتى لا يفاجئ المستخدم بفقد ما لا يتوقعه.
 */
export async function smartClean(win: BrowserWindow | null): Promise<SmartCleanResult> {
  const [scan, elevated] = await Promise.all([scanAllCategories(), isElevated().catch(() => false)])
  const ids = scan.categories
    .filter((c) => c.risk === 'safe' && c.sizeBytes > 0 && (!c.requiresAdmin || elevated))
    .map((c) => c.id)
  const freedBytes = await cleanCategories(win, ids)
  return { freedBytes, categoryIds: ids }
}

export function registerCleanerIpc(): void {
  ipcMain.handle('cleaner:scan', async (): Promise<CleanerScanResult> => scanAllCategories())

  ipcMain.handle('cleaner:clean', async (event, categoryIds: string[]): Promise<{ totalFreedBytes: number }> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const totalFreedBytes = await cleanCategories(win, categoryIds)
    return { totalFreedBytes }
  })

  ipcMain.handle('cleaner:smartClean', async (event): Promise<SmartCleanResult> =>
    smartClean(BrowserWindow.fromWebContents(event.sender))
  )
}
