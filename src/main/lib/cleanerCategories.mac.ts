import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { CategoryDef } from './cleanerTypes'
import { dirStats, pathExists } from './fsWalk'

const home = os.homedir()
const lib = path.join(home, 'Library')

/** يوسّع مجلدات الملفات الشخصية داخل مسار (مثل ملفات تعريف المتصفحات). */
async function subdirs(root: string, leaf: string): Promise<string[]> {
  if (!(await pathExists(root))) return []
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => path.join(root, e.name, leaf))
  } catch {
    return []
  }
}

export const MAC_CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'user_caches',
    labelKey: 'cleaner.mac.userCaches',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(lib, 'Caches')]
  },
  {
    id: 'system_caches',
    labelKey: 'cleaner.mac.systemCaches',
    risk: 'caution',
    requiresAdmin: true,
    resolvePaths: async () => ['/Library/Caches']
  },
  {
    id: 'user_logs',
    labelKey: 'cleaner.mac.userLogs',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(lib, 'Logs')]
  },
  {
    id: 'trash',
    labelKey: 'cleaner.mac.trash',
    risk: 'caution',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(home, '.Trash')]
  },
  {
    id: 'xcode_derived_data',
    labelKey: 'cleaner.mac.xcodeDerived',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(lib, 'Developer', 'Xcode', 'DerivedData')]
  },
  {
    id: 'xcode_device_support',
    labelKey: 'cleaner.mac.xcodeDeviceSupport',
    risk: 'caution',
    requiresAdmin: false,
    resolvePaths: async () => [
      path.join(lib, 'Developer', 'Xcode', 'iOS DeviceSupport'),
      path.join(lib, 'Developer', 'Xcode', 'watchOS DeviceSupport')
    ]
  },
  {
    id: 'xcode_archives',
    labelKey: 'cleaner.mac.xcodeArchives',
    risk: 'caution',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(lib, 'Developer', 'Xcode', 'Archives')]
  },
  {
    id: 'homebrew_cache',
    labelKey: 'cleaner.mac.homebrew',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(lib, 'Caches', 'Homebrew')]
  },
  {
    id: 'package_manager_caches',
    labelKey: 'cleaner.mac.packageManagers',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [
      path.join(home, '.npm', '_cacache'),
      path.join(lib, 'Caches', 'Yarn'),
      path.join(lib, 'Caches', 'pnpm'),
      path.join(home, '.cache', 'pip'),
      path.join(home, '.gradle', 'caches'),
      path.join(home, '.cocoapods')
    ]
  },
  {
    id: 'safari_cache',
    labelKey: 'cleaner.mac.safariCache',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [
      path.join(lib, 'Caches', 'com.apple.Safari'),
      path.join(lib, 'Containers', 'com.apple.Safari', 'Data', 'Library', 'Caches')
    ]
  },
  {
    id: 'chrome_cache',
    labelKey: 'cleaner.chromeCache',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () =>
      subdirs(path.join(lib, 'Application Support', 'Google', 'Chrome'), 'Cache')
  },
  {
    id: 'firefox_cache',
    labelKey: 'cleaner.firefoxCache',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () =>
      subdirs(path.join(lib, 'Caches', 'Firefox', 'Profiles'), 'cache2')
  },
  {
    id: 'edge_cache',
    labelKey: 'cleaner.edgeCache',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () =>
      subdirs(path.join(lib, 'Application Support', 'Microsoft Edge'), 'Cache')
  },
  {
    id: 'mail_downloads',
    labelKey: 'cleaner.mac.mailDownloads',
    risk: 'caution',
    requiresAdmin: false,
    resolvePaths: async () => [
      path.join(lib, 'Containers', 'com.apple.mail', 'Data', 'Library', 'Mail Downloads')
    ]
  },
  {
    id: 'ios_backups',
    labelKey: 'cleaner.mac.iosBackups',
    risk: 'caution',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(lib, 'Application Support', 'MobileSync', 'Backup')]
  },
  {
    id: 'crash_reports',
    labelKey: 'cleaner.mac.crashReports',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [
      path.join(lib, 'Logs', 'DiagnosticReports'),
      path.join(lib, 'Application Support', 'CrashReporter')
    ]
  },
  {
    id: 'quicklook_cache',
    labelKey: 'cleaner.mac.quicklook',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(lib, 'Caches', 'com.apple.QuickLook.thumbnailcache')]
  },
  {
    id: 'saved_app_state',
    labelKey: 'cleaner.mac.savedState',
    risk: 'caution',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(lib, 'Saved Application State')]
  }
]

/** حجم مجلد واحد — يُستخدم للمعاينة قبل الحذف. */
export async function macDirSize(target: string): Promise<number> {
  if (!(await pathExists(target))) return 0
  return (await dirStats(target)).sizeBytes
}
