import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { NetworkAdapter, NetworkConnection, PingResult } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

export function Network(): JSX.Element {
  const { showToast } = useToast()
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([])
  const [connections, setConnections] = useState<NetworkConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [pingHost, setPingHost] = useState('google.com')
  const [pinging, setPinging] = useState(false)
  const [pingResult, setPingResult] = useState<PingResult | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const [a, c] = await Promise.all([
        window.api.net.adapters(),
        window.api.net.connections()
      ])
      setAdapters(a)
      setConnections(c)
    } catch (err) {
      showToast(t('nw.failed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runPing(): Promise<void> {
    setPinging(true)
    setPingResult(null)
    try {
      setPingResult(await window.api.net.ping(pingHost))
    } finally {
      setPinging(false)
    }
  }

  async function flushDns(): Promise<void> {
    const result = await window.api.net.flushDns()
    showToast(result.message)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">
          {loading ? t('common.loading') : t('nw.count', { a: fmtNum(adapters.length), c: fmtNum(connections.length) })}
        </span>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={flushDns}>
          <Icon name="sparkles" size={15} /> {t('nw.flushDns')}
        </button>
        <button className="btn btn-sm" onClick={load}>
          <Icon name="refresh" size={15} /> {t('common.refresh')}
        </button>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>{t('nw.pingTitle')}</h3>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            type="text"
            value={pingHost}
            onChange={(e) => setPingHost(e.target.value)}
            style={{ width: 260 }}
            placeholder={t('nw.pingPh')}
          />
          <button className="btn btn-sm btn-primary" onClick={runPing} disabled={pinging}>
            {pinging ? t('nw.pinging') : t('nw.ping')}
          </button>
          {pingResult && (
            <span className={`badge ${pingResult.success ? 'badge-safe' : 'badge-danger'}`}>
              {pingResult.success
                ? t('nw.pingAvg', { ms: fmtNum(pingResult.averageMs) })
                : pingResult.message}
            </span>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>{t('nw.adapters')}</h3>
        <table>
          <thead>
            <tr>
              <th>{t('nw.thAdapter')}</th>
              <th>{t('nw.thIp')}</th>
              <th>{t('common.status')}</th>
              <th>{t('nw.thSpeed')}</th>
              <th>{t('nw.thTraffic')}</th>
            </tr>
          </thead>
          <tbody>
            {adapters.map((a) => (
              <tr key={a.name + a.mac}>
                <td>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div className="muted" style={{ fontSize: 11.5, direction: 'ltr', textAlign: 'right' }}>
                    {a.mac}
                  </div>
                </td>
                <td style={{ direction: 'ltr', textAlign: 'right' }}>{a.ip4 || '—'}</td>
                <td>
                  <span className={`badge ${a.isUp ? 'badge-safe' : 'badge-caution'}`}>
                    {t(a.isUp ? 'nw.up' : 'nw.down')}
                  </span>
                </td>
                <td className="muted">{a.speedMbps ? `${a.speedMbps} Mbps` : '—'}</td>
                <td className="muted">
                  {formatBytes(a.rxBytes)} / {formatBytes(a.txBytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>{t('nw.connections')}</h3>
        <table>
          <thead>
            <tr>
              <th>{t('nw.thApp')}</th>
              <th>{t('nw.thProto')}</th>
              <th>{t('nw.thLocal')}</th>
              <th>{t('nw.thRemote')}</th>
              <th>{t('common.status')}</th>
            </tr>
          </thead>
          <tbody>
            {connections.slice(0, 200).map((c, i) => (
              <tr key={`${c.localAddress}-${c.remoteAddress}-${i}`}>
                <td style={{ fontWeight: 600 }}>{c.processName || `PID ${c.pid}`}</td>
                <td className="muted">{c.protocol}</td>
                <td style={{ direction: 'ltr', textAlign: 'right', fontSize: 12 }}>{c.localAddress}</td>
                <td style={{ direction: 'ltr', textAlign: 'right', fontSize: 12 }}>
                  {c.remoteAddress || '—'}
                </td>
                <td className="muted">{c.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
