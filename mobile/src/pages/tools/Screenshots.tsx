import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { t } from '../../lib/i18n'
import { fmtNum, formatBytes, formatShortDate } from '../../lib/format'
import { markTaskDone } from '../../lib/plan'
import { tap, success } from '../../lib/haptics'
import type { ScanProgress, ScreenshotItem } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, ProgressPanel, Sheet } from '../../components/ui'
import { PermissionGate } from '../../components/PermissionGate'

const RANGES = [7, 30, 90, 0]

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
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
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
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })
  }

  async function trash(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    success()
    markTaskDone('shots')
    showToast(t('shots.moved', { n: fmtNum(r.results.filter((x) => x.success).length) }))
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />

      <div className="pill-row">
        {RANGES.map((d) => (
          <button key={d} className={`pill sm ${days === d ? 'active' : ''}`} onClick={() => { tap(); setDays(d); scan(d) }}>
            {d === 0 ? t('common.all') : d === 7 ? t('shots.older7') : t('shots.older', { n: fmtNum(d) })}
          </button>
        ))}
      </div>

      {items && items.length > 0 && (
        <div className="toolbar" style={{ margin: '12px 0' }}>
          <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>{t('shots.count', { n: fmtNum(items.length), size: formatBytes(total) })}</span>
          <div className="spacer" />
          <button className="btn btn-sm" onClick={() => { tap(); setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.path))) }}>
            {selected.size === items.length ? t('common.clearAll') : t('common.selectAll')}
          </button>
        </div>
      )}

      {scanning ? (
        <ProgressPanel progress={progress} label={t('shots.preparing')} onCancel={() => Native.cancelScan()} />
      ) : !items ? (
        <EmptyState icon="image" tone="tone-violet" text={t('shots.empty')} />
      ) : items.length === 0 ? (
        <EmptyState icon="checkCircle" tone="tone-green" text={t('shots.none')} />
      ) : (
        <div className="gallery">
          {items.map((it, i) => (
            <div
              key={it.path}
              className={`shot ${selected.has(it.path) ? 'on' : ''}`}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              onClick={() => toggle(it.path)}
              onContextMenu={(e) => { e.preventDefault(); setPreview(it) }}
            >
              {it.thumb
                ? <img src={`data:image/jpeg;base64,${it.thumb}`} alt="" loading="lazy" />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Icon name="play" size={26} className="muted" /></div>}
              <Check on={selected.has(it.path)} />
              <div className="meta">
                <span>{formatBytes(it.sizeBytes, true)}</span>
                <span>{formatShortDate(it.modifiedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && !scanning && (
        <div className="action-bar no-tabs">
          <button className="btn btn-dark" onClick={() => { tap(); setConfirm(true) }}>
            <Icon name="trash" size={17} /> {t('shots.deleteBtn', { n: fmtNum(selected.size), size: formatBytes(selBytes) })}
          </button>
        </div>
      )}

      {confirm && (
        <ConfirmSheet
          title={t('page.screenshots')}
          message={t('shots.confirm', { n: fmtNum(selected.size), size: formatBytes(selBytes) })}
          confirmLabel={t('common.moveToTrash')}
          onConfirm={trash}
          onCancel={() => setConfirm(false)}
        />
      )}
      {preview && (
        <Sheet onClose={() => setPreview(null)}>
          <img src={`data:image/jpeg;base64,${preview.thumb}`} alt="" style={{ width: '100%', borderRadius: 16, maxHeight: '60vh', objectFit: 'contain', background: 'var(--surface-2)' }} />
          <p style={{ marginTop: 10 }}>{preview.name} • {formatBytes(preview.sizeBytes)}</p>
        </Sheet>
      )}
    </div>
  )
}
