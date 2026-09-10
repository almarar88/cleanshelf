import { getLang, t } from './i18n'

const UNIT_KEYS = ['unit.b', 'unit.kb', 'unit.mb', 'unit.gb', 'unit.tb']

/** أرقام لاتينية دائمًا مع فواصل حسب اللغة. */
export function fmtNum(n: number, digits = 0): string {
  const locale = getLang() === 'ar' ? 'ar-u-nu-latn' : 'en-US'
  try {
    return n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  } catch {
    return n.toFixed(digits)
  }
}

export function formatBytes(bytes: number, compact = false): string {
  if (!bytes || bytes <= 0) return `0 ${t(UNIT_KEYS[0])}`
  let value = bytes
  let i = 0
  while (value >= 1024 && i < UNIT_KEYS.length - 1) {
    value /= 1024
    i += 1
  }
  const digits = i === 0 ? 0 : value >= 100 || compact ? 0 : 1
  return `${fmtNum(value, digits)} ${t(UNIT_KEYS[i])}`
}

/** الرقم والوحدة منفصلان — للبطاقات التي تعرض الرقم بحجم كبير. */
export function splitBytes(bytes: number): { value: string; unit: string } {
  if (!bytes || bytes <= 0) return { value: '0', unit: t(UNIT_KEYS[0]) }
  let value = bytes
  let i = 0
  while (value >= 1024 && i < UNIT_KEYS.length - 1) {
    value /= 1024
    i += 1
  }
  return { value: fmtNum(value, i === 0 || value >= 100 ? 0 : 1), unit: t(UNIT_KEYS[i]) }
}

export function formatDate(iso: string, withTime = true): string {
  if (!iso) return ''
  const locale = getLang() === 'ar' ? 'ar-u-nu-latn' : 'en-GB'
  try {
    return new Intl.DateTimeFormat(locale, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatShortDate(ms: number): string {
  const locale = getLang() === 'ar' ? 'ar-u-nu-latn' : 'en-GB'
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(ms))
  } catch {
    return ''
  }
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${fmtNum(m)}:${String(s).padStart(2, '0')}`
}
