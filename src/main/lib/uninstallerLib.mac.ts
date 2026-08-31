import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { shell } from 'electron'
import type { InstalledApp, LeftoverItem } from '../../shared/types'
import { dirStats, pathExists } from './fsWalk'
import { runJson } from './shell'

const home = os.homedir()
const lib = path.join(home, 'Library')

const APP_DIRS = ['/Applications', '/Applications/Utilities', path.join(home, 'Applications')]

interface PlistInfo {
  CFBundleIdentifier?: string
  CFBundleShortVersionString?: string
  CFBundleVersion?: string
  CFBundleName?: string
}

/** يقرأ Info.plist ككائن JSON عبر plutil بدل تحليل XML يدويًا. */
async function readPlist(appPath: string): Promise<PlistInfo> {
  const plist = path.join(appPath, 'Contents', 'Info.plist')
  if (!(await pathExists(plist))) return {}
  try {
    return await runJson<PlistInfo>('plutil', ['-convert', 'json', '-o', '-', plist], 15_000)
  } catch {
    return {}
  }
}

export async function listInstalledAppsMac(): Promise<InstalledApp[]> {
  const apps: InstalledApp[] = []

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
      const appPath = path.join(dir, entry.name)
      const info = await readPlist(appPath)
      const stats = await dirStats(appPath, 40_000)
      let installDate = ''
      try {
        installDate = (await fs.stat(appPath)).birthtime.toISOString().slice(0, 10)
      } catch {
        // بعض الحزم لا تحمل تاريخ إنشاء صالحًا
      }

      apps.push({
        key: appPath,
        name: entry.name.replace(/\.app$/, ''),
        version: info.CFBundleShortVersionString || info.CFBundleVersion || '',
        publisher: info.CFBundleIdentifier || '',
        installLocation: appPath,
        installDate,
        estimatedSizeKb: Math.round(stats.sizeBytes / 1024),
        uninstallString: appPath,
        quietUninstallString: '',
        hive: 'HKLM'
      })
    }
  }

  return apps.sort((a, b) => b.estimatedSizeKb - a.estimatedSizeKb)
}

/** إزالة تطبيق ماك = نقل حزمته إلى المهملات (قابل للتراجع). */
export async function uninstallAppMac(
  appPath: string
): Promise<{ success: boolean; message: string }> {
  if (!appPath.endsWith('.app') || !(await pathExists(appPath))) {
    return { success: false, message: 'مسار تطبيق غير صالح' }
  }
  try {
    await shell.trashItem(appPath)
    return { success: true, message: 'نُقل التطبيق إلى المهملات' }
  } catch (err) {
    const message = (err as Error).message
    return {
      success: false,
      message: /permission|denied/i.test(message)
        ? 'رُفض الوصول — قد يكون تطبيق نظام محميًا'
        : message
    }
  }
}

// المجلدات التي تخلّف فيها التطبيقات ملفاتها بعد الحذف
const LEFTOVER_ROOTS = [
  path.join(lib, 'Application Support'),
  path.join(lib, 'Caches'),
  path.join(lib, 'Preferences'),
  path.join(lib, 'Logs'),
  path.join(lib, 'Containers'),
  path.join(lib, 'Saved Application State'),
  path.join(lib, 'HTTPStorages'),
  path.join(lib, 'WebKit'),
  path.join(lib, 'LaunchAgents')
]

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * يبحث عن مخلّفات تطبيق. المطابقة تعتمد معرّف الحزمة أولًا لأنه دقيق،
 * ثم الاسم كاحتياط — مع اشتراط طول كافٍ حتى لا يلتقط اسم مثل "Go" كل شيء.
 */
export async function findLeftoversMac(
  appName: string,
  bundleId: string
): Promise<LeftoverItem[]> {
  const needles: string[] = []
  if (bundleId && bundleId.includes('.')) needles.push(normalize(bundleId))
  const normalizedName = normalize(appName)
  if (normalizedName.length >= 4) needles.push(normalizedName)
  if (needles.length === 0) return []

  const found: LeftoverItem[] = []

  for (const root of LEFTOVER_ROOTS) {
    if (!(await pathExists(root))) continue
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const normalizedEntry = normalize(entry.name)
      if (!needles.some((n) => normalizedEntry.includes(n))) continue

      const full = path.join(root, entry.name)
      let sizeBytes = 0
      try {
        sizeBytes = entry.isDirectory()
          ? (await dirStats(full, 20_000)).sizeBytes
          : (await fs.stat(full)).size
      } catch {
        continue
      }
      found.push({ path: full, kind: entry.isDirectory() ? 'folder' : 'file', sizeBytes })
    }
  }

  return found.sort((a, b) => b.sizeBytes - a.sizeBytes)
}

export async function removeLeftoverMac(target: string): Promise<void> {
  const isUnderKnownRoot = LEFTOVER_ROOTS.some((root) => target.startsWith(root + path.sep))
  if (!isUnderKnownRoot) {
    throw new Error('مسار خارج مجلدات المخلّفات المعروفة')
  }
  // عبر المهملات لا حذفًا نهائيًا، فالمطابقة بالاسم قد تخطئ أحيانًا
  await shell.trashItem(target)
}
