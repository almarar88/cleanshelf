import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { OrphanLeftover, LanguageFileGroup, ScanProgress } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

type Mode = 'orphans' | 'languages'

export function MacTools(): JSX.Element {
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('orphans')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [orphans, setOrphans] = useState<OrphanLeftover[]>([])
  const [languages, setLanguages] = useState<LanguageFileGroup[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function scan(which: Mode): Promise<void> {
    setScanning(true)
    setProgress(null)
    setChecked(new Set())
    setOrphans([])
    setLanguages([])
    try {
      if (which === 'orphans') {
        const result = await window.api.mac.orphanLeftovers()
        setOrphans(result)
        if (result.length === 0) showToast(t('mt.noOrphans'))
      } else {
        const result = await window.api.mac.languageFiles()
        setLanguages(result)
        if (result.length === 0) showToast(t('mt.noLangs'))
      }
    } catch (err) {
      const message = (err as Error).message
      showToast(/أُلغي|cancel/i.test(message) ? t('du.stopped') : t('mt.scanFailed', { msg: message }))
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  function toggle(key: string): void {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalSelected =
    mode === 'orphans'
      ? orphans.filter((o) => checked.has(o.path)).reduce((s, o) => s + o.sizeBytes, 0)
      : languages.filter((g) => checked.has(g.appPath)).reduce((s, g) => s + g.sizeBytes, 0)

  async function deleteChecked(): Promise<void> {
    if (checked.size === 0) return
    const paths =
      mode === 'orphans'
        ? [...checked]
        : languages.filter((g) => checked.has(g.appPath)).flatMap((g) => g.languagePaths)

    const confirmed = await window.api.dialogs.confirm(
      t('mt.trashConfirm', { n: fmtNum(paths.length) }),
      t('mt.trashDetail', { size: formatBytes(totalSelected) })
    )
    if (!confirmed) return

    const results = await window.api.fm.trashPaths(paths)
    const failed = results.filter((r) => !r.success)
    showToast(
      failed.length
        ? t('mt.partial', { ok: fmtNum(results.length - failed.length), fail: fmtNum(failed.length) })
        : t('mt.deleted', { n: fmtNum(results.length) })
    )
    await scan(mode)
  }

  async function purge(): Promise<void> {
    const result = await window.api.mac.purgeMemory()
    showToast(result.message)
  }

  const items = mode === 'orphans' ? orphans : languages

  return (
    <div className="page">
      <div className="toolbar">
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode)
            setOrphans([])
            setLanguages([])
            setChecked(new Set())
          }}
        >
          <option value="orphans">{t('mt.modeOrphans')}</option>
          <option value="languages">{t('mt.modeLanguages')}</option>
        </select>
        <button className="btn btn-primary" onClick={() => scan(mode)} disabled={scanning}>
          <Icon name="search" size={15} /> {t('mt.startScan')}
        </button>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={purge}>
          <Icon name="brain" size={15} /> {t('mt.purge')}
        </button>
        {items.length > 0 && (
          <button className="btn btn-danger" disabled={checked.size === 0} onClick={deleteChecked}>
            {t('mt.deleteSel', { size: formatBytes(totalSelected) })}
          </button>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13 }}>
        {mode === 'orphans'
          ? t('mt.orphansNote')
          : t('mt.langsNote')}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={() => window.api.mac.cancelScan()} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="tile-icon tone-teal"><Icon name={mode === 'orphans' ? 'sparkles' : 'globe'} size={26} /></div>
          <div>{t('mt.empty')}</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>{t(mode === 'orphans' ? 'mt.thItem' : 'mt.thApp')}</th>
                <th>{t(mode === 'orphans' ? 'mt.thLocation' : 'mt.thLangCount')}</th>
                <th>{t('common.size')}</th>
              </tr>
            </thead>
            <tbody>
              {mode === 'orphans'
                ? orphans.map((o) => (
                    <tr key={o.path}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked.has(o.path)}
                          onChange={() => toggle(o.path)}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.name}</div>
                        <div
                          className="muted"
                          style={{ fontSize: 11.5, direction: 'ltr', textAlign: 'right' }}
                        >
                          {o.path}
                        </div>
                      </td>
                      <td className="muted">{o.category}</td>
                      <td>{formatBytes(o.sizeBytes)}</td>
                    </tr>
                  ))
                : languages.map((g) => (
                    <tr key={g.appPath}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked.has(g.appPath)}
                          onChange={() => toggle(g.appPath)}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{g.appName}</td>
                      <td className="muted">{t('mt.langsN', { n: fmtNum(g.languagePaths.length) })}</td>
                      <td>{formatBytes(g.sizeBytes)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
