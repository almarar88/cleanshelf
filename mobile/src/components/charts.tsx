import { useEffect, useState } from 'react'

export interface Segment {
  key: string
  label: string
  value: number
  color: string
}

/** حلقة مجزّأة بنِسب — تُرسم بحركة عند الظهور. */
export function Donut({ segments, size = 150, stroke = 26, center, caption }: { segments: Segment[]; size?: number; stroke?: number; center: string; caption: string }): JSX.Element {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60)
    return () => clearTimeout(t)
  }, [])

  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1
  let offset = 0

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((seg) => {
          const frac = Math.max(0, seg.value) / total
          const len = ready ? frac * c : 0
          const el = (
            <circle
              key={seg.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          )
          if (ready) offset += frac * c
          return el
        })}
      </svg>
      <div className="center">
        <div className="v">{center}</div>
        <div className="u">{caption}</div>
      </div>
    </div>
  )
}

export function Legend({ segments, format }: { segments: Segment[]; format: (n: number) => string }): JSX.Element {
  return (
    <div className="legend">
      {segments.map((s) => (
        <div className="row" key={s.key} style={{ padding: 0, minHeight: 0, border: 'none', animation: 'none' }}>
          <span className="dot" style={{ background: s.color }} />
          {s.label}
          <span className="val">{format(s.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** أعمدة أسبوعية بسيطة مع تظليل الأعلى. */
export function WeekBars({ data, format }: { data: { label: string; value: number }[]; format: (n: number) => string }): JSX.Element {
  const max = Math.max(...data.map((d) => d.value), 1)
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0)
  return (
    <>
      <div className="week-bars">
        {data.map((d, i) => (
          <div className={`col ${i === peak && d.value > 0 ? 'peak' : ''}`} key={i} title={format(d.value)}>
            <b style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, animationDelay: `${i * 45}ms` }} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/** رسم المسار المنقّط مع علامة — يحاكي مخطط "الوصول المتأخر" في التصميم. */
export function RouteChart(): JSX.Element {
  return (
    <div className="route">
      <svg viewBox="0 0 340 128" aria-hidden="true">
        <defs>
          <linearGradient id="blob1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FBD9B0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#F8B98A" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="96" rx="58" ry="20" fill="url(#blob1)" opacity="0.5" />
        <ellipse cx="196" cy="104" rx="74" ry="22" fill="url(#blob1)" opacity="0.65" />
        <ellipse cx="300" cy="70" rx="42" ry="16" fill="url(#blob1)" opacity="0.45" />
        <path className="path" d="M24 78 C 90 20, 150 118, 214 74 S 300 26, 320 40" />
        <circle cx="24" cy="78" r="7" fill="#F5E14C" stroke="#121212" strokeWidth="2.5" />
        <circle cx="214" cy="74" r="5" fill="#121212" />
        <circle cx="320" cy="40" r="9" fill="#F5E14C" />
        <circle cx="320" cy="40" r="3.4" fill="#121212" />
      </svg>
    </div>
  )
}
