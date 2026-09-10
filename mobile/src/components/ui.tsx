import { useEffect, useRef, useState } from 'react'
import type { ScanProgress } from '../lib/types'
import { t } from '../lib/i18n'
import { Icon, type IconName } from './Icon'

/* مكوّنات الواجهة المشتركة بنمط التصميم الجديد */

export function Check({ on }: { on: boolean }): JSX.Element {
  return (
    <span className={`check ${on ? 'on' : ''}`}>
      <Icon name="check" size={14} strokeWidth={3.2} />
    </span>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): JSX.Element {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} />
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
  confirmLabel,
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
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-dark'}`} onClick={onConfirm}>{confirmLabel ?? t('common.confirm')}</button>
      </div>
    </Sheet>
  )
}

export function InputSheet({ title, initialValue, confirmLabel, onConfirm, onCancel }: { title: string; initialValue: string; confirmLabel?: string; onConfirm: (v: string) => void; onCancel: () => void }): JSX.Element {
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
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn btn-dark" disabled={!value.trim()} onClick={() => onConfirm(value.trim())}>{confirmLabel ?? t('common.confirm')}</button>
      </div>
    </Sheet>
  )
}

export function ProgressPanel({ progress, label, onCancel }: { progress: ScanProgress | null; label?: string; onCancel?: () => void }): JSX.Element {
  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : null
  const headline =
    label ??
    (progress?.phase === 'hashing'
      ? `${t('common.scanning')} ${progress.processed}/${progress.total}`
      : progress?.phase === 'shredding'
        ? t('shred.progress', { i: progress.processed + 1, n: progress.total })
        : `${t('common.scanning')} ${(progress?.filesSeen ?? 0).toLocaleString('en-US')}`)
  return (
    <div className="card card-pad">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>{headline}</strong>
        <div className="spacer" />
        {onCancel && <button className="btn btn-sm" onClick={onCancel}>{t('common.stop')}</button>}
      </div>
      <div className={`bar warm ${pct === null ? 'indeterminate' : ''}`}>
        <div style={{ width: pct === null ? '40%' : `${pct}%` }} />
      </div>
      <div className="muted mono" style={{ marginTop: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{progress?.currentPath ?? ''}</div>
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

/** حلقة درجة الصحة بلون متدرّج حسب الدرجة. */
export function ScoreRing({ score, caption, color }: { score: number | null; caption: string; color: string }): JSX.Element {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (score === null) {
      setShown(0)
      return
    }
    const t2 = setTimeout(() => setShown(score), 80)
    return () => clearTimeout(t2)
  }, [score])
  const R = 56
  const C = 2 * Math.PI * R
  return (
    <div className="score-ring">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle className="track" cx="66" cy="66" r={R} fill="none" strokeWidth="11" />
        <circle className="fill" cx="66" cy="66" r={R} fill="none" strokeWidth="11" stroke={color} strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} />
      </svg>
      <div className="center">
        {score === null ? <div className="skeleton" style={{ width: 48, height: 34 }} /> : <div className="n" style={{ color }}>{score}</div>}
        <div className="l">{caption}</div>
      </div>
    </div>
  )
}

/** بطاقة عنصر في الشبكة — بنفس شكل شاشة العناصر في التصميم. */
export function ItemCard({
  selected,
  onToggle,
  tag,
  name,
  meta,
  pill,
  thumb,
  icon,
  tone,
  index = 0
}: {
  selected: boolean
  onToggle: () => void
  tag: string
  name: string
  meta: string
  pill?: string
  thumb?: string
  icon?: IconName
  tone?: string
  index?: number
}): JSX.Element {
  return (
    <div className={`item-card ${selected ? 'on' : ''}`} style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }} onClick={onToggle}>
      <div className="top">
        <Check on={selected} />
        <span className="tag">{tag}</span>
      </div>
      <div className="thumb">
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <Icon name={icon ?? 'file'} size={40} strokeWidth={1.4} className={tone} />}
      </div>
      <div className="name">{name}</div>
      <div className="meta">{meta}</div>
      {pill && <span className="pill-green">{pill}</span>}
    </div>
  )
}
