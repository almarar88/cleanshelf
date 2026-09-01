import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import type { AppSettings } from '../../shared/types'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  accentHue: 216,
  minimizeToTray: false,
  launchAtLogin: false,
  notifications: true,
  scanOnLaunch: true,
  oldDownloadDays: 30,
  shredPasses: 3
}

let cache: AppSettings | null = null

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function sanitize(raw: unknown): AppSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: AppSettings = { ...DEFAULT_SETTINGS }
  if (obj.theme === 'light' || obj.theme === 'dark' || obj.theme === 'system') out.theme = obj.theme
  if (typeof obj.accentHue === 'number' && obj.accentHue >= 0 && obj.accentHue <= 360)
    out.accentHue = obj.accentHue
  for (const key of ['minimizeToTray', 'launchAtLogin', 'notifications', 'scanOnLaunch'] as const) {
    if (typeof obj[key] === 'boolean') out[key] = obj[key] as boolean
  }
  if (typeof obj.oldDownloadDays === 'number' && obj.oldDownloadDays >= 1)
    out.oldDownloadDays = Math.round(obj.oldDownloadDays)
  if (typeof obj.shredPasses === 'number' && obj.shredPasses >= 1 && obj.shredPasses <= 7)
    out.shredPasses = Math.round(obj.shredPasses)
  return out
}

/** نسخة متزامنة لمعالجات الأحداث التي لا تنتظر وعدًا (مثل إغلاق النافذة). */
export function getSettingsSync(): AppSettings {
  return cache ?? DEFAULT_SETTINGS
}

export async function readSettings(): Promise<AppSettings> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8')
    cache = sanitize(JSON.parse(raw))
  } catch {
    // أول تشغيل أو ملف تالف — الافتراضيات
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export async function writeSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readSettings()
  const next = sanitize({ ...current, ...patch })
  cache = next
  try {
    await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  } catch {
    // فشل الحفظ لا يمنع تطبيق الإعداد لهذه الجلسة
  }
  applyLoginItem(next.launchAtLogin)
  return next
}

/**
 * "التشغيل عند الدخول" يعمل في النسخة المحزومة فقط؛ في وضع التطوير سيُسجَّل
 * ملف electron نفسه لا التطبيق، فنتجاهله هناك.
 */
function applyLoginItem(enabled: boolean): void {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
  } catch {
    // بعض بيئات ماك ترفضه للتطبيقات غير الموقَّعة — لا نُسقط الإعدادات لأجله
  }
}
