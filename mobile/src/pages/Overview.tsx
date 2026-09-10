import { useEffect, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { t } from '../lib/i18n'
import { formatBytes, fmtNum } from '../lib/format'
import { forecastDays } from '../lib/health'
import { loadTrend } from '../lib/trend'
import { planSummary } from '../lib/plan'
import type { StorageStats } from '../lib/types'
import type { PageId } from '../lib/nav'
import { Icon, type IconName } from '../components/Icon'
import { Ico } from '../components/ui'
import { RouteChart } from '../components/charts'
import { PermissionGate } from '../components/PermissionGate'
import { tap } from '../lib/haptics'

interface Opportunity {
  id: PageId
  icon: IconName
  tone: string
  title: string
  bytes: number
  count: number
}

export function Overview(): JSX.Element {
  const { navigate, settings } = useApp()
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [ops, setOps] = useState<Opportunity[] | null>(null)
  const plan = planSummary()
  const trend = loadTrend()

  useEffect(() => {
    let alive = true
    Native.storageStats().then((s) => alive && setStats(s)).catch(() => undefined)
    ;(async () => {
      const [junk, social, shots, dl] = await Promise.all([
        Native.scanJunk().catch(() => null),
        Native.socialMedia().catch(() => null),
        Native.screenshots({ days: 30 }).catch(() => null),
        Native.oldDownloads({ days: settings.oldDownloadDays }).catch(() => null)
      ])
      if (!alive) return
      const list: Opportunity[] = []
      if (junk) list.push({ id: 'cleaner', icon: 'sparkles', tone: 'tone-yellow', title: t('clean.title'), bytes: junk.totalBytes, count: junk.categories.reduce((s, c) => s + c.fileCount, 0) })
      if (social) list.push({ id: 'social', icon: 'message', tone: 'tone-green', title: t('page.social'), bytes: social.categories.reduce((s, c) => s + c.sizeBytes, 0), count: social.categories.reduce((s, c) => s + c.fileCount, 0) })
      if (shots) list.push({ id: 'screenshots', icon: 'image', tone: 'tone-violet', title: t('page.screenshots'), bytes: shots.totalBytes, count: shots.totalCount })
      if (dl) list.push({ id: 'downloads', icon: 'download', tone: 'tone-blue', title: t('page.downloads'), bytes: dl.items.reduce((s, i) => s + i.sizeBytes, 0), count: dl.items.length })
      setOps(list.filter((x) => x.bytes > 0).sort((a, b) => b.bytes - a.bytes))
    })()
    return () => {
      alive = false
    }
  }, [settings.oldDownloadDays])

  const forecast = stats ? forecastDays(trend, stats.storageFreeBytes) : { days: null, perDay: 0 }
  const critical = forecast.days !== null && forecast.days <= 30
  const headline = forecast.days === null ? t('overview.healthy') : critical ? t('overview.filling') : t('overview.healthy')
  const best = ops?.[0]

  return (
    <div className="page no-tabs">
      <PermissionGate compact />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <h1 className="display sm" style={{ flex: 1, marginBottom: 10 }}>{headline}</h1>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
          {(ops ?? []).slice(0, 2).map((o, i) => (
            <span key={o.id} className={`ico ${o.tone}`} style={{ marginInlineStart: i ? -14 : 0, border: '2px solid var(--bg)' }}>
              <Icon name={o.icon} size={18} />
            </span>
          ))}
          {(ops?.length ?? 0) > 2 && (
            <span className="ico tone-ink" style={{ marginInlineStart: -14, border: '2px solid var(--bg)', fontSize: 12.5, fontWeight: 800 }}>
              +{fmtNum((ops as Opportunity[]).length - 2)}
            </span>
          )}
        </div>
      </div>

      <RouteChart />
      <div className="route" style={{ marginTop: -76, marginBottom: 18, position: 'relative', height: 40 }}>
        <div className="badge" style={{ top: 10 }}>
          <span className="chip-solid"><Icon name="clock" size={15} /> {t('overview.forecast')}</span>
          <span className="chip-plain">{forecast.days === null ? '—' : `${fmtNum(forecast.days)}${t('unit.dayShort')}`}</span>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="card-sub">{t('home.seg.free')}</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>{stats ? formatBytes(stats.storageFreeBytes) : '—'}</div>
        </div>
        <div className="card card-pad">
          <div className="card-sub">{t('overview.rate', { size: '' }).replace(/\s+/g, ' ').trim()}</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>{forecast.perDay > 0 ? formatBytes(forecast.perDay) : '—'}</div>
        </div>
      </div>

      {forecast.days === null && <div className="card card-pad" style={{ marginTop: 14 }}><div className="card-sub">{t('overview.noData')}</div></div>}

      <div className="section-title">
        {t('overview.suggested')}
        <button className="more" onClick={() => navigate('more')}>{t('common.viewAll')}</button>
      </div>

      {!ops ? (
        <div className="card card-pad"><div className="skeleton" style={{ height: 150 }} /></div>
      ) : !best ? (
        <div className="card card-pad"><div className="card-sub">{t('overview.nothing')}</div></div>
      ) : (
        <section className="tile dark">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="badge badge-yellow"><Icon name="trendUp" size={12} /> {t('overview.highImpact')}</span>
            <button className="tile-btn" style={{ marginInlineStart: 'auto' }} onClick={() => { tap(); navigate(best.id) }} aria-label={t('common.viewDetails')}>
              <Icon name="star" size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '22px 0 18px' }}>
            <span className="ico lg" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', width: 92, height: 92, borderRadius: 28 }}>
              <Icon name={best.icon} size={42} strokeWidth={1.5} />
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{best.title}</div>
          <div style={{ opacity: 0.72, fontSize: 13, marginTop: 6 }}>
            {formatBytes(best.bytes)} • {fmtNum(best.count)} {t('common.files')}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
            <button className="btn" style={{ flex: 1, background: 'transparent', borderColor: 'rgba(255,255,255,0.25)', color: '#fff' }} onClick={() => { tap(); navigate(best.id) }}>
              {t('common.viewDetails')} <Icon name="arrowRight" size={17} className="flip-rtl" />
            </button>
            <button className="fab" onClick={() => { tap(); navigate(best.id) }} aria-label={t('common.viewDetails')}>
              <Icon name="sparkles" size={22} />
            </button>
          </div>
        </section>
      )}

      {ops && ops.length > 1 && (
        <div className="card" style={{ marginTop: 14 }}>
          {ops.slice(1).map((o) => (
            <div key={o.id} className="row" onClick={() => { tap(); navigate(o.id) }}>
              <Ico name={o.icon} tone={o.tone} size="sm" />
              <div className="text">
                <div className="title">{o.title}</div>
                <div className="desc">{fmtNum(o.count)} {t('common.files')}</div>
              </div>
              <span className="trail">{formatBytes(o.bytes)}<Icon name="chevron" size={15} className="muted flip-rtl" /></span>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        {t('overview.plan')}
        <button className="more" onClick={() => navigate('plan')}>{t('common.viewAll')}</button>
      </div>
      <div className="card">
        {plan.tasks.filter((x) => x.state !== 'done').slice(0, 3).map((task) => (
          <div key={task.id} className="row" onClick={() => { tap(); navigate(task.page) }}>
            <Ico name={task.icon} tone={task.tone} size="sm" />
            <div className="text">
              <div className="title">{t(task.labelKey)}</div>
              <div className="desc">{task.daysAgo === null ? t('plan.never') : t('plan.doneRecently', { n: fmtNum(task.daysAgo) })}</div>
            </div>
            <span className={`badge ${task.state === 'overdue' ? 'badge-danger' : 'badge-warn'}`}>{task.state === 'overdue' ? t('plan.overdueBadge') : t('plan.dueBadge')}</span>
          </div>
        ))}
        {plan.tasks.every((x) => x.state === 'done') && (
          <div className="row" style={{ cursor: 'default' }}>
            <Ico name="checkCircle" tone="tone-green" size="sm" />
            <div className="text"><div className="title">{t('overview.nothing')}</div></div>
          </div>
        )}
      </div>
    </div>
  )
}
