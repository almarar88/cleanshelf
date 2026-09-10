import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { t } from '../../lib/i18n'
import { fmtNum, formatBytes } from '../../lib/format'
import { thud, success } from '../../lib/haptics'
import type { BoostResult, StorageStats } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Notice } from '../../components/ui'
import { CountUp } from '../../components/CountUp'

export function Booster(): JSX.Element {
  const { permissions } = useApp()
  const { showToast } = useToast()
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BoostResult | null>(null)

  const refresh = (): void => {
    Native.storageStats().then(setStats).catch(() => undefined)
  }
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 2500)
    return () => clearInterval(timer)
  }, [])

  const usedPct = stats && stats.ramTotalBytes ? Math.round(((stats.ramTotalBytes - stats.ramAvailableBytes) / stats.ramTotalBytes) * 100) : 0

  async function boost(): Promise<void> {
    setRunning(true)
    setResult(null)
    thud()
    try {
      const r = await Native.boostMemory()
      setResult(r)
      success()
      refresh()
      const gained = r.afterAvailable - r.beforeAvailable
      showToast(gained > 0 ? t('boost.gained', { size: formatBytes(gained) }) : t('boost.tidy'))
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page no-tabs">
      <section className="tile yellow">
        <div className="tile-head">
          <h3>{t('page.booster')}</h3>
          <span className="tile-btn"><Icon name="zap" size={17} /></span>
        </div>
        <div className="display sm" style={{ margin: '4px 0 2px' }}>
          <CountUp value={usedPct} format={(n) => fmtNum(Math.round(n))} />
          <small>%</small>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.72 }}>
          {stats ? t('boost.available', { free: formatBytes(stats.ramAvailableBytes), total: formatBytes(stats.ramTotalBytes) }) : '—'}
        </div>
        <div className="bar" style={{ margin: '16px 0 4px', height: 10, background: 'rgba(0,0,0,0.12)' }}>
          <div style={{ width: `${usedPct}%`, background: '#121212' }} />
        </div>
      </section>

      <div style={{ marginTop: 14 }}>
        <button className="btn btn-dark btn-block" onClick={boost} disabled={running}>
          <Icon name="bolt" size={19} /> {running ? t('boost.working') : t('boost.now')}
        </button>
      </div>

      {result && (
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="card card-pad" style={{ padding: 12 }}>
              <div className="card-sub">{t('boost.before')}</div>
              <div className="card-title" style={{ fontSize: 19 }}>{formatBytes(result.beforeAvailable)}</div>
            </div>
            <div className="card card-pad" style={{ padding: 12 }}>
              <div className="card-sub">{t('boost.after')}</div>
              <div className="card-title" style={{ fontSize: 19, color: 'var(--success)' }}>{formatBytes(result.afterAvailable)}</div>
            </div>
          </div>
          <div className="card-sub" style={{ marginBottom: 9 }}>{t('boost.killed', { n: fmtNum(result.killed.length) })}</div>
          <div className="chips">
            {result.killed.slice(0, 30).map((k) => <span key={k} className="tag-chip">{k}</span>)}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Notice icon="info">
          {t('boost.hint')}
          {!permissions.usageStats && (
            <div><button className="btn btn-sm btn-dark" onClick={() => Native.requestUsageStats()}>{t('boost.usageCta')}</button></div>
          )}
        </Notice>
      </div>
    </div>
  )
}
