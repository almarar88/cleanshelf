import os from 'node:os'
import { app } from 'electron'
import type { SystemReport } from '../../shared/types'
import { getSystemSummary } from './systemInfoLib'
import { CATEGORY_DEFS, scanCategory } from './cleanerCategories'
import { listStartupItems } from './startupLib'
import { listInstalledApps } from './uninstallerLib'
import { readHistory } from './historyLib'
import { isElevated } from './elevation'
import { isWindows } from './platform'

function bytes(n: number): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

function duration(sec: number): string {
  const d = Math.floor(sec / 86_400)
  const h = Math.floor((sec % 86_400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return [d ? `${d} يوم` : '', h ? `${h} ساعة` : '', `${m} دقيقة`].filter(Boolean).join(' و ')
}

/** تقرير Markdown شامل عن الجهاز يمكن حفظه أو إرساله للدعم الفني. */
export async function buildSystemReport(): Promise<SystemReport> {
  const generatedAt = new Date().toISOString()
  const [summary, startup, apps, history, elevated, scans] = await Promise.all([
    getSystemSummary().catch(() => null),
    listStartupItems().catch(() => []),
    listInstalledApps().catch(() => []),
    readHistory().catch(() => []),
    isElevated().catch(() => false),
    Promise.all(
      CATEGORY_DEFS.map(async (def) => {
        try {
          const r = await scanCategory(def)
          return { id: def.id, sizeBytes: r.sizeBytes, fileCount: r.fileCount, risk: def.risk }
        } catch {
          return { id: def.id, sizeBytes: 0, fileCount: 0, risk: def.risk }
        }
      })
    )
  ])

  const lines: string[] = []
  lines.push(`# تقرير CleanShelf عن الجهاز`)
  lines.push('')
  lines.push(`- **التاريخ:** ${new Date(generatedAt).toLocaleString('ar')}`)
  lines.push(`- **الإصدار:** CleanShelf ${app.getVersion()} — Alcode`)
  lines.push(`- **المنصة:** ${isWindows ? 'Windows' : 'macOS'} (${os.arch()})`)
  lines.push(`- **صلاحيات مرتفعة:** ${elevated ? 'نعم' : 'لا'}`)
  lines.push('')

  if (summary) {
    lines.push('## النظام')
    lines.push('')
    lines.push(`| البند | القيمة |`)
    lines.push(`|---|---|`)
    lines.push(`| نظام التشغيل | ${summary.osName} ${summary.osVersion} |`)
    lines.push(`| اسم الجهاز | ${summary.hostname} |`)
    lines.push(`| المعالج | ${summary.cpuModel} (حمل ${summary.cpuLoadPercent}%) |`)
    lines.push(`| الذاكرة | ${bytes(summary.usedMemBytes)} مستخدمة من ${bytes(summary.totalMemBytes)} |`)
    lines.push(`| مدة التشغيل | ${duration(summary.uptimeSec)} |`)
    lines.push('')
    lines.push('## الأقراص')
    lines.push('')
    lines.push(`| القرص | الإجمالي | المستخدم | المتاح | النسبة |`)
    lines.push(`|---|---|---|---|---|`)
    for (const d of summary.disks) {
      const pct = d.totalBytes ? Math.round((d.usedBytes / d.totalBytes) * 100) : 0
      lines.push(`| ${d.mount} | ${bytes(d.totalBytes)} | ${bytes(d.usedBytes)} | ${bytes(d.freeBytes)} | ${pct}% |`)
    }
    lines.push('')
  }

  const totalCleanable = scans.reduce((s, x) => s + x.sizeBytes, 0)
  lines.push(`## ما يمكن تنظيفه (${bytes(totalCleanable)})`)
  lines.push('')
  lines.push(`| الفئة | الحجم | الملفات | المخاطرة |`)
  lines.push(`|---|---|---|---|`)
  for (const s of scans.filter((x) => x.sizeBytes > 0).sort((a, b) => b.sizeBytes - a.sizeBytes)) {
    lines.push(`| ${s.id} | ${bytes(s.sizeBytes)} | ${s.fileCount} | ${s.risk === 'safe' ? 'آمن' : 'انتبه'} |`)
  }
  lines.push('')

  lines.push(`## برامج بدء التشغيل (${startup.length})`)
  lines.push('')
  for (const s of startup) lines.push(`- ${s.enabled ? '✅' : '⛔'} **${s.name}** — \`${s.command}\``)
  if (startup.length === 0) lines.push('- لا شيء')
  lines.push('')

  lines.push(`## البرامج المثبَّتة (${apps.length})`)
  lines.push('')
  for (const a of apps.slice().sort((x, y) => x.name.localeCompare(y.name)).slice(0, 300)) {
    lines.push(`- ${a.name}${a.version ? ` (${a.version})` : ''}${a.publisher ? ` — ${a.publisher}` : ''}`)
  }
  if (apps.length > 300) lines.push(`- … و${apps.length - 300} برنامجًا آخر`)
  lines.push('')

  const totalFreed = history.reduce((s, h) => s + h.freedBytes, 0)
  lines.push(`## سجل التنظيف`)
  lines.push('')
  lines.push(`- **عدد العمليات:** ${history.length}`)
  lines.push(`- **إجمالي ما حُرِّر:** ${bytes(totalFreed)}`)
  if (history[0]) lines.push(`- **آخر تنظيف:** ${new Date(history[0].timestamp).toLocaleString('ar')}`)
  lines.push('')
  lines.push('---')
  lines.push('_أُنشئ بواسطة CleanShelf من تطوير Alcode_')

  return { generatedAt, markdown: lines.join('\n') }
}
