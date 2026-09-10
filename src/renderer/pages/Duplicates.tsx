import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { DuplicateGroup, ScanProgress } from '../../shared/types'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { formatBytes } from '../lib/format'
import { basename } from '../lib/pathUtils'
import { useToast } from '../lib/toastContext'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

export function Duplicates(): JSX.Element {
  const { showToast } = useToast()
  const [folder, setFolder] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function runScan(root: string, announceEmpty = true): Promise<void> {
    setScanning(true)
    setGroups([])
    setChecked(new Set())
    setProgress(null)
    try {
      const result = await window.api.fm.findDuplicates(root, 4096)
      setGroups(result)
      if (announceEmpty && result.length === 0) showToast(t('du.none'))
    } catch (err) {
      const message = (err as Error).message
      showToast(/أُلغي|cancel/i.test(message) ? t('du.stopped') : t('du.failed', { msg: message }))
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  async function pickAndScan(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (!picked) return
    setFolder(picked)
    await runScan(picked)
  }

  async function cancelScan(): Promise<void> {
    await window.api.fm.cancelScan()
  }

  function toggle(p: string): void {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  function selectAllButFirst(): void {
    const next = new Set<string>()
    for (const g of groups) {
      g.files.slice(1).forEach((f) => next.add(f))
    }
    setChecked(next)
  }

  const wastedBytes = groups.reduce((sum, g) => sum + g.sizeBytes * (g.files.length - 1), 0)

  async function deleteChecked(): Promise<void> {
    if (checked.size === 0) return
    const confirmed = await window.api.dialogs.confirm(
      t('du.trashConfirm', { n: fmtNum(checked.size) }),
      t('du.trashDetail')
    )
    if (!confirmed) return
    const results = await window.api.fm.delete([...checked])
    showToast(t('du.deleted', { n: fmtNum(results.filter((r) => r.success).length) }))
    if (folder) await runScan(folder, false)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={pickAndScan} disabled={scanning}>
          <Icon name="folderOpen" size={15} /> {t('du.pick')}
        </button>
        {folder && <span className="muted">{folder}</span>}
        <div className="spacer" />
        {groups.length > 0 && (
          <>
            <span className="muted">{t('du.wasted', { size: formatBytes(wastedBytes) })}</span>
            <button className="btn" onClick={selectAllButFirst}>
              {t('du.selectExtra')}
            </button>
            <button className="btn btn-danger" disabled={checked.size === 0} onClick={deleteChecked}>
              {t('du.deleteSel', { n: fmtNum(checked.size) })}
            </button>
          </>
        )}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={cancelScan} />
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="tile-icon tone-pink"><Icon name="copy" size={26} /></div>
          <div>{t('du.empty')}</div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {groups.map((g) => (
            <div key={g.hash} className="card card-pad">
              <div className="muted" style={{ marginBottom: 8, fontSize: 12.5 }}>
                {t('du.copies', { n: fmtNum(g.files.length), size: formatBytes(g.sizeBytes) })}
              </div>
              {g.files.map((f) => (
                <div key={f} className="checkbox-row" style={{ marginBottom: 4 }}>
                  <input type="checkbox" checked={checked.has(f)} onChange={() => toggle(f)} />
                  <span style={{ fontSize: 13 }}>{basename(f)}</span>
                  <span className="muted" style={{ fontSize: 11.5 }}>{f}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
