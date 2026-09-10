import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import type { ServiceEntry } from '../../shared/types'
import { useToast } from '../lib/toastContext'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

const STATUS_LABEL: Record<ServiceEntry['status'], string> = {
  running: 'sv.running',
  stopped: 'sv.stopped',
  paused: 'sv.paused',
  unknown: 'sv.unknown'
}

const START_TYPE_LABEL: Record<ServiceEntry['startType'], string> = {
  boot: 'sv.boot',
  system: 'sv.system',
  automatic: 'sv.automatic',
  manual: 'sv.manual',
  disabled: 'sv.disabled',
  unknown: '—'
}

export function Services(): JSX.Element {
  const { showToast } = useToast()
  const [services, setServices] = useState<ServiceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [onlyRunning, setOnlyRunning] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setServices(await window.api.svc.list())
    } catch (err) {
      showToast(t('sv.failed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return services.filter((s) => {
      if (onlyRunning && s.status !== 'running') return false
      if (!q) return true
      return s.displayName.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    })
  }, [services, query, onlyRunning])

  async function control(
    service: ServiceEntry,
    action: 'start' | 'stop' | 'restart'
  ): Promise<void> {
    if (action === 'stop') {
      const confirmed = await window.api.dialogs.confirm(
        t('sv.stopConfirm', { name: service.displayName }),
        t('sv.stopDetail')
      )
      if (!confirmed) return
    }
    setBusy(service.name)
    try {
      const result = await window.api.svc.control(service.name, action)
      showToast(result.message)
      if (result.success) await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          placeholder={t('sv.searchPh')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 260 }}
        />
        <label className="checkbox-row" style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={onlyRunning}
            onChange={(e) => setOnlyRunning(e.target.checked)}
          />
          {t('sv.runningOnly')}
        </label>
        <div className="spacer" />
        <span className="muted">{loading ? t('common.loading') : t('sv.count', { n: fmtNum(visible.length) })}</span>
        <button className="btn btn-sm" onClick={load}>
          <Icon name="refresh" size={15} /> {t('common.refresh')}
        </button>
      </div>

      <div className="notice notice-warn">
        <Icon name="alert" size={17} />
        <div>{t('sv.warn')}</div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('sv.thService')}</th>
              <th>{t('common.status')}</th>
              <th>{t('sv.thStartType')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 400).map((s) => (
              <tr key={s.name}>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.displayName}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {s.name}
                  </div>
                </td>
                <td>
                  <span className={`badge ${s.status === 'running' ? 'badge-safe' : 'badge-caution'}`}>
                    {t(STATUS_LABEL[s.status])}
                  </span>
                </td>
                <td className="muted">{t(START_TYPE_LABEL[s.startType])}</td>
                <td>
                  {s.status === 'running' ? (
                    <>
                      <button
                        className="btn btn-sm"
                        disabled={busy === s.name}
                        onClick={() => control(s, 'stop')}
                      >
                        {t('sv.stop')}
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ marginRight: 6 }}
                        disabled={busy === s.name}
                        onClick={() => control(s, 'restart')}
                      >
                        {t('sv.restart')}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-sm"
                      disabled={busy === s.name || s.startType === 'disabled'}
                      onClick={() => control(s, 'start')}
                    >
                      {t('sv.start')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
