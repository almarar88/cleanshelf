import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { StartupItem } from '../../shared/types'
import { useToast } from '../lib/toastContext'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

const LOCATION_LABEL: Record<StartupItem['location'], string> = {
  'HKCU-Run': 'su.HKCU-Run',
  'HKLM-Run': 'su.HKLM-Run',
  'StartupFolder-User': 'su.StartupFolder-User',
  'StartupFolder-Common': 'su.StartupFolder-Common'
}

export function Startup(): JSX.Element {
  const { showToast } = useToast()
  const [items, setItems] = useState<StartupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setItems(await window.api.startup.list())
    } catch (err) {
      showToast(t('su.loadFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleEnabled(item: StartupItem): Promise<void> {
    setBusyId(item.id)
    try {
      await window.api.startup.setEnabled(item, !item.enabled)
      await load()
    } catch (err) {
      showToast(t('su.opFailed', { msg: (err as Error).message }))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(item: StartupItem): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(t('su.deleteConfirm', { name: item.name }))
    if (!confirmed) return
    setBusyId(item.id)
    try {
      await window.api.startup.remove(item)
      await load()
    } catch (err) {
      showToast(t('su.deleteFailed', { msg: (err as Error).message }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{loading ? t('common.loading') : t('su.count', { n: fmtNum(items.length) })}</span>
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
              <th>{t('su.thCommand')}</th>
              <th>{t('su.thLocation')}</th>
              <th>{t('common.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td className="muted" style={{ fontSize: 12, wordBreak: 'break-all', maxWidth: 320 }}>
                  {item.command}
                </td>
                <td className="muted">{t(LOCATION_LABEL[item.location])}</td>
                <td>
                  <span className={`badge ${item.enabled ? 'badge-safe' : 'badge-caution'}`}>
                    {t(item.enabled ? 'su.enabled' : 'su.disabled')}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-sm"
                    disabled={busyId === item.id}
                    onClick={() => toggleEnabled(item)}
                  >
                    {t(item.enabled ? 'su.disable' : 'su.enable')}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    style={{ marginRight: 6 }}
                    disabled={busyId === item.id}
                    onClick={() => remove(item)}
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
