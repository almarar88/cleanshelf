import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { LargeFileEntry, ScanProgress } from '../../shared/types'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { formatBytes } from '../lib/format'
import { basename } from '../lib/pathUtils'
import { useToast } from '../lib/toastContext'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

const THRESHOLDS = [
  { bytes: 100 * 1024 * 1024 },
  { bytes: 500 * 1024 * 1024 },
  { bytes: 1024 * 1024 * 1024 },
  { bytes: 5 * 1024 * 1024 * 1024 }
]

export function LargeFiles(): JSX.Element {
  const { showToast } = useToast()
  const [folder, setFolder] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [threshold, setThreshold] = useState(THRESHOLDS[0].bytes)
  const [files, setFiles] = useState<LargeFileEntry[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function pickAndScan(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (!picked) return
    await runScan(picked, threshold)
  }

  async function runScan(root: string, minSize: number): Promise<void> {
    setFolder(root)
    setScanning(true)
    setChecked(new Set())
    setProgress(null)
    try {
      setFiles(await window.api.fm.findLargeFiles(root, minSize))
    } catch (err) {
      const message = (err as Error).message
      showToast(/أُلغي|cancel/i.test(message) ? t('du.stopped') : t('du.failed', { msg: message }))
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  function toggle(p: string): void {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  async function deleteChecked(): Promise<void> {
    if (checked.size === 0) return
    const confirmed = await window.api.dialogs.confirm(t('lf.trashConfirm', { n: fmtNum(checked.size) }))
    if (!confirmed) return
    const results = await window.api.fm.delete([...checked])
    showToast(t('du.deleted', { n: fmtNum(results.filter((r) => r.success).length) }))
    if (folder) runScan(folder, threshold)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={pickAndScan} disabled={scanning}>
          <Icon name="folderOpen" size={15} /> {t('lf.pick')}
        </button>
        <select
          value={threshold}
          onChange={(e) => {
            const v = Number(e.target.value)
            setThreshold(v)
            if (folder) runScan(folder, v)
          }}
        >
          {THRESHOLDS.map((opt) => (
            <option key={opt.bytes} value={opt.bytes}>
              {t('lf.biggerThan', { size: formatBytes(opt.bytes) })}
            </option>
          ))}
        </select>
        {folder && <span className="muted">{folder}</span>}
        <div className="spacer" />
        {files.length > 0 && (
          <button className="btn btn-danger" disabled={checked.size === 0} onClick={deleteChecked}>
            {t('du.deleteSel', { n: fmtNum(checked.size) })}
          </button>
        )}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={() => window.api.fm.cancelScan()} />
      ) : (
      <div className="card">
        {files.length === 0 ? (
          <div className="empty-state">
            <div className="tile-icon tone-orange"><Icon name="package" size={26} /></div>
            <div>{t('lf.empty')}</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>{t('lf.thFile')}</th>
                <th>{t('common.size')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.path}>
                  <td>
                    <input type="checkbox" checked={checked.has(f.path)} onChange={() => toggle(f.path)} />
                  </td>
                  <td>
                    <div>{basename(f.path)}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {f.path}
                    </div>
                  </td>
                  <td>{formatBytes(f.sizeBytes)}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => window.api.fm.reveal(f.path)}>
                      {t('lf.reveal')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  )
}
