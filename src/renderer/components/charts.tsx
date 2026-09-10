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
