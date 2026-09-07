import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { formatBytes, formatDate } from '../../lib/format'
import type { TrashItem } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, Notice } from '../../components/ui'

export function Trash(): JSX.Element {
  const { settings } = useApp()
  const { showToast } = useToast()
  const [items, setItems] = useState<TrashItem[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<'empty' | 'delete' | null>(null)

  async function load(): Promise<void> {
    const r = await Native.listTrash()
    setItems(r.items)
    setTotal(r.totalBytes)
    setSelected(new Set())
  }

  useEffect(() => {
    load()
  }, [])

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function restore(): Promise<void> {
    const r = await Native.restoreTrash({ ids: [...selected] })
    const ok = r.results.filter((x) => x.success).length
    showToast(ok === r.results.length ? `استُرجع ${ok} عنصر إلى مكانه` : `استُرجع ${ok}، وتعذّر ${r.results.length - ok}`)
    load()
  }

  async function deleteSelected(): Promise<void> {
    setConfirm(null)
    const r = await Native.deleteTrash({ ids: [...selected] })
    showToast(`حُذف نهائيًا وتحرّر ${formatBytes(r.freedBytes)}`)
    load()
  }

  async function empty(): Promise<void> {
    setConfirm(null)
    const r = await Native.emptyTrash()
    showToast(`أُفرغت السلة وتحرّر ${formatBytes(r.freedBytes)}`)
    load()
  }

  return (
    <div className="page no-tabs">
      <Notice icon="shield">كل ما تحذفه من CleanShelf يأتي هنا أولًا، ويُحذف نهائيًا تلقائيًا بعد {settings.trashRetentionDays} يومًا. غيّر المدة من الإعدادات.</Notice>
      <div className="toolbar">
        <strong style={{ fontSize: 13.5 }}>{items.length} عنصر • {formatBytes(total)}</strong>
        <div className="spacer" />
        {items.length > 0 && <button className="btn btn-sm" onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}>{selected.size === items.length ? 'إلغاء الكل' : 'تحديد الكل'}</button>}
        <button className="btn btn-sm btn-danger" disabled={items.length === 0} onClick={() => setConfirm('empty')}>إفراغ السلة</button>
      </div>
      {items.length === 0 ? <EmptyState icon="trash" tone="tone-red" text="سلة المهملات فارغة" /> : (
        <div className="card">
          {items.map((i) => (
            <div key={i.id} className={`row ${selected.has(i.id) ? 'selected' : ''}`} onClick={() => toggle(i.id)}>
              <Check on={selected.has(i.id)} />
              <Icon name={i.isDirectory ? 'folder' : 'file'} size={17} className="muted" />
              <div className="text">
                <div className="title">{i.name}</div>
                <div className="desc mono">{i.originalPath.slice(0, i.originalPath.lastIndexOf('/')).replace('/storage/emulated/0', '') || '/'}</div>
                <div className="desc">{formatDate(i.trashedAt)}</div>
              </div>
              <span className="trail">{formatBytes(i.sizeBytes)}</span>
            </div>
          ))}
        </div>
      )}
      {selected.size > 0 && (
        <div className="action-bar no-tabs">
          <button className="btn btn-primary" onClick={restore}><Icon name="refresh" size={16} /> استرجاع {selected.size}</button>
          <button className="btn btn-danger" onClick={() => setConfirm('delete')}><Icon name="x" size={16} /> حذف نهائي</button>
        </div>
      )}
      {confirm === 'empty' && <ConfirmSheet title="إفراغ سلة المهملات" message={`سيُحذف ${items.length} عنصر (${formatBytes(total)}) نهائيًا ولا يمكن استرجاعه.`} confirmLabel="إفراغ" danger onConfirm={empty} onCancel={() => setConfirm(null)} />}
      {confirm === 'delete' && <ConfirmSheet title="حذف نهائي" message={`سيُحذف ${selected.size} عنصر نهائيًا ولا يمكن استرجاعه.`} confirmLabel="حذف نهائي" danger onConfirm={deleteSelected} onCancel={() => setConfirm(null)} />}
    </div>
  )
}
