import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import type { InstalledApp, LeftoverItem } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

export function Uninstaller(): JSX.Element {
  const { showToast } = useToast()
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [leftoverTarget, setLeftoverTarget] = useState<InstalledApp | null>(null)
  const [leftovers, setLeftovers] = useState<LeftoverItem[]>([])
  const [scanningLeftovers, setScanningLeftovers] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setApps(await window.api.uninstaller.list())
    } catch (err) {
      showToast(t('un.loadFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return apps
    return apps.filter(
      (a) => a.name.toLowerCase().includes(q) || a.publisher.toLowerCase().includes(q)
    )
  }, [apps, query])

  async function handleUninstall(app: InstalledApp): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(
      t('un.confirm', { name: app.name }),
      t('un.confirmDetail')
    )
    if (!confirmed) return
    setBusyKey(app.key)
    try {
      const result = await window.api.uninstaller.uninstall(app)
      showToast(result.success ? t('un.removed', { name: app.name }) : t('un.removeFailed', { msg: result.message }))
      if (result.success) {
        await load()
        openLeftoverScan(app)
      }
    } finally {
      setBusyKey(null)
    }
  }

  async function openLeftoverScan(app: InstalledApp): Promise<void> {
    setLeftoverTarget(app)
    setLeftovers([])
    setScanningLeftovers(true)
    try {
      const result = await window.api.uninstaller.findLeftovers(app.name, app.publisher)
      setLeftovers(result)
    } finally {
      setScanningLeftovers(false)
    }
  }

  async function removeLeftover(item: LeftoverItem): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(
      t('un.leftoverConfirm'),
      t('un.leftoverDetail', { path: item.path, size: formatBytes(item.sizeBytes) })
    )
    if (!confirmed) return
    try {
      await window.api.uninstaller.removeLeftover(item.path)
      setLeftovers((prev) => prev.filter((l) => l.path !== item.path))
      showToast(t('un.leftoverDeleted'))
    } catch (err) {
      showToast(t('un.deleteFailed', { msg: (err as Error).message }))
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          placeholder={t('un.searchPh')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 280 }}
        />
        <span className="muted">{loading ? t('common.loading') : t('un.count', { n: fmtNum(filtered.length) })}</span>
        <div className="spacer" />
        <button className="btn" onClick={load} disabled={loading}>
          <Icon name="refresh" size={15} /> {t('common.refresh')}
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('un.thPublisher')}</th>
              <th>{t('un.thVersion')}</th>
              <th>{t('un.thSize')}</th>
              <th>{t('un.thInstalled')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr key={app.key}>
                <td style={{ fontWeight: 600 }}>{app.name}</td>
                <td className="muted">{app.publisher || '—'}</td>
                <td className="muted">{app.version || '—'}</td>
                <td>{app.estimatedSizeKb ? formatBytes(app.estimatedSizeKb * 1024) : '—'}</td>
                <td className="muted">{app.installDate || '—'}</td>
                <td>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={busyKey === app.key}
                    onClick={() => handleUninstall(app)}
                  >
                    {t(busyKey === app.key ? 'un.busy' : 'un.uninstall')}
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ marginRight: 6 }}
                    onClick={() => openLeftoverScan(app)}
                  >
                    {t('un.leftovers')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {leftoverTarget && (
        <div className="modal-backdrop" onClick={() => setLeftoverTarget(null)}>
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>{t('un.leftoversTitle', { name: leftoverTarget.name })}</h3>
            {scanningLeftovers ? (
              <p className="muted">{t('un.searching')}</p>
            ) : leftovers.length === 0 ? (
              <p className="muted">{t('un.noLeftovers')}</p>
            ) : (
              <div className="scroll-list" style={{ maxHeight: 300 }}>
                {leftovers.map((item) => (
                  <div
                    key={item.path}
                    className="toolbar"
                    style={{ marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, wordBreak: 'break-all' }}>{item.path}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{formatBytes(item.sizeBytes)}</div>
                    </div>
                    <div className="spacer" />
                    <button className="btn btn-sm btn-danger" onClick={() => removeLeftover(item)}>
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
              <div className="spacer" />
              <button className="btn" onClick={() => setLeftoverTarget(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
