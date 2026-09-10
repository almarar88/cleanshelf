import { useCallback, useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { t } from '../../lib/i18n'
import { fmtNum, formatBytes, formatDate } from '../../lib/format'
import { markTaskDone } from '../../lib/plan'
import { tap, success } from '../../lib/haptics'
import type { TrashItem } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, Ico, Notice } from '../../components/ui'

export function Trash(): JSX.Element {
  const { settings } = useApp()
  const { showToast } = useToast()
  const [items, setItems] = useState<TrashItem[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<'empty' | 'delete' | null>(null)

  const load = useCallback(async () => {
    const r = await Native.listTrash()
    setItems(r.items)
    setTotal(r.totalBytes)
    setSelected(new Set())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function toggle(id: string): void {
    tap()
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
    showToast(ok === r.results.length ? t('trash.restored', { n: fmtNum(ok) }) : t('trash.restoredPartial', { ok: fmtNum(ok), fail: fmtNum(r.results.length - ok) }))
    load()
  }

  async function deleteSelected(): Promise<void> {
    setConfirm(null)
    const r = await Native.deleteTrash({ ids: [...selected] })
    showToast(t('trash.deletedFreed', { size: formatBytes(r.freedBytes) }))
    load()
  }

  async function empty(): Promise<void> {
    setConfirm(null)
    const r = await Native.emptyTrash()
    success()
    markTaskDone('trash')
    showToast(t('trash.emptied', { size: formatBytes(r.freedBytes) }))
    load()
  }

  return (
    <div className="page no-tabs">
      <Notice icon="shield">{t('trash.hint', { n: fmtNum(settings.trashRetentionDays) })}</Notice>

      <div className="toolbar" style={{ margin: '14px 0' }}>
        <strong style={{ fontSize: 13.5 }}>{t('trash.count', { n: fmtNum(items.length), size: formatBytes(total) })}</strong>
        <div className="spacer" />
        {items.length > 0 && (
          <button className="btn btn-sm" onClick={() => { tap(); setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id))) }}>
            {selected.size === items.length ? t('common.clearAll') : t('common.selectAll')}
          </button>
        )}
        <button className="btn btn-sm btn-danger" disabled={items.length === 0} onClick={() => { tap(); setConfirm('empty') }}>{t('trash.emptyBtn')}</button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="trash" tone="tone-red" text={t('trash.empty')} />
      ) : (
        <div className="card">
          {items.map((i, idx) => (
            <div key={i.id} className={`row ${selected.has(i.id) ? 'on' : ''}`} style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }} onClick={() => toggle(i.id)}>
              <Check on={selected.has(i.id)} />
              <Ico name={i.isDirectory ? 'folder' : 'file'} tone="tone-ink" size="sm" />
              <div className="text">
                <div className="title">{i.name}</div>
                <div className="desc mono" style={{ direction: 'ltr', textAlign: 'start' }}>{i.originalPath.slice(0, i.originalPath.lastIndexOf('/')).replace('/storage/emulated/0', '') || '/'}</div>
                <div className="desc">{formatDate(i.trashedAt)}</div>
              </div>
              <span className="trail">{formatBytes(i.sizeBytes)}</span>
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="action-bar no-tabs">
          <button className="btn btn-dark" onClick={restore}><Icon name="refresh" size={17} /> {t('trash.restore', { n: fmtNum(selected.size) })}</button>
          <button className="btn btn-danger" onClick={() => setConfirm('delete')}><Icon name="x" size={17} /> {t('trash.deleteForever')}</button>
        </div>
      )}

      {confirm === 'empty' && (
        <ConfirmSheet title={t('trash.emptyBtn')} message={t('trash.emptyConfirm', { n: fmtNum(items.length), size: formatBytes(total) })} confirmLabel={t('trash.emptyBtn')} danger onConfirm={empty} onCancel={() => setConfirm(null)} />
      )}
      {confirm === 'delete' && (
        <ConfirmSheet title={t('trash.deleteForever')} message={t('trash.deleteConfirm', { n: fmtNum(selected.size) })} confirmLabel={t('trash.deleteForever')} danger onConfirm={deleteSelected} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}
