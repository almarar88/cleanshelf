import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { formatBytes } from '../../lib/format'
import type { BoostResult, StorageStats } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Notice } from '../../components/ui'
import { CountUp } from '../../components/CountUp'
import { thud, success } from '../../lib/haptics'

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
    const t = setInterval(refresh, 2500)
    return () => clearInterval(t)
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
      showToast(gained > 0 ? `تحرّر ${formatBytes(gained)} من الذاكرة` : 'الذاكرة كانت مرتّبة بالفعل')
    } catch (err) {
      showToast('فشل التسريع: ' + (err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page no-tabs">
      <div className="hero pulse" style={{ textAlign: 'center' }}>
        <div className="tile-icon tone-amber" style={{ width: 72, height: 72, borderRadius: 22, margin: '0 auto' }}><Icon name="zap" size={34} /></div>
        <h2><CountUp value={usedPct} format={(n) => `${Math.round(n)}%`} /> من الذاكرة مستخدمة</h2>
        <p>{stats ? `${formatBytes(stats.ramAvailableBytes)} متاحة من ${formatBytes(stats.ramTotalBytes)}` : '…'}</p>
        <div className="boost-gauge" style={{ margin: '16px 0' }}><div style={{ width: `${usedPct}%` }} /></div>
        <button className="btn btn-primary btn-lg btn-block" onClick={boost} disabled={running}>
          <Icon name="bolt" size={18} /> {running ? 'جارٍ إغلاق تطبيقات الخلفية…' : 'تسريع الآن'}
        </button>
      </div>

      {result && (
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div className="card stat-tile"><span className="label">قبل</span><span className="value">{formatBytes(result.beforeAvailable)}</span></div>
            <div className="card stat-tile"><span className="label">بعد</span><span className="value" style={{ color: 'var(--success)' }}>{formatBytes(result.afterAvailable)}</span></div>
          </div>
          <div className="card-sub" style={{ marginBottom: 8 }}>{result.killed.length} تطبيق أُغلق من الخلفية</div>
          <div className="chip-list">{result.killed.slice(0, 30).map((k) => <span key={k} className="app-tag">{k}</span>)}</div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Notice icon="info">
          يطلب من النظام إنهاء العمليات الخلفية للتطبيقات المستخدمة مؤخرًا؛ أندرويد الحديث يعيد تشغيل بعضها تلقائيًا، فالمكسب مؤقت لكنه مفيد قبل لعبة أو تسجيل فيديو.
          {!permissions.usageStats && <div><button className="btn btn-sm" onClick={() => Native.requestUsageStats()}>امنح إذن بيانات الاستخدام لاستهداف التطبيقات النشطة فقط</button></div>}
        </Notice>
      </div>
    </div>
  )
}
