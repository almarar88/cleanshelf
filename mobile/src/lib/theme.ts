import type { IconName } from '../components/Icon'

export type ThemeMode = 'system' | 'light' | 'dark'

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}

export function applyAccent(hue: number): void {
  document.documentElement.style.setProperty('--accent-h', String(hue))
}

export const THEME_LABEL: Record<ThemeMode, string> = { system: 'حسب النظام', light: 'فاتح', dark: 'داكن' }
export const THEME_ICON: Record<ThemeMode, IconName> = { system: 'laptop', light: 'sun', dark: 'moon' }

export const ACCENTS: { hue: number; name: string }[] = [
  { hue: 216, name: 'أزرق' },
  { hue: 262, name: 'بنفسجي' },
  { hue: 330, name: 'وردي' },
  { hue: 12, name: 'برتقالي' },
  { hue: 152, name: 'أخضر' },
  { hue: 188, name: 'سماوي' }
]
