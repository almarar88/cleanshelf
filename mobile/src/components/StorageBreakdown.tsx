import type { MediaStats } from '../lib/types'
import { formatBytes } from '../lib/format'
import type { TrendPoint } from '../lib/trend'

const SEGMENTS: { key: keyof MediaStats; label: string; color: string }[] = [
  { key: 'imagesBytes', label: 'الصور', color: '#ec4899' },
  { key: 'videosBytes', label: 'الفيديو', color: '#8b5cf6' },
  { key: 'audioBytes', label: 'الصوتيات', color: '#06b6d4' },
  { key: 'appsBytes', label: 'التطبيقات', color: '#f97316' }
]

export function StorageBreakdown({ stats }: { stats: MediaStats }): JSX.Element {
  const known = SEGMENTS.reduce((s, seg) => s + (stats[seg.key] as number), 0)
  const used = Math.max(0, stats.totalBytes - stats.freeBytes)
  const other = Math.max(0, used - known)
  const total = stats.totalBytes || 1
  const parts = [...SEGMENTS.map((seg) => ({ label: seg.label, color: seg.color, bytes: stats[seg.key] as number })), { label: 'أخرى', color: 'var(--text-faint)', bytes: other }]
  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div className="card-title">تفصيل التخزين</div>
        <div className="card-sub">{formatBytes(stats.freeBytes)} متاحة</div>
      </div>
      <div className="storage-bar" aria-label="توزيع التخزين">
        {parts.filter((p) => p.bytes > 0).map((p) => <span key={p.label} style={{ flexBasis: `${(p.bytes / total) * 100}%`, background: p.color }} title={p.label} />)}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <div key={p.label}><span className="dot" style={{ background: p.color }} />{p.label}<span className="val">{p.bytes > 0 ? formatBytes(p.bytes) : '—'}</span></div>
        ))}
      </div>
    </div>
  )
}

export function Sparkline({ points }: { points: TrendPoint[] }): JSX.Element | null {
  if (points.length < 2) return null
  const w = 300
  const h = 56
  const min = Math.min(...points.map((p) => p.free))
  const max = Math.max(...points.map((p) => p.free))
  const span = Math.max(1, max - min)
  const xs = points.map((_, i) => (i / (points.length - 1)) * w)
  const ys = points.map((p) => h - 6 - ((p.free - min) / span) * (h - 12))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const delta = points[points.length - 1].free - points[0].free
  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div className="card-title">اتجاه المساحة المتاحة</div>
        <span className={`badge ${delta >= 0 ? 'badge-safe' : 'badge-caution'}`}>{delta >= 0 ? '+' : '−'}{formatBytes(Math.abs(delta))}</span>
      </div>
      <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path className="area" d={area} />
        <path className="line" d={line} />
      </svg>
      <div className="card-sub">{points.length} يومًا من القياسات — تُسجَّل نقطة عند كل فتح</div>
    </div>
  )
}
