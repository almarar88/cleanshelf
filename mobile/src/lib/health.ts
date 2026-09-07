import type { HealthFactor, JunkScan, StorageStats, CleanHistoryEntry } from './types'

const GB = 1024 ** 3
const MB = 1024 ** 2

export interface Health {
  score: number
  factors: HealthFactor[]
  safeCleanableBytes: number
}

/** درجة صحة الهاتف من 100 — الخصم لكل عامل يستحق الانتباه. */
export function computeHealth(stats: StorageStats | null, junk: JunkScan | null, oldDownloads: number, history: CleanHistoryEntry[]): Health {
  const factors: HealthFactor[] = []
  let score = 100

  if (junk) {
    const total = junk.totalBytes
    if (total > 3 * GB) {
      score -= 22
      factors.push({ id: 'junk', label: 'ملفات غير ضرورية', status: 'bad', detail: 'أكثر من 3 غيغابايت يمكن تحريرها', page: 'cleaner' })
    } else if (total > 700 * MB) {
      score -= 12
      factors.push({ id: 'junk', label: 'ملفات غير ضرورية', status: 'warn', detail: 'مئات الميغابايت قابلة للتنظيف', page: 'cleaner' })
    } else if (total > 100 * MB) {
      score -= 5
      factors.push({ id: 'junk', label: 'ملفات غير ضرورية', status: 'warn', detail: 'القليل من الملفات القابلة للتنظيف', page: 'cleaner' })
    } else {
      factors.push({ id: 'junk', label: 'ملفات غير ضرورية', status: 'good', detail: 'الذاكرة نظيفة تقريبًا', page: 'cleaner' })
    }
  }

  if (stats) {
    const freePct = stats.storageTotalBytes > 0 ? Math.round((stats.storageFreeBytes / stats.storageTotalBytes) * 100) : 100
    if (freePct < 5) {
      score -= 30
      factors.push({ id: 'storage', label: 'مساحة التخزين', status: 'bad', detail: `${freePct}% فقط متاحة — الهاتف سيتباطأ`, page: 'analyzer' })
    } else if (freePct < 10) {
      score -= 18
      factors.push({ id: 'storage', label: 'مساحة التخزين', status: 'bad', detail: `${freePct}% متاحة — اقتربت من الامتلاء`, page: 'analyzer' })
    } else if (freePct < 20) {
      score -= 8
      factors.push({ id: 'storage', label: 'مساحة التخزين', status: 'warn', detail: `${freePct}% متاحة`, page: 'analyzer' })
    } else {
      factors.push({ id: 'storage', label: 'مساحة التخزين', status: 'good', detail: `${freePct}% متاحة`, page: 'analyzer' })
    }

    const memPct = stats.ramTotalBytes > 0 ? Math.round(((stats.ramTotalBytes - stats.ramAvailableBytes) / stats.ramTotalBytes) * 100) : 0
    if (memPct > 90) {
      score -= 8
      factors.push({ id: 'ram', label: 'الذاكرة', status: 'warn', detail: `${memPct}% مستخدمة — أغلق تطبيقات من الخلفية`, page: 'usage' })
    } else {
      factors.push({ id: 'ram', label: 'الذاكرة', status: 'good', detail: `${memPct}% مستخدمة`, page: 'usage' })
    }

    if (stats.batteryTempC >= 42) {
      score -= 6
      factors.push({ id: 'battery', label: 'حرارة البطارية', status: 'warn', detail: `${stats.batteryTempC.toFixed(0)}° — أعطِ الهاتف استراحة`, page: 'device' })
    }
  }

  if (oldDownloads > 20) {
    score -= 6
    factors.push({ id: 'downloads', label: 'التنزيلات القديمة', status: 'warn', detail: `${oldDownloads} ملفًا منسيًا في التنزيلات`, page: 'downloads' })
  } else if (oldDownloads > 0) {
    score -= 2
    factors.push({ id: 'downloads', label: 'التنزيلات القديمة', status: 'warn', detail: `${oldDownloads} ملفات قديمة في التنزيلات`, page: 'downloads' })
  } else {
    factors.push({ id: 'downloads', label: 'التنزيلات القديمة', status: 'good', detail: 'مجلد التنزيلات مرتّب', page: 'downloads' })
  }

  const last = history[0]
  const days = last ? Math.floor((Date.now() - last.timestamp) / 86_400_000) : null
  if (days === null) {
    score -= 6
    factors.push({ id: 'lastclean', label: 'آخر تنظيف', status: 'warn', detail: 'لم يُنفَّذ تنظيف بعد', page: 'history' })
  } else if (days > 30) {
    score -= 6
    factors.push({ id: 'lastclean', label: 'آخر تنظيف', status: 'warn', detail: `قبل ${days} يومًا`, page: 'history' })
  } else {
    factors.push({ id: 'lastclean', label: 'آخر تنظيف', status: 'good', detail: days === 0 ? 'اليوم' : `قبل ${days} يوم`, page: 'history' })
  }

  const safeCleanableBytes = junk ? junk.categories.filter((c) => c.risk === 'safe').reduce((s, c) => s + c.sizeBytes, 0) : 0
  return { score: Math.max(0, Math.min(100, score)), factors, safeCleanableBytes }
}
