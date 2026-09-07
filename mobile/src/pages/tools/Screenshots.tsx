import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useToast } from '../../lib/toastContext'
import { formatBytes } from '../../lib/format'
import type { ScanProgress, ScreenshotItem } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, ProgressPanel, Sheet } from '../../components/ui'
import { PermissionGate } from '../../components/PermissionGate'
import { useApp } from '../../lib/appContext'
import { tap, success } from '../../lib/haptics'

export function Screenshots(): JSX.Element {
  const { permissions } = useApp()
  const { showToast } = useToast()
  const [days, setDays] = useState(30)
  const [items, setItems] = useState<ScreenshotItem[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const [preview, setPreview] = useState<ScreenshotItem | null>(null)

  useEffect(() => {
    const h = Native.addListener('scanProgress', setProgress)
    return () => {
      h.then((x) => x.remove())
    }
  }, [])

  async function scan(withDays = days): Promise<void> {
    setScanning(true)
    setSelected(new Set())
    try {
      const r = await Native.screenshots({ days: withDays })
      setItems(r.items)
    } catch (err) {
      showToast('فشل الفحص: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (permissions.allFiles && !items && !scanning) scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.allFiles])

  const selBytes = (items ?? []).filter((i) => selected.has(i.path)).reduce((s, i) => s + i.sizeBytes, 0)
  const total = (items ?? []).reduce((s, i) => s + i.sizeBytes, 0)

  function toggle(p: string): void {
    tap()
    setSelected((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })
  }

  async function trash(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    success()
    showToast(`نُقلت ${r.results.filter((x) => x.success).length} لقطة إلى سلة المهملات`)
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <div className="toolbar">
        <div className="segmented" style={{ flex: 1 }}>
          {[7, 30, 90, 0].map((d) => <button key={d} className={days === d ? 'active' : ''} onClick={() => { setDays(d); scan(d) }}>{d === 0 ? 'الكل' : d === 7 ? '7 أيام' : `${d} يومًا`}</button>)}
        </div>
      </div>
      {items && items.length > 0 && (
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>{items.length} لقطة • {formatBytes(total)}</span>
          <div className="spacer" />
          <button className="btn btn-sm" onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.path)))}>{selected.size === items.length ? 'إلغاء الكل' : 'تحديد الكل'}</button>
        </div>
      )}
      {scanning ? <ProgressPanel progress={progress} label="جارٍ تجهيز المصغّرات…" onCancel={() => Native.cancelScan()} /> : !items ? <EmptyState icon="image" tone="tone-violet" text="لقطات الشاشة تتراكم بصمت — راجعها واحذف ما انتهت حاجتك منه" /> : items.length === 0 ? <EmptyState icon="checkCircle" tone="tone-green" text="لا لقطات شاشة بهذا العمر" /> : (
        <div className="gallery">
          {items.map((it, i) => (
            <div key={it.path} className={`shot ${selected.has(it.path) ? 'selected' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }} onClick={() => toggle(it.path)} onContextMenu={(e) => { e.preventDefault(); setPreview(it) }}>
              {it.thumb ? <img src={`data:image/jpeg;base64,${it.thumb}`} alt="" loading="lazy" /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Icon name="play" size={26} className="muted" /></div>}
              <Check on={selected.has(it.path)} />
              <div className="meta"><span>{formatBytes(it.sizeBytes)}</span><span>{new Date(it.modifiedAt).toLocaleDateString('ar', { month: 'short', day: 'numeric' })}</span></div>
            </div>
          ))}
        </div>
      )}
      {selected.size > 0 && !scanning && (
        <div className="action-bar no-tabs">
          <button className="btn btn-danger" onClick={() => setConfirm(true)}><Icon name="trash" size={16} /> حذف {selected.size} لقطة ({formatBytes(selBytes)})</button>
        </div>
      )}
      {confirm && <ConfirmSheet title="حذف لقطات الشاشة" message={`ستُنقل ${selected.size} لقطة (${formatBytes(selBytes)}) إلى سلة مهملات CleanShelf ويمكن استرجاعها.`} confirmLabel="نقل" onConfirm={trash} onCancel={() => setConfirm(false)} />}
      {preview && (
        <Sheet onClose={() => setPreview(null)}>
          <img src={`data:image/jpeg;base64,${preview.thumb}`} alt="" style={{ width: '100%', borderRadius: 14, maxHeight: '60vh', objectFit: 'contain', background: 'var(--bg-sunken)' }} />
          <p style={{ marginTop: 10 }}>{preview.name} • {formatBytes(preview.sizeBytes)}</p>
        </Sheet>
      )}
    </div>
  )
}
