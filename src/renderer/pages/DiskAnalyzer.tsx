import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { DiskUsageResult, ScanProgress, FolderUsage } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { t } from '../lib/i18n'

export function DiskAnalyzer(): JSX.Element {
  const { showToast } = useToast()
  const [result, setResult] = useState<DiskUsageResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function analyze(rootPath: string): Promise<void> {
    setScanning(true)
    setProgress(null)
    try {
      setResult(await window.api.fm.analyzeFolder(rootPath))
    } catch (err) {
      const message = (err as Error).message
      showToast(/أُلغي|cancel/i.test(message) ? t('da.stopped') : t('da.failed', { msg: message }))
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  async function pickAndAnalyze(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (picked) await analyze(picked)
  }

  async function openItem(item: FolderUsage): Promise<void> {
    if (item.isDirectory) await analyze(item.path)
    else await window.api.fm.reveal(item.path)
  }

  async function trashItem(item: FolderUsage): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(
      t('da.trashConfirm', { name: item.name }),
      t('da.trashDetail', { path: item.path, size: formatBytes(item.sizeBytes) })
    )
    if (!confirmed) return
    const [res] = await window.api.fm.trashPaths([item.path])
    showToast(res.success ? t('da.moved') : t('da.deleteFailed', { msg: res.error ?? '' }))
    if (res.success && result) await analyze(result.root)
  }

  const maxSize = result?.children[0]?.sizeBytes ?? 0

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={pickAndAnalyze} disabled={scanning}>
          <Icon name="folderOpen" size={15} /> {t('da.pick')}
        </button>
        {result && (
          <>
            <button
              className="btn"
              disabled={!result.parent || scanning}
              onClick={() => result.parent && analyze(result.parent)}
            >
              <Icon name="arrowUp" size={15} /> {t('da.up')}
            </button>
            <span className="muted" style={{ direction: 'ltr' }}>
              {result.root}
            </span>
          </>
        )}
        <div className="spacer" />
        {result && <strong>{t('da.total', { size: formatBytes(result.totalBytes) })}</strong>}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={() => window.api.fm.cancelScan()} />
      ) : !result ? (
        <div className="empty-state">
          <div className="tile-icon tone-cyan"><Icon name="activity" size={26} /></div>
          <div>{t('da.empty')}</div>
        </div>
      ) : result.children.length === 0 ? (
        <div className="empty-state">{t('da.emptyFolder')}</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>{t('da.thItem')}</th>
                <th style={{ width: '30%' }}>{t('da.thShare')}</th>
                <th>{t('common.size')}</th>
                <th>{t('da.thFiles')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.children.slice(0, 200).map((item) => {
                const percent = result.totalBytes
                  ? Math.round((item.sizeBytes / result.totalBytes) * 100)
                  : 0
                const barWidth = maxSize ? Math.max(2, (item.sizeBytes / maxSize) * 100) : 0
                return (
                  <tr key={item.path}>
                    <td
                      style={{ cursor: item.isDirectory ? 'pointer' : 'default', fontWeight: 600 }}
                      onClick={() => item.isDirectory && analyze(item.path)}
                    >
                      <Icon name={item.isDirectory ? 'folder' : 'file'} size={15} /> {item.name}
                    </td>
                    <td>
                      <div className="progress-bar" style={{ minWidth: 100 }}>
                        <div style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {percent}%
                      </span>
                    </td>
                    <td>{formatBytes(item.sizeBytes)}</td>
                    <td className="muted">{item.fileCount.toLocaleString('ar')}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => openItem(item)}>
                        {t(item.isDirectory ? 'da.openIt' : 'lf.reveal')}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        style={{ marginRight: 6 }}
                        onClick={() => trashItem(item)}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
