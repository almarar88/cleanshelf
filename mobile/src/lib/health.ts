import type { CleanHistoryEntry, HealthFactor, JunkScan, StorageStats } from './types'
import { t } from './i18n'

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
      factors.push({ id: 'junk', label: t('health.junk'), status: 'bad', detail: t('health.junk.bad'), page: 'cleaner' })
    } else if (total > 700 * MB) {
      score -= 12
      factors.push({ id: 'junk', label: t('health.junk'), status: 'warn', detail: t('health.junk.warn'), page: 'cleaner' })
    } else if (total > 100 * MB) {
      score -= 5
      factors.push({ id: 'junk', label: t('health.junk'), status: 'warn', detail: t('health.junk.some'), page: 'cleaner' })
    } else {
      factors.push({ id: 'junk', label: t('health.junk'), status: 'good', detail: t('health.junk.good'), page: 'cleaner' })
    }
  }

  if (stats) {
    const p = stats.storageTotalBytes > 0 ? Math.round((stats.storageFreeBytes / stats.storageTotalBytes) * 100) : 100
    if (p < 5) {
      score -= 30
      factors.push({ id: 'storage', label: t('health.storage'), status: 'bad', detail: t('health.storage.crit', { p }), page: 'analyzer' })
    } else if (p < 10) {
      score -= 18
      factors.push({ id: 'storage', label: t('health.storage'), status: 'bad', detail: t('health.storage.bad', { p }), page: 'analyzer' })
    } else if (p < 20) {
      score -= 8
      factors.push({ id: 'storage', label: t('health.storage'), status: 'warn', detail: t('health.storage.pct', { p }), page: 'analyzer' })
    } else {
      factors.push({ id: 'storage', label: t('health.storage'), status: 'good', detail: t('health.storage.pct', { p }), page: 'analyzer' })
    }

    const mem = stats.ramTotalBytes > 0 ? Math.round(((stats.ramTotalBytes - stats.ramAvailableBytes) / stats.ramTotalBytes) * 100) : 0
    if (mem > 90) {
      score -= 8
      factors.push({ id: 'ram', label: t('health.ram'), status: 'warn', detail: t('health.ram.high', { p: mem }), page: 'booster' })
    } else {
      factors.push({ id: 'ram', label: t('health.ram'), status: 'good', detail: t('health.ram.pct', { p: mem }), page: 'booster' })
    }

    if (stats.batteryTempC >= 42) {
      score -= 6
      factors.push({ id: 'battery', label: t('health.battery'), status: 'warn', detail: t('health.battery.hot', { t: stats.batteryTempC.toFixed(0) }), page: 'device' })
    }
  }

  if (oldDownloads > 20) {
    score -= 6
    factors.push({ id: 'downloads', label: t('health.downloads'), status: 'warn', detail: t('health.downloads.many', { n: oldDownloads }), page: 'downloads' })
  } else if (oldDownloads > 0) {
    score -= 2
    factors.push({ id: 'downloads', label: t('health.downloads'), status: 'warn', detail: t('health.downloads.some', { n: oldDownloads }), page: 'downloads' })
  } else {
    factors.push({ id: 'downloads', label: t('health.downloads'), status: 'good', detail: t('health.downloads.good'), page: 'downloads' })
  }

  const last = history[0]
  const days = last ? Math.floor((Date.now() - last.timestamp) / 86_400_000) : null
  if (days === null) {
    score -= 6
    factors.push({ id: 'lastclean', label: t('health.lastclean'), status: 'warn', detail: t('health.lastclean.never'), page: 'history' })
  } else if (days > 30) {
    score -= 6
    factors.push({ id: 'lastclean', label: t('health.lastclean'), status: 'warn', detail: t('health.lastclean.ago', { n: days }), page: 'history' })
  } else {
    factors.push({ id: 'lastclean', label: t('health.lastclean'), status: 'good', detail: days === 0 ? t('health.lastclean.today') : t('health.lastclean.ago', { n: days }), page: 'history' })
  }

  const safeCleanableBytes = junk ? junk.categories.filter((c) => c.risk === 'safe').reduce((s, c) => s + c.sizeBytes, 0) : 0
  return { score: Math.max(0, Math.min(100, score)), factors, safeCleanableBytes }
}

export function healthTitleKey(score: number | null, scanning: boolean): string {
  if (scanning) return 'health.scanning'
  if (score === null) return 'health.prompt'
  if (score >= 90) return 'health.score.excellent'
  if (score >= 80) return 'health.score.good'
  if (score >= 60) return 'health.score.fair'
  return 'health.score.poor'
}

export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-faint)'
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--orange)'
  return 'var(--danger)'
}

/** توقّع امتلاء التخزين من ميل نقاط الاتجاه (بايت/يوم). */
export function forecastDays(points: { t: number; free: number }[], freeNow: number): { days: number | null; perDay: number } {
  if (points.length < 3) return { days: null, perDay: 0 }
  const first = points[0]
  const last = points[points.length - 1]
  const spanDays = Math.max(1, (last.t - first.t) / 86_400_000)
  const perDay = (first.free - last.free) / spanDays
  if (perDay <= 0) return { days: null, perDay: 0 }
  return { days: Math.max(0, Math.round(freeNow / perDay)), perDay }
}
