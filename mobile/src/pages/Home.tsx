import { useCallback, useEffect, useRef, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { t } from '../lib/i18n'
import { computeHealth, healthTitleKey, scoreColor, type Health } from '../lib/health'
import { formatBytes, fmtNum, splitBytes } from '../lib/format'
import type { CleanHistoryEntry, JunkScan, MediaStats, StorageStats } from '../lib/types'
import { PAGE_META, type PageId } from '../lib/nav'
import { planSummary, type PlanSummary } from '../lib/plan'
import { loadTrend, recordTrend, type TrendPoint } from '../lib/trend'
import { tap, thud, success } from '../lib/haptics'
import { Icon, type IconName } from '../components/Icon'
import { Ico, ScoreRing } from '../components/ui'
import { Donut, Legend, type Segment } from '../components/charts'
import { PermissionGate } from '../components/PermissionGate'
import { CleanOverlay } from '../components/CleanOverlay'

const PERIODS = ['home.filter.week', 'home.filter.period', 'home.filter.year'] as const

export function Home(): JSX.Element {
  const { settings, permissions, navigate, favorites } = useApp()
  const { showToast } = useToast()
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [media, setMedia] = useState<MediaStats | null>(null)
  const [junk, setJunk] = useState<JunkScan | null>(null)
  const [history, setHistory] = useState<CleanHistoryEntry[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [plan, setPlan] = useState<PlanSummary>(() => planSummary())
  const [, setTrend] = useState<TrendPoint[]>(loadTrend)
  const [scanning, setScanning] = useState(false)
  const [overlay, setOverlay] = useState<{ phase: 'working' | 'done'; freed: number } | null>(null)
  const [started, setStarted] = useState(false)
  const [period, setPeriod] = useState(1)
  const [pull, setPull] = useState(0)
  const pullFrom = useRef<number | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const loadBasics = useCallback(async () => {
    const [s, h, m] = await Promise.all([
      Native.storageStats().catch(() => null),
      Native.history().then((r) => r.entries).catch(() => []),
      Native.mediaStats().catch(() => null)
    ])
    setStats(s)
    setHistory(h)
    setMedia(m)
    setPlan(planSummary())
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
      Native.updateWidget({
        freePercent: s && s.storageTotalBytes ? Math.round((s.storageFreeBytes / s.storageTotalBytes) * 100) : 0,
        junkBytes: j?.totalBytes ?? 0,
        score: hs.score
      }).catch(() => undefined)
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
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
      showToast(t('clean.nothing'))
      return
    }
    thud()
    setOverlay({ phase: 'working', freed: 0 })
    try {
      const r = await Native.cleanJunk({ categoryIds: ids })
      setOverlay({ phase: 'done', freed: r.freedBytes })
      success()
      if (settings.notifications) Native.notify({ title: t('clean.notifTitle'), body: t('clean.notifBody', { size: formatBytes(r.freedBytes) }) }).catch(() => undefined)
      await scan()
    } catch (err) {
      setOverlay(null)
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    }
  }

  function onTouchStart(e: React.TouchEvent): void {
    if ((pageRef.current?.scrollTop ?? 1) <= 0 && !scanning) pullFrom.current = e.touches[0].clientY
  }
  function onTouchMove(e: React.TouchEvent): void {
    if (pullFrom.current === null) return
    setPull(Math.max(0, Math.min(90, (e.touches[0].clientY - pullFrom.current) * 0.5)))
  }
  function onTouchEnd(): void {
    if (pull >= 58) {
      tap()
      scan()
    }
    pullFrom.current = null
    setPull(0)
  }

  const score = health?.score ?? null
  const freePct = stats && stats.storageTotalBytes > 0 ? Math.round((stats.storageFreeBytes / stats.storageTotalBytes) * 100) : null
  const totalSplit = stats ? splitBytes(stats.storageTotalBytes) : null

  const segments: Segment[] = media
    ? [
        { key: 'photos', label: t('home.seg.photos'), value: media.imagesBytes, color: '#2a1206' },
        { key: 'videos', label: t('home.seg.videos'), value: media.videosBytes, color: '#8c3d12' },
        { key: 'audio', label: t('home.seg.audio'), value: media.audioBytes, color: '#c9682c' },
        { key: 'apps', label: t('home.seg.apps'), value: media.appsBytes, color: '#f7c99b' },
        { key: 'free', label: t('home.seg.free'), value: media.freeBytes, color: '#fff3e6' }
      ]
    : []

  const initial = (settings.userName || 'C').trim().charAt(0).toUpperCase()

  return (
    <div className="page" ref={pageRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className={`ptr ${pull >= 58 || scanning ? 'active' : ''}`} style={{ height: pull > 0 ? pull : 0 }}>
        <div className="spin" />
      </div>

      <header className="head">
        <span className="brand-mark"><Icon name="hourglass" size={26} strokeWidth={2.4} /></span>
        <div className="head-actions">
          <button className="round-btn plain" onClick={() => { tap(); navigate('plan') }} aria-label={t('plan.title')}>
            <Icon name="bell" size={21} />
            {plan.overdue > 0 && <span className="dot" />}
          </button>
          <button className="avatar" onClick={() => { tap(); navigate('settings') }} aria-label={t('common.settings')}>{initial}</button>
        </div>
      </header>

      <div className="greeting">{t('home.hello', { name: settings.userName || t('app.name') })} 👋</div>
      <h1 className="display">{t('home.title')}</h1>

      <div className="pill-row">
        <button className="pill" onClick={() => { tap(); setPeriod((p) => (p + 1) % PERIODS.length) }}>
          <Icon name="calendar2" size={17} />
          {t(PERIODS[period])}
          <Icon name="chevron" size={15} style={{ transform: 'rotate(90deg)', opacity: 0.6 }} />
        </button>
        <button className="pill" onClick={() => { tap(); navigate('analyzer') }}>
          <Icon name="house" size={17} />
          {t('home.filter.storage')}
          <Icon name="chevron" size={15} style={{ transform: 'rotate(90deg)', opacity: 0.6 }} />
        </button>
      </div>

      <PermissionGate />

      <section className="tile yellow" onClick={() => { tap(); navigate('plan') }}>
        <div className="tile-head">
          <h3>{t('home.plan.title')}</h3>
          <span className="tile-btn"><Icon name="sliders" size={17} /></span>
        </div>
        <div className="stat-steps tall">
          <div className="step">
            <span className="n">{fmtNum(plan.overdue)}</span>
            <span className="l">{t('home.plan.overdue')}</span>
            <span className="deco dots" />
          </div>
          <div className="step">
            <span className="n">{fmtNum(plan.due)}</span>
            <span className="l">{t('home.plan.due')}</span>
            <span className="deco hatch" />
          </div>
          <div className="step">
            <span className="n">{fmtNum(plan.inPlan)}</span>
            <span className="l">{t('home.plan.inplan')}</span>
            <span className="bars">
              {[34, 46, 58, 52, 70, 84].map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }} />
              ))}
            </span>
          </div>
          <div className="step">
            <span className="n">{fmtNum(plan.done)}</span>
            <span className="l">{t('home.plan.done')}</span>
            <span className="deco solid" />
          </div>
        </div>
      </section>

      <section className="tile orange" style={{ marginTop: 14 }} onClick={() => { tap(); navigate('analyzer') }}>
        <div className="tile-head">
          <h3>{t('home.storage.title')}</h3>
          <span className="tile-btn"><Icon name="sliders" size={17} /></span>
        </div>
        <div className="donut-wrap">
          {media ? <Legend segments={segments} format={(n) => formatBytes(n, true)} /> : <div className="legend"><div className="skeleton" style={{ height: 76 }} /></div>}
          <Donut
            segments={segments.length ? segments : [{ key: 'x', label: '', value: 1, color: '#fff3e6' }]}
            size={148}
            stroke={25}
            center={totalSplit ? totalSplit.value : '—'}
            caption={totalSplit ? `${totalSplit.unit} ${t('home.storage.center')}` : ''}
          />
        </div>
      </section>

      <section className="card card-pad" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ScoreRing score={score} caption={scanning ? t('common.scanning') : t('health.outOf')} color={scoreColor(score)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="card-title" style={{ fontSize: 19, letterSpacing: '-0.02em' }}>{t(healthTitleKey(score, scanning))}</h2>
            <p className="card-sub" style={{ marginTop: 6 }}>
              {health
                ? health.safeCleanableBytes > 0
                  ? t('health.canFree', { size: formatBytes(health.safeCleanableBytes) })
                  : t('health.clean')
                : scanning
                  ? t('health.scanningDesc')
                  : t('health.idleDesc')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-dark" style={{ flex: 1 }} onClick={smartClean} disabled={!junk || scanning || !!overlay}>
            <Icon name="sparkles" size={18} /> {t('home.smartClean')}
          </button>
          <button className="fab" onClick={() => { tap(); scan() }} disabled={scanning} aria-label={t('home.scanPhone')}>
            <Icon name="refresh" size={22} />
          </button>
        </div>
      </section>

      {health && (
        <>
          <div className="section-title">{t('health.factors')}</div>
          <div className="card">
            {health.factors.map((f) => (
              <div key={f.id} className="row" onClick={() => { tap(); f.page && navigate(f.page as PageId) }}>
                <Ico name={f.status === 'good' ? 'checkCircle' : 'alert'} tone={f.status === 'good' ? 'tone-green' : f.status === 'warn' ? 'tone-yellow' : 'tone-red'} size="sm" />
                <div className="text">
                  <div className="title">{f.label}</div>
                  <div className="desc">{f.detail}</div>
                </div>
                <Icon name="chevron" size={16} className="muted flip-rtl" />
              </div>
            ))}
          </div>
        </>
      )}

      {favorites.length > 0 && (
        <>
          <div className="section-title">{t('home.favorites')}</div>
          <div className="items-grid">
            {favorites.map((id, i) => {
              const m = PAGE_META[id]
              return (
                <ToolTile key={id} id={id} icon={m.icon} tone={m.tone} title={t(m.title)} sub={t(m.sub)} index={i} onOpen={() => navigate(id)} />
              )
            })}
          </div>
        </>
      )}

      <div className="section-title">
        {t('home.tools')}
        <button className="more" onClick={() => navigate('more')}>{t('common.viewAll')}</button>
      </div>
      <div className="items-grid">
        {(['social', 'screenshots', 'booster', 'overview'] as PageId[]).map((id, i) => {
          const m = PAGE_META[id]
          return <ToolTile key={id} id={id} icon={m.icon} tone={m.tone} title={t(m.title)} sub={t(m.sub)} index={i} onOpen={() => navigate(id)} />
        })}
      </div>

      {history.length > 0 && (
        <>
          <div className="section-title">
            {t('home.lastClean')}
            <button className="more" onClick={() => navigate('history')}>{t('common.viewAll')}</button>
          </div>
          <div className="card">
            <div className="row" onClick={() => navigate('history')}>
              <Ico name="history" tone="tone-green" size="sm" />
              <div className="text">
                <div className="title">{t('home.freed', { size: formatBytes(history[0].freedBytes) })}</div>
                <div className="desc">{new Date(history[0].timestamp).toLocaleDateString(settings.lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB')}</div>
              </div>
              <span className="trail">{t('home.opsCount', { n: fmtNum(history.length) })}</span>
            </div>
          </div>
        </>
      )}

      {freePct !== null && stats && (
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            <span>{formatBytes(stats.storageFreeBytes)} {t('common.free')}</span>
            <span className="muted">{formatBytes(stats.storageTotalBytes)}</span>
          </div>
          <div className="bar warm"><div style={{ width: `${100 - freePct}%` }} /></div>
        </div>
      )}

      {overlay && <CleanOverlay phase={overlay.phase} freedBytes={overlay.freed} label={t('clean.working')} onClose={() => setOverlay(null)} />}
    </div>
  )
}

function ToolTile({ id, icon, tone, title, sub, index, onOpen }: { id: PageId; icon: IconName; tone: string; title: string; sub: string; index: number; onOpen: () => void }): JSX.Element {
  const { favorites, toggleFavorite } = useApp()
  const fav = favorites.includes(id)
  return (
    <div className="item-card" style={{ animationDelay: `${index * 40}ms` }} onClick={() => { tap(); onOpen() }}>
      <div className="top">
        <Ico name={icon} tone={tone} size="sm" />
        <button
          className={`star ${fav ? 'on' : ''}`}
          style={{ marginInlineStart: 'auto' }}
          onClick={(e) => { e.stopPropagation(); tap(); toggleFavorite(id) }}
          aria-label={title}
        >
          <Icon name="star" size={17} strokeWidth={fav ? 2.4 : 1.8} />
        </button>
      </div>
      <div className="name" style={{ marginTop: 4 }}>{title}</div>
      <div className="card-sub" style={{ whiteSpace: 'normal' }}>{sub}</div>
    </div>
  )
}
