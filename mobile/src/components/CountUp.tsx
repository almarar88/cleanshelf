import { useEffect, useRef, useState } from 'react'

/** يعدّ الرقم صعودًا من آخر قيمة إلى الجديدة خلال زمن قصير — يجعل الأرقام تبدو حيّة. */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (target - from) * eased
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

export function CountUp({ value, format }: { value: number; format: (n: number) => string }): JSX.Element {
  const v = useCountUp(value)
  return <>{format(v)}</>
}
