import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { t } from '../../lib/i18n'
import { fmtNum, formatBytes } from '../../lib/format'
import { tap } from '../../lib/haptics'
import type { FileEntry, OpResult, ScanProgress } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, Ico, Notice, ProgressPanel, Sheet, fileIcon } from '../../components/ui'

const ROOT = '/storage/emulated/0'

/** اختيار ملفات بالتصفّح — أندرويد لا يعطي مسارات حقيقية من منتقي النظام */
function FilePicker({ onPick, onCancel }: { onPick: (paths: string[]) => void; onCancel: () => void }): JSX.Element {
  const [path, setPath] = useState(ROOT)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [parent, setParent] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  useEffect(() => {
    Native.listDir({ path })
      .then((r) => {
        setEntries(r.entries)
        setParent(r.parent)
      })
      .catch(() => setEntries([]))
  }, [path])

  return (
    <Sheet onClose={onCancel}>
      <h3>{t('shred.pick')}</h3>
      <div className="muted mono" style={{ marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'ltr', textAlign: 'start' }}>{path}</div>
      <div className="card" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
        {parent && (
          <div className="row" onClick={() => setPath(parent)}>
            <Ico name="arrowUp" tone="tone-ink" size="sm" />
            <div className="text"><div className="title">{t('files.parent')}</div></div>
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.path}
            className={`row ${chosen.has(e.path) ? 'on' : ''}`}
            onClick={() =>
              e.isDirectory
                ? setPath(e.path)
                : setChosen((prev) => {
                    const n = new Set(prev)
                    if (n.has(e.path)) n.delete(e.path)
                    else n.add(e.path)
                    return n
                  })
            }
          >
            {!e.isDirectory && <Check on={chosen.has(e.path)} />}
            <Ico name={fileIcon(e.isDirectory, e.extension)} tone={e.isDirectory ? 'tone-yellow' : 'tone-ink'} size="sm" />
            <div className="text">
              <div className="title">{e.name}</div>
              {!e.isDirectory && <div className="desc">{formatBytes(e.sizeBytes)}</div>}
            </div>
            {e.isDirectory && <Icon name="chevron" size={15} className="muted flip-rtl" />}
          </div>
        ))}
      </div>
      <div className="actions">
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn btn-dark" disabled={chosen.size === 0} onClick={() => onPick([...chosen])}>{t('shred.add2', { n: fmtNum(chosen.size) })}</button>
      </div>
    </Sheet>
  )
}

export function Shredder(): JSX.Element {
  const { settings } = useApp()
  const { showToast } = useToast()
  const [paths, setPaths] = useState<string[]>([])
  const [passes, setPasses] = useState(settings.shredPasses)
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [results, setResults] = useState<OpResult[] | null>(null)

  useEffect(() => {
    const handle = Native.addListener('scanProgress', setProgress)
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  async function shred(): Promise<void> {
    setConfirm(false)
    setRunning(true)
    setResults(null)
    try {
      const r = await Native.shred({ paths, passes })
      setResults(r.results)
      const failed = r.results.filter((x) => !x.success).length
      showToast(failed ? t('shred.donePartial', { n: fmtNum(failed) }) : t('shred.doneAll', { n: fmtNum(r.results.length) }))
      if (!failed) setPaths([])
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <div className="page no-tabs">
      <Notice kind="warn">
        <strong>{t('shred.warn')}</strong> {t('shred.warnBody')}
      </Notice>

      <div className="toolbar" style={{ margin: '14px 0' }}>
        <button className="btn btn-sm" onClick={() => { tap(); setPicking(true) }} disabled={running} style={{ flex: 1 }}>
          <Icon name="plus" size={16} /> {t('shred.add')}
        </button>
        <select value={passes} onChange={(e) => setPasses(Number(e.target.value))} disabled={running} style={{ width: 'auto', minHeight: 38, padding: '4px 12px' }}>
          <option value={1}>{t('shred.once')}</option>
          <option value={3}>{t('shred.times', { n: fmtNum(3) })}</option>
          <option value={7}>{t('shred.times', { n: fmtNum(7) })}</option>
        </select>
      </div>

      {running ? (
        <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} />
      ) : paths.length === 0 && !results ? (
        <EmptyState icon="scissors" tone="tone-red" text={t('shred.empty')} />
      ) : (
        <div className="card">
          {(results ?? paths.map((p) => ({ path: p, success: false }))).map((r) => (
            <div key={r.path} className="row" style={{ cursor: 'default' }}>
              <Ico name="file" tone="tone-red" size="sm" />
              <div className="text">
                <div className="title">{r.path.split('/').pop()}</div>
                <div className="desc mono" style={{ direction: 'ltr', textAlign: 'start' }}>{r.path.slice(0, r.path.lastIndexOf('/')).replace(ROOT, '')}</div>
              </div>
              {results ? (
                <span className={`badge ${r.success ? 'badge-safe' : 'badge-danger'}`}>{r.success ? t('shred.shredded') : t('common.failed')}</span>
              ) : (
                <button className="round-btn plain" style={{ width: 30, height: 30 }} onClick={() => setPaths((prev) => prev.filter((p) => p !== r.path))} aria-label={t('common.remove')}>
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {paths.length > 0 && !running && (
        <div className="action-bar no-tabs">
          <button className="btn btn-danger" onClick={() => { tap(); setConfirm(true) }}>
            <Icon name="scissors" size={17} /> {t('shred.btn', { n: fmtNum(paths.length) })}
          </button>
        </div>
      )}

      {picking && (
        <FilePicker
          onPick={(p) => {
            setPaths((prev) => [...new Set([...prev, ...p])])
            setResults(null)
            setPicking(false)
          }}
          onCancel={() => setPicking(false)}
        />
      )}
      {confirm && (
        <ConfirmSheet
          title={t('shred.confirmTitle', { n: fmtNum(paths.length) })}
          message={t('shred.confirmMsg')}
          confirmLabel={t('shred.confirmBtn')}
          danger
          onConfirm={shred}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  )
}
