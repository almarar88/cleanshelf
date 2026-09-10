import { useEffect, useMemo, useState } from 'react'
import { Share } from '@capacitor/share'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { getLang, t } from '../../lib/i18n'
import { fmtNum, formatBytes, formatDate, formatMs, formatShortDate, formatUptime, splitBytes } from '../../lib/format'
import { junkLabel } from '../../lib/labels'
import { tap } from '../../lib/haptics'
import type { CleanHistoryEntry, DeviceInfo, StorageRoot, StorageStats, UsageEntry } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { EmptyState, Ico, Notice } from '../../components/ui'
import { WeekBars } from '../../components/charts'

function StatCard({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }): JSX.Element {
  return (
    <div className="card card-pad">
      <div className="card-sub">{label}</div>
      <div className="card-title" style={{ fontSize: small ? 16 : 21, marginTop: 3 }}>{value}</div>
      {sub && <div className="card-sub" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/* ---------- استخدام التطبيقات ---------- */

export function Usage(): JSX.Element {
  const { permissions } = useApp()
  const [days, setDays] = useState(7)
  const [entries, setEntries] = useState<UsageEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!permissions.usageStats) return
    setLoading(true)
    Native.usageStats({ days })
      .then((r) => setEntries(r.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [days, permissions.usageStats])

  const max = Math.max(...entries.map((e) => e.totalTimeMs), 1)
  const total = entries.reduce((s, e) => s + e.totalTimeMs, 0)

  if (!permissions.usageStats) {
    return (
      <div className="page no-tabs">
        <EmptyState
          icon="clock"
          tone="tone-teal"
          text={t('usage.needPerm')}
          action={<button className="btn btn-dark" onClick={() => Native.requestUsageStats()}>{t('perm.usage.cta')}</button>}
        />
      </div>
    )
  }

  return (
    <div className="page no-tabs">
      <div className="pill-row">
        {[1, 7, 30].map((d) => (
          <button key={d} className={`pill sm ${days === d ? 'active' : ''}`} onClick={() => { tap(); setDays(d) }}>
            {d === 1 ? t('usage.today') : t('usage.days', { n: fmtNum(d) })}
          </button>
        ))}
      </div>

      <section className="tile yellow" style={{ marginTop: 12 }}>
        <div className="tile-head">
          <h3>{t('usage.screenTime')}</h3>
          <span className="tile-btn"><Icon name="clock" size={17} /></span>
        </div>
        <div className="display sm" style={{ margin: '4px 0 0' }}>{formatMs(total)}</div>
      </section>

      {loading ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="skeleton" style={{ height: 58 }} />
          <div className="skeleton" style={{ height: 58, marginTop: 1 }} />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon="clock" tone="tone-teal" text={t('usage.none')} />
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          {entries.map((e, i) => (
            <div key={e.packageName} className="row" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 7, animationDelay: `${Math.min(i, 12) * 25}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%' }}>
                <img className="app-icon" style={{ width: 38, height: 38, borderRadius: 12 }} src={`data:image/png;base64,${e.icon}`} alt="" loading="lazy" />
                <div className="text">
                  <div className="title">{e.label}</div>
                  <div className="desc">{t('usage.lastUsed', { date: formatDate(e.lastUsedAt, false) })}</div>
                </div>
                <span className="trail">{formatMs(e.totalTimeMs)}</span>
              </div>
              <div className="bar warm" style={{ height: 6 }}><div style={{ width: `${(e.totalTimeMs / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- معلومات الجهاز ---------- */

export function Device(): JSX.Element {
  const [info, setInfo] = useState<DeviceInfo | null>(null)
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [roots, setRoots] = useState<StorageRoot[]>([])

  useEffect(() => {
    const tick = (): void => {
      Native.deviceInfo().then(setInfo).catch(() => undefined)
      Native.storageStats().then(setStats).catch(() => undefined)
    }
    tick()
    Native.roots().then((r) => setRoots(r.roots)).catch(() => undefined)
    const timer = setInterval(tick, 3000)
    return () => clearInterval(timer)
  }, [])

  const ramPct = stats && stats.ramTotalBytes ? Math.round(((stats.ramTotalBytes - stats.ramAvailableBytes) / stats.ramTotalBytes) * 100) : 0
  const ram = stats ? splitBytes(stats.ramTotalBytes - stats.ramAvailableBytes) : null

  return (
    <div className="page no-tabs">
      <section className="tile dark">
        <div className="tile-head">
          <h3>{info ? `${info.manufacturer} ${info.model}` : '—'}</h3>
          <span className="tile-btn"><Icon name="monitor" size={17} /></span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.78, marginTop: 4 }}>
          Android {info?.androidVersion ?? '—'} • API {info?.sdkInt ?? '—'} • {info ? t('device.cores', { n: fmtNum(info.cpuCores) }) : '—'}
        </div>
      </section>

      <div className="section-title">{t('device.ram')}</div>
      <div className="card card-pad">
        <div className="display sm" style={{ margin: 0 }}>
          {ram?.value ?? '—'}
          <small>{ram?.unit ?? ''}</small>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, margin: '8px 0' }}>
          <span className="muted">{t('common.used')}</span>
          <span className="muted">{stats ? formatBytes(stats.ramTotalBytes) : '—'}</span>
        </div>
        <div className="bar warm"><div style={{ width: `${ramPct}%` }} /></div>
      </div>

      <div className="section-title">{t('device.storage')}</div>
      <div className="card">
        {roots.map((r) => {
          const pct = r.totalBytes ? Math.round(((r.totalBytes - r.freeBytes) / r.totalBytes) * 100) : 0
          return (
            <div key={r.path} className="row" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, width: '100%' }}>
                <strong>{r.label}</strong>
                <span className="muted">{t('device.freeOf', { free: formatBytes(r.freeBytes), total: formatBytes(r.totalBytes) })}</span>
              </div>
              <div className="bar warm" style={{ height: 6 }}><div style={{ width: `${pct}%` }} /></div>
            </div>
          )
        })}
      </div>

      <div className="section-title">{t('device.battery')}</div>
      <div className="grid grid-2">
        <StatCard label={t('device.battery')} value={stats ? `${fmtNum(stats.batteryPercent)}%` : '—'} sub={stats?.batteryCharging ? t('device.charging') : t('device.notCharging')} />
        <StatCard label={t('device.temp')} value={stats ? `${fmtNum(stats.batteryTempC, 1)}°` : '—'} sub={stats && stats.batteryTempC >= 42 ? t('device.tempHigh') : t('device.tempNormal')} />
        <StatCard label={t('device.uptime')} value={info ? formatUptime(info.uptimeSec) : '—'} small />
        <StatCard label={t('app.name')} value={info?.appVersion ?? '—'} sub="Alcode" small />
      </div>
    </div>
  )
}

/* ---------- التقرير ---------- */

export function Report(): JSX.Element {
  const { showToast } = useToast()
  const [text, setText] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)

  async function build(): Promise<void> {
    setBuilding(true)
    try {
      const [info, stats, roots, apps, junk, history] = await Promise.all([
        Native.deviceInfo(),
        Native.storageStats(),
        Native.roots().then((r) => r.roots),
        Native.listApps({ includeSystem: false }).then((r) => r.apps).catch(() => []),
        Native.scanJunk().catch(() => null),
        Native.history().then((r) => r.entries).catch(() => [])
      ])
      const l: string[] = []
      l.push(`# ${t('report.h1')}`, '')
      l.push(`- **${t('report.date')}:** ${formatDate(Date.now())}`)
      l.push(`- **${t('report.device')}:** ${info.manufacturer} ${info.model} — Android ${info.androidVersion} (API ${info.sdkInt})`)
      l.push(`- **${t('app.name')}:** ${info.appVersion} — Alcode`, '')
      l.push(`## ${t('report.memBat')}`, '')
      l.push(`- RAM: ${formatBytes(stats.ramTotalBytes - stats.ramAvailableBytes)} / ${formatBytes(stats.ramTotalBytes)}`)
      l.push(`- ${t('device.battery')}: ${fmtNum(stats.batteryPercent)}% (${fmtNum(stats.batteryTempC, 1)}°)`)
      l.push(`- ${t('device.uptime')}: ${formatUptime(info.uptimeSec)}`, '')
      l.push(`## ${t('report.storage')}`, '', `| ${t('report.partition')} | ${t('common.total')} | ${t('common.free')} |`, '|---|---|---|')
      for (const r of roots) l.push(`| ${r.label} | ${formatBytes(r.totalBytes)} | ${formatBytes(r.freeBytes)} |`)
      l.push('')
      if (junk) {
        l.push(`## ${t('report.cleanable')} (${formatBytes(junk.totalBytes)})`, '', `| ${t('report.category')} | ${t('common.size')} | ${t('report.count')} |`, '|---|---|---|')
        for (const c of junk.categories.filter((x) => x.sizeBytes > 0 || x.fileCount > 0)) {
          l.push(`| ${junkLabel(c.id).title} | ${formatBytes(c.sizeBytes)} | ${fmtNum(c.fileCount)} |`)
        }
        l.push('')
      }
      l.push(`## ${t('report.biggestApps', { n: fmtNum(apps.length) })}`, '')
      for (const a of [...apps].sort((x, y) => y.sizeBytes - x.sizeBytes).slice(0, 25)) l.push(`- ${a.label} — ${formatBytes(a.sizeBytes)}`)
      l.push('', `## ${t('report.historyH')}`, '', `- ${t('report.ops')}: ${fmtNum(history.length)}`, `- ${t('report.totalFreed')}: ${formatBytes(history.reduce((s, h) => s + h.freedBytes, 0))}`)
      l.push('', '---', `_${t('report.footer')}_`)
      setText(l.join('\n'))
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    } finally {
      setBuilding(false)
    }
  }

  async function share(): Promise<void> {
    if (!text) return
    try {
      await Share.share({ title: t('report.h1'), text, dialogTitle: t('report.share') })
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        showToast(t('report.copied'))
      } catch {
        showToast(t('report.shareFailed'), 'error')
      }
    }
  }

  return (
    <div className="page no-tabs">
      <Notice>{t('report.hint')}</Notice>

      <div className="toolbar" style={{ margin: '14px 0' }}>
        <button className="btn btn-dark" style={{ flex: 1 }} onClick={() => { tap(); build() }} disabled={building}>
          <Icon name="fileText" size={16} /> {building ? t('report.building') : text ? t('report.rebuild') : t('report.build')}
        </button>
        <button className="btn" onClick={share} disabled={!text}><Icon name="externalLink" size={16} /> {t('report.share')}</button>
      </div>

      {building ? (
        <div className="card card-pad">
          <div className="skeleton" style={{ height: 16, width: '50%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 12, width: '70%' }} />
        </div>
      ) : text ? (
        <div className="card card-pad">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, userSelect: 'text' }}>{text}</pre>
        </div>
      ) : (
        <EmptyState icon="fileText" tone="tone-teal" text={t('report.empty')} />
      )}
    </div>
  )
}

/* ---------- السجل ---------- */

export function History(): JSX.Element {
  const { showToast } = useToast()
  const [entries, setEntries] = useState<CleanHistoryEntry[]>([])

  const load = (): void => {
    Native.history().then((r) => setEntries(r.entries)).catch(() => setEntries([]))
  }
  useEffect(load, [])

  const total = entries.reduce((s, e) => s + e.freedBytes, 0)
  const totalSplit = splitBytes(total)

  /** آخر 8 أسابيع — يعطي إحساسًا بالإيقاع لا بالأرقام فقط */
  const weeks = useMemo(() => {
    const WEEK = 7 * 86_400_000
    const now = Date.now()
    return Array.from({ length: 8 }, (_, idx) => {
      const i = 7 - idx
      const from = now - (i + 1) * WEEK
      const to = now - i * WEEK
      const value = entries.filter((e) => e.timestamp > from && e.timestamp <= to).reduce((s, e) => s + e.freedBytes, 0)
      return { label: formatShortDate(to).split(' ')[getLang() === 'ar' ? 0 : 1] ?? '', value }
    })
  }, [entries])

  return (
    <div className="page no-tabs">
      <section className="tile yellow">
        <div className="tile-head">
          <h3>{t('history.totalFreed')}</h3>
          <span className="tile-btn"><Icon name="sparkles" size={17} /></span>
        </div>
        <div className="display sm" style={{ margin: '4px 0 0' }}>
          {totalSplit.value}
          <small>{totalSplit.unit}</small>
        </div>
        <div className="stat-steps flat">
          <div className="step"><span className="n">{fmtNum(entries.length)}</span><span className="l">{t('history.ops')}</span></div>
          <div className="step"><span className="n">{fmtNum(entries.filter((e) => Date.now() - e.timestamp < 30 * 86_400_000).length)}</span><span className="l">{t('set.days', { n: fmtNum(30) })}</span></div>
        </div>
      </section>

      {entries.length === 0 ? (
        <EmptyState icon="history" tone="tone-green" text={t('history.none')} />
      ) : (
        <>
          <div className="section-title">{t('history.weekly')}<span className="more" style={{ pointerEvents: 'none' }}>{t('history.weeks')}</span></div>
          <div className="card card-pad">
            <WeekBars data={weeks} format={(n) => formatBytes(n, true)} />
          </div>

          <div className="section-title">{t('page.history')}</div>
          <div className="card">
            {entries.map((e, i) => (
              <div key={i} className="row" style={{ cursor: 'default', animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                <Ico name="checkCircle" tone="tone-green" size="sm" />
                <div className="text">
                  <div className="title">{formatBytes(e.freedBytes)}</div>
                  <div className="desc">{formatDate(e.timestamp)} • {e.categories.map((c) => junkLabel(c).title).join(getLang() === 'ar' ? '، ' : ', ')}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-block btn-sm" style={{ marginTop: 12 }} onClick={() => Native.clearHistory().then(() => { showToast(t('history.cleared')); load() })}>
            {t('history.clear')}
          </button>
        </>
      )}
    </div>
  )
}
