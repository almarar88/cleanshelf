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

export const THEME_LABEL: Record<ThemeMode, string> = {
  system: 'حسب النظام',
  light: 'فاتح',
  dark: 'داكن'
}

export const THEME_ICON: Record<ThemeMode, IconName> = {
  system: 'laptop',
  light: 'sun',
  dark: 'moon'
}

/** ألوان التمييز المتاحة — صبغة HSL فقط، والباقي يُشتق في CSS. */
export const ACCENTS: { hue: number; name: string }[] = [
  { hue: 216, name: 'أزرق' },
  { hue: 262, name: 'بنفسجي' },
  { hue: 330, name: 'وردي' },
  { hue: 12, name: 'برتقالي' },
  { hue: 152, name: 'أخضر' },
  { hue: 188, name: 'سماوي' }
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
  document.documentElement.style.setProperty('--accent-h', String(hue))
  try {
    localStorage.setItem(ACCENT_KEY, String(hue))
  } catch {
    // تجاهل
  }
}
