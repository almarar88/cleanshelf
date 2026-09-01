import type { HealthFactor, HealthReport } from '../../shared/types'
import { getSystemSummary } from './systemInfoLib'
import { CATEGORY_DEFS, scanCategory } from './cleanerCategories'
import { listStartupItems } from './startupLib'
import { readHistory } from './historyLib'
import { isElevated } from './elevation'

const GB = 1024 ** 3
const MB = 1024 ** 2

/**
 * درجة صحة الجهاز من 100. تُخصم نقاط لكل عامل يستحق انتباه المستخدم،
 * ويُرفق مع كل عامل الصفحة التي تعالجه ليقفز إليها بضغطة.
 */
export async function computeHealth(): Promise<HealthReport> {
  const [summary, startup, history, elevated, scans] = await Promise.all([
    getSystemSummary().catch(() => null),
    listStartupItems().catch(() => []),
    readHistory().catch(() => []),
    isElevated().catch(() => false),
    Promise.all(
      CATEGORY_DEFS.map(async (def) => {
        try {
          const { sizeBytes } = await scanCategory(def)
          return { def, sizeBytes }
        } catch {
          return { def, sizeBytes: 0 }
        }
      })
    )
  ])

  const factors: HealthFactor[] = []
  let score = 100

  const cleanableBytes = scans.reduce((s, x) => s + x.sizeBytes, 0)
  const safeCleanableBytes = scans
    .filter((x) => x.def.risk === 'safe' && (!x.def.requiresAdmin || elevated))
    .reduce((s, x) => s + x.sizeBytes, 0)

  // 1) الملفات القابلة للتنظيف
  if (cleanableBytes > 5 * GB) {
    score -= 20
    factors.push({ id: 'junk', label: 'ملفات غير ضرورية', status: 'bad', detail: 'أكثر من 5 غيغابايت يمكن تحريرها', page: 'cleaner' })
  } else if (cleanableBytes > 1 * GB) {
    score -= 12
    factors.push({ id: 'junk', label: 'ملفات غير ضرورية', status: 'warn', detail: 'أكثر من غيغابايت يمكن تحريرها', page: 'cleaner' })
  } else if (cleanableBytes > 200 * MB) {
    score -= 5
    factors.push({ id: 'junk', label: 'ملفات غير ضرورية', status: 'warn', detail: 'بضع مئات الميغابايت قابلة للتنظيف', page: 'cleaner' })
  } else {
    factors.push({ id: 'junk', label: 'ملفات غير ضرورية', status: 'good', detail: 'القرص نظيف تقريبًا', page: 'cleaner' })
  }

  // 2) مساحة القرص الرئيسي
  const mainDisk = summary?.disks.find((d) => d.mount === '/' || /^C:/i.test(d.mount)) ?? summary?.disks[0]
  const diskFreePercent = mainDisk && mainDisk.totalBytes > 0 ? Math.round((mainDisk.freeBytes / mainDisk.totalBytes) * 100) : 100
  if (mainDisk) {
    if (diskFreePercent < 5) {
      score -= 30
      factors.push({ id: 'disk', label: 'مساحة القرص', status: 'bad', detail: `${diskFreePercent}% فقط متاحة — النظام قد يتباطأ`, page: 'diskanalyzer' })
    } else if (diskFreePercent < 10) {
      score -= 20
      factors.push({ id: 'disk', label: 'مساحة القرص', status: 'bad', detail: `${diskFreePercent}% متاحة — اقتربت من الامتلاء`, page: 'diskanalyzer' })
    } else if (diskFreePercent < 20) {
      score -= 10
      factors.push({ id: 'disk', label: 'مساحة القرص', status: 'warn', detail: `${diskFreePercent}% متاحة`, page: 'diskanalyzer' })
    } else {
      factors.push({ id: 'disk', label: 'مساحة القرص', status: 'good', detail: `${diskFreePercent}% متاحة`, page: 'diskanalyzer' })
    }
  }

  // 3) الذاكرة
  const memUsedPercent = summary && summary.totalMemBytes > 0 ? Math.round((summary.usedMemBytes / summary.totalMemBytes) * 100) : 0
  if (summary) {
    if (memUsedPercent > 90) {
      score -= 10
      factors.push({ id: 'mem', label: 'الذاكرة', status: 'bad', detail: `${memUsedPercent}% مستخدمة`, page: 'processes' })
    } else if (memUsedPercent > 80) {
      score -= 5
      factors.push({ id: 'mem', label: 'الذاكرة', status: 'warn', detail: `${memUsedPercent}% مستخدمة`, page: 'processes' })
    } else {
      factors.push({ id: 'mem', label: 'الذاكرة', status: 'good', detail: `${memUsedPercent}% مستخدمة`, page: 'processes' })
    }
  }

  // 4) برامج بدء التشغيل
  const startupCount = startup.filter((s) => s.enabled).length
  if (startupCount > 15) {
    score -= 10
    factors.push({ id: 'startup', label: 'بدء التشغيل', status: 'bad', detail: `${startupCount} برنامجًا يعمل عند الإقلاع`, page: 'startup' })
  } else if (startupCount > 8) {
    score -= 5
    factors.push({ id: 'startup', label: 'بدء التشغيل', status: 'warn', detail: `${startupCount} برامج تعمل عند الإقلاع`, page: 'startup' })
  } else {
    factors.push({ id: 'startup', label: 'بدء التشغيل', status: 'good', detail: `${startupCount} عناصر فقط`, page: 'startup' })
  }

  // 5) آخر تنظيف
  let lastCleanDaysAgo: number | null = null
  if (history[0]) {
    lastCleanDaysAgo = Math.floor((Date.now() - new Date(history[0].timestamp).getTime()) / 86_400_000)
  }
  if (lastCleanDaysAgo === null) {
    score -= 8
    factors.push({ id: 'lastclean', label: 'آخر تنظيف', status: 'warn', detail: 'لم يُنفَّذ تنظيف بعد', page: 'history' })
  } else if (lastCleanDaysAgo > 30) {
    score -= 8
    factors.push({ id: 'lastclean', label: 'آخر تنظيف', status: 'warn', detail: `قبل ${lastCleanDaysAgo} يومًا`, page: 'history' })
  } else if (lastCleanDaysAgo > 14) {
    score -= 4
    factors.push({ id: 'lastclean', label: 'آخر تنظيف', status: 'warn', detail: `قبل ${lastCleanDaysAgo} يومًا`, page: 'history' })
  } else {
    factors.push({ id: 'lastclean', label: 'آخر تنظيف', status: 'good', detail: lastCleanDaysAgo === 0 ? 'اليوم' : `قبل ${lastCleanDaysAgo} يوم`, page: 'history' })
  }

  // 6) مدة التشغيل الطويلة
  if (summary && summary.uptimeSec > 7 * 86_400) {
    score -= 5
    factors.push({ id: 'uptime', label: 'إعادة التشغيل', status: 'warn', detail: `الجهاز يعمل منذ ${Math.floor(summary.uptimeSec / 86_400)} أيام — إعادة تشغيل تنعشه`, page: 'system' })
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
    cleanableBytes,
    safeCleanableBytes,
    startupCount,
    diskFreePercent,
    memUsedPercent,
    lastCleanDaysAgo
  }
}
