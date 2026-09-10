const UNITS = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت', 'تيرابايت']

export function formatBytes(bytes: number, compact = false): string {
  if (!bytes || bytes <= 0) return `0 ${UNITS[0]}`
  let value = bytes
  let i = 0
  while (value >= 1024 && i < UNITS.length - 1) {
    value /= 1024
    i += 1
  }
  const digits = i === 0 ? 0 : value >= 100 || compact ? 0 : 1
  return `${value.toFixed(digits)} ${UNITS[i]}`
}

/** الرقم والوحدة منفصلان — للبطاقات التي تعرض الرقم بحجم كبير. */
export function splitBytes(bytes: number): { value: string; unit: string } {
  if (!bytes || bytes <= 0) return { value: '0', unit: UNITS[0] }
  let value = bytes
  let i = 0
  while (value >= 1024 && i < UNITS.length - 1) {
    value /= 1024
    i += 1
  }
  return { value: value.toFixed(i === 0 || value >= 100 ? 0 : 1), unit: UNITS[i] }
}

export function formatDate(iso: string, withTime = true): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('ar', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatShortDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat('ar', { month: 'short', day: 'numeric' }).format(new Date(ms))
  } catch {
    return ''
  }
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
