import { useCallback, useEffect, useMemo, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { getLang, t } from '../lib/i18n'
import { fmtNum, formatBytes, formatDate } from '../lib/format'
import { markTaskDone } from '../lib/plan'
import { tap } from '../lib/haptics'
import type { AppEntry, LeftoverEntry } from '../lib/types'
import { Icon } from '../components/Icon'
import { ConfirmSheet, Notice, Sheet, Switch } from '../components/ui'

type SortKey = 'size' | 'name' | 'unused' | 'updated'
const SORTS: { id: SortKey; key: string }[] = [
  { id: 'size', key: 'apps.sortSize' },
  { id: 'unused', key: 'apps.sortUnused' },
  { id: 'updated', key: 'apps.sortUpdated' },
  { id: 'name', key: 'apps.sortName' }
]

export function Apps(): JSX.Element {
  const { settings, updateSettings, permissions } = useApp()
  const { showToast } = useToast()
  const [apps, setApps] = useState<AppEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('size')
  const [active, setActive] = useState<AppEntry | null>(null)
  const [leftovers, setLeftovers] = useState<LeftoverEntry[] | null>(null)
  const [confirmLeftovers, setConfirmLeftovers] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await Native.listApps({ includeSystem: settings.showSystemApps })
      setApps(r.apps)
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }, [settings.showSystemApps, showToast])

  useEffect(() => {
    load()
  }, [load])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const collator = new Intl.Collator(getLang() === 'ar' ? 'ar' : 'en')
    const filtered = apps.filter((a) => !q || a.label.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q))
    filtered.sort((a, b) => {
      if (sort === 'size') return b.sizeBytes - a.sizeBytes
      if (sort === 'unused') return (a.lastUsedAt || 0) - (b.lastUsedAt || 0)
      if (sort === 'updated') return b.updatedAt - a.updatedAt
      return collator.compare(a.label, b.label)
    })
    return filtered
  }, [apps, query, sort])

  const totalBytes = apps.reduce((s, a) => s + a.sizeBytes, 0)

  async function scanLeftovers(): Promise<void> {
    if (!active) return
    try {
      const r = await Native.findLeftovers({ packageName: active.packageName, label: active.label })
      setLeftovers(r.items)
      if (r.items.length === 0) showToast(t('apps.noLeftovers'))
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    }
  }

  async function trashLeftovers(): Promise<void> {
    setConfirmLeftovers(false)
    if (!leftovers) return
    const r = await Native.trash({ paths: leftovers.map((l) => l.path) })
    const ok = r.results.filter((x) => x.success).length
    showToast(t('moved.partial', { ok: fmtNum(ok), total: fmtNum(r.results.length) }))
    markTaskDone('apps')
    setLeftovers([])
  }

  function unusedLabel(a: AppEntry): string {
    if (!permissions.usageStats) return ''
    if (!a.lastUsedAt) return t('apps.neverUsed')
    const days = Math.floor((Date.now() - a.lastUsedAt) / 86_400_000)
    return days === 0 ? t('apps.usedToday') : t('apps.usedAgo', { n: fmtNum(days) })
  }

  return (
    <div className="page">
      <h1 className="display sm">{t('page.apps')}</h1>

      <div className="field-row" style={{ marginBottom: 10 }}>
        <Icon name="search" size={18} />
        <input type="search" placeholder={t('apps.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button className="round-btn plain" style={{ width: 28, height: 28 }} onClick={() => setQuery('')} aria-label={t('common.clearAll')}><Icon name="x" size={16} /></button>
        )}
      </div>

      <div className="pill-row">
        {SORTS.map((s) => (
          <button key={s.id} className={`pill sm ${sort === s.id ? 'active' : ''}`} onClick={() => { tap(); setSort(s.id) }}>{t(s.key)}</button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ cursor: 'default' }}>
          <div className="text"><div className="title">{t('apps.system')}</div></div>
          <Switch checked={settings.showSystemApps} onChange={(v) => updateSettings({ showSystemApps: v })} label={t('apps.system')} />
        </div>
      </div>

      {!permissions.usageStats && (
        <div style={{ marginTop: 12 }}>
          <Notice icon="clock">
            {t('apps.usageHint')}
            <div><button className="btn btn-sm btn-dark" onClick={() => Native.requestUsageStats()}>{t('perm.usage.cta')}</button></div>
          </Notice>
        </div>
      )}

      <div className="section-title">{loading ? t('common.loading') : t('apps.count', { n: fmtNum(list.length), size: formatBytes(totalBytes) })}</div>

      <div className="card">
        {loading && apps.length === 0
          ? [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="row" style={{ cursor: 'default' }}>
                <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 13, flex: 'none' }} />
                <div className="text">
                  <div className="skeleton" style={{ height: 14, width: '52%' }} />
                  <div className="skeleton" style={{ height: 11, width: '32%', marginTop: 7 }} />
                </div>
              </div>
            ))
          : list.map((a, i) => (
              <div key={a.packageName} className="row" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} onClick={() => { tap(); setActive(a); setLeftovers(null) }}>
                <img className="app-icon" src={`data:image/png;base64,${a.icon}`} alt="" loading="lazy" />
                <div className="text">
                  <div className="title">
                    {a.label} {a.isSystem && <span className="badge badge-neutral">{t('apps.systemBadge')}</span>}
                  </div>
                  <div className="desc">{unusedLabel(a) || a.packageName}</div>
                </div>
                <span className="trail">{formatBytes(a.sizeBytes)}</span>
              </div>
            ))}
      </div>

      {active && (
        <Sheet onClose={() => setActive(null)}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img className="app-icon" style={{ width: 58, height: 58, borderRadius: 17 }} src={`data:image/png;base64,${active.icon}`} alt="" />
            <div style={{ minWidth: 0 }}>
              <h3 style={{ marginBottom: 2 }}>{active.label}</h3>
              <div className="muted mono" style={{ fontSize: 12, direction: 'ltr', textAlign: 'start' }}>{active.packageName}</div>
            </div>
          </div>

          <div className="grid grid-3" style={{ margin: '14px 0' }}>
            <div className="card card-pad" style={{ padding: 12 }}>
              <div className="card-sub">{t('common.size')}</div>
              <div className="card-title" style={{ fontSize: 15 }}>{formatBytes(active.sizeBytes)}</div>
            </div>
            <div className="card card-pad" style={{ padding: 12 }}>
              <div className="card-sub">{t('apps.version')}</div>
              <div className="card-title" style={{ fontSize: 15, direction: 'ltr' }}>{active.versionName || '—'}</div>
            </div>
            <div className="card card-pad" style={{ padding: 12 }}>
              <div className="card-sub">{t('apps.updated')}</div>
              <div className="card-title" style={{ fontSize: 13 }}>{active.updatedAt ? formatDate(active.updatedAt, false) : '—'}</div>
            </div>
          </div>

          {leftovers && leftovers.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              {leftovers.map((l) => (
                <div key={l.path} className="row" style={{ cursor: 'default' }}>
                  <Icon name={l.isDirectory ? 'folder' : 'file'} size={18} className="muted" />
                  <div className="text"><div className="desc mono" style={{ whiteSpace: 'normal', wordBreak: 'break-all', direction: 'ltr', textAlign: 'start' }}>{l.path}</div></div>
                  <span className="trail">{formatBytes(l.sizeBytes)}</span>
                </div>
              ))}
              <div style={{ padding: 10 }}>
                <button className="btn btn-danger btn-block btn-sm" onClick={() => setConfirmLeftovers(true)}>
                  <Icon name="trash" size={16} /> {t('apps.leftoversBtn', { size: formatBytes(leftovers.reduce((s, l) => s + l.sizeBytes, 0)) })}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-2">
            <button className="btn" onClick={() => Native.launchApp({ packageName: active.packageName })}><Icon name="play" size={16} /> {t('common.open')}</button>
            <button className="btn" onClick={() => Native.openAppInfo({ packageName: active.packageName })}><Icon name="info" size={16} /> {t('apps.info')}</button>
            <button className="btn" onClick={scanLeftovers}><Icon name="folderSearch" size={16} /> {t('apps.findLeftovers')}</button>
            <button className="btn btn-danger" disabled={active.isSystem} onClick={() => Native.uninstallApp({ packageName: active.packageName }).then(() => setTimeout(load, 3000))}>
              <Icon name="trash" size={16} /> {t('apps.uninstall')}
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: 12.5 }}>{t('apps.infoHint')}</p>
        </Sheet>
      )}

      {confirmLeftovers && (
        <ConfirmSheet
          title={t('apps.findLeftovers')}
          message={t('apps.leftoversConfirm')}
          confirmLabel={t('common.moveToTrash')}
          onConfirm={trashLeftovers}
          onCancel={() => setConfirmLeftovers(false)}
        />
      )}
    </div>
  )
}
