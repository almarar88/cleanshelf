import { useCallback, useEffect, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { computeHealth, type Health } from '../lib/health'
import { formatBytes, formatUptime } from '../lib/format'
import type { CleanHistoryEntry, JunkScan, StorageStats, DeviceInfo } from '../lib/types'
import { PAGE_META, type PageId } from '../lib/nav'
import { Icon, type IconName } from '../components/Icon'
import { HealthRing } from '../components/ui'
import { PermissionGate } from '../components/PermissionGate'

const STATUS_ICON = { good: 'checkCircle', warn: 'alert', bad: 'alert' } as const
const STATUS_TONE = { good: 'tone-green', warn: 'tone-amber', bad: 'tone-red' } as const

function healthTitle(score: number | null, scanning: boolean): string {
  if (scanning) return 'جارٍ فحص هاتفك…'
  if (score === null) return 'اضغط "فحص" لتقييم هاتفك'
  if (score >= 90) return 'هاتفك بحالة ممتازة'
  if (score >= 80) return 'هاتفك بحالة جيدة'
  if (score >= 60) return 'هاتفك يحتاج بعض العناية'
  return 'هاتفك يحتاج تنظيفًا الآن'
}

export function Home(): JSX.Element {
  const { settings, permissions, navigate } = useApp()
  const { showToast } = useToast()
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [junk, setJunk] = useState<JunkScan | null>(null)
  const [history, setHistory] = useState<CleanHistoryEntry[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [scanning, setScanning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [lastFreed, setLastFreed] = useState<number | null>(null)
  const [started, setStarted] = useState(false)

  const loadBasics = useCallback(async () => {
    const [s, d, h] = await Promise.all([
      Native.storageStats().catch(() => null),
      Native.deviceInfo().catch(() => null),
      Native.history().then((r) => r.entries).catch(() => [])
    ])
    setStats(s)
    setDevice(d)
    setHistory(h)
    return { s, h }
  }, [])

  const scan = useCallback(async () => {
    setScanning(true)
    setStarted(true)
    try {
      const { s, h } = await loadBasics()
      const [j, dl] = await Promise.all([
        Native.scanJunk().catch(() => null),
        Native.oldDownloads({ days: settings.oldDownloadDays }).then((r) => r.items.length).catch(() => 0)
      ])
      setJunk(j)
      setHealth(computeHealth(s, j, dl, h))
      // يلتقطه فحص التشغيل الآلي في CI من logcat — دليل أن الفحص الأصلي عمل على جهاز حقيقي
      if (j) Native.log({ message: `CLEANSHELF_SMOKE_SCAN categories=${j.categories.length} files=${j.scannedFiles} bytes=${j.totalBytes}` }).catch(() => undefined)
    } catch (err) {
      showToast('تعذّر الفحص: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }, [loadBasics, settings.oldDownloadDays, showToast])

  useEffect(() => {
    loadBasics()
  }, [loadBasics])

  // الفحص التلقائي بعد منح الإذن (أو فورًا في المتصفح)
  useEffect(() => {
    if (settings.scanOnLaunch && permissions.allFiles && !started) scan()
  }, [settings.scanOnLaunch, permissions.allFiles, started, scan])

  async function smartClean(): Promise<void> {
    if (!junk) return
    const ids = junk.categories.filter((c) => c.risk === 'safe' && (c.sizeBytes > 0 || c.fileCount > 0)).map((c) => c.id)
    if (ids.length === 0) {
      showToast('لا شيء يحتاج تنظيفًا — هاتفك نظيف')
      return
    }
    setCleaning(true)
    try {
      const r = await Native.cleanJunk({ categoryIds: ids })
      setLastFreed(r.freedBytes)
      showToast(`تم تحرير ${formatBytes(r.freedBytes)} من ${ids.length} فئة`)
      if (settings.notifications) Native.notify({ title: 'اكتمل التنظيف', body: `تم تحرير ${formatBytes(r.freedBytes)}` }).catch(() => undefined)
      await scan()
    } catch (err) {
      showToast('فشل التنظيف: ' + (err as Error).message)
    } finally {
      setCleaning(false)
    }
  }

  const score = health?.score ?? null
  const freePct = stats && stats.storageTotalBytes > 0 ? Math.round((stats.storageFreeBytes / stats.storageTotalBytes) * 100) : null
  const ramPct = stats && stats.ramTotalBytes > 0 ? Math.round(((stats.ramTotalBytes - stats.ramAvailableBytes) / stats.ramTotalBytes) * 100) : null

  return (
    <div className="page">
      <PermissionGate />

      <section className="hero">
        <HealthRing score={score} caption={scanning ? 'جارٍ الفحص…' : 'من 100'} />
        <h2>{healthTitle(score, scanning)}</h2>
        <p>
          {health
            ? health.safeCleanableBytes > 0
              ? `يمكن تحرير نحو ${formatBytes(health.safeCleanableBytes)} بضغطة واحدة دون مخاطرة.`
              : 'لا توجد ملفات غير ضرورية تستحق التنظيف الآن.'
            : scanning
              ? 'نفحص الملفات المؤقتة والتخزين والذاكرة والتنزيلات…'
              : 'الفحص يستغرق ثوانٍ ولا يحذف شيئًا.'}
        </p>
        {health && junk && (
          <div className="hero-facts">
            <span className={`fact-chip ${junk.totalBytes > 700 * 1024 ** 2 ? 'warn' : ''}`}><Icon name="trash" size={12} /> {formatBytes(junk.totalBytes)} قابلة للتنظيف</span>
            {freePct !== null && <span className={`fact-chip ${freePct < 15 ? 'warn' : ''}`}><Icon name="hardDrive" size={12} /> {freePct}% مساحة متاحة</span>}
            {ramPct !== null && <span className={`fact-chip ${ramPct > 90 ? 'warn' : ''}`}><Icon name="cpu" size={12} /> {ramPct}% ذاكرة</span>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary btn-lg btn-block" onClick={smartClean} disabled={!junk || cleaning || scanning}>
            <Icon name="sparkles" size={18} />
            {cleaning ? 'جارٍ التنظيف الذكي…' : 'تنظيف ذكي بضغطة واحدة'}
          </button>
          <button className="btn btn-block" onClick={scan} disabled={scanning || cleaning}>
            <Icon name="refresh" size={16} />
            {health ? 'إعادة الفحص' : 'فحص الهاتف'}
          </button>
          {lastFreed !== null && <span className="badge badge-safe" style={{ alignSelf: 'center', fontSize: 12.5 }}><Icon name="check" /> حُرِّر {formatBytes(lastFreed)}</span>}
        </div>
      </section>

      {health && (
        <>
          <div className="section-title">ما يؤثر في الدرجة</div>
          <div className="card">
            {health.factors.map((f) => (
              <div key={f.id} className="row" onClick={() => f.page && navigate(f.page as PageId)}>
                <div className={`tile-icon sm ${STATUS_TONE[f.status]}`}><Icon name={STATUS_ICON[f.status]} size={17} /></div>
                <div className="text">
                  <div className="title">{f.label}</div>
                  <div className="desc">{f.detail}</div>
                </div>
                <Icon name="chevron" size={16} className="muted" style={{ transform: 'scaleX(-1)' }} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">الجهاز الآن</div>
      <div className="grid grid-2">
        <Stat icon="hardDrive" tone="tone-green" label="مساحة متاحة" value={stats ? formatBytes(stats.storageFreeBytes) : null} sub={stats ? `من ${formatBytes(stats.storageTotalBytes)}` : ''} />
        <Stat icon="cpu" tone="tone-cyan" label="الذاكرة المتاحة" value={stats ? formatBytes(stats.ramAvailableBytes) : null} sub={stats ? `من ${formatBytes(stats.ramTotalBytes)}` : ''} />
        <Stat icon="zap" tone="tone-amber" label="البطارية" value={stats ? `${stats.batteryPercent}%` : null} sub={stats ? (stats.batteryCharging ? 'يشحن الآن' : `${stats.batteryTempC.toFixed(0)}° حرارة`) : ''} />
        <Stat icon="clock" tone="tone-violet" label="منذ آخر إعادة تشغيل" value={device ? formatUptime(device.uptimeSec) : null} sub={device ? `${device.manufacturer} ${device.model}` : ''} />
      </div>

      <div className="section-title">أدوات سريعة</div>
      <div className="grid grid-2">
        {(['apps', 'duplicates', 'downloads', 'tags'] as PageId[]).map((id) => {
          const m = PAGE_META[id]
          return (
            <div key={id} className={`card tool-tile`} onClick={() => navigate(id)}>
              <div className={`tile-icon ${m.tone ?? ''}`}><Icon name={m.icon} size={20} /></div>
              <div>
                <div className="card-title">{m.title}</div>
                <div className="card-sub">{m.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      {history.length > 0 && (
        <>
          <div className="section-title">آخر تنظيف</div>
          <div className="card row" onClick={() => navigate('history')}>
            <div className="tile-icon sm tone-green"><Icon name="history" size={17} /></div>
            <div className="text">
              <div className="title">حُرِّر {formatBytes(history[0].freedBytes)}</div>
              <div className="desc">{new Date(history[0].timestamp).toLocaleDateString('ar')} — {history[0].categories.length} فئة</div>
            </div>
            <span className="trail">{history.length} عملية</span>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ icon, tone, label, value, sub }: { icon: IconName; tone: string; label: string; value: string | null; sub: string }): JSX.Element {
  return (
    <div className="card stat-tile">
      <span className="label"><span className={`tile-icon sm ${tone}`} style={{ width: 28, height: 28, borderRadius: 8 }}><Icon name={icon} size={14} /></span>{label}</span>
      {value === null ? <div className="skeleton" style={{ height: 24, width: '60%' }} /> : <span className="value">{value}</span>}
      <span className="muted">{sub || ' '}</span>
    </div>
  )
}
