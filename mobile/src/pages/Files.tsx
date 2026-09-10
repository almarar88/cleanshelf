import { useEffect, useMemo, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { getLang, t } from '../lib/i18n'
import { fmtNum, formatBytes, formatDate } from '../lib/format'
import { tap } from '../lib/haptics'
import type { DirListing, FileEntry, StorageRoot } from '../lib/types'
import { Icon } from '../components/Icon'
import { Check, ConfirmSheet, EmptyState, Ico, InputSheet, Sheet, fileIcon } from '../components/ui'
import { FolderPicker } from '../components/FolderPicker'
import { PermissionGate } from '../components/PermissionGate'

type SortKey = 'name' | 'size' | 'date'
const ROOT = '/storage/emulated/0'

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
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const entries = useMemo(() => {
    const list = [...(searchResults ?? listing?.entries ?? [])]
    const collator = new Intl.Collator(getLang() === 'ar' ? 'ar' : 'en')
    list.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      if (sort === 'size') return b.sizeBytes - a.sizeBytes
      if (sort === 'date') return b.modifiedAt - a.modifiedAt
      return collator.compare(a.name, b.name)
    })
    return list
  }, [listing, searchResults, sort])

  const selectedEntries = entries.filter((e) => selected.has(e.path))

  function toggle(path: string): void {
    tap()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function openEntry(entry: FileEntry): void {
    if (selected.size > 0) {
      toggle(entry.path)
      return
    }
    tap()
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
      if (r.entries.length === 0) showToast(t('more.noResults'))
    } finally {
      setLoading(false)
    }
  }

  async function doRename(name: string): Promise<void> {
    setSheet('none')
    const target = selectedEntries[0] ?? infoEntry
    if (!target || !listing) return
    try {
      await Native.rename({ path: target.path, newName: name })
      showToast(t('files.renamed'))
      open(listing.path)
    } catch {
      showToast(t('files.renameFailed'))
    }
  }

  async function doNewFolder(name: string): Promise<void> {
    setSheet('none')
    if (!listing) return
    try {
      await Native.createFolder({ parent: listing.path, name })
      open(listing.path)
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    }
  }

  async function doMove(destination: string): Promise<void> {
    setSheet('none')
    if (!listing) return
    const r = await Native.move({ paths: [...selected], destination })
    const failed = r.results.filter((x) => !x.success).length
    showToast(failed ? t('nav.moveFailed') : t('files.moved', { n: fmtNum(r.results.length) }))
    open(listing.path)
  }

  async function doTrash(): Promise<void> {
    setSheet('none')
    const paths = selected.size > 0 ? [...selected] : infoEntry ? [infoEntry.path] : []
    if (paths.length === 0 || !listing) return
    const r = await Native.trash({ paths })
    const failed = r.results.filter((x) => !x.success).length
    showToast(failed ? t('moved.partial', { ok: fmtNum(r.results.length - failed), total: fmtNum(r.results.length) }) : t('files.trashed', { n: fmtNum(r.results.length) }))
    open(listing.path)
  }

  async function doBatchRename(): Promise<void> {
    setSheet('none')
    if (!listing) return
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
    showToast(t('files.batchDone', { ok: fmtNum(ok), total: fmtNum(files.length) }))
    open(listing.path)
  }

  const crumbs = listing ? listing.path.replace(ROOT, '').split('/').filter(Boolean) : []

  return (
    <div className="page">
      <PermissionGate />

      {!listing && <h1 className="display sm">{t('page.files')}</h1>}

      {listing && (
        <>
          <div className="field-row" style={{ marginBottom: 10 }}>
            <Icon name="search" size={18} />
            <input type="search" placeholder={t('files.searchHere')} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} />
            {searchResults ? (
              <button className="round-btn plain" style={{ width: 28, height: 28 }} onClick={() => { setSearchResults(null); setQuery('') }} aria-label={t('common.clearAll')}><Icon name="x" size={16} /></button>
            ) : (
              query.trim() && <button className="round-btn plain" style={{ width: 28, height: 28 }} onClick={runSearch} aria-label={t('common.search')}><Icon name="arrowRight" size={16} className="flip-rtl" /></button>
            )}
          </div>

          <div className="crumbs">
            <span className="c" onClick={() => open(null)}>{t('files.sections')}</span>
            <span className={`c ${crumbs.length === 0 ? 'cur' : ''}`} onClick={() => open(ROOT)}>{t('files.internal')}</span>
            {crumbs.map((c, i) => (
              <span key={i} className={`c ${i === crumbs.length - 1 ? 'cur' : ''}`} onClick={() => open(`${ROOT}/${crumbs.slice(0, i + 1).join('/')}`)}>{c}</span>
            ))}
          </div>

          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div className="segmented" style={{ flex: 1 }}>
              {(['name', 'size', 'date'] as SortKey[]).map((k) => (
                <button key={k} className={sort === k ? 'active' : ''} onClick={() => { tap(); setSort(k) }}>
                  {t(k === 'name' ? 'files.sortName' : k === 'size' ? 'files.sortSize' : 'files.sortDate')}
                </button>
              ))}
            </div>
            <button className="round-btn" onClick={() => { tap(); setSheet('newFolder') }} aria-label={t('files.newFolder')}><Icon name="plus" size={18} /></button>
            <button className="round-btn" onClick={() => { tap(); setSelected(selected.size === entries.length ? new Set() : new Set(entries.map((e) => e.path))) }} aria-label={t('common.selectAll')}><Icon name="checkCircle" size={18} /></button>
          </div>
        </>
      )}

      {!listing ? (
        <div className="card">
          {roots.map((r) => {
            const usedPct = r.totalBytes ? Math.round(((r.totalBytes - r.freeBytes) / r.totalBytes) * 100) : 0
            return (
              <div key={r.path} className="row" onClick={() => { tap(); open(r.path) }}>
                <Ico name={r.removable ? 'download' : 'hardDrive'} tone={r.removable ? 'tone-teal' : 'tone-blue'} size="sm" />
                <div className="text">
                  <div className="title">{r.label}</div>
                  <div className="desc">{t('device.freeOf', { free: formatBytes(r.freeBytes), total: formatBytes(r.totalBytes) })}</div>
                  <div className="bar warm" style={{ marginTop: 7, height: 6 }}><div style={{ width: `${usedPct}%` }} /></div>
                </div>
                <Icon name="chevron" size={16} className="muted flip-rtl" />
              </div>
            )
          })}
          {roots.length === 0 && permissions.allFiles && (
            <>
              <div className="skeleton" style={{ height: 62 }} />
              <div className="skeleton" style={{ height: 62, marginTop: 1 }} />
            </>
          )}
        </div>
      ) : loading ? (
        <div className="card">
          <div className="skeleton" style={{ height: 58 }} />
          <div className="skeleton" style={{ height: 58, marginTop: 1 }} />
          <div className="skeleton" style={{ height: 58, marginTop: 1 }} />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon="folder" tone="tone-yellow" text={searchResults ? t('more.noResults') : t('files.emptyFolder')} />
      ) : (
        <div className="card">
          {entries.map((e, i) => (
            <div
              key={e.path}
              className={`row ${selected.has(e.path) ? 'on' : ''}`}
              style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
              onClick={() => openEntry(e)}
              onContextMenu={(ev) => { ev.preventDefault(); toggle(e.path) }}
            >
              {selected.size > 0 ? <Check on={selected.has(e.path)} /> : <Ico name={fileIcon(e.isDirectory, e.extension)} tone={e.isDirectory ? 'tone-yellow' : 'tone-ink'} size="sm" />}
              <div className="text">
                <div className="title">{e.name}</div>
                <div className="desc">{e.isDirectory ? t('files.childCount', { n: fmtNum(e.childCount) }) : formatBytes(e.sizeBytes)} • {formatDate(e.modifiedAt, false)}</div>
              </div>
              {selected.size === 0 && (
                <button className="round-btn plain" style={{ width: 30, height: 30 }} onClick={(ev) => { ev.stopPropagation(); toggle(e.path) }} aria-label={t('common.selected')}>
                  <Icon name="checkCircle" size={17} className="muted" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="action-bar">
          <button className="btn btn-sm" onClick={() => setSheet('rename')} disabled={selected.size !== 1}><Icon name="type" size={16} /> {t('files.rename')}</button>
          <button className="btn btn-sm" onClick={() => setSheet('batch')} disabled={selectedEntries.filter((e) => !e.isDirectory).length < 2}><Icon name="layers" size={16} /> {t('files.batch')}</button>
          <button className="btn btn-sm" onClick={() => setSheet('move')}><Icon name="folderOpen" size={16} /> {t('files.move')}</button>
          <button className="btn btn-sm btn-danger" onClick={() => setSheet('trash')}><Icon name="trash" size={16} /> {fmtNum(selected.size)}</button>
        </div>
      )}

      {sheet === 'rename' && <InputSheet title={t('files.rename')} initialValue={(selectedEntries[0] ?? infoEntry)?.name ?? ''} confirmLabel={t('common.save')} onConfirm={doRename} onCancel={() => setSheet('none')} />}
      {sheet === 'newFolder' && <InputSheet title={t('files.newFolder')} initialValue={t('files.newFolder')} confirmLabel={t('common.confirm')} onConfirm={doNewFolder} onCancel={() => setSheet('none')} />}
      {sheet === 'move' && <FolderPicker title={t('files.moveTo', { n: fmtNum(selected.size) })} onPick={doMove} onCancel={() => setSheet('none')} />}
      {sheet === 'trash' && (
        <ConfirmSheet
          title={t('common.moveToTrash')}
          message={t('files.trashConfirm', { n: fmtNum(selected.size || 1) })}
          confirmLabel={t('common.trash')}
          onConfirm={doTrash}
          onCancel={() => setSheet('none')}
        />
      )}
      {sheet === 'batch' && (
        <Sheet onClose={() => setSheet('none')}>
          <h3>{t('files.batch')}</h3>
          <p>{t('files.batchHint')}</p>
          <input type="text" value={batchPattern} onChange={(e) => setBatchPattern(e.target.value)} dir="ltr" />
          <div className="card" style={{ marginTop: 12, maxHeight: '30vh', overflowY: 'auto' }}>
            {selectedEntries.filter((e) => !e.isDirectory).slice(0, 20).map((e, i) => (
              <div key={e.path} className="row" style={{ minHeight: 44 }}>
                <div className="text">
                  <div className="desc">{e.name}</div>
                  <div className="title" style={{ fontSize: 13.5 }}>{applyPattern(batchPattern, e.name, i + 1)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setSheet('none')}>{t('common.cancel')}</button>
            <button className="btn btn-dark" onClick={doBatchRename}>{t('files.batchApply')}</button>
          </div>
        </Sheet>
      )}
      {sheet === 'info' && infoEntry && (
        <Sheet onClose={() => setSheet('none')}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Ico name={fileIcon(false, infoEntry.extension)} tone="tone-ink" size="lg" />
            <div style={{ minWidth: 0 }}>
              <h3 style={{ marginBottom: 2, wordBreak: 'break-all' }}>{infoEntry.name}</h3>
              <div className="muted" style={{ fontSize: 12.5 }}>{formatBytes(infoEntry.sizeBytes)} • {formatDate(infoEntry.modifiedAt)}</div>
            </div>
          </div>
          <div className="muted mono" style={{ marginTop: 10, wordBreak: 'break-all', whiteSpace: 'normal', direction: 'ltr', textAlign: 'start' }}>{infoEntry.path}</div>
          <div className="actions">
            <button className="btn" onClick={() => { setSelected(new Set([infoEntry.path])); setSheet('rename') }}><Icon name="type" size={16} /> {t('files.rename')}</button>
            <button className="btn" onClick={() => { setSelected(new Set([infoEntry.path])); setSheet('move') }}><Icon name="folderOpen" size={16} /> {t('files.move')}</button>
            <button className="btn btn-danger" onClick={() => setSheet('trash')}><Icon name="trash" size={16} /> {t('common.delete')}</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
