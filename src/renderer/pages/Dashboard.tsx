import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, CleanHistoryEntry, HealthReport, SystemSummary } from '../../shared/types'
import { formatBytes, formatDate } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { Icon, type IconName } from '../components/Icon'
import { HealthRing, healthTitle } from '../components/HealthRing'
import type { PageId } from '../App'

const STATUS_ICON: Record<HealthReport['factors'][number]['status'], IconName> = {
  good: 'checkCircle',
  warn: 'alert',
  bad: 'alert'
}

const STATUS_TONE = { good: 'tone-green', warn: 'tone-amber', bad: 'tone-red' } as const

export function Dashboard({
  onNavigate,
  settings,
  command,
  onCommandHandled
}: {
  onNavigate: (id: PageId) => void
  settings: AppSettings | null
  command: string | null
  onCommandHandled: () => void
}): JSX.Element {
  const { showToast } = useToast()
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [history, setHistory] = useState<CleanHistoryEntry[]>([])
  const [cleaning, setCleaning] = useState(false)
  const [lastFreed, setLastFreed] = useState<number | null>(null)

  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      setHealth(await window.api.health.compute())
    } catch (err) {
      showToast('تعذّر تقييم الجهاز: ' + (err as Error).message)
    } finally {
      setHealthLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    window.api.system.summary().then(setSummary).catch(() => setSummary(null))
    window.api.history.list().then(setHistory).catch(() => setHistory([]))
  }, [])

  // نفحص تلقائيًا إلا إن أوقف المستخدم ذلك من الإعدادات
  useEffect(() => {
    if (!settings) return
    if (settings.scanOnLaunch && !health && !healthLoading) loadHealth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const runSmartClean = useCallback(async () => {
    if (cleaning) return
    setCleaning(true)
    setLastFreed(null)
    try {
      const result = await window.api.cleaner.smartClean()
      setLastFreed(result.freedBytes)
      showToast(
        result.categoryIds.length === 0
          ? 'لا شيء يحتاج تنظيفًا — جهازك نظيف'
          : `تم تحرير ${formatBytes(result.freedBytes)} من ${result.categoryIds.length} فئة`
      )
      window.api.history.list().then(setHistory).catch(() => undefined)
      await loadHealth()
    } catch (err) {
      showToast('فشل التنظيف الذكي: ' + (err as Error).message)
    } finally {
      setCleaning(false)
    }
  }, [cleaning, loadHealth, showToast])

  // أمر قادم من شريط النظام أو لوحة الأوامر
  useEffect(() => {
    if (command === 'smartClean') {
      onCommandHandled()
      runSmartClean()
    }
  }, [command, onCommandHandled, runSmartClean])

  const mainDisk = summary?.disks.find((d) => d.mount === '/' || /^C:/i.test(d.mount)) ?? summary?.disks[0]
  const score = health?.score ?? null

  return (
    <div className="page">
      <section className="hero">
        <HealthRing score={score} caption={healthLoading ? 'جارٍ الفحص…' : 'من 100'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{healthTitle(score)}</h2>
          <p>
            {health
              ? health.safeCleanableBytes > 0
                ? `يمكن تحرير نحو ${formatBytes(health.safeCleanableBytes)} بضغطة واحدة دون أي مخاطرة.`
                : 'لا توجد ملفات غير ضرورية تستحق التنظيف الآن.'
              : healthLoading
                ? 'نفحص الملفات المؤقتة والذاكرة والقرص وبرامج بدء التشغيل…'
                : 'اضغط "فحص الجهاز" لتقييم حالته الحالية.'}
          </p>
          {health && (
            <div className="hero-facts">
              <span className={`fact-chip ${health.cleanableBytes > 1024 ** 3 ? 'warn' : ''}`}>
                <Icon name="trash" size={13} /> {formatBytes(health.cleanableBytes)} قابلة للتنظيف
              </span>
              <span className={`fact-chip ${health.diskFreePercent < 15 ? 'warn' : ''}`}>
                <Icon name="hardDrive" size={13} /> {health.diskFreePercent}% مساحة متاحة
              </span>
              <span className={`fact-chip ${health.memUsedPercent > 85 ? 'warn' : ''}`}>
                <Icon name="cpu" size={13} /> {health.memUsedPercent}% ذاكرة مستخدمة
              </span>
              <span className={`fact-chip ${health.startupCount > 8 ? 'warn' : ''}`}>
                <Icon name="rocket" size={13} /> {health.startupCount} عند الإقلاع
              </span>
            </div>
          )}
          <div className="toolbar" style={{ marginTop: 18, marginBottom: 0 }}>
            <button className="btn btn-primary btn-lg" onClick={runSmartClean} disabled={cleaning || healthLoading}>
              <Icon name="sparkles" size={17} />
              {cleaning ? 'جارٍ التنظيف الذكي…' : 'تنظيف ذكي بضغطة واحدة'}
            </button>
            <button className="btn btn-lg" onClick={loadHealth} disabled={healthLoading || cleaning}>
              <Icon name="refresh" size={16} />
              {health ? 'إعادة الفحص' : 'فحص الجهاز'}
            </button>
            {lastFreed !== null && (
              <span className="badge badge-safe" style={{ fontSize: 12.5 }}>
                <Icon name="check" /> حُرِّر {formatBytes(lastFreed)}
              </span>
            )}
          </div>
        </div>
      </section>

      {health && (
        <div className="grid grid-3" style={{ marginBottom: 20 }}>
          {health.factors.map((f) => (
            <div
              key={f.id}
              className="card card-pad card-clickable"
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
              onClick={() => f.page && onNavigate(f.page as PageId)}
            >
              <div className={`tile-icon ${STATUS_TONE[f.status]}`} style={{ width: 36, height: 36, borderRadius: 10 }}>
                <Icon name={STATUS_ICON[f.status]} size={17} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="card-title" style={{ fontSize: 13.5 }}>{f.label}</div>
                <div className="card-sub">{f.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatTile icon="cpu" tone="tone-violet" label="المعالج" value={summary ? `${summary.cpuLoadPercent}%` : null} sub={summary?.cpuModel || ''} />
        <StatTile icon="activity" tone="tone-cyan" label="الذاكرة المستخدمة" value={summary ? formatBytes(summary.usedMemBytes) : null} sub={summary ? `من أصل ${formatBytes(summary.totalMemBytes)}` : ''} />
        <StatTile icon="hardDrive" tone="tone-green" label="القرص الرئيسي" value={mainDisk ? formatBytes(mainDisk.freeBytes) : null} sub={mainDisk ? `متاحة من ${formatBytes(mainDisk.totalBytes)}` : ''} />
        <StatTile icon="clock" tone="tone-orange" label="مدة التشغيل" value={summary ? `${Math.floor(summary.uptimeSec / 3600)} ساعة` : null} sub={summary?.hostname || ''} />
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <QuickAction icon="sparkles" tone="" title="منظّف القرص" desc="اختر بدقة ما يُحذف من الملفات المؤقتة والذواكر" onClick={() => onNavigate('cleaner')} />
        <QuickAction icon="trash" tone="tone-red" title="إزالة البرامج" desc="أزل ما لا تحتاجه مع مخلّفاته بالكامل" onClick={() => onNavigate('uninstaller')} />
        <QuickAction icon="eyeOff" tone="tone-violet" title="خصوصية المتصفح" desc="امسح السجل والكوكيز من كل المتصفحات" onClick={() => onNavigate('privacy')} />
        <QuickAction icon="copy" tone="tone-pink" title="الملفات المكرّرة" desc="اعثر على النسخ المكرّرة واسترجع المساحة" onClick={() => onNavigate('duplicates')} />
        <QuickAction icon="download" tone="tone-cyan" title="التنزيلات القديمة" desc="ما نسيته في مجلد التنزيلات منذ شهور" onClick={() => onNavigate('downloads')} />
        <QuickAction icon="music" tone="tone-teal" title="وسوم الأغاني" desc="عدّل العنوان والفنان والغلاف دفعة واحدة" onClick={() => onNavigate('tags')} />
      </div>

      {history.length > 0 && (
        <div className="card">
          <div className="card-pad" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10 }}>
            <Icon name="history" size={16} className="muted" />
            <strong style={{ fontSize: 13.5 }}>آخر عمليات التنظيف</strong>
            <div className="spacer" />
            <button className="btn btn-sm btn-ghost" onClick={() => onNavigate('history')}>
              عرض الكل <Icon name="chevron" size={13} />
            </button>
          </div>
          <table>
            <tbody>
              {history.slice(0, 3).map((h, i) => (
                <tr key={`${h.timestamp}-${i}`}>
                  <td className="muted">{formatDate(h.timestamp)}</td>
                  <td style={{ fontWeight: 600 }}>{formatBytes(h.freedBytes)}</td>
                  <td className="muted">{h.categories.length} فئة</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatTile({ icon, tone, label, value, sub }: { icon: IconName; tone: string; label: string; value: string | null; sub: string }): JSX.Element {
  return (
    <div className="card card-pad stat-tile">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className={`tile-icon ${tone}`} style={{ width: 34, height: 34, borderRadius: 10 }}>
          <Icon name={icon} size={16} />
        </div>
        <span className="label">{label}</span>
      </div>
      {value === null ? <div className="skeleton" style={{ height: 28, width: '55%' }} /> : <span className="value">{value}</span>}
      <span className="muted" title={sub}>{sub || ' '}</span>
    </div>
  )
}

function QuickAction({ icon, tone, title, desc, onClick }: { icon: IconName; tone: string; title: string; desc: string; onClick: () => void }): JSX.Element {
  return (
    <div className="card card-pad card-clickable" onClick={onClick} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div className={`tile-icon ${tone}`}>
        <Icon name={icon} size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="card-title">{title}</div>
        <div className="card-sub">{desc}</div>
      </div>
    </div>
  )
}
