import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { useCountUp } from './CountUp'
import { formatBytes } from '../lib/format'
import { t } from '../lib/i18n'

const COLORS = ['#f5e14c', '#fc8b4f', '#121212', '#c8ec71', '#8fd7f5', '#f8b4d0']

/** شاشة التنظيف: حلقات دوّارة أثناء العمل، ثم عدّاد للمساحة المحرَّرة وقصاصات احتفال. */
export function CleanOverlay({ phase, freedBytes, label, onClose }: { phase: 'working' | 'done'; freedBytes: number; label: string; onClose: () => void }): JSX.Element {
  const shown = useCountUp(phase === 'done' ? freedBytes : 0, 1400)
  const [closing, setClosing] = useState(false)
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        color: COLORS[i % COLORS.length],
        dx: `${Math.round((Math.random() - 0.5) * 360)}px`,
        dy: `${Math.round(-120 - Math.random() * 320)}px`,
        rot: `${Math.round((Math.random() - 0.5) * 720)}deg`,
        delay: `${(i % 6) * 40}ms`
      })),
    []
  )

  useEffect(() => {
    if (phase !== 'done') return
    const timer = setTimeout(() => setClosing(true), 3200)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (closing) onClose()
  }, [closing, onClose])

  return (
    <div className="clean-overlay" onClick={() => phase === 'done' && setClosing(true)}>
      {phase === 'done' && (
        <div className="confetti">
          {pieces.map((p, i) => (
            <i key={i} style={{ background: p.color, ['--dx' as string]: p.dx, ['--dy' as string]: p.dy, ['--rot' as string]: p.rot, animationDelay: p.delay }} />
          ))}
        </div>
      )}
      <div className={`orb ${phase === 'done' ? 'done' : ''}`}>
        <div className="ring" />
        <div className="ring r2" />
        <div className="ring r3" />
        <div className="core"><Icon name={phase === 'done' ? 'check' : 'sparkles'} size={40} strokeWidth={2.2} /></div>
      </div>
      {phase === 'working' ? (
        <>
          <h2>{label}</h2>
          <div className="muted">{t('clean.dontClose')}</div>
        </>
      ) : (
        <>
          <div className="big">{formatBytes(shown)}</div>
          <h2>{t('clean.freedTitle')}</h2>
          <div className="muted">{t('clean.tapToContinue')}</div>
        </>
      )}
    </div>
  )
}
