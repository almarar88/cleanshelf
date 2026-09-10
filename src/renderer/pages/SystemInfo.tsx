import { useEffect, useState } from 'react'
import type { SystemSummary } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

export function SystemInfo(): JSX.Element {
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.system
      .summary()
      .then(setSummary)
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">{t('si.failed', { msg: error })}</div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="page">
        <div className="empty-state">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>{t('si.system')}</h3>
          <InfoRow label={t('si.host')} value={summary.hostname} />
          <InfoRow label={t('si.os')} value={summary.osName} />
          <InfoRow label={t('si.version')} value={summary.osVersion} />
          <InfoRow label={t('dash.uptime')} value={t('dash.hoursShort', { n: fmtNum(Math.floor(summary.uptimeSec / 3600)) })} />
        </div>
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>{t('si.cpuMem')}</h3>
          <InfoRow label={t('dash.cpu')} value={summary.cpuModel} />
          <InfoRow label={t('si.usage')} value={`${fmtNum(summary.cpuLoadPercent)}%`} />
          <InfoRow label={t('dash.memUsed')} value={formatBytes(summary.usedMemBytes)} />
          <InfoRow label={t('si.totalMem')} value={formatBytes(summary.totalMemBytes)} />
        </div>
      </div>

      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>{t('si.disks')}</h3>
        <table>
          <thead>
            <tr>
              <th>{t('si.thDisk')}</th>
              <th>{t('si.thUsed')}</th>
              <th>{t('si.thFree')}</th>
              <th>{t('common.total')}</th>
            </tr>
          </thead>
          <tbody>
            {summary.disks.map((d) => (
              <tr key={d.mount}>
                <td>{d.mount}</td>
                <td>{formatBytes(d.usedBytes)}</td>
                <td>{formatBytes(d.freeBytes)}</td>
                <td>{formatBytes(d.totalBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5 }}>
      <span className="muted">{label}</span>
      <span>{value || '—'}</span>
    </div>
  )
}
