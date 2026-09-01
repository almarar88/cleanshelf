import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import type { OldDownload } from '../../shared/types'
import { dirStats } from './fsWalk'

const DAY_MS = 24 * 60 * 60 * 1000

/** يعرض ما في مجلد التنزيلات (المستوى الأول) مما مضى عليه أكثر من N يوم. */
export async function findOldDownloads(olderThanDays: number): Promise<OldDownload[]> {
  const root = app.getPath('downloads')
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return []
  }

  const now = Date.now()
  const out: OldDownload[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
    const full = path.join(root, entry.name)
    try {
      const stat = await fs.stat(full)
      // أحدث تاريخ بين التعديل والإنشاء، فالملف المنسوخ حديثًا يحمل تاريخ تعديل قديم
      const newest = Math.max(stat.mtimeMs, stat.birthtimeMs || 0)
      const ageDays = Math.floor((now - newest) / DAY_MS)
      if (ageDays < olderThanDays) continue
      const sizeBytes = entry.isDirectory() ? (await dirStats(full, 30_000)).sizeBytes : stat.size
      out.push({
        path: full,
        name: entry.name,
        isDirectory: entry.isDirectory(),
        sizeBytes,
        modifiedAt: new Date(newest).toISOString(),
        ageDays,
        extension: entry.isDirectory() ? '' : path.extname(entry.name).replace('.', '').toLowerCase()
      })
    } catch {
      // ملف تعذّر قراءته
    }
  }
  return out.sort((a, b) => b.sizeBytes - a.sizeBytes)
}

export function downloadsPath(): string {
  return app.getPath('downloads')
}
