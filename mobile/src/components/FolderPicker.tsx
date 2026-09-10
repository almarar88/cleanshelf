import { useEffect, useState } from 'react'
import { Native } from '../lib/native'
import { t } from '../lib/i18n'
import type { DirListing, StorageRoot } from '../lib/types'
import { Icon } from './Icon'
import { Ico, Sheet } from './ui'

/** اختيار مجلد عبر التصفّح داخل ورقة سفلية (لنقل الملفات وتشغيل أداة على مجلد). */
export function FolderPicker({ title, onPick, onCancel }: { title: string; onPick: (path: string) => void; onCancel: () => void }): JSX.Element {
  const [roots, setRoots] = useState<StorageRoot[]>([])
  const [listing, setListing] = useState<DirListing | null>(null)

  useEffect(() => {
    Native.roots().then((r) => setRoots(r.roots)).catch(() => setRoots([]))
  }, [])

  async function open(path: string): Promise<void> {
    try {
      setListing(await Native.listDir({ path }))
    } catch {
      // مجلد لا يمكن قراءته
    }
  }

  const subFolders = listing?.entries.filter((e) => e.isDirectory) ?? []

  return (
    <Sheet onClose={onCancel}>
      <h3>{title}</h3>
      {listing ? (
        <>
          <div className="crumbs">
            <span className="c" onClick={() => setListing(null)}>{t('files.sections')}</span>
            <span className="c cur mono" style={{ direction: 'ltr' }}>{listing.path.replace('/storage/emulated/0', t('files.internal'))}</span>
          </div>
          <div className="card" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
            {listing.parent && (
              <div className="row" onClick={() => open(listing.parent as string)}>
                <Ico name="arrowUp" tone="tone-ink" size="sm" />
                <div className="text"><div className="title">{t('files.parent')}</div></div>
              </div>
            )}
            {subFolders.map((e) => (
              <div key={e.path} className="row" onClick={() => open(e.path)}>
                <Ico name="folder" tone="tone-yellow" size="sm" />
                <div className="text"><div className="title">{e.name}</div></div>
                <Icon name="chevron" size={15} className="muted flip-rtl" />
              </div>
            ))}
            {subFolders.length === 0 && <div className="empty" style={{ padding: 22 }}>{t('files.noSub')}</div>}
          </div>
        </>
      ) : (
        <div className="card">
          {roots.map((r) => (
            <div key={r.path} className="row" onClick={() => open(r.path)}>
              <Ico name="hardDrive" tone="tone-blue" size="sm" />
              <div className="text"><div className="title">{r.label}</div></div>
              <Icon name="chevron" size={15} className="muted flip-rtl" />
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="btn" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn btn-dark" disabled={!listing} onClick={() => listing && onPick(listing.path)}>{t('files.pickFolder')}</button>
      </div>
    </Sheet>
  )
}
