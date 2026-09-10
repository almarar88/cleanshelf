import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { CleanHistoryEntry } from '../../shared/types'
import { formatBytes, formatDate } from '../lib/format'
import { categoryTitleById } from '../lib/labels'
import { useToast } from '../lib/toastContext'
import { getLang, t } from '../lib/i18n'

export function History(): JSX.Element {
  const { showToast } = useToast()
  const [entries, setEntries] = useState<CleanHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setEntries(await window.api.history.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totalFreed = entries.reduce((sum, e) => sum + e.freedBytes, 0)

  async function clear(): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(t('hi.clearConfirm'))
    if (!confirmed) return
    await window.api.history.clear()
    showToast(t('hi.cleared'))
    load()
  }

  return (
    <div className="page">
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card card-pad stat-tile">
          <span className="label">{t('hi.totalFreed')}</span>
          <span className="value">{formatBytes(totalFreed)}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label">{t('hi.ops')}</span>
          <span className="value">{entries.length}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label">{t('hi.lastClean')}</span>
          <span className="value" style={{ fontSize: 16 }}>
            {entries[0] ? formatDate(entries[0].timestamp) : '—'}
          </span>
        </div>
      </div>

      <div className="toolbar">
        <span className="muted">{loading ? t('common.loading') : t('hi.sub')}</span>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={clear} disabled={entries.length === 0}>
          {t('hi.clear')}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="tile-icon tone-green"><Icon name="history" size={26} /></div>
          <div>{t('hi.none')}</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('hi.thFreed')}</th>
                <th>{t('hi.thCats')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.timestamp}-${i}`}>
                  <td>{formatDate(e.timestamp)}</td>
                  <td style={{ fontWeight: 600 }}>{formatBytes(e.freedBytes)}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>
                    {e.categories.map(categoryTitleById).join(getLang() === 'ar' ? '، ' : ', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
