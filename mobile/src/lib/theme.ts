export type ThemeMode = 'system' | 'light' | 'dark'

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}

/** ألوان التمييز المتاحة — تُستخدم في البطاقات والعناصر النشطة. */
export const ACCENTS: { hue: number; name: string; yellow: string; orange: string }[] = [
  { hue: 45, name: 'amber', yellow: '#f5e14c', orange: '#fc8b4f' },
  { hue: 150, name: 'mint', yellow: '#c8ec71', orange: '#4bbf87' },
  { hue: 200, name: 'sky', yellow: '#8fd7f5', orange: '#4a90e2' },
  { hue: 280, name: 'lilac', yellow: '#d9b8f7', orange: '#8b5cf6' },
  { hue: 15, name: 'coral', yellow: '#ffc4a3', orange: '#f2643c' },
  { hue: 330, name: 'rose', yellow: '#f8b4d0', orange: '#e0479a' }
]

export function applyAccent(hue: number): void {
  const accent = ACCENTS.find((a) => a.hue === hue) ?? ACCENTS[0]
  const root = document.documentElement
  root.style.setProperty('--accent-h', String(accent.hue))
  root.style.setProperty('--yellow', accent.yellow)
  root.style.setProperty('--orange', accent.orange)
}
