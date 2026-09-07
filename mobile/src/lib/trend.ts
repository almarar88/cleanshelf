const KEY = 'cleanshelf.storageTrend'

export interface TrendPoint {
  t: number
  free: number
}

/** يحتفظ بنقطة لكل يوم (آخر 30 يومًا) لرسم اتجاه المساحة المتاحة. */
export function recordTrend(freeBytes: number): TrendPoint[] {
  let points: TrendPoint[] = []
  try {
    points = JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    points = []
  }
  const today = new Date().toDateString()
  const last = points[points.length - 1]
  if (last && new Date(last.t).toDateString() === today) last.free = freeBytes
  else points.push({ t: Date.now(), free: freeBytes })
  points = points.slice(-30)
  try {
    localStorage.setItem(KEY, JSON.stringify(points))
  } catch {
    // تجاهل
  }
  return points
}

export function loadTrend(): TrendPoint[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
