import { useEffect, useState } from 'react'
import type { AppSettings, OldDownload } from '../../shared/types'
import { formatBytes, formatDate } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { Icon, type IconName } from '../components/Icon'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

function typeIcon(d: OldDownload): IconName {
  if (d.isDirectory) return 'folder'
  const e = d.extension
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(e)) return 'archive'
  if (['exe', 'msi', 'dmg', 'pkg'].includes(e)) return 'package'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(e)) return 'image'
  if (['mp3', 'wav', 'flac', 'm4a'].includes(e)) return 'music'
  if (['pdf', 'doc', 'docx', 'txt', 'xlsx', 'pptx'].includes(e)) return 'fileText'
  return 'file'
}

export function OldDownloads({ settings }: { settings: AppSettings | null }): JSX.Element {
  const { showToast } = useToast()
  const [days, setDays] = useState(30)
  const [items, setItems] = useState<OldDownload[]>([])
  const [loading, setLoading] = useState(false)
  const [folder, setFolder] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    window.api.downloads.path().then(setFolder).catch(() => setFolder(''))
  }, [])

  useEffect(() => {
    if (settings && !initialized) {
      setDays(settings.oldDownloadDays)
      setInitialized(true)
      scan(settings.oldDownloadDays)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, initialized])

  async function scan(withDays = days): Promise<void> {
    setLoading(true)
    setSelected(new Set())
    try {
      setItems(await window.api.downloads.findOld(withDays))
    } catch (err) {
      showToast(t('ex.scanFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const total = items.reduce((s, i) => s + i.sizeBytes, 0)
  const selectedBytes = items.filter((i) => selected.has(i.path)).reduce((s, i) => s + i.sizeBytes, 0)

  function toggle(p: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  async function trash(): Promise<void> {
    if (selected.size === 0) return
    const confirmed = await window.api.dialogs.confirm(
      t('od.trashConfirm', { n: fmtNum(selected.size) }),
      t('od.trashDetail', { size: formatBytes(selectedBytes) })
    )
    if (!confirmed) return
    const results = await window.api.fm.trashPaths([...selected])
    const failed = results.filter((r) => !r.success).length
    showToast(failed ? t('od.partial', { ok: fmtNum(results.length - failed), fail: fmtNum(failed) }) : t('od.moved', { n: fmtNum(results.length) }))
    await scan()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <label className="checkbox-row muted" style={{ fontSize: 13 }}>
          {t('od.olderThan')}
          <select value={days} onChange={(e) => { const d = Number(e.target.value); setDays(d); scan(d) }} disabled={loading}>
            {[7, 14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{t('od.daysN', { n: fmtNum(d) })}</option>)}
          </select>
        </label>
        <button className="btn" onClick={() => scan()} disabled={loading}>
          <Icon name="refresh" size={15} /> {t('common.rescan')}
        </button>
        <button className="btn btn-ghost" onClick={() => folder && window.api.fm.openPath(folder)} disabled={!folder}>
          <Icon name="folderOpen" size={15} /> {t('od.openFolder')}
        </button>
        <div className="spacer" />
        {items.length > 0 && (
          <button className="btn btn-sm" onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.path)))}>
            {t(selected.size === items.length ? 'od.clearAll' : 'common.selectAll')}
          </button>
        )}
        <button className="btn btn-danger" disabled={selected.size === 0} onClick={trash}>
          <Icon name="trash" size={15} /> {t('od.trashBtn', { size: formatBytes(selectedBytes) })}
        </button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card card-pad stat-tile">
          <span className="label"><Icon name="download" size={14} /> {t('od.oldItems')}</span>
          <span className="value">{loading ? '…' : fmtNum(items.length)}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label"><Icon name="hardDrive" size={14} /> {t('od.theirSize')}</span>
          <span className="value">{loading ? '…' : formatBytes(total)}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label"><Icon name="calendar" size={14} /> {t('od.oldest')}</span>
          <span className="value" style={{ fontSize: 18 }}>
            {items.length ? t('od.daysN', { n: fmtNum(Math.max(...items.map((i) => i.ageDays))) }) : '—'}
          </span>
        </div>
      </div>

      {!loading && items.length === 0 ? (
        <div className="empty-state">
          <div className="tile-icon tone-cyan"><Icon name="download" size={26} /></div>
          <div>{t('od.none', { n: fmtNum(days) })}</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>{t('common.name')}</th>
                <th>{t('od.thModified')}</th>
                <th>{t('od.thAge')}</th>
                <th>{t('common.size')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.path}>
                  <td><input type="checkbox" checked={selected.has(d.path)} onChange={() => toggle(d.path)} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <Icon name={typeIcon(d)} size={15} className="muted" /> {d.name}
                    </div>
                  </td>
                  <td className="muted">{formatDate(d.modifiedAt)}</td>
                  <td>
                    <span className={`badge ${d.ageDays > 180 ? 'badge-danger' : d.ageDays > 60 ? 'badge-caution' : 'badge-neutral'}`}>{t('od.daysN', { n: fmtNum(d.ageDays) })}</span>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBytes(d.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
