import { useEffect, useRef, useState } from 'react'
import type { ScanProgress } from '../lib/types'
import { Icon, type IconName } from './Icon'

/* مكوّنات واجهة صغيرة مشتركة بين الصفحات */

export function Check({ on }: { on: boolean }): JSX.Element {
  return (
    <span className={`check ${on ? 'on' : ''}`}>
      <Icon name="check" size={14} strokeWidth={3} />
    </span>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): JSX.Element {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} />
}

export function EmptyState({ icon, tone, text }: { icon: IconName; tone?: string; text: string }): JSX.Element {
  return (
    <div className="empty-state">
      <div className={`tile-icon ${tone ?? ''}`}>
        <Icon name={icon} size={28} />
      </div>
      <div>{text}</div>
    </div>
  )
}

export function Notice({ kind = 'info', icon, children }: { kind?: 'info' | 'warn'; icon?: IconName; children: React.ReactNode }): JSX.Element {
  return (
    <div className={`notice notice-${kind}`}>
      <Icon name={icon ?? (kind === 'warn' ? 'alert' : 'info')} size={17} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

/** ورقة سفلية — بديل النوافذ المنبثقة على الهاتف */
export function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function ConfirmSheet({
  title,
  message,
  confirmLabel = 'تأكيد',
  danger,
  onConfirm,
  onCancel,
  children
}: {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}): JSX.Element {
  return (
    <Sheet onClose={onCancel}>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {children}
      <div className="actions">
        <button className="btn" onClick={onCancel}>إلغاء</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Sheet>
  )
}

export function InputSheet({ title, initialValue, confirmLabel = 'تأكيد', onConfirm, onCancel }: { title: string; initialValue: string; confirmLabel?: string; onConfirm: (v: string) => void; onCancel: () => void }): JSX.Element {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <Sheet onClose={onCancel}>
      <h3>{title}</h3>
      <input ref={ref} type="text" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && value.trim() && onConfirm(value.trim())} />
      <div className="actions">
        <button className="btn" onClick={onCancel}>إلغاء</button>
        <button className="btn btn-primary" disabled={!value.trim()} onClick={() => onConfirm(value.trim())}>{confirmLabel}</button>
      </div>
    </Sheet>
  )
}

export function ProgressPanel({ progress, label, onCancel }: { progress: ScanProgress | null; label?: string; onCancel?: () => void }): JSX.Element {
  const percent = progress && progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : null
  return (
    <div className="card card-pad">
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>
          {label ??
            (progress?.phase === 'hashing'
              ? `مقارنة المحتوى… ${progress.processed} من ${progress.total}`
              : progress?.phase === 'shredding'
                ? `تمزيق… ${progress.processed + 1} من ${progress.total}`
                : `جارٍ الفحص… ${(progress?.filesSeen ?? 0).toLocaleString('ar')} ملف`)}
        </strong>
        <div className="spacer" />
        {onCancel && <button className="btn btn-sm" onClick={onCancel}>إيقاف</button>}
      </div>
      <div className={`progress-bar ${percent === null ? 'indeterminate' : ''}`}>
        <div style={{ width: percent === null ? '100%' : `${percent}%` }} />
      </div>
      <div className="muted mono" style={{ marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{progress?.currentPath ?? ''}</div>
    </div>
  )
}

export function fileIcon(isDirectory: boolean, ext: string): IconName {
  if (isDirectory) return 'folder'
  const e = ext.toLowerCase()
  if (['mp3', 'flac', 'wav', 'm4a', 'ogg', 'aac', 'opus'].includes(e)) return 'music'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(e)) return 'image'
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(e)) return 'archive'
  if (['apk', 'apks', 'xapk'].includes(e)) return 'package'
  if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(e)) return 'play'
  if (['pdf', 'doc', 'docx', 'txt', 'xlsx', 'pptx'].includes(e)) return 'fileText'
  return 'file'
}

const RADIUS = 62
const CIRC = 2 * Math.PI * RADIUS

export function healthTone(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 60) return 'var(--warning)'
  return 'var(--danger)'
}

export function HealthRing({ score, caption }: { score: number | null; caption?: string }): JSX.Element {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (score === null) {
      setShown(0)
      return
    }
    const t = setTimeout(() => setShown(score), 60)
    return () => clearTimeout(t)
  }, [score])
  const tone = score === null ? 'var(--text-faint)' : healthTone(score)
  return (
    <div className="health-ring" style={{ ['--tone' as string]: tone }}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle className="track" cx="75" cy="75" r={RADIUS} fill="none" strokeWidth="11" />
        <circle className="fill" cx="75" cy="75" r={RADIUS} fill="none" strokeWidth="11" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - shown / 100)} />
      </svg>
      <div className="center">
        {score === null ? <div className="skeleton" style={{ width: 52, height: 34 }} /> : <div className="score" style={{ color: tone }}>{score}</div>}
        <div className="caption">{caption ?? 'من 100'}</div>
      </div>
    </div>
  )
}

export function useScanProgress(): [ScanProgress | null, (p: ScanProgress | null) => void] {
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  return [progress, setProgress]
}
