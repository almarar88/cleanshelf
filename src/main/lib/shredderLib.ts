import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ShredProgress, ShredResult } from '../../shared/types'

const CHUNK = 1024 * 1024

export interface ShredHooks {
  onProgress?: (p: ShredProgress) => void
  shouldCancel?: () => boolean
}

/**
 * يكتب فوق محتوى الملف عدة مرات (بيانات عشوائية ثم أصفار) قبل حذفه، ثم يغيّر
 * اسمه لاسم عشوائي حتى لا يبقى الاسم الأصلي في جدول الملفات.
 * ملاحظة: على أقراص SSD قد يحتفظ القرص بنسخ داخلية، فالتمزيق يقلّل الاحتمال ولا يضمن.
 */
async function shredOne(filePath: string, passes: number, report: (pass: number) => void): Promise<void> {
  const stat = await fs.stat(filePath)
  const size = stat.size
  const handle = await fs.open(filePath, 'r+')
  try {
    for (let pass = 1; pass <= passes; pass += 1) {
      report(pass)
      const lastPass = pass === passes
      let offset = 0
      while (offset < size) {
        const len = Math.min(CHUNK, size - offset)
        const buffer = lastPass ? Buffer.alloc(len, 0) : randomBytes(len)
        await handle.write(buffer, 0, len, offset)
        offset += len
      }
      await handle.sync()
    }
  } finally {
    await handle.close()
  }
  await fs.truncate(filePath, 0)

  const dir = path.dirname(filePath)
  const anonymous = path.join(dir, randomBytes(8).toString('hex'))
  try {
    await fs.rename(filePath, anonymous)
    await fs.unlink(anonymous)
  } catch {
    await fs.unlink(filePath)
  }
}

async function collectFiles(target: string): Promise<string[]> {
  const stat = await fs.lstat(target)
  if (stat.isSymbolicLink()) return []
  if (!stat.isDirectory()) return [target]
  const out: string[] = []
  const entries = await fs.readdir(target, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(target, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) out.push(...(await collectFiles(full)))
    else out.push(full)
  }
  return out
}

export async function shredPaths(
  targets: string[],
  passes: number,
  hooks: ShredHooks = {}
): Promise<ShredResult[]> {
  const results: ShredResult[] = []
  const safePasses = Math.min(Math.max(Math.round(passes), 1), 7)

  const plan: { file: string; root: string }[] = []
  for (const root of targets) {
    try {
      for (const file of await collectFiles(root)) plan.push({ file, root })
    } catch (err) {
      results.push({ path: root, success: false, error: (err as Error).message })
    }
  }

  const failedRoots = new Set<string>()
  let done = 0
  for (const { file, root } of plan) {
    if (hooks.shouldCancel?.()) {
      results.push({ path: file, success: false, error: 'أُلغيت العملية' })
      failedRoots.add(root)
      continue
    }
    try {
      await shredOne(file, safePasses, (pass) =>
        hooks.onProgress?.({ path: file, pass, totalPasses: safePasses, done, total: plan.length })
      )
      results.push({ path: file, success: true })
    } catch (err) {
      results.push({ path: file, success: false, error: (err as Error).message })
      failedRoots.add(root)
    }
    done += 1
  }

  // المجلدات التي فرغت بالكامل تُحذف هي الأخرى
  for (const root of targets) {
    if (failedRoots.has(root)) continue
    try {
      const stat = await fs.lstat(root)
      if (stat.isDirectory()) await fs.rm(root, { recursive: true, force: true })
    } catch {
      // حُذف بالفعل أو لا صلاحية — النتائج أعلاه هي المرجع
    }
  }

  return results
}
