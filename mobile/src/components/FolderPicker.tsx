import { useEffect, useState } from 'react'
import { Native } from '../lib/native'
import type { DirListing, StorageRoot } from '../lib/types'
import { Icon } from './Icon'
import { Sheet } from './ui'

/** اختيار مجلد عبر التصفّح داخل ورقة سفلية (لنقل الملفات وفحص أداة على مجلد). */
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

  return (
    <Sheet onClose={onCancel}>
      <h3>{title}</h3>
      {listing ? (
        <>
          <div className="breadcrumbs">
            <span className="crumb" onClick={() => setListing(null)}>الأقسام</span>
            <span className="sep">/</span>
            <span className="crumb current mono" style={{ direction: 'ltr' }}>{listing.path.replace('/storage/emulated/0', 'الداخلية')}</span>
          </div>
          <div className="card" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
            {listing.parent && (
              <div className="row" onClick={() => open(listing.parent!)}>
                <Icon name="arrowUp" size={18} className="muted" />
                <div className="text"><div className="title">المجلد الأعلى</div></div>
              </div>
            )}
            {listing.entries.filter((e) => e.isDirectory).map((e) => (
              <div key={e.path} className="row" onClick={() => open(e.path)}>
                <Icon name="folder" size={18} className="muted" />
                <div className="text"><div className="title">{e.name}</div></div>
                <Icon name="chevron" size={14} className="muted" style={{ transform: 'scaleX(-1)' }} />
              </div>
            ))}
            {listing.entries.filter((e) => e.isDirectory).length === 0 && <div className="empty-state" style={{ padding: 24 }}>لا مجلدات فرعية</div>}
          </div>
        </>
      ) : (
        <div className="card">
          {roots.map((r) => (
            <div key={r.path} className="row" onClick={() => open(r.path)}>
              <Icon name="hardDrive" size={18} className="muted" />
              <div className="text"><div className="title">{r.label}</div></div>
              <Icon name="chevron" size={14} className="muted" style={{ transform: 'scaleX(-1)' }} />
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="btn" onClick={onCancel}>إلغاء</button>
        <button className="btn btn-primary" disabled={!listing} onClick={() => listing && onPick(listing.path)}>اختيار هذا المجلد</button>
      </div>
    </Sheet>
  )
}
