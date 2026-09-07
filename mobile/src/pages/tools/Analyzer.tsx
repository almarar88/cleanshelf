import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useToast } from '../../lib/toastContext'
import { formatBytes } from '../../lib/format'
import type { DiskUsageResult, ScanProgress } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { ProgressPanel, EmptyState } from '../../components/ui'
import { PermissionGate } from '../../components/PermissionGate'
import { useApp } from '../../lib/appContext'

const ROOT = '/storage/emulated/0'

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
      showToast((err as Error).message.includes('أُلغي') ? 'أُوقف الفحص' : 'فشل التحليل: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (permissions.allFiles && !result && !scanning) analyze(ROOT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.allFiles])

  const max = result ? Math.max(...result.children.map((c) => c.sizeBytes), 1) : 1

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      {result && (
        <div className="toolbar">
          <button className="btn btn-sm" disabled={!result.parent || scanning} onClick={() => analyze(result.parent!)}><Icon name="arrowUp" size={15} /> للأعلى</button>
          <span className="muted mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.root.replace(ROOT, 'الداخلية')}</span>
          <strong style={{ fontSize: 13 }}>{formatBytes(result.totalBytes)}</strong>
        </div>
      )}
      {scanning ? <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /> : !result ? <EmptyState icon="activity" tone="tone-cyan" text="اعرف أين تذهب مساحة هاتفك بالضبط" /> : result.children.length === 0 ? <EmptyState icon="folder" text="المجلد فارغ" /> : (
        <div className="card">
          {result.children.map((c) => {
            const pct = result.totalBytes ? Math.round((c.sizeBytes / result.totalBytes) * 100) : 0
            return (
              <div key={c.path} className="row" onClick={() => c.isDirectory && analyze(c.path)} style={{ alignItems: 'stretch', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name={c.isDirectory ? 'folder' : 'file'} size={17} className="muted" />
                  <div className="text"><div className="title">{c.name}</div><div className="desc">{c.fileCount.toLocaleString('ar')} ملف</div></div>
                  <span className="trail">{formatBytes(c.sizeBytes)} <span className="muted">({pct}%)</span></span>
                </div>
                <div className="progress-bar" style={{ height: 6 }}><div style={{ width: `${Math.max(2, (c.sizeBytes / max) * 100)}%` }} /></div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
