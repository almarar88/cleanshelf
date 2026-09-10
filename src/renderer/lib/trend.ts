/** يسجّل نقطة مساحة متاحة يوميًا لتقدير متى يمتلئ القرص. */

export interface TrendPoint {
  /** بداية اليوم بالمللي ثانية */
  day: number
  freeBytes: number
}

const KEY = 'cleanshelf.trend'
const DAY = 86_400_000
const MAX_POINTS = 60

export function loadTrend(): TrendPoint[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as TrendPoint[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

/** نقطة واحدة لكل يوم — آخر قراءة في اليوم هي المعتمدة. */
export function recordTrend(freeBytes: number): TrendPoint[] {
  const day = Math.floor(Date.now() / DAY) * DAY
  const points = loadTrend().filter((p) => p.day !== day)
  points.push({ day, freeBytes })
  points.sort((a, b) => a.day - b.day)
  const trimmed = points.slice(-MAX_POINTS)
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch {
    // تجاهل
  }
  return trimmed
}

export interface Forecast {
  /** الأيام المتبقّية حتى الامتلاء، أو null إن لم تكف البيانات */
  days: number | null
  /** متوسط ما يُستهلك يوميًا بالبايت */
  perDay: number
}

/**
 * ميل بسيط بين أول وآخر نقطة: يكفي لإعطاء إحساس بالاتجاه دون ادّعاء دقة.
 * نحتاج نقطتين على الأقل يفصل بينهما يوم كامل.
 */
export function forecastDays(points: TrendPoint[], freeNow: number): Forecast {
  if (points.length < 2) return { days: null, perDay: 0 }
  const first = points[0]
  const last = points[points.length - 1]
  const spanDays = (last.day - first.day) / DAY
  if (spanDays < 1) return { days: null, perDay: 0 }
  const perDay = (first.freeBytes - last.freeBytes) / spanDays
  if (perDay <= 0) return { days: null, perDay: 0 }
  return { days: Math.max(0, Math.round(freeNow / perDay)), perDay }
}
