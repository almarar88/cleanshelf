import { useCallback, useEffect, useMemo, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { t } from '../lib/i18n'
import { fmtNum, formatBytes, splitBytes } from '../lib/format'
import { junkLabel } from '../lib/labels'
import { markTaskDone } from '../lib/plan'
import { tap, thud, success } from '../lib/haptics'
import type { JunkCategory, JunkScan, ScanProgress } from '../lib/types'
import { Icon } from '../components/Icon'
import { Check, ConfirmSheet, EmptyState, Ico, ProgressPanel } from '../components/ui'
import { PermissionGate } from '../components/PermissionGate'
import { CleanOverlay } from '../components/CleanOverlay'

export function Cleaner(): JSX.Element {
  const { permissions, settings } = useApp()
  const { showToast } = useToast()
  const [scan, setScan] = useState<JunkScan | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<{ phase: 'working' | 'done'; freed: number } | null>(null)

  useEffect(() => {
    const handle = Native.addListener('scanProgress', setProgress)
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  const runScan = useCallback(async () => {
    setScanning(true)
    setProgress(null)
    try {
      const result = await Native.scanJunk()
      setScan(result)
      setSelected(new Set(result.categories.filter((c) => c.risk === 'safe' && (c.sizeBytes > 0 || c.fileCount > 0)).map((c) => c.id)))
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }, [showToast])

  useEffect(() => {
    if (permissions.allFiles && !scan && !scanning) runScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.allFiles])

  const selectedBytes = useMemo(() => (scan ? scan.categories.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.sizeBytes, 0) : 0), [scan, selected])
  const hasCaution = scan?.categories.some((c) => selected.has(c.id) && c.risk === 'caution') ?? false
  const total = scan ? splitBytes(scan.totalBytes) : null

  function toggle(id: string): void {
    tap()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function clean(): Promise<void> {
    setConfirm(false)
    thud()
    setOverlay({ phase: 'working', freed: 0 })
    try {
      const r = await Native.cleanJunk({ categoryIds: [...selected] })
      setOverlay({ phase: 'done', freed: r.freedBytes })
      success()
      markTaskDone('junk')
      if (settings.notifications) Native.notify({ title: t('clean.notifTitle'), body: t('clean.notifBody', { size: formatBytes(r.freedBytes) }) }).catch(() => undefined)
      await runScan()
    } catch (err) {
      setOverlay(null)
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    }
  }

  const safe = scan?.categories.filter((c) => c.risk === 'safe') ?? []
  const caution = scan?.categories.filter((c) => c.risk === 'caution') ?? []

  return (
    <div className="page">
      <PermissionGate />

      {scan && !scanning && (
        <section className="tile yellow">
          <div className="tile-head">
            <h3>{t('clean.title')}</h3>
            <button className="tile-btn" onClick={() => { tap(); runScan() }} aria-label={t('common.rescan')}><Icon name="refresh" size={17} /></button>
          </div>
          <div className="display sm">
            {total?.value}
            <small>{total?.unit}</small>
          </div>
          <div className="stat-steps flat">
            <div className="step"><span className="n">{fmtNum(scan.categories.filter((c) => c.sizeBytes > 0 || c.fileCount > 0).length)}</span><span className="l">{t('report.category')}</span></div>
            <div className="step"><span className="n">{fmtNum(scan.scannedFiles)}</span><span className="l">{t('common.files')}</span></div>
            <div className="step"><span className="n">{fmtNum(selected.size)}</span><span className="l">{t('common.selected')}</span></div>
          </div>
          <div className="deco-row">
            <span className="deco dots" />
            <span className="deco hatch" />
            <span className="bars">
              {[30, 48, 38, 62, 54, 74, 66, 90].map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }} />
              ))}
            </span>
          </div>
        </section>
      )}

      {scanning ? (
        <div style={{ marginTop: 14 }}>
          <ProgressPanel progress={progress} onCancel={() => { Native.cancelScan(); showToast(t('toast.stopped')) }} />
        </div>
      ) : scan ? (
        <>
          {safe.length > 0 && (
            <>
              <div className="section-title">{t('clean.safeGroup')}</div>
              <div className="card">
                {safe.map((c, i) => (
                  <Row key={c.id} c={c} index={i} on={selected.has(c.id)} onToggle={() => toggle(c.id)} expanded={expanded === c.id} onExpand={() => setExpanded(expanded === c.id ? null : c.id)} />
                ))}
              </div>
            </>
          )}
          {caution.length > 0 && (
            <>
              <div className="section-title">{t('clean.reviewGroup')}</div>
              <div className="card">
                {caution.map((c, i) => (
                  <Row key={c.id} c={c} index={i} on={selected.has(c.id)} onToggle={() => toggle(c.id)} expanded={expanded === c.id} onExpand={() => setExpanded(expanded === c.id ? null : c.id)} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        permissions.allFiles && (
          <div style={{ marginTop: 20 }}>
            <EmptyState
              icon="sparkles"
              tone="tone-yellow"
              text={t('clean.empty')}
              action={<button className="btn btn-dark" onClick={runScan}><Icon name="search" size={17} /> {t('common.scan')}</button>}
            />
          </div>
        )
      )}

      {scan && !scanning && (
        <div className="action-bar">
          <button className="btn btn-dark" disabled={selected.size === 0 || !!overlay} onClick={() => { tap(); setConfirm(true) }}>
            <Icon name="sparkles" size={18} /> {t('clean.cleanBtn', { size: formatBytes(selectedBytes) })}
          </button>
        </div>
      )}

      {confirm && (
        <ConfirmSheet
          title={t('clean.confirm.title')}
          message={t('clean.confirm.msg', { size: formatBytes(selectedBytes), n: fmtNum(selected.size) })}
          confirmLabel={t('clean.cleanBtn', { size: formatBytes(selectedBytes) })}
          danger={hasCaution}
          onConfirm={clean}
          onCancel={() => setConfirm(false)}
        >
          {hasCaution && (
            <div className="notice notice-warn" style={{ marginBottom: 0 }}>
              <Icon name="alert" size={18} />
              <div>{t('clean.confirm.caution')}</div>
            </div>
          )}
        </ConfirmSheet>
      )}

      {overlay && <CleanOverlay phase={overlay.phase} freedBytes={overlay.freed} label={t('clean.working')} onClose={() => setOverlay(null)} />}
    </div>
  )
}

function Row({ c, on, index, onToggle, expanded, onExpand }: { c: JunkCategory; on: boolean; index: number; onToggle: () => void; expanded: boolean; onExpand: () => void }): JSX.Element {
  const label = junkLabel(c.id)
  const empty = c.sizeBytes === 0 && c.fileCount === 0
  return (
    <div>
      <div className={`row ${on ? 'on' : ''}`} style={{ opacity: empty ? 0.5 : 1, animationDelay: `${Math.min(index, 8) * 35}ms` }} onClick={() => !empty && onToggle()}>
        <Check on={on} />
        <Ico name={label.icon} tone={label.tone} size="sm" />
        <div className="text">
          <div className="title">{label.title}</div>
          <div className="desc">{empty ? t('common.empty') : `${fmtNum(c.fileCount)} ${t('common.items')}`} • {label.desc}</div>
        </div>
        <span className="trail">{formatBytes(c.sizeBytes)}</span>
        {c.samples.length > 0 && (
          <button className="round-btn plain" style={{ width: 30, height: 30 }} onClick={(e) => { e.stopPropagation(); tap(); onExpand() }} aria-label={t('common.viewDetails')}>
            <Icon name="chevron" size={15} style={{ transform: expanded ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ padding: '2px 18px 12px', display: 'grid', gap: 3 }}>
          {c.samples.map((s) => (
            <div key={s} className="muted mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'start' }}>{s}</div>
          ))}
        </div>
      )}
    </div>
  )
}
