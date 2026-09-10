import { useEffect, useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import type { DirListing, FileEntry, LargeFileEntry, ScanProgress } from '../../shared/types'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { formatBytes, formatDate } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { BatchRenameModal } from '../components/BatchRenameModal'
import { InputModal } from '../components/InputModal'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

function extIcon(entry: FileEntry): IconName {
  if (entry.isDirectory) return 'folder'
  const audio = ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'aac', 'wma']
  const image = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
  const archive = ['zip', 'rar', '7z']
  const ext = entry.extension.toLowerCase()
  if (audio.includes(ext)) return 'music'
  if (image.includes(ext)) return 'image'
  if (archive.includes(ext)) return 'archive'
  if (ext === 'exe' || ext === 'msi' || ext === 'dmg' || ext === 'pkg' || ext === 'app') return 'cog'
  return 'file'
}

export function FileManager(): JSX.Element {
  const { showToast } = useToast()
  const [listing, setListing] = useState<DirListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBatchRename, setShowBatchRename] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<LargeFileEntry[] | null>(null)
  const [searchProgress, setSearchProgress] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.fm.onScanProgress(setSearchProgress), [])

  async function runSearch(): Promise<void> {
    const query = searchQuery.trim()
    if (!query || !listing?.path) return
    setSearching(true)
    setSearchProgress(null)
    try {
      setSearchResults(await window.api.fm.search(listing.path, query))
    } catch (err) {
      const message = (err as Error).message
      showToast(/أُلغي|cancel/i.test(message) ? t('fm.searchStopped') : t('fm.searchFailed', { msg: message }))
    } finally {
      setSearching(false)
      setSearchProgress(null)
    }
  }

  async function open(targetPath: string | null): Promise<void> {
    setLoading(true)
    setSelected(new Set())
    try {
      setListing(await window.api.fm.list(targetPath))
    } catch (err) {
      showToast(t('fm.openFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    open(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  async function handleDelete(): Promise<void> {
    if (selected.size === 0) return
    const confirmed = await window.api.dialogs.confirm(
      t('fm.trashConfirm', { n: fmtNum(selected.size) }),
      t('fm.trashDetail')
    )
    if (!confirmed) return
    const results = await window.api.fm.delete([...selected])
    const failed = results.filter((r) => !r.success)
    showToast(failed.length ? t('fm.trashedPartial', { n: fmtNum(failed.length) }) : t('fm.trashed'))
    if (listing) open(listing.path)
  }

  async function handleRename(entry: FileEntry, newName: string): Promise<void> {
    setRenameTarget(null)
    if (newName === entry.name) return
    try {
      await window.api.fm.rename(entry.path, newName)
      if (listing) open(listing.path)
    } catch (err) {
      showToast(t('fm.renameFailed', { msg: (err as Error).message }))
    }
  }

  async function handleNewFolder(name: string): Promise<void> {
    setShowNewFolder(false)
    if (!listing?.path) return
    try {
      await window.api.fm.createFolder(listing.path, name)
      open(listing.path)
    } catch (err) {
      showToast(t('fm.mkdirFailed', { msg: (err as Error).message }))
    }
  }

  const crumbs = listing?.path
    ? listing.path.split(/[\\/]/).filter(Boolean)
    : []

  const selectedFileEntries = (listing?.entries || []).filter(
    (e) => selected.has(e.path) && !e.isDirectory
  )

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" disabled={!listing?.parent} onClick={() => open(listing!.parent)}>
          <Icon name="arrowUp" size={15} /> {t('da.up')}
        </button>
        <button className="btn" disabled={!listing?.path} onClick={() => setShowNewFolder(true)}>
          <Icon name="plus" size={15} /> {t('fm.newFolder')}
        </button>
        <button className="btn" disabled={selected.size === 0} onClick={handleDelete}>
          <Icon name="trash" size={15} /> {t('fm.toTrash')}
        </button>
        <button
          className="btn"
          disabled={selectedFileEntries.length === 0}
          onClick={() => setShowBatchRename(true)}
        >
          <Icon name="type" size={15} /> {t('fm.batchRename')}
        </button>
        <div className="spacer" />
        <input
          type="search"
          placeholder={t('fm.searchPh')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          disabled={!listing?.path}
          style={{ width: 240 }}
        />
        <button
          className="btn"
          onClick={runSearch}
          disabled={!listing?.path || !searchQuery.trim() || searching}
        >
          <Icon name="search" size={15} /> {t('common.search')}
        </button>
        {searchResults && (
          <button className="btn btn-sm btn-ghost" onClick={() => setSearchResults(null)}>
            <Icon name="x" size={14} /> {t('fm.clearSearch')}
          </button>
        )}
        <span className="muted">{selected.size > 0 ? t('fm.selectedN', { n: fmtNum(selected.size) }) : ''}</span>
      </div>

      {listing?.path && (
        <div className="breadcrumbs">
          <span className="crumb" onClick={() => open(null)}>
            {t('fm.drives')}
          </span>
          {crumbs.map((c, i) => {
            const partial = crumbs.slice(0, i + 1).join('\\')
            // "C:" وحده يعني "المجلد الحالي للقرص" في ويندوز وليس جذره — لذا نضيف الفاصل
            const withRoot = i === 0 ? partial + '\\' : partial
            const full = listing.path.startsWith('\\\\') ? '\\\\' + withRoot : withRoot
            return (
              <span key={i}>
                {' / '}
                <span className="crumb" onClick={() => open(full)}>
                  {c}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {searching ? (
        <ScanProgressPanel progress={searchProgress} onCancel={() => window.api.fm.cancelScan()} />
      ) : searchResults ? (
        <div className="card">
          {searchResults.length === 0 ? (
            <div className="empty-state">{t('fm.noMatches')}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('fm.searchResults', { n: fmtNum(searchResults.length) })}</th>
                  <th>{t('common.size')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {searchResults.map((r) => (
                  <tr key={r.path}>
                    <td style={{ direction: 'ltr', textAlign: 'right', fontSize: 12.5 }}>{r.path}</td>
                    <td>{formatBytes(r.sizeBytes)}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => window.api.fm.reveal(r.path)}>
                        {t('lf.reveal')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <div className="card">
        {loading ? (
          <div className="empty-state">{t('common.loading')}</div>
        ) : !listing?.path ? (
          <div style={{ padding: 16 }} className="grid grid-4">
            {(listing?.drives || []).map((d) => (
              <div key={d} className="card card-pad" style={{ cursor: 'pointer' }} onClick={() => open(d)}>
                <Icon name="hardDrive" size={16} /> {d}
              </div>
            ))}
          </div>
        ) : listing.entries.length === 0 ? (
          <div className="empty-state">{t('fm.emptyFolder')}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>{t('common.name')}</th>
                <th>{t('common.size')}</th>
                <th>{t('od.thModified')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listing.entries.map((entry) => (
                <tr key={entry.path}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(entry.path)}
                      onChange={() => toggle(entry.path)}
                    />
                  </td>
                  <td
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() =>
                      entry.isDirectory ? open(entry.path) : window.api.fm.openPath(entry.path)
                    }
                  >
                    <Icon name={extIcon(entry)} size={15} /> {entry.name}
                  </td>
                  <td>{entry.isDirectory ? '—' : formatBytes(entry.sizeBytes)}</td>
                  <td className="muted">{formatDate(entry.modifiedAt)}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setRenameTarget(entry)}>
                      {t('fm.rename')}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ marginRight: 6 }}
                      onClick={() => window.api.fm.reveal(entry.path)}
                    >
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

      {renameTarget && (
        <InputModal
          title={t('fm.rename')}
          initialValue={renameTarget.name}
          confirmLabel={t('fm.rename')}
          onConfirm={(name) => handleRename(renameTarget, name)}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {showNewFolder && (
        <InputModal
          title={t('fm.newFolderTitle')}
          initialValue={t('fm.newFolder')}
          confirmLabel={t('fm.create')}
          onConfirm={handleNewFolder}
          onCancel={() => setShowNewFolder(false)}
        />
      )}

      {showBatchRename && (
        <BatchRenameModal
          files={selectedFileEntries.map((e) => e.path)}
          onClose={() => setShowBatchRename(false)}
          onDone={() => {
            setShowBatchRename(false)
            if (listing) open(listing.path)
          }}
        />
      )}
    </div>
  )
}
