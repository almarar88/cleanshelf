export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 بايت'
  const units = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت', 'تيرابايت']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function formatDate(ms: number): string {
  if (!ms) return ''
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))
  } catch {
    return new Date(ms).toISOString()
  }
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86_400)
  const h = Math.floor((sec % 86_400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d} يوم و${h} ساعة`
  if (h > 0) return `${h} ساعة و${m} دقيقة`
  return `${m} دقيقة`
}

export function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h} س ${m} د`
  return `${m} د`
}
