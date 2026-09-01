import { useEffect, useState } from 'react'

const RADIUS = 70
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function healthTone(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--warning)'
  return 'var(--danger)'
}

export function healthTitle(score: number | null): string {
  if (score === null) return 'جارٍ تقييم جهازك…'
  if (score >= 90) return 'جهازك بحالة ممتازة'
  if (score >= 80) return 'جهازك بحالة جيدة'
  if (score >= 60) return 'جهازك يحتاج بعض العناية'
  return 'جهازك يحتاج تنظيفًا الآن'
}

/** حلقة متحرّكة تعرض درجة صحة الجهاز من 100. */
export function HealthRing({ score, caption }: { score: number | null; caption?: string }): JSX.Element {
  // نبدأ من صفر ثم ننتقل للقيمة الحقيقية لتلعب الحركة عند الظهور
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (score === null) {
      setShown(0)
      return
    }
    const timer = setTimeout(() => setShown(score), 60)
    return () => clearTimeout(timer)
  }, [score])

  const offset = CIRCUMFERENCE * (1 - shown / 100)
  const tone = score === null ? 'var(--text-faint)' : healthTone(score)

  return (
    <div className="health-ring" style={{ ['--tone' as string]: tone }}>
      <svg width="168" height="168" viewBox="0 0 168 168">
        <circle className="track" cx="84" cy="84" r={RADIUS} fill="none" strokeWidth="12" />
        <circle
          className="fill"
          cx="84"
          cy="84"
          r={RADIUS}
          fill="none"
          strokeWidth="12"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="center">
        {score === null ? (
          <div className="skeleton" style={{ width: 56, height: 36 }} />
        ) : (
          <div className="score" style={{ color: tone }}>
            {score}
          </div>
        )}
        <div className="caption">{caption ?? 'من 100'}</div>
      </div>
    </div>
  )
}
