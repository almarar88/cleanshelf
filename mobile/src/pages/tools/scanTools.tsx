import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { t } from '../../lib/i18n'
import { fmtNum, formatBytes, formatDate } from '../../lib/format'
import { markTaskDone } from '../../lib/plan'
import { tap } from '../../lib/haptics'
import type { DuplicateGroup, LargeFile, OldDownload, ScanProgress } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, Ico, ProgressPanel, fileIcon } from '../../components/ui'
import { FolderPicker } from '../../components/FolderPicker'
import { PermissionGate } from '../../components/PermissionGate'

const ROOT = '/storage/emulated/0'
const MB = 1024 ** 2

function useProgress(): ScanProgress | null {
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  useEffect(() => {
    const handle = Native.addListener('scanProgress', setProgress)
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])
  return progress
}

function useSelection(): [Set<string>, (p: string) => void, (s: Set<string>) => void] {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = (p: string): void => {
    tap()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }
  return [selected, toggle, setSelected]
}

function scanError(err: unknown, showToast: (m: string) => void): void {
  const msg = (err as Error).message ?? ''
  showToast(/أُلغي|cancel/i.test(msg) ? t('toast.stopped') : t('toast.scanFailed', { msg }))
}

function ScopeBar({ root, onPick, onScan, scanning, extra }: { root: string; onPick: () => void; onScan: () => void; scanning: boolean; extra?: React.ReactNode }): JSX.Element {
  return (
    <div className="toolbar" style={{ marginBottom: 14 }}>
      <button className="btn btn-sm" onClick={onPick} disabled={scanning} style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0 }}>
        <Icon name="folderOpen" size={16} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{root === ROOT ? t('scope.allInternal') : root.replace(`${ROOT}/`, '')}</span>
      </button>
      {extra}
      <button className="btn btn-sm btn-dark" onClick={() => { tap(); onScan() }} disabled={scanning}><Icon name="search" size={16} /> {t('common.scan')}</button>
    </div>
  )
}

function TrashBar({ count, bytes, onTrash }: { count: number; bytes: number; onTrash: () => void }): JSX.Element | null {
  if (count === 0) return null
  return (
    <div className="action-bar no-tabs">
      <button className="btn btn-dark" onClick={() => { tap(); onTrash() }}>
        <Icon name="trash" size={17} /> {t('trashBar.move', { n: fmtNum(count), size: formatBytes(bytes) })}
      </button>
    </div>
  )
}

function StatPair({ aLabel, aValue, bLabel, bValue }: { aLabel: string; aValue: string; bLabel: string; bValue: string }): JSX.Element {
  return (
    <div className="grid grid-2" style={{ marginBottom: 14 }}>
      <div className="card card-pad">
        <div className="card-sub">{aLabel}</div>
        <div className="card-title" style={{ fontSize: 22, marginTop: 2 }}>{aValue}</div>
      </div>
      <div className="card card-pad">
        <div className="card-sub">{bLabel}</div>
        <div className="card-title" style={{ fontSize: 22, marginTop: 2 }}>{bValue}</div>
      </div>
    </div>
  )
}

/* ---------- الملفات المكرّرة ---------- */

export function Duplicates(): JSX.Element {
  const { showToast } = useToast()
  const progress = useProgress()
  const [root, setRoot] = useState(ROOT)
  const [picking, setPicking] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [selected, toggle, setSelected] = useSelection()
  const [confirm, setConfirm] = useState(false)

  async function scan(): Promise<void> {
    setScanning(true)
    setGroups(null)
    try {
      const r = await Native.findDuplicates({ root, minSizeBytes: 64 * 1024 })
      setGroups(r.groups)
      // نحدّد تلقائيًا كل النسخ عدا الأولى في كل مجموعة
      setSelected(new Set(r.groups.flatMap((g) => g.files.slice(1))))
      if (r.groups.length === 0) showToast(t('dup.none'))
    } catch (err) {
      scanError(err, showToast)
    } finally {
      setScanning(false)
    }
  }

  const bytes = groups ? groups.reduce((s, g) => s + g.files.filter((f) => selected.has(f)).length * g.sizeBytes, 0) : 0
  const wasted = groups ? groups.reduce((s, g) => s + (g.files.length - 1) * g.sizeBytes, 0) : 0

  async function trash(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    showToast(t('moved.partial', { ok: fmtNum(r.results.filter((x) => x.success).length), total: fmtNum(r.results.length) }))
    markTaskDone('dup')
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <ScopeBar root={root} onPick={() => setPicking(true)} onScan={scan} scanning={scanning} />
      {scanning ? (
        <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} />
      ) : groups === null ? (
        <EmptyState icon="copy" tone="tone-pink" text={t('dup.empty')} />
      ) : groups.length === 0 ? (
        <EmptyState icon="checkCircle" tone="tone-green" text={t('dup.none')} />
      ) : (
        <>
          <div className="section-title">{t('dup.groups', { n: fmtNum(groups.length), size: formatBytes(wasted) })}</div>
          {groups.map((g) => (
            <div key={g.hash} className="card" style={{ marginBottom: 10 }}>
              <div className="row" style={{ cursor: 'default', minHeight: 40 }}>
                <div className="text"><div className="desc">{t('dup.copies', { n: fmtNum(g.files.length), size: formatBytes(g.sizeBytes) })}</div></div>
              </div>
              {g.files.map((f) => (
                <div key={f} className={`row ${selected.has(f) ? 'on' : ''}`} onClick={() => toggle(f)}>
                  <Check on={selected.has(f)} />
                  <div className="text">
                    <div className="title">{f.split('/').pop()}</div>
                    <div className="desc mono" style={{ direction: 'ltr', textAlign: 'start' }}>{f.slice(0, f.lastIndexOf('/')).replace(ROOT, '')}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      <TrashBar count={selected.size} bytes={bytes} onTrash={() => setConfirm(true)} />
      {picking && <FolderPicker title={t('scope.pick')} onPick={(p) => { setRoot(p); setPicking(false) }} onCancel={() => setPicking(false)} />}
      {confirm && (
        <ConfirmSheet title={t('common.moveToTrash')} message={t('dup.confirm', { n: fmtNum(selected.size) })} confirmLabel={t('common.trash')} onConfirm={trash} onCancel={() => setConfirm(false)} />
      )}
    </div>
  )
}

/* ---------- أكبر الملفات ---------- */

export function LargeFiles(): JSX.Element {
  const { showToast } = useToast()
  const progress = useProgress()
  const [root, setRoot] = useState(ROOT)
  const [picking, setPicking] = useState(false)
  const [minMb, setMinMb] = useState(50)
  const [scanning, setScanning] = useState(false)
  const [files, setFiles] = useState<LargeFile[] | null>(null)
  const [selected, toggle] = useSelection()
  const [confirm, setConfirm] = useState(false)

  async function scan(): Promise<void> {
    setScanning(true)
    setFiles(null)
    try {
      const r = await Native.findLargeFiles({ root, minSizeBytes: minMb * MB, limit: 200 })
      setFiles(r.files)
    } catch (err) {
      scanError(err, showToast)
    } finally {
      setScanning(false)
    }
  }

  const bytes = files ? files.filter((f) => selected.has(f.path)).reduce((s, f) => s + f.sizeBytes, 0) : 0

  async function trash(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    showToast(t('moved.partial', { ok: fmtNum(r.results.filter((x) => x.success).length), total: fmtNum(r.results.length) }))
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <ScopeBar
        root={root}
        onPick={() => setPicking(true)}
        onScan={scan}
        scanning={scanning}
        extra={
          <select value={minMb} onChange={(e) => setMinMb(Number(e.target.value))} style={{ width: 'auto', minHeight: 38, padding: '4px 12px' }}>
            {[10, 50, 100, 500, 1024].map((m) => (
              <option key={m} value={m}>{t('large.min', { v: m >= 1024 ? formatBytes(1024 * MB) : formatBytes(m * MB) })}</option>
            ))}
          </select>
        }
      />
      {scanning ? (
        <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} />
      ) : files === null ? (
        <EmptyState icon="package" tone="tone-orange" text={t('large.empty')} />
      ) : files.length === 0 ? (
        <EmptyState icon="checkCircle" tone="tone-green" text={t('large.none')} />
      ) : (
        <div className="card">
          {files.map((f, i) => (
            <div key={f.path} className={`row ${selected.has(f.path) ? 'on' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} onClick={() => toggle(f.path)}>
              <Check on={selected.has(f.path)} />
              <Ico name={fileIcon(false, f.extension)} tone="tone-ink" size="sm" />
              <div className="text">
                <div className="title">{f.name}</div>
                <div className="desc">{formatDate(f.modifiedAt, false)} • {f.path.slice(0, f.path.lastIndexOf('/')).replace(ROOT, '') || '/'}</div>
              </div>
              <span className="trail">{formatBytes(f.sizeBytes)}</span>
            </div>
          ))}
        </div>
      )}
      <TrashBar count={selected.size} bytes={bytes} onTrash={() => setConfirm(true)} />
      {picking && <FolderPicker title={t('scope.pick')} onPick={(p) => { setRoot(p); setPicking(false) }} onCancel={() => setPicking(false)} />}
      {confirm && (
        <ConfirmSheet title={t('common.moveToTrash')} message={t('trashBar.confirm', { n: fmtNum(selected.size), size: formatBytes(bytes) })} confirmLabel={t('common.trash')} onConfirm={trash} onCancel={() => setConfirm(false)} />
      )}
    </div>
  )
}

/* ---------- التنزيلات القديمة ---------- */

export function OldDownloads(): JSX.Element {
  const { settings } = useApp()
  const { showToast } = useToast()
  const [days, setDays] = useState(settings.oldDownloadDays)
  const [items, setItems] = useState<OldDownload[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, toggle, setSelected] = useSelection()
  const [confirm, setConfirm] = useState(false)

  async function scan(withDays = days): Promise<void> {
    setLoading(true)
    setSelected(new Set())
    try {
      const r = await Native.oldDownloads({ days: withDays })
      setItems(r.items)
    } catch (err) {
      scanError(err, showToast)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = items?.reduce((s, i) => s + i.sizeBytes, 0) ?? 0
  const bytes = items?.filter((i) => selected.has(i.path)).reduce((s, i) => s + i.sizeBytes, 0) ?? 0

  async function trash(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    showToast(t('moved.partial', { ok: fmtNum(r.results.filter((x) => x.success).length), total: fmtNum(r.results.length) }))
    markTaskDone('downloads')
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <select value={days} onChange={(e) => { const d = Number(e.target.value); setDays(d); scan(d) }} style={{ flex: 1 }}>
          {[7, 14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{t('dl.olderThan', { n: fmtNum(d) })}</option>)}
        </select>
        {items && items.length > 0 && (
          <button className="btn btn-sm" onClick={() => { tap(); setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.path))) }}>
            {selected.size === items.length ? t('common.clearAll') : t('common.selectAll')}
          </button>
        )}
      </div>

      <StatPair
        aLabel={t('dl.oldItems')}
        aValue={loading ? '—' : fmtNum(items?.length ?? 0)}
        bLabel={t('dl.theirSize')}
        bValue={loading ? '—' : formatBytes(total)}
      />

      {!loading && items && items.length === 0 ? (
        <EmptyState icon="checkCircle" tone="tone-green" text={t('dl.none', { n: fmtNum(days) })} />
      ) : (
        items && (
          <div className="card">
            {items.map((d, i) => (
              <div key={d.path} className={`row ${selected.has(d.path) ? 'on' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} onClick={() => toggle(d.path)}>
                <Check on={selected.has(d.path)} />
                <Ico name={fileIcon(d.isDirectory, d.extension)} tone="tone-blue" size="sm" />
                <div className="text">
                  <div className="title">{d.name}</div>
                  <div className="desc">{formatDate(d.modifiedAt, false)}</div>
                </div>
                <div className="trail" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <span>{formatBytes(d.sizeBytes)}</span>
                  <span className={`badge ${d.ageDays > 180 ? 'badge-danger' : d.ageDays > 60 ? 'badge-warn' : 'badge-neutral'}`}>{t('set.days', { n: fmtNum(d.ageDays) })}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      <TrashBar count={selected.size} bytes={bytes} onTrash={() => setConfirm(true)} />
      {confirm && (
        <ConfirmSheet title={t('common.moveToTrash')} message={t('trashBar.confirm', { n: fmtNum(selected.size), size: formatBytes(bytes) })} confirmLabel={t('common.trash')} onConfirm={trash} onCancel={() => setConfirm(false)} />
      )}
    </div>
  )
}

/* ---------- المجلدات الفارغة ---------- */

export function EmptyFolders(): JSX.Element {
  const { showToast } = useToast()
  const progress = useProgress()
  const [root, setRoot] = useState(ROOT)
  const [picking, setPicking] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [folders, setFolders] = useState<string[] | null>(null)
  const [selected, toggle, setSelected] = useSelection()
  const [confirm, setConfirm] = useState(false)

  async function scan(): Promise<void> {
    setScanning(true)
    setFolders(null)
    try {
      const r = await Native.findEmptyFolders({ root })
      setFolders(r.folders)
      setSelected(new Set(r.folders))
    } catch (err) {
      scanError(err, showToast)
    } finally {
      setScanning(false)
    }
  }

  async function remove(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    showToast(t('empty.deleted', { n: fmtNum(r.results.filter((x) => x.success).length) }))
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <ScopeBar root={root} onPick={() => setPicking(true)} onScan={scan} scanning={scanning} />
      {scanning ? (
        <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} />
      ) : folders === null ? (
        <EmptyState icon="folderSearch" tone="tone-yellow" text={t('empty.empty')} />
      ) : folders.length === 0 ? (
        <EmptyState icon="checkCircle" tone="tone-green" text={t('empty.none')} />
      ) : (
        <div className="card">
          {folders.map((f, i) => (
            <div key={f} className={`row ${selected.has(f) ? 'on' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} onClick={() => toggle(f)}>
              <Check on={selected.has(f)} />
              <Ico name="folder" tone="tone-yellow" size="sm" />
              <div className="text">
                <div className="title">{f.split('/').pop()}</div>
                <div className="desc mono" style={{ direction: 'ltr', textAlign: 'start' }}>{f.slice(0, f.lastIndexOf('/')).replace(ROOT, '') || '/'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {selected.size > 0 && (
        <div className="action-bar no-tabs">
          <button className="btn btn-dark" onClick={() => { tap(); setConfirm(true) }}>
            <Icon name="trash" size={17} /> {t('empty.deleteBtn', { n: fmtNum(selected.size) })}
          </button>
        </div>
      )}
      {picking && <FolderPicker title={t('scope.pick')} onPick={(p) => { setRoot(p); setPicking(false) }} onCancel={() => setPicking(false)} />}
      {confirm && (
        <ConfirmSheet title={t('empty.deleteBtn', { n: fmtNum(selected.size) })} message={t('empty.confirm', { n: fmtNum(selected.size) })} confirmLabel={t('common.delete')} onConfirm={remove} onCancel={() => setConfirm(false)} />
      )}
    </div>
  )
}
