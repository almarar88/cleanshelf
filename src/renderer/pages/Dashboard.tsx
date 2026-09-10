import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, CleanHistoryEntry, HealthReport, SystemSummary } from '../../shared/types'
import { fmtNum, formatBytes, formatDate, splitBytes } from '../lib/format'
import { t } from '../lib/i18n'
import { useToast } from '../lib/toastContext'
import { planSummary, type PlanSummary } from '../lib/plan'
import { recordTrend } from '../lib/trend'
import { Icon } from '../components/Icon'
import { Ico, ScoreRing, ToolCard, scoreColor } from '../components/ui'
import { Donut, Legend, type Segment } from '../components/charts'
import { PAGE_META, pageSub, pageTitle, type PageId } from '../lib/pages'

const PERIODS = ['dash.period.week', 'dash.period.month', 'dash.period.year']

function healthTitle(score: number | null): string {
  if (score === null) return t('health.evaluating')
  if (score >= 90) return t('health.excellent')
  if (score >= 80) return t('health.good')
  if (score >= 60) return t('health.fair')
  return t('health.poor')
}

export function Dashboard({
  onNavigate,
  settings,
  command,
  onCommandHandled,
  pinned,
  onTogglePin
}: {
  onNavigate: (id: PageId) => void
  settings: AppSettings | null
  command: string | null
  onCommandHandled: () => void
  pinned: PageId[]
  onTogglePin: (id: PageId) => void
}): JSX.Element {
  const { showToast } = useToast()
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [history, setHistory] = useState<CleanHistoryEntry[]>([])
  const [cleaning, setCleaning] = useState(false)
  const [plan, setPlan] = useState<PlanSummary>(() => planSummary())
  const [period, setPeriod] = useState(1)

  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      setHealth(await window.api.health.compute())
      setPlan(planSummary())
    } catch (err) {
      showToast(t('health.failed', { msg: (err as Error).message }))
    } finally {
      setHealthLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    window.api.system
      .summary()
      .then((s) => {
        setSummary(s)
        const disk = s.disks.find((d) => d.mount === '/' || /^C:/i.test(d.mount)) ?? s.disks[0]
        if (disk) recordTrend(disk.freeBytes)
      })
      .catch(() => setSummary(null))
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
    try {
      const result = await window.api.cleaner.smartClean()
      showToast(
        result.categoryIds.length === 0
          ? t('dash.cleanNothing')
          : t('dash.cleanDone', { size: formatBytes(result.freedBytes), n: fmtNum(result.categoryIds.length) })
      )
      window.api.history.list().then(setHistory).catch(() => undefined)
      await loadHealth()
    } catch (err) {
      showToast(t('dash.cleanFailed', { msg: (err as Error).message }))
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

  const disk = summary?.disks.find((d) => d.mount === '/' || /^C:/i.test(d.mount)) ?? summary?.disks[0]
  const score = health?.score ?? null
  const totalSplit = disk ? splitBytes(disk.totalBytes) : null

  const segments: Segment[] = disk
    ? [
        { key: 'used', label: t('dash.seg.used'), value: Math.max(0, disk.usedBytes - (health?.cleanableBytes ?? 0)), color: '#2a1206' },
        { key: 'junk', label: t('dash.seg.junk'), value: health?.cleanableBytes ?? 0, color: '#c9682c' },
        { key: 'free', label: t('dash.seg.free'), value: disk.freeBytes, color: '#fff3e6' }
      ]
    : []

  return (
    <div className="page">
      <div className="pill-row">
        <button className="pill" onClick={() => setPeriod((p) => (p + 1) % PERIODS.length)}>
          <Icon name="calendar2" size={17} />
          {t(PERIODS[period])}
          <Icon name="chevron" size={15} style={{ transform: 'rotate(90deg)', opacity: 0.6 }} />
        </button>
        <button className="pill" onClick={() => onNavigate('diskanalyzer')}>
          <Icon name="hardDrive" size={17} />
          {disk ? disk.mount : t('dash.mainDisk')}
          <Icon name="chevron" size={15} style={{ transform: 'rotate(90deg)', opacity: 0.6 }} />
        </button>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="tile yellow" onClick={() => onNavigate('plan')}>
          <div className="tile-head">
            <h3>{t('dash.planTile')}</h3>
            <span className="tile-btn"><Icon name="sliders" size={17} /></span>
          </div>
          <div className="stat-steps tall">
            <div className="step">
              <span className="n">{fmtNum(plan.overdue)}</span>
              <span className="l">{t('dash.overdue')}</span>
              <span className="deco dots" />
            </div>
            <div className="step">
              <span className="n">{fmtNum(plan.due)}</span>
              <span className="l">{t('dash.due')}</span>
              <span className="deco hatch" />
            </div>
            <div className="step">
              <span className="n">{fmtNum(plan.inPlan)}</span>
              <span className="l">{t('dash.inPlan')}</span>
              <span className="bars">
                {[34, 46, 58, 52, 70, 84].map((h, i) => (
                  <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }} />
                ))}
              </span>
            </div>
            <div className="step">
              <span className="n">{fmtNum(plan.done)}</span>
              <span className="l">{t('dash.done')}</span>
              <span className="deco solid" />
            </div>
          </div>
        </section>

        <section className="tile orange" onClick={() => onNavigate('diskanalyzer')}>
          <div className="tile-head">
            <h3>{t('dash.diskTile')}</h3>
            <span className="tile-btn"><Icon name="sliders" size={17} /></span>
          </div>
          <div className="donut-wrap">
            {disk ? <Legend segments={segments} format={(n) => formatBytes(n, true)} /> : <div className="legend"><div className="skeleton" style={{ height: 76 }} /></div>}
            <Donut
              segments={segments.length ? segments : [{ key: 'x', label: '', value: 1, color: '#fff3e6' }]}
              size={150}
              stroke={25}
              center={totalSplit ? totalSplit.value : '—'}
              caption={totalSplit ? t('dash.totalOf', { unit: totalSplit.unit }) : ''}
            />
          </div>
        </section>
      </div>

      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <ScoreRing score={score} caption={healthLoading ? t('common.scanning') : t('dash.outOf100')} color={scoreColor(score)} size={158} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="card-title" style={{ fontSize: 24, letterSpacing: '-0.03em' }}>{healthTitle(score)}</h2>
            <p className="card-sub" style={{ marginTop: 8, whiteSpace: 'normal', lineHeight: 1.6 }}>
              {health
                ? health.safeCleanableBytes > 0
                  ? t('health.canFree', { size: formatBytes(health.safeCleanableBytes) })
                  : t('health.clean')
                : healthLoading
                  ? t('health.scanningDesc')
                  : t('health.idleDesc')}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="btn btn-dark btn-lg" onClick={runSmartClean} disabled={cleaning || healthLoading}>
                <Icon name="sparkles" size={18} />
                {cleaning ? t('dash.cleaning') : t('dash.smartClean')}
              </button>
              <button className="btn btn-lg" onClick={loadHealth} disabled={healthLoading || cleaning}>
                <Icon name="refresh" size={17} />
                {health ? t('common.rescan') : t('dash.scanDevice')}
              </button>
              <button className="btn btn-lg" onClick={() => onNavigate('overview')}>
                <Icon name="trendUp" size={17} /> {t('page.overview')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {health && (
        <>
          <div className="section-title">{t('dash.factors')}</div>
          <div className="grid grid-2" style={{ marginBottom: 16 }}>
            {health.factors.map((f) => (
              <div key={f.id} className="card card-pad card-clickable" style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }} onClick={() => f.page && onNavigate(f.page as PageId)}>
                <Ico
                  name={f.status === 'good' ? 'checkCircle' : 'alert'}
                  tone={f.status === 'good' ? 'tone-green' : f.status === 'warn' ? 'tone-yellow' : 'tone-red'}
                  size="sm"
                />
                <div style={{ minWidth: 0 }}>
                  <div className="card-title" style={{ fontSize: 14 }}>{f.label}</div>
                  <div className="card-sub" style={{ whiteSpace: 'normal' }}>{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pinned.length > 0 && (
        <>
          <div className="section-title">{t('dash.pinnedTools')}</div>
          <div className="items-grid" style={{ marginBottom: 16 }}>
            {pinned.map((id, i) => {
              const m = PAGE_META[id]
              return (
                <ToolCard
                  key={id}
                  icon={m.icon}
                  tone={m.tone}
                  title={pageTitle(id)}
                  sub={pageSub(id)}
                  index={i}
                  pinned
                  onPin={() => onTogglePin(id)}
                  onOpen={() => onNavigate(id)}
                />
              )
            })}
          </div>
        </>
      )}

      <div className="section-title">
        {t('dash.quickTools')}
        <button className="more" onClick={() => onNavigate('cleaner')}>{t('dash.allTools')}</button>
      </div>
      <div className="items-grid" style={{ marginBottom: 16 }}>
        {(['cleaner', 'uninstaller', 'privacy', 'duplicates', 'downloads', 'diskanalyzer'] as PageId[]).map((id, i) => {
          const m = PAGE_META[id]
          return (
            <ToolCard
              key={id}
              icon={m.icon}
              tone={m.tone}
              title={pageTitle(id)}
              sub={pageSub(id)}
              index={i}
              pinned={pinned.includes(id)}
              onPin={() => onTogglePin(id)}
              onOpen={() => onNavigate(id)}
            />
          )
        })}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label={t('dash.cpu')} value={summary ? `${fmtNum(summary.cpuLoadPercent)}%` : null} sub={summary?.cpuModel ?? ''} />
        <StatCard label={t('dash.memUsed')} value={summary ? formatBytes(summary.usedMemBytes) : null} sub={summary ? t('dash.outOfTotal', { size: formatBytes(summary.totalMemBytes) }) : ''} />
        <StatCard label={t('dash.diskFree')} value={disk ? formatBytes(disk.freeBytes) : null} sub={disk ? t('dash.ofTotal', { size: formatBytes(disk.totalBytes) }) : ''} />
        <StatCard label={t('dash.uptime')} value={summary ? t('dash.hoursShort', { n: fmtNum(Math.floor(summary.uptimeSec / 3600)) }) : null} sub={summary?.hostname ?? ''} />
      </div>

      {history.length > 0 && (
        <>
          <div className="section-title">
            {t('dash.lastCleans')}
            <button className="more" onClick={() => onNavigate('history')}>{t('common.viewAll')}</button>
          </div>
          <div className="card">
            {history.slice(0, 4).map((h, i) => (
              <div key={`${h.timestamp}-${i}`} className="row" onClick={() => onNavigate('history')}>
                <Ico name="checkCircle" tone="tone-green" size="sm" />
                <div className="text">
                  <div className="title">{formatBytes(h.freedBytes)}</div>
                  <div className="desc">{formatDate(h.timestamp)}</div>
                </div>
                <span className="trail">{fmtNum(h.categories.length)} {t('common.categories')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | null; sub: string }): JSX.Element {
  return (
    <div className="card card-pad stat-tile">
      <span className="label">{label}</span>
      {value === null ? <div className="skeleton" style={{ height: 26, width: '55%' }} /> : <span className="value">{value}</span>}
      <span className="muted" title={sub}>{sub || ' '}</span>
    </div>
  )
}
