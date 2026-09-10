import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { BrokenShortcut, ScanProgress } from '../../shared/types'
import { useToast } from '../lib/toastContext'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { basename } from '../lib/pathUtils'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

type Mode = 'empty' | 'shortcuts'

export function CleanupExtras(): JSX.Element {
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('empty')
  const [folder, setFolder] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [emptyFolders, setEmptyFolders] = useState<string[]>([])
  const [broken, setBroken] = useState<BrokenShortcut[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function pickAndScan(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (!picked) return
    setFolder(picked)
    await runScan(picked, mode)
  }

  async function runScan(root: string, which: Mode): Promise<void> {
    setScanning(true)
    setProgress(null)
    setChecked(new Set())
    setEmptyFolders([])
    setBroken([])
    try {
      if (which === 'empty') {
        const result = await window.api.fm.findEmptyFolders(root)
        setEmptyFolders(result)
        if (result.length === 0) showToast(t('ex.noEmpty'))
      } else {
        const result = await window.api.fm.findBrokenShortcuts(root)
        setBroken(result)
        if (result.length === 0) showToast(t('ex.noBroken'))
      }
    } catch (err) {
      const message = (err as Error).message
      showToast(/أُلغي|cancel/i.test(message) ? t('du.stopped') : t('ex.scanFailed', { msg: message }))
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

  const items = mode === 'empty' ? emptyFolders : broken.map((b) => b.shortcutPath)

  async function deleteChecked(): Promise<void> {
    if (checked.size === 0) return
    const confirmed = await window.api.dialogs.confirm(
      t('ex.trashConfirm', { n: fmtNum(checked.size) }),
      t('ex.trashDetail')
    )
    if (!confirmed) return
    const results = await window.api.fm.trashPaths([...checked])
    showToast(t('ex.deleted', { n: fmtNum(results.filter((r) => r.success).length) }))
    if (folder) await runScan(folder, mode)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <select
          value={mode}
          onChange={(e) => {
            const next = e.target.value as Mode
            setMode(next)
            setEmptyFolders([])
            setBroken([])
            setChecked(new Set())
            if (folder) runScan(folder, next)
          }}
        >
          <option value="empty">{t('ex.modeEmpty')}</option>
          <option value="shortcuts">{t('ex.modeShortcuts')}</option>
        </select>
        <button className="btn btn-primary" onClick={pickAndScan} disabled={scanning}>
          <Icon name="folderOpen" size={15} /> {t('ex.pick')}
        </button>
        {folder && (
          <span className="muted" style={{ direction: 'ltr' }}>
            {folder}
          </span>
        )}
        <div className="spacer" />
        {items.length > 0 && (
          <>
            <button
              className="btn btn-sm"
              onClick={() => setChecked(new Set(checked.size === items.length ? [] : items))}
            >
              {t(checked.size === items.length ? 'common.clearAll' : 'common.selectAll')}
            </button>
            <button className="btn btn-danger" disabled={checked.size === 0} onClick={deleteChecked}>
              {t('ex.deleteSel', { n: fmtNum(checked.size) })}
            </button>
          </>
        )}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={() => window.api.fm.cancelScan()} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="tile-icon tone-amber"><Icon name={mode === 'empty' ? 'folder' : 'link'} size={26} /></div>
          <div>
            {mode === 'empty'
              ? t('ex.emptyHint')
              : t('ex.shortcutsHint')}
          </div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>{t(mode === 'empty' ? 'ex.thFolder' : 'ex.thShortcut')}</th>
                {mode === 'shortcuts' && <th>{t('ex.thTarget')}</th>}
              </tr>
            </thead>
            <tbody>
              {mode === 'empty'
                ? emptyFolders.map((p) => (
                    <tr key={p}>
                      <td>
                        <input type="checkbox" checked={checked.has(p)} onChange={() => toggle(p)} />
                      </td>
                      <td style={{ direction: 'ltr', textAlign: 'right', fontSize: 12.5 }}>{p}</td>
                    </tr>
                  ))
                : broken.map((b) => (
                    <tr key={b.shortcutPath}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked.has(b.shortcutPath)}
                          onChange={() => toggle(b.shortcutPath)}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{basename(b.shortcutPath)}</div>
                        <div
                          className="muted"
                          style={{ fontSize: 11.5, direction: 'ltr', textAlign: 'right' }}
                        >
                          {b.shortcutPath}
                        </div>
                      </td>
                      <td
                        className="muted"
                        style={{ fontSize: 11.5, direction: 'ltr', textAlign: 'right' }}
                      >
                        {b.targetPath}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
