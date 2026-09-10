import { useEffect, useMemo, useState } from 'react'
import type { BrowserDataItem, BrowserDataKind } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { Icon, type IconName } from '../components/Icon'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

const KIND_LABEL: Record<BrowserDataKind, { title: string; desc: string; icon: IconName }> = {
  history: { title: 'pv.history.t', desc: 'pv.history.d', icon: 'history' },
  cookies: { title: 'pv.cookies.t', desc: 'pv.cookies.d', icon: 'cookie' },
  sessions: { title: 'pv.sessions.t', desc: 'pv.sessions.d', icon: 'layers' },
  formdata: { title: 'pv.formdata.t', desc: 'pv.formdata.d', icon: 'keyboard' }
}

export function Privacy(): JSX.Element {
  const { showToast } = useToast()
  const [items, setItems] = useState<BrowserDataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function scan(): Promise<void> {
    setLoading(true)
    try {
      const result = await window.api.privacy.scan()
      setItems(result)
      setSelected(new Set(result.filter((i) => i.risk === 'safe').map((i) => i.id)))
    } catch (err) {
      showToast(t('pv.scanFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const browsers = useMemo(() => {
    const map = new Map<string, BrowserDataItem[]>()
    for (const item of items) {
      const key = item.profile === 'Default' ? item.browser : `${item.browser} — ${item.profile}`
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()]
  }, [items])

  const selectedBytes = items.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.sizeBytes, 0)

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function clear(): Promise<void> {
    const chosen = items.filter((i) => selected.has(i.id))
    if (chosen.length === 0) return
    const hasCookies = chosen.some((i) => i.kind === 'cookies')
    const confirmed = await window.api.dialogs.confirm(
      t('pv.clearConfirm', { n: fmtNum(chosen.length) }),
      (hasCookies ? t('pv.cookieWarn') : '') + t('pv.closeFirst')
    )
    if (!confirmed) return
    setBusy(true)
    try {
      const results = await window.api.privacy.clear(chosen)
      const failed = results.filter((r) => !r.success)
      const freed = results.reduce((s, r) => s + r.freedBytes, 0)
      if (failed.length === 0) showToast(t('pv.cleared', { n: fmtNum(results.length), size: formatBytes(freed) }))
      else showToast(t('pv.partial', { fail: fmtNum(failed.length), n: fmtNum(results.length), msg: failed[0].error ?? '' }), 'error')
      await scan()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" onClick={scan} disabled={loading || busy}>
          <Icon name="refresh" size={15} /> {t('common.rescan')}
        </button>
        <span className="muted">{loading ? t('pv.searching') : t('pv.count', { b: fmtNum(browsers.length), n: fmtNum(items.length) })}</span>
        <div className="spacer" />
        <button className="btn btn-danger" disabled={selected.size === 0 || busy || loading} onClick={clear}>
          <Icon name="eyeOff" size={15} /> {busy ? t('pv.clearing') : t('pv.clearSel', { size: formatBytes(selectedBytes) })}
        </button>
      </div>

      <div className="notice notice-info">
        <Icon name="info" size={17} />
        <div>
          {t('pv.note')}
        </div>
      </div>

      {!loading && items.length === 0 ? (
        <div className="empty-state">
          <div className="tile-icon tone-violet"><Icon name="eyeOff" size={26} /></div>
          <div>{t('pv.none')}</div>
        </div>
      ) : (
        <div className="grid grid-2">
          {browsers.map(([name, group]) => (
            <div key={name} className="card">
              <div className="card-pad" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
                <div className="tile-icon" style={{ width: 32, height: 32, borderRadius: 9 }}>
                  <Icon name="globe" size={16} />
                </div>
                <strong>{name}</strong>
                <div className="spacer" />
                <span className="muted" style={{ fontSize: 12 }}>{formatBytes(group.reduce((s, i) => s + i.sizeBytes, 0))}</span>
              </div>
              {group.map((item) => {
                const meta = KIND_LABEL[item.kind]
                return (
                  <label key={item.id} className="settings-row" style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} disabled={busy} />
                    <Icon name={meta.icon} size={16} className="muted" />
                    <div className="text">
                      <div className="title" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {t(meta.title)}
                        {item.risk === 'caution' && <span className="badge badge-caution">{t('cl.caution')}</span>}
                      </div>
                      <div className="desc">{t(meta.desc)}</div>
                    </div>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBytes(item.sizeBytes)}</span>
                  </label>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
