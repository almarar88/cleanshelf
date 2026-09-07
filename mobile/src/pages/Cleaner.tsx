import { useEffect, useMemo, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { formatBytes } from '../lib/format'
import { junkLabel } from '../lib/labels'
import type { JunkScan, ScanProgress } from '../lib/types'
import { Icon } from '../components/Icon'
import { Check, ConfirmSheet, ProgressPanel } from '../components/ui'
import { PermissionGate } from '../components/PermissionGate'

export function Cleaner(): JSX.Element {
  const { permissions, settings } = useApp()
  const { showToast } = useToast()
  const [scan, setScan] = useState<JunkScan | null>(null)
  const [scanning, setScanning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const handle = Native.addListener('scanProgress', setProgress)
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  async function runScan(): Promise<void> {
    setScanning(true)
    setProgress(null)
    try {
      const result = await Native.scanJunk()
      setScan(result)
      setSelected(new Set(result.categories.filter((c) => c.risk === 'safe' && (c.sizeBytes > 0 || c.fileCount > 0)).map((c) => c.id)))
    } catch (err) {
      showToast('فشل الفحص: ' + (err as Error).message)
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  useEffect(() => {
    if (permissions.allFiles && !scan && !scanning) runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.allFiles])

  const selectedBytes = useMemo(() => (scan ? scan.categories.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.sizeBytes, 0) : 0), [scan, selected])
  const hasCaution = scan?.categories.some((c) => selected.has(c.id) && c.risk === 'caution') ?? false

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function clean(): Promise<void> {
    setConfirm(false)
    setCleaning(true)
    try {
      const r = await Native.cleanJunk({ categoryIds: [...selected] })
      showToast(`تم تحرير ${formatBytes(r.freedBytes)} (${r.deleted} عنصر)`)
      if (settings.notifications) Native.notify({ title: 'اكتمل التنظيف', body: `تم تحرير ${formatBytes(r.freedBytes)}` }).catch(() => undefined)
      await runScan()
    } catch (err) {
      showToast('فشل التنظيف: ' + (err as Error).message)
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="page">
      <PermissionGate />

      {scan && (
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="tile-icon"><Icon name="sparkles" size={20} /></div>
          <div style={{ flex: 1 }}>
            <div className="card-title">{formatBytes(scan.totalBytes)} قابلة للتنظيف</div>
            <div className="card-sub">{scan.scannedFiles.toLocaleString('ar')} ملف فُحص • محدَّد {formatBytes(selectedBytes)}</div>
          </div>
          <button className="icon-btn raised" onClick={runScan} disabled={scanning || cleaning} aria-label="إعادة الفحص"><Icon name="refresh" size={17} /></button>
        </div>
      )}

      {scanning ? (
        <div style={{ marginTop: 14 }}><ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /></div>
      ) : scan ? (
        <>
          <div className="section-title">آمن للحذف</div>
          <div className="card">
            {scan.categories.filter((c) => c.risk === 'safe').map((c) => <Row key={c.id} c={c} on={selected.has(c.id)} onToggle={() => toggle(c.id)} expanded={expanded === c.id} onExpand={() => setExpanded(expanded === c.id ? null : c.id)} disabled={cleaning} />)}
          </div>
          <div className="section-title">راجع قبل الحذف</div>
          <div className="card">
            {scan.categories.filter((c) => c.risk === 'caution').map((c) => <Row key={c.id} c={c} on={selected.has(c.id)} onToggle={() => toggle(c.id)} expanded={expanded === c.id} onExpand={() => setExpanded(expanded === c.id ? null : c.id)} disabled={cleaning} />)}
          </div>
        </>
      ) : (
        !permissions.allFiles ? null : (
          <div className="empty-state">
            <div className="tile-icon"><Icon name="sparkles" size={28} /></div>
            <div>اضغط "فحص" للبحث عن الملفات غير الضرورية</div>
            <button className="btn btn-primary" onClick={runScan}>فحص</button>
          </div>
        )
      )}

      {scan && !scanning && (
        <div className="action-bar">
          <button className="btn btn-primary" disabled={selected.size === 0 || cleaning} onClick={() => setConfirm(true)}>
            <Icon name="trash" size={16} /> {cleaning ? 'جارٍ التنظيف…' : `تنظيف ${formatBytes(selectedBytes)}`}
          </button>
        </div>
      )}

      {confirm && (
        <ConfirmSheet title="تأكيد التنظيف" message={`سيُحذف ${formatBytes(selectedBytes)} من ${selected.size} فئة نهائيًا. هذه الملفات تُعاد تلقائيًا عند الحاجة ولا تُنقل إلى سلة المهملات.`} confirmLabel="تنظيف الآن" danger={hasCaution} onConfirm={clean} onCancel={() => setConfirm(false)}>
          {hasCaution && (
            <div className="notice notice-warn" style={{ marginBottom: 0 }}>
              <Icon name="alert" size={16} />
              <div>اخترت فئات "راجع قبل الحذف" — تأكد أنك لا تحتاج محتواها.</div>
            </div>
          )}
        </ConfirmSheet>
      )}
    </div>
  )
}

function Row({ c, on, onToggle, expanded, onExpand, disabled }: { c: JunkScan['categories'][number]; on: boolean; onToggle: () => void; expanded: boolean; onExpand: () => void; disabled: boolean }): JSX.Element {
  const label = junkLabel(c.id)
  const empty = c.sizeBytes === 0 && c.fileCount === 0
  return (
    <div>
      <div className={`row ${on ? 'selected' : ''}`} style={{ opacity: empty ? 0.55 : 1 }} onClick={() => !disabled && !empty && onToggle()}>
        <Check on={on} />
        <div className={`tile-icon sm ${c.risk === 'caution' ? 'tone-amber' : ''}`}><Icon name={label.icon} size={17} /></div>
        <div className="text">
          <div className="title">{label.title}</div>
          <div className="desc">{empty ? 'لا شيء' : `${c.fileCount.toLocaleString('ar')} عنصر`} • {label.desc}</div>
        </div>
        <span className="trail">{formatBytes(c.sizeBytes)}</span>
        {c.samples.length > 0 && (
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={(e) => { e.stopPropagation(); onExpand() }} aria-label="تفاصيل">
            <Icon name="chevron" size={15} style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(-90deg)' }} />
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ padding: '4px 14px 12px 60px' }}>
          {c.samples.map((s) => <div key={s} className="muted mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</div>)}
        </div>
      )}
    </div>
  )
}
