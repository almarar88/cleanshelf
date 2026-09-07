import { useEffect, useState } from 'react'
import { Share } from '@capacitor/share'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { formatBytes, formatDate, formatMs, formatUptime } from '../../lib/format'
import { junkLabel } from '../../lib/labels'
import type { CleanHistoryEntry, DeviceInfo, StorageStats, UsageEntry, StorageRoot } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { EmptyState, Notice } from '../../components/ui'

/* ---------- استخدام التطبيقات ---------- */

export function Usage(): JSX.Element {
  const { permissions } = useApp()
  const [days, setDays] = useState(7)
  const [entries, setEntries] = useState<UsageEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!permissions.usageStats) return
    setLoading(true)
    Native.usageStats({ days }).then((r) => setEntries(r.entries)).catch(() => setEntries([])).finally(() => setLoading(false))
  }, [days, permissions.usageStats])

  const max = Math.max(...entries.map((e) => e.totalTimeMs), 1)
  const total = entries.reduce((s, e) => s + e.totalTimeMs, 0)

  if (!permissions.usageStats) {
    return (
      <div className="page no-tabs">
        <EmptyState icon="clock" tone="tone-teal" text="لعرض وقت استخدام كل تطبيق يلزم إذن الوصول إلى بيانات الاستخدام" />
        <button className="btn btn-primary btn-block" onClick={() => Native.requestUsageStats()}>فتح الإعدادات</button>
      </div>
    )
  }

  return (
    <div className="page no-tabs">
      <div className="segmented" style={{ marginBottom: 12 }}>
        {[1, 7, 30].map((d) => <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>{d === 1 ? 'اليوم' : `${d} يوم`}</button>)}
      </div>
      <div className="card card-pad" style={{ marginBottom: 12 }}>
        <div className="card-sub">إجمالي وقت الشاشة</div>
        <div className="card-title" style={{ fontSize: 22 }}>{formatMs(total)}</div>
      </div>
      {loading ? <div className="card"><div className="skeleton" style={{ height: 56 }} /></div> : entries.length === 0 ? <EmptyState icon="clock" text="لا بيانات استخدام بعد" /> : (
        <div className="card">
          {entries.map((e) => (
            <div key={e.packageName} className="row" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img className="app-icon" style={{ width: 36, height: 36, borderRadius: 9 }} src={`data:image/png;base64,${e.icon}`} alt="" />
                <div className="text"><div className="title">{e.label}</div><div className="desc">آخر استخدام {formatDate(e.lastUsedAt)}</div></div>
                <span className="trail">{formatMs(e.totalTimeMs)}</span>
              </div>
              <div className="progress-bar" style={{ height: 5 }}><div style={{ width: `${(e.totalTimeMs / max) * 100}%` }} /></div>
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
    const t = setInterval(tick, 3000)
    return () => clearInterval(t)
  }, [])

  const ramPct = stats && stats.ramTotalBytes ? Math.round(((stats.ramTotalBytes - stats.ramAvailableBytes) / stats.ramTotalBytes) * 100) : 0

  return (
    <div className="page no-tabs">
      <div className="card card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="tile-icon tone-green"><Icon name="monitor" size={22} /></div>
        <div>
          <div className="card-title">{info ? `${info.manufacturer} ${info.model}` : '…'}</div>
          <div className="card-sub">Android {info?.androidVersion ?? '…'} (API {info?.sdkInt ?? '…'}) • {info?.cpuCores ?? '…'} أنوية</div>
        </div>
      </div>
      <div className="section-title">الذاكرة (RAM)</div>
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span>{stats ? formatBytes(stats.ramTotalBytes - stats.ramAvailableBytes) : '…'} مستخدمة</span><span className="muted">{stats ? formatBytes(stats.ramTotalBytes) : '…'}</span></div>
        <div className="progress-bar" style={{ marginTop: 8 }}><div style={{ width: `${ramPct}%` }} /></div>
      </div>
      <div className="section-title">التخزين</div>
      <div className="card">
        {roots.map((r) => {
          const pct = r.totalBytes ? Math.round(((r.totalBytes - r.freeBytes) / r.totalBytes) * 100) : 0
          return (
            <div key={r.path} className="row" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><strong>{r.label}</strong><span className="muted">{formatBytes(r.freeBytes)} متاحة من {formatBytes(r.totalBytes)}</span></div>
              <div className="progress-bar" style={{ height: 6 }}><div style={{ width: `${pct}%` }} /></div>
            </div>
          )
        })}
      </div>
      <div className="section-title">البطارية والتشغيل</div>
      <div className="grid grid-2">
        <div className="card stat-tile"><span className="label"><Icon name="zap" size={13} /> البطارية</span><span className="value">{stats ? `${stats.batteryPercent}%` : '…'}</span><span className="muted">{stats?.batteryCharging ? 'يشحن' : 'لا يشحن'}</span></div>
        <div className="card stat-tile"><span className="label"><Icon name="flame" size={13} /> الحرارة</span><span className="value">{stats ? `${stats.batteryTempC.toFixed(1)}°` : '…'}</span><span className="muted">{stats && stats.batteryTempC >= 42 ? 'مرتفعة' : 'طبيعية'}</span></div>
        <div className="card stat-tile"><span className="label"><Icon name="clock" size={13} /> منذ إعادة التشغيل</span><span className="value" style={{ fontSize: 16 }}>{info ? formatUptime(info.uptimeSec) : '…'}</span></div>
        <div className="card stat-tile"><span className="label"><Icon name="info" size={13} /> CleanShelf</span><span className="value" style={{ fontSize: 16 }}>{info?.appVersion ?? '…'}</span><span className="muted">Alcode</span></div>
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
      l.push('# تقرير CleanShelf عن الهاتف', '')
      l.push(`- **التاريخ:** ${new Date().toLocaleString('ar')}`)
      l.push(`- **الجهاز:** ${info.manufacturer} ${info.model} — Android ${info.androidVersion} (API ${info.sdkInt})`)
      l.push(`- **CleanShelf:** ${info.appVersion} — Alcode`, '')
      l.push('## الذاكرة والبطارية', '')
      l.push(`- RAM: ${formatBytes(stats.ramTotalBytes - stats.ramAvailableBytes)} مستخدمة من ${formatBytes(stats.ramTotalBytes)}`)
      l.push(`- البطارية: ${stats.batteryPercent}% (${stats.batteryTempC.toFixed(1)}°)`)
      l.push(`- منذ إعادة التشغيل: ${formatUptime(info.uptimeSec)}`, '')
      l.push('## التخزين', '', '| القسم | الإجمالي | المتاح |', '|---|---|---|')
      for (const r of roots) l.push(`| ${r.label} | ${formatBytes(r.totalBytes)} | ${formatBytes(r.freeBytes)} |`)
      l.push('')
      if (junk) {
        l.push(`## ما يمكن تنظيفه (${formatBytes(junk.totalBytes)})`, '', '| الفئة | الحجم | العناصر |', '|---|---|---|')
        for (const c of junk.categories.filter((x) => x.sizeBytes > 0 || x.fileCount > 0)) l.push(`| ${junkLabel(c.id).title} | ${formatBytes(c.sizeBytes)} | ${c.fileCount} |`)
        l.push('')
      }
      l.push(`## أكبر التطبيقات (${apps.length} تطبيق)`, '')
      for (const a of [...apps].sort((x, y) => y.sizeBytes - x.sizeBytes).slice(0, 25)) l.push(`- ${a.label} — ${formatBytes(a.sizeBytes)}`)
      l.push('', '## سجل التنظيف', '', `- عدد العمليات: ${history.length}`, `- إجمالي ما حُرِّر: ${formatBytes(history.reduce((s, h) => s + h.freedBytes, 0))}`)
      l.push('', '---', '_أُنشئ بواسطة CleanShelf من تطوير Alcode_')
      setText(l.join('\n'))
    } catch (err) {
      showToast('فشل إنشاء التقرير: ' + (err as Error).message)
    } finally {
      setBuilding(false)
    }
  }

  async function share(): Promise<void> {
    if (!text) return
    try {
      await Share.share({ title: 'تقرير CleanShelf', text, dialogTitle: 'مشاركة التقرير' })
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        showToast('تم نسخ التقرير')
      } catch {
        showToast('تعذّرت المشاركة', 'error')
      }
    }
  }

  return (
    <div className="page no-tabs">
      <Notice>يجمع التقرير حالة الجهاز والتخزين وما يمكن تنظيفه وأكبر التطبيقات في نص واحد يمكنك مشاركته أو حفظه.</Notice>
      <div className="toolbar">
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={build} disabled={building}><Icon name="fileText" size={15} /> {building ? 'جارٍ الجمع…' : text ? 'إعادة الإنشاء' : 'إنشاء التقرير'}</button>
        <button className="btn" onClick={share} disabled={!text}><Icon name="externalLink" size={15} /> مشاركة</button>
      </div>
      {building ? <div className="card card-pad"><div className="skeleton" style={{ height: 16, width: '50%', marginBottom: 10 }} /><div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 6 }} /><div className="skeleton" style={{ height: 12, width: '70%' }} /></div> : text ? <div className="card card-pad"><pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, userSelect: 'text' }}>{text}</pre></div> : <EmptyState icon="fileText" tone="tone-teal" text="اضغط إنشاء التقرير لأخذ لقطة كاملة عن هاتفك" />}
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

  return (
    <div className="page no-tabs">
      <div className="grid grid-2" style={{ marginBottom: 12 }}>
        <div className="card stat-tile"><span className="label"><Icon name="sparkles" size={13} /> إجمالي ما حُرِّر</span><span className="value">{formatBytes(total)}</span></div>
        <div className="card stat-tile"><span className="label"><Icon name="history" size={13} /> عمليات التنظيف</span><span className="value">{entries.length}</span></div>
      </div>
      {entries.length === 0 ? <EmptyState icon="history" tone="tone-green" text="لم يُنفَّذ أي تنظيف بعد" /> : (
        <>
          <div className="card">
            {entries.map((e, i) => (
              <div key={i} className="row" style={{ cursor: 'default' }}>
                <div className="tile-icon sm tone-green"><Icon name="check" size={16} /></div>
                <div className="text"><div className="title">{formatBytes(e.freedBytes)}</div><div className="desc">{formatDate(e.timestamp)} • {e.categories.map((c) => junkLabel(c).title).join('، ')}</div></div>
              </div>
            ))}
          </div>
          <button className="btn btn-block btn-sm" style={{ marginTop: 12 }} onClick={() => Native.clearHistory().then(() => { showToast('مُسح السجل'); load() })}>مسح السجل</button>
        </>
      )}
    </div>
  )
}
