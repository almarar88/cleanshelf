import type { IconName } from '../components/Icon'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'cleanshelf.theme'
const ACCENT_KEY = 'cleanshelf.accent'

export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // التخزين المحلي قد يكون معطّلًا — نعود للوضع الافتراضي
  }
  return 'system'
}

/** يطبّق السمة على عنصر الجذر؛ "system" تزيل السمة ليعمل prefers-color-scheme. */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // تجاهل — التبديل يبقى فعّالًا لهذه الجلسة
  }
}

export function nextTheme(current: ThemeMode): ThemeMode {
  if (current === 'system') return 'light'
  if (current === 'light') return 'dark'
  return 'system'
}

/** مفاتيح ترجمة لا نصوصًا جاهزة */
export const THEME_LABEL: Record<ThemeMode, string> = {
  system: 'theme.system',
  light: 'theme.light',
  dark: 'theme.dark'
}

export const THEME_ICON: Record<ThemeMode, IconName> = {
  system: 'laptop',
  light: 'sun',
  dark: 'moon'
}

/** لوحات التمييز — كل واحدة تبدّل الأصفر والبرتقالي في التصميم. */
export const ACCENTS: { hue: number; name: string; yellow: string; orange: string }[] = [
  { hue: 45, name: 'amber', yellow: '#f5e14c', orange: '#fc8b4f' },
  { hue: 150, name: 'mint', yellow: '#c8ec71', orange: '#4bbf87' },
  { hue: 200, name: 'sky', yellow: '#8fd7f5', orange: '#4a90e2' },
  { hue: 280, name: 'lilac', yellow: '#d9b8f7', orange: '#8b5cf6' },
  { hue: 15, name: 'coral', yellow: '#ffc4a3', orange: '#f2643c' },
  { hue: 330, name: 'rose', yellow: '#f8b4d0', orange: '#e0479a' }
]

export function loadAccent(): number {
  try {
    const saved = Number(localStorage.getItem(ACCENT_KEY))
    if (Number.isFinite(saved) && saved > 0) return saved
  } catch {
    // تجاهل
  }
  return ACCENTS[0].hue
}

export function applyAccent(hue: number): void {
  const accent = ACCENTS.find((a) => a.hue === hue) ?? ACCENTS[0]
  const root = document.documentElement
  root.style.setProperty('--accent-h', String(accent.hue))
  root.style.setProperty('--yellow', accent.yellow)
  root.style.setProperty('--orange', accent.orange)
  try {
    localStorage.setItem(ACCENT_KEY, String(accent.hue))
  } catch {
    // تجاهل
  }
}
