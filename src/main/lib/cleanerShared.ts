import fs from 'node:fs/promises'
import path from 'node:path'
import { dirStats, pathExists } from './fsWalk'
import type { CategoryDef } from './cleanerTypes'

export async function scanCategory(
  def: CategoryDef
): Promise<{ sizeBytes: number; fileCount: number; existingPaths: string[] }> {
  if (def.customScan) {
    const r = await def.customScan()
    return { ...r, existingPaths: [] }
  }
  const candidates = await def.resolvePaths()
  const existingPaths: string[] = []
  let sizeBytes = 0
  let fileCount = 0
  for (const p of candidates) {
    if (!p || !(await pathExists(p))) continue
    existingPaths.push(p)
    const stats = await dirStats(p)
    sizeBytes += stats.sizeBytes
    fileCount += stats.fileCount
  }
  return { sizeBytes, fileCount, existingPaths }
}

/** يحذف محتويات مجلد (وليس المجلد نفسه) لتفادي كسر تطبيقات تتوقع وجوده. */
export async function clearDirectoryContents(dirPath: string): Promise<number> {
  let freed = 0
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name)
    try {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        const stats = await dirStats(full)
        await fs.rm(full, { recursive: true, force: true })
        freed += stats.sizeBytes
      } else {
        const stat = await fs.stat(full)
        await fs.unlink(full)
        freed += stat.size
      }
    } catch {
      // ملف مستخدَم حاليًا أو محمي، نتخطاه ونكمل الباقي
    }
  }
  return freed
}
