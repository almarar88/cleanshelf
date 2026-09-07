import type { AppSettings } from './types'

const KEY = 'cleanshelf.settings'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  accentHue: 216,
  notifications: true,
  scanOnLaunch: true,
  oldDownloadDays: 30,
  shredPasses: 3,
  trashRetentionDays: 30,
  showSystemApps: false,
  reminderEnabled: false,
  reminderDay: 6,
  reminderHour: 19
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // التخزين قد يكون معطّلًا — يبقى الإعداد لهذه الجلسة
  }
}
