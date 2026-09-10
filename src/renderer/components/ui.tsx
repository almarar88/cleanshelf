import { useEffect, useState } from 'react'
import { Icon, type IconName } from './Icon'

/* مكوّنات الواجهة المشتركة بنمط التصميم الجديد */

export function Check({ on }: { on: boolean }): JSX.Element {
  return (
    <span className={`check ${on ? 'on' : ''}`}>
      <Icon name="check" size={14} strokeWidth={3.2} />
    </span>
  )
}

export function Ico({ name, tone, size = 'md' }: { name: IconName; tone?: string; size?: 'sm' | 'md' | 'lg' }): JSX.Element {
  return (
    <span className={`ico ${size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : ''} ${tone ?? 'tone-ink'}`}>
      <Icon name={name} size={size === 'sm' ? 16 : size === 'lg' ? 26 : 19} />
    </span>
  )
}

export function EmptyState({ icon, tone, text, action }: { icon: IconName; tone?: string; text: string; action?: React.ReactNode }): JSX.Element {
  return (
    <div className="empty">
      <Ico name={icon} tone={tone} size="lg" />
      <div>{text}</div>
      {action}
    </div>
  )
}

export function Notice({ kind = 'info', icon, children }: { kind?: 'info' | 'warn'; icon?: IconName; children: React.ReactNode }): JSX.Element {
  return (
    <div className={`notice ${kind === 'warn' ? 'notice-warn' : ''}`}>
      <Icon name={icon ?? (kind === 'warn' ? 'alert' : 'info')} size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}

/** حلقة درجة الصحة بلون متدرّج حسب الدرجة. */
export function ScoreRing({ score, caption, color, size = 150 }: { score: number | null; caption: string; color: string; size?: number }): JSX.Element {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (score === null) {
      setShown(0)
      return
    }
    const timer = setTimeout(() => setShown(score), 80)
    return () => clearTimeout(timer)
  }, [score])

  const stroke = Math.round(size * 0.085)
  const r = (size - stroke) / 2 - 2
  const c = 2 * Math.PI * r
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
        />
      </svg>
      <div className="center">
        {score === null ? <div className="skeleton" style={{ width: 52, height: 36 }} /> : <div className="n" style={{ color }}>{score}</div>}
        <div className="l">{caption}</div>
      </div>
    </div>
  )
}

export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-faint)'
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--warning)'
  return 'var(--danger)'
}

/** بطاقة أداة في الشبكة مع نجمة تثبيت. */
export function ToolCard({
  icon,
  tone,
  title,
  sub,
  index = 0,
  pinned,
  onPin,
  onOpen
}: {
  icon: IconName
  tone?: string
  title: string
  sub: string
  index?: number
  pinned?: boolean
  onPin?: () => void
  onOpen: () => void
}): JSX.Element {
  return (
    <div className="item-card" style={{ animationDelay: `${Math.min(index, 12) * 32}ms` }} onClick={onOpen}>
      <div className="top">
        <Ico name={icon} tone={tone} size="sm" />
        {onPin && (
          <button
            className={`star ${pinned ? 'on' : ''}`}
            style={{ marginInlineStart: 'auto' }}
            onClick={(e) => {
              e.stopPropagation()
              onPin()
            }}
            aria-label={title}
          >
            <Icon name="star" size={17} strokeWidth={pinned ? 2.4 : 1.8} />
          </button>
        )}
      </div>
      <div className="name" style={{ marginTop: 4 }}>{title}</div>
      <div className="card-sub" style={{ whiteSpace: 'normal' }}>{sub}</div>
    </div>
  )
}
