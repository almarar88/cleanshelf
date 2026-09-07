import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { formatBytes, formatDate } from '../../lib/format'
import type { DuplicateGroup, LargeFile, OldDownload, ScanProgress } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, ProgressPanel, fileIcon } from '../../components/ui'
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
  const toggle = (p: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  return [selected, toggle, setSelected]
}

function ScopeBar({ root, onPick, onScan, scanning, extra }: { root: string; onPick: () => void; onScan: () => void; scanning: boolean; extra?: React.ReactNode }): JSX.Element {
  return (
    <div className="toolbar">
      <button className="btn btn-sm" onClick={onPick} disabled={scanning} style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0 }}>
        <Icon name="folderOpen" size={15} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{root === ROOT ? 'كل الذاكرة الداخلية' : root.replace(ROOT + '/', '')}</span>
      </button>
      {extra}
      <button className="btn btn-sm btn-primary" onClick={onScan} disabled={scanning}><Icon name="search" size={15} /> فحص</button>
    </div>
  )
}

function TrashBar({ count, bytes, onTrash }: { count: number; bytes: number; onTrash: () => void }): JSX.Element | null {
  if (count === 0) return null
  return (
    <div className="action-bar no-tabs">
      <button className="btn btn-danger" onClick={onTrash}><Icon name="trash" size={16} /> نقل {count} إلى سلة المهملات ({formatBytes(bytes)})</button>
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
      if (r.groups.length === 0) showToast('لا ملفات مكرّرة')
    } catch (err) {
      showToast((err as Error).message.includes('أُلغي') ? 'أُوقف الفحص' : 'فشل الفحص: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  const bytes = groups ? groups.reduce((s, g) => s + g.files.filter((f) => selected.has(f)).length * g.sizeBytes, 0) : 0
  const wasted = groups ? groups.reduce((s, g) => s + (g.files.length - 1) * g.sizeBytes, 0) : 0

  async function trash(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    showToast(`نُقل ${r.results.filter((x) => x.success).length} من ${r.results.length} إلى سلة المهملات`)
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <ScopeBar root={root} onPick={() => setPicking(true)} onScan={scan} scanning={scanning} />
      {scanning ? <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /> : groups === null ? <EmptyState icon="copy" tone="tone-pink" text="يقارن الملفات بمحتواها لا باسمها، فيجد النسخ المتطابقة أينما كانت" /> : groups.length === 0 ? <EmptyState icon="checkCircle" tone="tone-green" text="لا ملفات مكرّرة في هذا النطاق" /> : (
        <>
          <div className="muted" style={{ fontSize: 12.5, margin: '0 4px 8px' }}>{groups.length} مجموعة • {formatBytes(wasted)} مساحة مهدرة</div>
          {groups.map((g) => (
            <div key={g.hash} className="card" style={{ marginBottom: 10 }}>
              <div className="row" style={{ cursor: 'default', minHeight: 40, padding: '8px 14px' }}>
                <div className="text"><div className="desc">{g.files.length} نسخ × {formatBytes(g.sizeBytes)}</div></div>
              </div>
              {g.files.map((f) => (
                <div key={f} className={`row ${selected.has(f) ? 'selected' : ''}`} onClick={() => toggle(f)}>
                  <Check on={selected.has(f)} />
                  <div className="text">
                    <div className="title">{f.split('/').pop()}</div>
                    <div className="desc mono">{f.slice(0, f.lastIndexOf('/')).replace(ROOT, '')}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      <TrashBar count={selected.size} bytes={bytes} onTrash={() => setConfirm(true)} />
      {picking && <FolderPicker title="نطاق البحث" onPick={(p) => { setRoot(p); setPicking(false) }} onCancel={() => setPicking(false)} />}
      {confirm && <ConfirmSheet title="نقل النسخ المكرّرة" message={`سيُنقل ${selected.size} ملف إلى سلة المهملات وتبقى نسخة واحدة من كل مجموعة.`} confirmLabel="نقل" onConfirm={trash} onCancel={() => setConfirm(false)} />}
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
      showToast((err as Error).message.includes('أُلغي') ? 'أُوقف الفحص' : 'فشل الفحص: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  const bytes = files ? files.filter((f) => selected.has(f.path)).reduce((s, f) => s + f.sizeBytes, 0) : 0

  async function trash(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    showToast(`نُقل ${r.results.filter((x) => x.success).length} من ${r.results.length} إلى سلة المهملات`)
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <ScopeBar root={root} onPick={() => setPicking(true)} onScan={scan} scanning={scanning} extra={
        <select value={minMb} onChange={(e) => setMinMb(Number(e.target.value))} style={{ width: 'auto', minHeight: 36, padding: '4px 10px' }}>
          {[10, 50, 100, 500, 1024].map((m) => <option key={m} value={m}>≥ {m >= 1024 ? '1 غ.ب' : `${m} م.ب`}</option>)}
        </select>
      } />
      {scanning ? <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /> : files === null ? <EmptyState icon="package" tone="tone-orange" text="اعرف أي الملفات تلتهم مساحتك وقرّر بنفسك" /> : files.length === 0 ? <EmptyState icon="checkCircle" tone="tone-green" text="لا ملفات بهذا الحجم" /> : (
        <div className="card">
          {files.map((f) => (
            <div key={f.path} className={`row ${selected.has(f.path) ? 'selected' : ''}`} onClick={() => toggle(f.path)}>
              <Check on={selected.has(f.path)} />
              <div className="tile-icon sm"><Icon name={fileIcon(false, f.extension)} size={17} /></div>
              <div className="text">
                <div className="title">{f.name}</div>
                <div className="desc">{formatDate(f.modifiedAt)} • {f.path.slice(0, f.path.lastIndexOf('/')).replace(ROOT, '') || '/'}</div>
              </div>
              <span className="trail">{formatBytes(f.sizeBytes)}</span>
            </div>
          ))}
        </div>
      )}
      <TrashBar count={selected.size} bytes={bytes} onTrash={() => setConfirm(true)} />
      {picking && <FolderPicker title="نطاق البحث" onPick={(p) => { setRoot(p); setPicking(false) }} onCancel={() => setPicking(false)} />}
      {confirm && <ConfirmSheet title="نقل إلى سلة المهملات" message={`سيُنقل ${selected.size} ملف (${formatBytes(bytes)}) إلى سلة المهملات ويمكن استرجاعه.`} confirmLabel="نقل" onConfirm={trash} onCancel={() => setConfirm(false)} />}
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
      showToast('فشل الفحص: ' + (err as Error).message)
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
    showToast(`نُقل ${r.results.filter((x) => x.success).length} من ${r.results.length} إلى سلة المهملات`)
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <div className="toolbar">
        <select value={days} onChange={(e) => { const d = Number(e.target.value); setDays(d); scan(d) }} style={{ flex: 1 }}>
          {[7, 14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>أقدم من {d} يوم</option>)}
        </select>
        {items && items.length > 0 && <button className="btn btn-sm" onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.path)))}>{selected.size === items.length ? 'إلغاء الكل' : 'تحديد الكل'}</button>}
      </div>
      <div className="grid grid-2" style={{ marginBottom: 12 }}>
        <div className="card stat-tile"><span className="label"><Icon name="download" size={13} /> عناصر قديمة</span><span className="value">{loading ? '…' : items?.length ?? 0}</span></div>
        <div className="card stat-tile"><span className="label"><Icon name="hardDrive" size={13} /> حجمها</span><span className="value">{loading ? '…' : formatBytes(total)}</span></div>
      </div>
      {!loading && items && items.length === 0 ? <EmptyState icon="checkCircle" tone="tone-green" text={`لا شيء أقدم من ${days} يومًا في التنزيلات`} /> : items && (
        <div className="card">
          {items.map((d) => (
            <div key={d.path} className={`row ${selected.has(d.path) ? 'selected' : ''}`} onClick={() => toggle(d.path)}>
              <Check on={selected.has(d.path)} />
              <div className="tile-icon sm"><Icon name={fileIcon(d.isDirectory, d.extension)} size={17} /></div>
              <div className="text">
                <div className="title">{d.name}</div>
                <div className="desc">{formatDate(d.modifiedAt)}</div>
              </div>
              <div className="trail" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span>{formatBytes(d.sizeBytes)}</span>
                <span className={`badge ${d.ageDays > 180 ? 'badge-danger' : d.ageDays > 60 ? 'badge-caution' : 'badge-neutral'}`}>{d.ageDays} يوم</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <TrashBar count={selected.size} bytes={bytes} onTrash={() => setConfirm(true)} />
      {confirm && <ConfirmSheet title="نقل إلى سلة المهملات" message={`سيُنقل ${selected.size} عنصر (${formatBytes(bytes)}) إلى سلة المهملات ويمكن استرجاعه.`} confirmLabel="نقل" onConfirm={trash} onCancel={() => setConfirm(false)} />}
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
      showToast('فشل الفحص: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  async function remove(): Promise<void> {
    setConfirm(false)
    const r = await Native.trash({ paths: [...selected] })
    showToast(`حُذف ${r.results.filter((x) => x.success).length} مجلد`)
    scan()
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <ScopeBar root={root} onPick={() => setPicking(true)} onScan={scan} scanning={scanning} />
      {scanning ? <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /> : folders === null ? <EmptyState icon="folderSearch" tone="tone-amber" text="مجلدات فارغة تمامًا تتركها التطبيقات بعد الحذف" /> : folders.length === 0 ? <EmptyState icon="checkCircle" tone="tone-green" text="لا مجلدات فارغة" /> : (
        <div className="card">
          {folders.map((f) => (
            <div key={f} className={`row ${selected.has(f) ? 'selected' : ''}`} onClick={() => toggle(f)}>
              <Check on={selected.has(f)} />
              <Icon name="folder" size={17} className="muted" />
              <div className="text"><div className="title">{f.split('/').pop()}</div><div className="desc mono">{f.slice(0, f.lastIndexOf('/')).replace(ROOT, '') || '/'}</div></div>
            </div>
          ))}
        </div>
      )}
      {selected.size > 0 && <div className="action-bar no-tabs"><button className="btn btn-danger" onClick={() => setConfirm(true)}><Icon name="trash" size={16} /> حذف {selected.size} مجلد</button></div>}
      {picking && <FolderPicker title="نطاق البحث" onPick={(p) => { setRoot(p); setPicking(false) }} onCancel={() => setPicking(false)} />}
      {confirm && <ConfirmSheet title="حذف المجلدات الفارغة" message={`${selected.size} مجلد فارغ سيُنقل إلى سلة المهملات.`} confirmLabel="حذف" onConfirm={remove} onCancel={() => setConfirm(false)} />}
    </div>
  )
}
