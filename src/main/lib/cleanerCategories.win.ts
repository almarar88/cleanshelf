import fs from 'node:fs/promises'
import path from 'node:path'
import { pathExists } from './fsWalk'
import { runPowerShell } from './powershell'
import { env } from './platform'
import type { CategoryDef } from './cleanerTypes'

async function firefoxCacheDirs(): Promise<string[]> {
  const profilesRoot = path.join(env('LOCALAPPDATA'), 'Mozilla', 'Firefox', 'Profiles')
  if (!(await pathExists(profilesRoot))) return []
  try {
    const entries = await fs.readdir(profilesRoot, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(profilesRoot, e.name, 'cache2'))
  } catch {
    return []
  }
}

export const WINDOWS_CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'user_temp',
    labelKey: 'cleaner.userTemp',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [env('TEMP') || env('TMP')].filter(Boolean)
  },
  {
    id: 'windows_temp',
    labelKey: 'cleaner.windowsTemp',
    risk: 'safe',
    requiresAdmin: true,
    resolvePaths: async () => [path.join(env('WINDIR') || 'C:\\Windows', 'Temp')]
  },
  {
    id: 'prefetch',
    labelKey: 'cleaner.prefetch',
    risk: 'caution',
    requiresAdmin: true,
    resolvePaths: async () => [path.join(env('WINDIR') || 'C:\\Windows', 'Prefetch')]
  },
  {
    id: 'windows_update_cache',
    labelKey: 'cleaner.windowsUpdate',
    risk: 'safe',
    requiresAdmin: true,
    resolvePaths: async () => [
      path.join(env('WINDIR') || 'C:\\Windows', 'SoftwareDistribution', 'Download')
    ]
  },
  {
    id: 'thumbnail_cache',
    labelKey: 'cleaner.thumbnails',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [
      path.join(env('LOCALAPPDATA'), 'Microsoft', 'Windows', 'Explorer')
    ]
  },
  {
    id: 'windows_error_reports',
    labelKey: 'cleaner.errorReports',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(env('LOCALAPPDATA'), 'Microsoft', 'Windows', 'WER')]
  },
  {
    id: 'recent_list',
    labelKey: 'cleaner.recentList',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [path.join(env('APPDATA'), 'Microsoft', 'Windows', 'Recent')]
  },
  {
    id: 'chrome_cache',
    labelKey: 'cleaner.chromeCache',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [
      path.join(env('LOCALAPPDATA'), 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
      path.join(env('LOCALAPPDATA'), 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache')
    ]
  },
  {
    id: 'edge_cache',
    labelKey: 'cleaner.edgeCache',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: async () => [
      path.join(env('LOCALAPPDATA'), 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
      path.join(env('LOCALAPPDATA'), 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache')
    ]
  },
  {
    id: 'firefox_cache',
    labelKey: 'cleaner.firefoxCache',
    risk: 'safe',
    requiresAdmin: false,
    resolvePaths: firefoxCacheDirs
  },
  {
    id: 'delivery_optimization',
    labelKey: 'cleaner.deliveryOptimization',
    risk: 'caution',
    requiresAdmin: true,
    resolvePaths: async () => [
      path.join(env('WINDIR') || 'C:\\Windows', 'SoftwareDistribution', 'DeliveryOptimization')
    ]
  },
  {
    id: 'minidumps',
    labelKey: 'cleaner.minidumps',
    risk: 'caution',
    requiresAdmin: true,
    resolvePaths: async () => [path.join(env('WINDIR') || 'C:\\Windows', 'Minidump')]
  },
  {
    id: 'recycle_bin',
    labelKey: 'cleaner.recycleBin',
    risk: 'caution',
    requiresAdmin: false,
    resolvePaths: async () => [],
    customScan: async () => {
      const script = `
        $shell = New-Object -ComObject Shell.Application
        $bin = $shell.Namespace(0xA)
        $items = $bin.Items()
        $size = 0
        foreach ($i in $items) { $size += $i.ExtendedProperty('Size') }
        [PSCustomObject]@{ SizeBytes = $size; Count = $items.Count } | ConvertTo-Json -Compress
      `
      try {
        const out = await runPowerShell(script)
        const parsed = JSON.parse(out.trim())
        return { sizeBytes: Number(parsed.SizeBytes) || 0, fileCount: Number(parsed.Count) || 0 }
      } catch {
        return { sizeBytes: 0, fileCount: 0 }
      }
    },
    customClean: async () => {
      const before = await WINDOWS_CATEGORY_DEFS.find((c) => c.id === 'recycle_bin')!.customScan!()
      await runPowerShell('Clear-RecycleBin -Force -ErrorAction SilentlyContinue')
      return before.sizeBytes
    }
  }
]
