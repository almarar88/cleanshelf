import { useEffect, useMemo, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { formatBytes, formatDate } from '../lib/format'
import type { DirListing, FileEntry, StorageRoot } from '../lib/types'
import { Icon } from '../components/Icon'
import { Check, ConfirmSheet, InputSheet, Sheet, fileIcon } from '../components/ui'
import { FolderPicker } from '../components/FolderPicker'
import { PermissionGate } from '../components/PermissionGate'

type SortKey = 'name' | 'size' | 'date'

function applyPattern(pattern: string, name: string, index: number): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot + 1) : ''
  const out = pattern.replace(/%name%/g, base).replace(/%n%/g, String(index)).replace(/%nn%/g, String(index).padStart(2, '0')).replace(/%ext%/g, ext)
  return ext && !/%ext%/.test(pattern) ? `${out}.${ext}` : out
}

export function Files(): JSX.Element {
  const { permissions } = useApp()
  const { showToast } = useToast()
  const [roots, setRoots] = useState<StorageRoot[]>([])
  const [listing, setListing] = useState<DirListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortKey>('name')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null)
  const [sheet, setSheet] = useState<'none' | 'rename' | 'newFolder' | 'move' | 'trash' | 'batch' | 'info'>('none')
  const [batchPattern, setBatchPattern] = useState('%name%')
  const [infoEntry, setInfoEntry] = useState<FileEntry | null>(null)

  useEffect(() => {
    if (!permissions.allFiles) return
    Native.roots().then((r) => setRoots(r.roots)).catch(() => setRoots([]))
  }, [permissions.allFiles])

  async function open(path: string | null): Promise<void> {
    setSelected(new Set())
    setSearchResults(null)
    if (path === null) {
      setListing(null)
      return
    }
    setLoading(true)
    try {
      setListing(await Native.listDir({ path }))
    } catch (err) {
      showToast('تعذّر فتح المجلد: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const entries = useMemo(() => {
    const list = [...(searchResults ?? listing?.entries ?? [])]
    list.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      if (sort === 'size') return b.sizeBytes - a.sizeBytes
      if (sort === 'date') return b.modifiedAt - a.modifiedAt
      return a.name.localeCompare(b.name, 'ar')
    })
    return list
  }, [listing, searchResults, sort])

  const selectedEntries = entries.filter((e) => selected.has(e.path))

  function toggle(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function tap(entry: FileEntry): void {
    if (selected.size > 0) {
      toggle(entry.path)
      return
    }
    if (entry.isDirectory) open(entry.path)
    else {
      setInfoEntry(entry)
      setSheet('info')
    }
  }

  async function runSearch(): Promise<void> {
    if (!listing || !query.trim()) return
    setLoading(true)
    try {
      const r = await Native.search({ root: listing.path, query: query.trim() })
      setSearchResults(r.entries)
      if (r.entries.length === 0) showToast('لا نتائج')
    } finally {
      setLoading(false)
    }
  }

  async function doRename(name: string): Promise<void> {
    setSheet('none')
    const target = selectedEntries[0] ?? infoEntry
    if (!target) return
    try {
      await Native.rename({ path: target.path, newName: name })
      showToast('تمت إعادة التسمية')
      open(listing!.path)
    } catch (err) {
      showToast('فشلت إعادة التسمية: ' + (err as Error).message)
    }
  }

  async function doNewFolder(name: string): Promise<void> {
    setSheet('none')
    if (!listing) return
    try {
      await Native.createFolder({ parent: listing.path, name })
      open(listing.path)
    } catch (err) {
      showToast('فشل إنشاء المجلد: ' + (err as Error).message)
    }
  }

  async function doMove(destination: string): Promise<void> {
    setSheet('none')
    const r = await Native.move({ paths: [...selected], destination })
    const failed = r.results.filter((x) => !x.success).length
    showToast(failed ? `نُقل ${r.results.length - failed} وتعذّر ${failed}` : `تم نقل ${r.results.length} عنصر`)
    open(listing!.path)
  }

  async function doTrash(): Promise<void> {
    setSheet('none')
    const paths = selected.size > 0 ? [...selected] : infoEntry ? [infoEntry.path] : []
    const r = await Native.trash({ paths })
    const failed = r.results.filter((x) => !x.success).length
    showToast(failed ? `نُقل ${r.results.length - failed} وتعذّر ${failed}` : `تم نقل ${r.results.length} عنصر إلى سلة المهملات`)
    open(listing!.path)
  }

  async function doBatchRename(): Promise<void> {
    setSheet('none')
    const files = selectedEntries.filter((e) => !e.isDirectory)
    let ok = 0
    let index = 1
    for (const f of files) {
      const newName = applyPattern(batchPattern, f.name, index)
      index += 1
      if (newName === f.name) continue
      try {
        await Native.rename({ path: f.path, newName })
        ok += 1
      } catch {
        // نكمل الباقي
      }
    }
    showToast(`أُعيدت تسمية ${ok} من ${files.length}`)
    open(listing!.path)
  }

  const crumbs = listing ? listing.path.replace(/^\/storage\/emulated\/0/, '').split('/').filter(Boolean) : []

  return (
    <div className="page">
      <PermissionGate />

      {listing && (
        <>
          <div className="search-box" style={{ marginBottom: 10 }}>
            <Icon name="search" size={16} />
            <input type="search" placeholder="ابحث في هذا المجلد وما تحته…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} />
            {searchResults && <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => { setSearchResults(null); setQuery('') }}><Icon name="x" size={15} /></button>}
          </div>
          <div className="breadcrumbs">
            <span className="crumb" onClick={() => open(null)}>الأقسام</span>
            <span className="sep">/</span>
            <span className={`crumb ${crumbs.length === 0 ? 'current' : ''}`} onClick={() => open('/storage/emulated/0')}>الداخلية</span>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <span className="sep">/</span>
                <span className={`crumb ${i === crumbs.length - 1 ? 'current' : ''}`} onClick={() => open('/storage/emulated/0/' + crumbs.slice(0, i + 1).join('/'))}>{c}</span>
              </span>
            ))}
          </div>
          <div className="toolbar">
            <div className="segmented" style={{ flex: 1 }}>
              {(['name', 'size', 'date'] as SortKey[]).map((k) => (
                <button key={k} className={sort === k ? 'active' : ''} onClick={() => setSort(k)}>{k === 'name' ? 'الاسم' : k === 'size' ? 'الحجم' : 'التاريخ'}</button>
              ))}
            </div>
            <button className="icon-btn raised" onClick={() => setSheet('newFolder')} aria-label="مجلد جديد"><Icon name="plus" size={18} /></button>
            <button className="icon-btn raised" onClick={() => setSelected(selected.size === entries.length ? new Set() : new Set(entries.map((e) => e.path)))} aria-label="تحديد الكل"><Icon name="checkCircle" size={18} /></button>
          </div>
        </>
      )}

      {!listing ? (
        <div className="card">
          {roots.map((r) => (
            <div key={r.path} className="row" onClick={() => open(r.path)}>
              <div className="tile-icon sm"><Icon name={r.removable ? 'download' : 'hardDrive'} size={17} /></div>
              <div className="text">
                <div className="title">{r.label}</div>
                <div className="desc">{formatBytes(r.freeBytes)} متاحة من {formatBytes(r.totalBytes)}</div>
                <div className="progress-bar" style={{ marginTop: 6, height: 5 }}><div style={{ width: `${r.totalBytes ? Math.round(((r.totalBytes - r.freeBytes) / r.totalBytes) * 100) : 0}%` }} /></div>
              </div>
            </div>
          ))}
          {roots.length === 0 && permissions.allFiles && <div className="empty-state">جارٍ قراءة أقسام التخزين…</div>}
        </div>
      ) : loading ? (
        <div className="card"><div className="skeleton" style={{ height: 56 }} /><div className="skeleton" style={{ height: 56, marginTop: 1 }} /></div>
      ) : entries.length === 0 ? (
        <div className="empty-state"><div className="tile-icon"><Icon name="folder" size={28} /></div><div>{searchResults ? 'لا نتائج' : 'المجلد فارغ'}</div></div>
      ) : (
        <div className="card">
          {entries.map((e) => (
            <div key={e.path} className={`row ${selected.has(e.path) ? 'selected' : ''}`} onClick={() => tap(e)} onContextMenu={(ev) => { ev.preventDefault(); toggle(e.path) }}>
              {selected.size > 0 ? <Check on={selected.has(e.path)} /> : <div className={`tile-icon sm ${e.isDirectory ? 'tone-amber' : ''}`}><Icon name={fileIcon(e.isDirectory, e.extension)} size={17} /></div>}
              <div className="text">
                <div className="title">{e.name}</div>
                <div className="desc">{e.isDirectory ? `${e.childCount} عنصر` : formatBytes(e.sizeBytes)} • {formatDate(e.modifiedAt)}</div>
              </div>
              {selected.size === 0 && <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={(ev) => { ev.stopPropagation(); toggle(e.path) }} aria-label="تحديد"><Icon name="checkCircle" size={16} className="muted" /></button>}
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="action-bar">
          <button className="btn btn-sm" onClick={() => setSheet('rename')} disabled={selected.size !== 1}><Icon name="type" size={15} /> تسمية</button>
          <button className="btn btn-sm" onClick={() => setSheet('batch')} disabled={selectedEntries.filter((e) => !e.isDirectory).length < 2}><Icon name="layers" size={15} /> دفعية</button>
          <button className="btn btn-sm" onClick={() => setSheet('move')}><Icon name="folderOpen" size={15} /> نقل</button>
          <button className="btn btn-sm btn-danger" onClick={() => setSheet('trash')}><Icon name="trash" size={15} /> {selected.size}</button>
        </div>
      )}

      {sheet === 'rename' && <InputSheet title="إعادة التسمية" initialValue={(selectedEntries[0] ?? infoEntry)?.name ?? ''} confirmLabel="حفظ" onConfirm={doRename} onCancel={() => setSheet('none')} />}
      {sheet === 'newFolder' && <InputSheet title="مجلد جديد" initialValue="مجلد جديد" confirmLabel="إنشاء" onConfirm={doNewFolder} onCancel={() => setSheet('none')} />}
      {sheet === 'move' && <FolderPicker title={`نقل ${selected.size} عنصر إلى…`} onPick={doMove} onCancel={() => setSheet('none')} />}
      {sheet === 'trash' && <ConfirmSheet title="نقل إلى سلة المهملات" message={`سيُنقل ${selected.size || 1} عنصر إلى سلة مهملات CleanShelf، ويمكنك استرجاعه من أداة "سلة المهملات" خلال أيام الاحتفاظ.`} confirmLabel="نقل" onConfirm={doTrash} onCancel={() => setSheet('none')} />}
      {sheet === 'batch' && (
        <Sheet onClose={() => setSheet('none')}>
          <h3>إعادة تسمية دفعية</h3>
          <p>المتغيّرات: <code>%name%</code> الاسم الحالي، <code>%n%</code> رقم تسلسلي، <code>%nn%</code> رقم بخانتين، <code>%ext%</code> الامتداد.</p>
          <input type="text" value={batchPattern} onChange={(e) => setBatchPattern(e.target.value)} dir="ltr" />
          <div className="card" style={{ marginTop: 12, maxHeight: '30vh', overflowY: 'auto' }}>
            {selectedEntries.filter((e) => !e.isDirectory).slice(0, 20).map((e, i) => (
              <div key={e.path} className="row" style={{ minHeight: 44, padding: '8px 14px' }}>
                <div className="text"><div className="desc">{e.name}</div><div className="title" style={{ fontSize: 13 }}>{applyPattern(batchPattern, e.name, i + 1)}</div></div>
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setSheet('none')}>إلغاء</button>
            <button className="btn btn-primary" onClick={doBatchRename}>تطبيق</button>
          </div>
        </Sheet>
      )}
      {sheet === 'info' && infoEntry && (
        <Sheet onClose={() => setSheet('none')}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="tile-icon"><Icon name={fileIcon(false, infoEntry.extension)} size={22} /></div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ marginBottom: 2, wordBreak: 'break-all' }}>{infoEntry.name}</h3>
              <div className="muted" style={{ fontSize: 12.5 }}>{formatBytes(infoEntry.sizeBytes)} • {formatDate(infoEntry.modifiedAt)}</div>
            </div>
          </div>
          <div className="muted mono" style={{ marginTop: 10, wordBreak: 'break-all', whiteSpace: 'normal' }}>{infoEntry.path}</div>
          <div className="actions">
            <button className="btn" onClick={() => { setSelected(new Set([infoEntry.path])); setSheet('rename') }}><Icon name="type" size={15} /> تسمية</button>
            <button className="btn" onClick={() => { setSelected(new Set([infoEntry.path])); setSheet('move') }}><Icon name="folderOpen" size={15} /> نقل</button>
            <button className="btn btn-danger" onClick={() => setSheet('trash')}><Icon name="trash" size={15} /> حذف</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
