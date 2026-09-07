import { useCallback, useEffect, useRef, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { computeHealth, type Health } from '../lib/health'
import { formatBytes, formatUptime } from '../lib/format'
import type { CleanHistoryEntry, JunkScan, StorageStats, DeviceInfo, MediaStats } from '../lib/types'
import { PAGE_META, type PageId } from '../lib/nav'
import { Icon, type IconName } from '../components/Icon'
import { HealthRing } from '../components/ui'
import { PermissionGate } from '../components/PermissionGate'
import { CleanOverlay } from '../components/CleanOverlay'
import { StorageBreakdown, Sparkline } from '../components/StorageBreakdown'
import { CountUp } from '../components/CountUp'
import { loadTrend, recordTrend, type TrendPoint } from '../lib/trend'
import { tap, thud, success } from '../lib/haptics'

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
  const [media, setMedia] = useState<MediaStats | null>(null)
  const [junk, setJunk] = useState<JunkScan | null>(null)
  const [history, setHistory] = useState<CleanHistoryEntry[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>(loadTrend)
  const [scanning, setScanning] = useState(false)
  const [overlay, setOverlay] = useState<{ phase: 'working' | 'done'; freed: number } | null>(null)
  const [started, setStarted] = useState(false)
  const [pull, setPull] = useState(0)
  const pullStart = useRef<number | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const loadBasics = useCallback(async () => {
    const [s, d, h, m] = await Promise.all([
      Native.storageStats().catch(() => null),
      Native.deviceInfo().catch(() => null),
      Native.history().then((r) => r.entries).catch(() => []),
      Native.mediaStats().catch(() => null)
    ])
    setStats(s)
    setDevice(d)
    setHistory(h)
    setMedia(m)
    if (s) setTrend(recordTrend(s.storageFreeBytes))
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
      const hs = computeHealth(s, j, dl, h)
      setHealth(hs)
      if (j) Native.log({ message: `CLEANSHELF_SMOKE_SCAN categories=${j.categories.length} files=${j.scannedFiles} bytes=${j.totalBytes}` }).catch(() => undefined)
      // الودجت والتذكير يقرآن آخر نتيجة
      Native.updateWidget({ freePercent: s && s.storageTotalBytes ? Math.round((s.storageFreeBytes / s.storageTotalBytes) * 100) : 0, junkBytes: j?.totalBytes ?? 0, score: hs.score }).catch(() => undefined)
    } catch (err) {
      showToast('تعذّر الفحص: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }, [loadBasics, settings.oldDownloadDays, showToast])

  useEffect(() => {
    loadBasics()
  }, [loadBasics])

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
    thud()
    setOverlay({ phase: 'working', freed: 0 })
    try {
      const r = await Native.cleanJunk({ categoryIds: ids })
      setOverlay({ phase: 'done', freed: r.freedBytes })
      success()
      if (settings.notifications) Native.notify({ title: 'اكتمل التنظيف', body: `تم تحرير ${formatBytes(r.freedBytes)}` }).catch(() => undefined)
      await scan()
    } catch (err) {
      setOverlay(null)
      showToast('فشل التنظيف: ' + (err as Error).message)
    }
  }

  // سحب للتحديث: نقيس السحب من أعلى الصفحة فقط
  function onTouchStart(e: React.TouchEvent): void {
    if ((pageRef.current?.scrollTop ?? 1) <= 0 && !scanning) pullStart.current = e.touches[0].clientY
  }
  function onTouchMove(e: React.TouchEvent): void {
    if (pullStart.current === null) return
    const dy = e.touches[0].clientY - pullStart.current
    setPull(Math.max(0, Math.min(90, dy * 0.5)))
  }
  function onTouchEnd(): void {
    if (pull >= 60) {
      tap()
      scan()
    }
    pullStart.current = null
    setPull(0)
  }

  const score = health?.score ?? null
  const freePct = stats && stats.storageTotalBytes > 0 ? Math.round((stats.storageFreeBytes / stats.storageTotalBytes) * 100) : null
  const ramPct = stats && stats.ramTotalBytes > 0 ? Math.round(((stats.ramTotalBytes - stats.ramAvailableBytes) / stats.ramTotalBytes) * 100) : null

  return (
    <div className="page" ref={pageRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={score === null ? 'var(--text-faint)' : score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)'} />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>
      <div className={`ptr ${pull >= 60 || scanning ? 'active' : ''}`} style={{ height: pull > 0 ? pull : 0 }}>
        <div className="spinner" />
      </div>

      <PermissionGate />

      <section className={`hero ${scanning ? 'pulse' : ''}`}>
        <HealthRing score={score} caption={scanning ? 'جارٍ الفحص…' : 'من 100'} />
        <h2>{healthTitle(score, scanning)}</h2>
        <p>
          {health
            ? health.safeCleanableBytes > 0
              ? `يمكن تحرير نحو ${formatBytes(health.safeCleanableBytes)} بضغطة واحدة دون مخاطرة.`
              : 'لا توجد ملفات غير ضرورية تستحق التنظيف الآن.'
            : scanning
              ? 'نفحص الملفات المؤقتة والتخزين والذاكرة والتنزيلات…'
              : 'الفحص يستغرق ثوانٍ ولا يحذف شيئًا. اسحب للأسفل للتحديث في أي وقت.'}
        </p>
        {health && junk && (
          <div className="hero-facts">
            <span className={`fact-chip ${junk.totalBytes > 700 * 1024 ** 2 ? 'warn' : ''}`}><Icon name="trash" size={12} /> {formatBytes(junk.totalBytes)} قابلة للتنظيف</span>
            {freePct !== null && <span className={`fact-chip ${freePct < 15 ? 'warn' : ''}`}><Icon name="hardDrive" size={12} /> {freePct}% مساحة متاحة</span>}
            {ramPct !== null && <span className={`fact-chip ${ramPct > 90 ? 'warn' : ''}`}><Icon name="cpu" size={12} /> {ramPct}% ذاكرة</span>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary btn-lg btn-block" onClick={smartClean} disabled={!junk || scanning || !!overlay}>
            <Icon name="sparkles" size={18} /> تنظيف ذكي بضغطة واحدة
          </button>
          <div className="grid grid-2">
            <button className="btn" onClick={() => { tap(); scan() }} disabled={scanning}><Icon name="refresh" size={16} /> {health ? 'إعادة الفحص' : 'فحص الهاتف'}</button>
            <button className="btn" onClick={() => { tap(); navigate('booster') }}><Icon name="zap" size={16} /> تسريع الذاكرة</button>
          </div>
        </div>
      </section>

      {media && media.totalBytes > 0 && (
        <div style={{ marginTop: 14 }}><StorageBreakdown stats={media} /></div>
      )}

      {health && (
        <>
          <div className="section-title">ما يؤثر في الدرجة</div>
          <div className="card">
            {health.factors.map((f) => (
              <div key={f.id} className="row" onClick={() => { tap(); f.page && navigate(f.page as PageId) }}>
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
        <Stat icon="hardDrive" tone="tone-green" label="مساحة متاحة" value={stats ? <CountUp value={stats.storageFreeBytes} format={formatBytes} /> : null} sub={stats ? `من ${formatBytes(stats.storageTotalBytes)}` : ''} />
        <Stat icon="cpu" tone="tone-cyan" label="الذاكرة المتاحة" value={stats ? <CountUp value={stats.ramAvailableBytes} format={formatBytes} /> : null} sub={stats ? `من ${formatBytes(stats.ramTotalBytes)}` : ''} />
        <Stat icon="zap" tone="tone-amber" label="البطارية" value={stats ? <CountUp value={stats.batteryPercent} format={(n) => `${Math.round(n)}%`} /> : null} sub={stats ? (stats.batteryCharging ? 'يشحن الآن' : `${stats.batteryTempC.toFixed(0)}° حرارة`) : ''} />
        <Stat icon="clock" tone="tone-violet" label="منذ آخر إعادة تشغيل" value={device ? formatUptime(device.uptimeSec) : null} sub={device ? `${device.manufacturer} ${device.model}` : ''} />
      </div>

      {trend.length >= 2 && <div style={{ marginTop: 14 }}><Sparkline points={trend} /></div>}

      <div className="section-title">أدوات مميزة</div>
      <div className="grid grid-2">
        {(['social', 'screenshots', 'apps', 'duplicates'] as PageId[]).map((id) => {
          const m = PAGE_META[id]
          return (
            <div key={id} className="card tool-tile" onClick={() => { tap(); navigate(id) }}>
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

      {overlay && <CleanOverlay phase={overlay.phase} freedBytes={overlay.freed} label="جارٍ التنظيف الذكي…" onClose={() => setOverlay(null)} />}
    </div>
  )
}

function Stat({ icon, tone, label, value, sub }: { icon: IconName; tone: string; label: string; value: React.ReactNode | null; sub: string }): JSX.Element {
  return (
    <div className="card stat-tile">
      <span className="label"><span className={`tile-icon sm ${tone}`} style={{ width: 28, height: 28, borderRadius: 8 }}><Icon name={icon} size={14} /></span>{label}</span>
      {value === null ? <div className="skeleton" style={{ height: 24, width: '60%' }} /> : <span className="value">{value}</span>}
      <span className="muted">{sub || ' '}</span>
    </div>
  )
}
