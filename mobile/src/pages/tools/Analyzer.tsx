import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { t } from '../../lib/i18n'
import { fmtNum, formatBytes, splitBytes } from '../../lib/format'
import { tap } from '../../lib/haptics'
import type { DiskUsageResult, ScanProgress } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { EmptyState, Ico, ProgressPanel } from '../../components/ui'
import { PermissionGate } from '../../components/PermissionGate'

const ROOT = '/storage/emulated/0'
const TONES = ['tone-yellow', 'tone-orange', 'tone-blue', 'tone-green', 'tone-violet', 'tone-pink', 'tone-teal']

export function Analyzer(): JSX.Element {
  const { permissions } = useApp()
  const { showToast } = useToast()
  const [result, setResult] = useState<DiskUsageResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  useEffect(() => {
    const handle = Native.addListener('scanProgress', setProgress)
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  async function analyze(path: string): Promise<void> {
    setScanning(true)
    try {
      setResult(await Native.analyzeFolder({ path }))
    } catch (err) {
      const msg = (err as Error).message ?? ''
      showToast(/أُلغي|cancel/i.test(msg) ? t('toast.stopped') : t('toast.scanFailed', { msg }))
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (permissions.allFiles && !result && !scanning) analyze(ROOT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.allFiles])

  const max = result ? Math.max(...result.children.map((c) => c.sizeBytes), 1) : 1
  const total = result ? splitBytes(result.totalBytes) : null

  return (
    <div className="page no-tabs">
      <PermissionGate compact />

      {result && (
        <section className="tile orange">
          <div className="tile-head">
            <h3 className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'start' }}>
              {result.root.replace(ROOT, t('files.internal'))}
            </h3>
            <button className="tile-btn" disabled={!result.parent || scanning} onClick={() => { tap(); result.parent && analyze(result.parent) }} aria-label={t('analyzer.up')}>
              <Icon name="arrowUp" size={17} />
            </button>
          </div>
          <div className="display sm" style={{ margin: '6px 0 0' }}>
            {total?.value}
            <small>{total?.unit}</small>
          </div>
          <div className="deco-row">
            <span className="deco hatch" />
            <span className="bars">
              {result.children.slice(0, 8).map((c, i) => (
                <i key={c.path} style={{ height: `${Math.max(12, (c.sizeBytes / max) * 100)}%`, animationDelay: `${i * 45}ms` }} />
              ))}
            </span>
          </div>
        </section>
      )}

      {scanning ? (
        <div style={{ marginTop: 14 }}><ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /></div>
      ) : !result ? (
        <EmptyState icon="activity" tone="tone-teal" text={t('analyzer.empty')} />
      ) : result.children.length === 0 ? (
        <EmptyState icon="folder" tone="tone-yellow" text={t('files.emptyFolder')} />
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          {result.children.map((c, i) => {
            const pct = result.totalBytes ? Math.round((c.sizeBytes / result.totalBytes) * 100) : 0
            return (
              <div
                key={c.path}
                className="row"
                style={{ alignItems: 'stretch', flexDirection: 'column', gap: 7, animationDelay: `${Math.min(i, 12) * 25}ms` }}
                onClick={() => { if (c.isDirectory) { tap(); analyze(c.path) } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%' }}>
                  <Ico name={c.isDirectory ? 'folder' : 'file'} tone={TONES[i % TONES.length]} size="sm" />
                  <div className="text">
                    <div className="title">{c.name}</div>
                    <div className="desc">{t('analyzer.files', { n: fmtNum(c.fileCount) })}</div>
                  </div>
                  <span className="trail">{formatBytes(c.sizeBytes)} <span className="muted">{fmtNum(pct)}%</span></span>
                </div>
                <div className="bar warm" style={{ height: 6 }}><div style={{ width: `${Math.max(2, (c.sizeBytes / max) * 100)}%` }} /></div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
