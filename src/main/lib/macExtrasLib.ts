import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { OrphanLeftover, LanguageFileGroup, ScanProgress } from '../../shared/types'
import { dirStats, pathExists, ScanCancelledError } from './fsWalk'
import { run, runWithAdmin } from './shell'

const home = os.homedir()
const lib = path.join(home, 'Library')

export interface MacScanHooks {
  onProgress?: (progress: ScanProgress) => void
  shouldCancel?: () => boolean
}

const SUPPORT_ROOTS = [
  path.join(lib, 'Application Support'),
  path.join(lib, 'Caches'),
  path.join(lib, 'Preferences'),
  path.join(lib, 'Containers'),
  path.join(lib, 'Saved Application State'),
  path.join(lib, 'HTTPStorages')
]

const APP_DIRS = ['/Applications', '/Applications/Utilities', path.join(home, 'Applications')]

/** أسماء ومعرّفات لا تخص تطبيقًا مثبَّتًا بعينه، فلا تُعدّ يتيمة أبدًا. */
const SYSTEM_PREFIXES = [
  'com.apple.',
  'apple',
  'crashreporter',
  'mobilesync',
  'accountsd',
  'cloudkit',
  'knowledge',
  'icloud',
  'safari',
  'finder',
  'dock',
  'spotlight'
]

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function installedAppTokens(): Promise<Set<string>> {
  const tokens = new Set<string>()

  for (const dir of APP_DIRS) {
    if (!(await pathExists(dir))) continue
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.name.endsWith('.app')) continue
      const name = entry.name.replace(/\.app$/, '')
      tokens.add(normalize(name))

      // معرّف الحزمة يربط ملفات الدعم بالتطبيق حتى لو اختلف الاسم المعروض
      try {
        const plist = path.join(dir, entry.name, 'Contents', 'Info.plist')
        const out = await run('plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist], 10_000)
        const bundleId = out.trim()
        if (bundleId) {
          tokens.add(normalize(bundleId))
          const lastPart = bundleId.split('.').pop()
          if (lastPart && lastPart.length >= 4) tokens.add(normalize(lastPart))
        }
      } catch {
        // بعض الحزم بلا Info.plist صالح
      }
    }
  }

  return tokens
}

/**
 * يبحث عن ملفات دعم لتطبيقات لم تعد مثبَّتة — أكبر مصدر لتراكم المساحة على ماك،
 * لأن سحب التطبيق إلى المهملات لا يحذف ما تركه في Library.
 */
export async function findOrphanLeftovers(hooks: MacScanHooks = {}): Promise<OrphanLeftover[]> {
  const { onProgress, shouldCancel } = hooks
  const installed = await installedAppTokens()
  const orphans: OrphanLeftover[] = []
  let checked = 0

  for (const root of SUPPORT_ROOTS) {
    if (!(await pathExists(root))) continue
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (shouldCancel?.()) throw new ScanCancelledError()
      checked += 1
      const full = path.join(root, entry.name)
      onProgress?.({
        phase: 'walking',
        filesSeen: orphans.length,
        processed: checked,
        total: 0,
        currentPath: full
      })

      const lower = entry.name.toLowerCase()
      if (SYSTEM_PREFIXES.some((p) => lower.startsWith(p))) continue

      const token = normalize(entry.name.replace(/\.(plist|savedState)$/i, ''))
      if (token.length < 4) continue

      // مثبَّت إن طابق أي رمز لتطبيق موجود، في أي من الاتجاهين
      const isInstalled = [...installed].some(
        (appToken) => token.includes(appToken) || appToken.includes(token)
      )
      if (isInstalled) continue

      let sizeBytes = 0
      try {
        sizeBytes = entry.isDirectory()
          ? (await dirStats(full, 15_000)).sizeBytes
          : (await fs.stat(full)).size
      } catch {
        continue
      }

      orphans.push({ path: full, name: entry.name, sizeBytes, category: path.basename(root) })
    }
  }

  return orphans.sort((a, b) => b.sizeBytes - a.sizeBytes)
}

/**
 * ملفات اللغات (.lproj) داخل التطبيقات — تشغل غيغابايتات وأنت تستخدم لغتين.
 * نُبقي دائمًا الإنجليزية والعربية والقاعدة، ونعرض الباقي للحذف الاختياري.
 */
const KEEP_LANGUAGES = ['en', 'en_gb', 'en_us', 'english', 'base', 'ar', 'arabic']

export async function findLanguageFiles(hooks: MacScanHooks = {}): Promise<LanguageFileGroup[]> {
  const { onProgress, shouldCancel } = hooks
  const groups: LanguageFileGroup[] = []
  let checked = 0

  for (const dir of APP_DIRS) {
    if (!(await pathExists(dir))) continue
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (shouldCancel?.()) throw new ScanCancelledError()
      if (!entry.name.endsWith('.app')) continue

      const resources = path.join(dir, entry.name, 'Contents', 'Resources')
      if (!(await pathExists(resources))) continue

      checked += 1
      onProgress?.({
        phase: 'walking',
        filesSeen: groups.length,
        processed: checked,
        total: 0,
        currentPath: path.join(dir, entry.name)
      })

      let resourceEntries: import('node:fs').Dirent[]
      try {
        resourceEntries = await fs.readdir(resources, { withFileTypes: true })
      } catch {
        continue
      }

      const removable: string[] = []
      let sizeBytes = 0

      for (const res of resourceEntries) {
        if (!res.isDirectory() || !res.name.endsWith('.lproj')) continue
        const lang = res.name.replace(/\.lproj$/, '').toLowerCase()
        if (KEEP_LANGUAGES.includes(lang)) continue
        const full = path.join(resources, res.name)
        try {
          sizeBytes += (await dirStats(full, 5_000)).sizeBytes
          removable.push(full)
        } catch {
          // تجاهل
        }
      }

      if (removable.length > 0 && sizeBytes > 0) {
        groups.push({
          appName: entry.name.replace(/\.app$/, ''),
          appPath: path.join(dir, entry.name),
          languagePaths: removable,
          sizeBytes
        })
      }
    }
  }

  return groups.sort((a, b) => b.sizeBytes - a.sizeBytes)
}

/** يحرّر الذاكرة غير النشطة عبر أمر purge (يتطلب صلاحيات). */
export async function purgeMemory(): Promise<{ success: boolean; message: string }> {
  try {
    await runWithAdmin('purge')
    return { success: true, message: 'تم تحرير الذاكرة غير النشطة' }
  } catch (err) {
    const message = (err as Error).message
    return {
      success: false,
      message: /User canceled|-128/i.test(message) ? 'أُلغيت العملية' : message.trim().split('\n')[0]
    }
  }
}
