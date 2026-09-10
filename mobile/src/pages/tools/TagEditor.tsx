import { useState } from 'react'
import { Native } from '../../lib/native'
import { useToast } from '../../lib/toastContext'
import { fmtNum, formatBytes, formatDuration } from '../../lib/format'
import { t } from '../../lib/i18n'
import { tap } from '../../lib/haptics'
import type { AudioTag, AudioTagWrite } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, EmptyState, Ico, Notice, Sheet } from '../../components/ui'
import { FolderPicker } from '../../components/FolderPicker'
import { PermissionGate } from '../../components/PermissionGate'

type Form = Omit<AudioTagWrite, 'path'>

const FIELDS: { key: keyof Form; labelKey: string }[] = [
  { key: 'title', labelKey: 'tags.title' },
  { key: 'artist', labelKey: 'tags.artist' },
  { key: 'album', labelKey: 'tags.album' },
  { key: 'albumArtist', labelKey: 'tags.albumArtist' },
  { key: 'year', labelKey: 'tags.year' },
  { key: 'genre', labelKey: 'tags.genre' },
  { key: 'track', labelKey: 'tags.track' },
  { key: 'comment', labelKey: 'tags.comment' }
]

/** يستخرج الحقول من اسم الملف بنمط مثل "%artist% - %title%" */
function parseFileName(name: string, pattern: string): Record<string, string> {
  const base = name.replace(/\.[^.]+$/, '')
  const keys: string[] = []
  const regex = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%(\w+)%/g, (_, k) => { keys.push(k); return '(.+?)' }) + '$')
  const m = base.match(regex)
  if (!m) return {}
  const out: Record<string, string> = {}
  keys.forEach((k, i) => { out[k] = m[i + 1].trim() })
  return out
}

function nameFromTags(tag: AudioTag, pattern: string): string {
  const ext = tag.fileName.slice(tag.fileName.lastIndexOf('.'))
  const clean = (s: string): string => s.replace(/[\\/:*?"<>|]/g, '').trim()
  return pattern.replace(/%(\w+)%/g, (_, k) => clean(String((tag as unknown as Record<string, string>)[k] ?? ''))) + ext
}

export function TagEditor(): JSX.Element {
  const { showToast } = useToast()
  const [folder, setFolder] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<AudioTag[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<AudioTag | null>(null)
  const [form, setForm] = useState<Form>({})
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [batch, setBatch] = useState<'none' | 'fill' | 'rename' | 'edit'>('none')
  const [pattern, setPattern] = useState('%artist% - %title%')
  const [saving, setSaving] = useState(false)

  async function load(path: string): Promise<void> {
    setLoading(true)
    setSelected(new Set())
    try {
      const r = await Native.readTags({ folder: path })
      setFiles(r.tags)
      if (r.tags.length === 0) showToast(t('tags.none'))
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  function openEdit(tag: AudioTag): void {
    setEditing(tag)
    setCoverPath(null)
    setForm({ title: tag.title, artist: tag.artist, album: tag.album, albumArtist: tag.albumArtist, year: tag.year, genre: tag.genre, track: tag.track, comment: tag.comment })
  }

  async function save(): Promise<void> {
    if (!editing) return
    setSaving(true)
    try {
      const r = await Native.writeTags({ items: [{ path: editing.path, ...form, coverPath }] })
      showToast(r.results[0].success ? t('tags.saved') : t('tags.saveFailed', { msg: r.results[0].message }))
      setEditing(null)
      if (folder) load(folder)
    } finally {
      setSaving(false)
    }
  }

  async function saveBatchEdit(): Promise<void> {
    setSaving(true)
    try {
      const items: AudioTagWrite[] = [...selected].map((p) => ({ path: p, ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== undefined && v !== '')), coverPath }))
      const r = await Native.writeTags({ items })
      showToast(t('tags.savedCount', { ok: fmtNum(r.results.filter((x) => x.success).length), total: fmtNum(r.results.length) }))
      setBatch('none')
      if (folder) load(folder)
    } finally {
      setSaving(false)
    }
  }

  async function applyFill(): Promise<void> {
    const items: AudioTagWrite[] = [...selected].map((p) => {
      const tag = files.find((f) => f.path === p)!
      return { path: p, ...parseFileName(tag.fileName, pattern) }
    }).filter((i) => Object.keys(i).length > 1)
    if (items.length === 0) {
      showToast(t('tags.noMatch'))
      return
    }
    const r = await Native.writeTags({ items })
    showToast(t('tags.filled', { n: fmtNum(r.results.filter((x) => x.success).length) }))
    setBatch('none')
    if (folder) load(folder)
  }

  async function applyRename(): Promise<void> {
    let ok = 0
    for (const p of selected) {
      const tag = files.find((f) => f.path === p)!
      const newName = nameFromTags(tag, pattern)
      if (!newName || newName === tag.fileName || newName.startsWith('.')) continue
      try {
        await Native.rename({ path: p, newName })
        ok += 1
      } catch {
        // نكمل
      }
    }
    showToast(t('tags.renamed', { n: fmtNum(ok) }))
    setBatch('none')
    if (folder) load(folder)
  }

  function toggle(p: string): void {
    tap()
    setSelected((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <button className="btn btn-sm btn-dark" onClick={() => { tap(); setPicking(true) }} style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0 }}>
          <Icon name="folderOpen" size={16} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder ? folder.replace('/storage/emulated/0', t('files.internal')) : t('tags.pickFolder')}</span>
        </button>
        {files.length > 0 && (
          <button className="btn btn-sm" onClick={() => { tap(); setSelected(selected.size === files.length ? new Set() : new Set(files.map((f) => f.path))) }}>
            {selected.size === files.length ? t('common.clearAll') : t('common.selectAll')}
          </button>
        )}
      </div>
      {loading ? <div className="card"><div className="skeleton" style={{ height: 60 }} /></div> : files.length === 0 ? <EmptyState icon="music" tone="tone-violet" text={t('tags.empty')} /> : (
        <div className="card">
          {files.map((f) => (
            <div key={f.path} className={`row ${selected.has(f.path) ? 'on' : ''}`} onClick={() => openEdit(f)}>
              <span onClick={(e) => { e.stopPropagation(); toggle(f.path) }}><Check on={selected.has(f.path)} /></span>
              {f.coverThumb ? <img className="app-icon" src={`data:image/jpeg;base64,${f.coverThumb}`} alt="" loading="lazy" /> : <Ico name="music" tone="tone-violet" size="sm" />}
              <div className="text">
                <div className="title">{f.title || <span className="muted">{t('tags.noTitle')}</span>} {!f.writable && <span className="badge badge-neutral">{t('tags.readOnly')}</span>}</div>
                <div className="desc">{[f.artist, f.album].filter(Boolean).join(' • ') || f.fileName}</div>
              </div>
              <span className="trail">{formatDuration(f.durationSec)}</span>
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="action-bar no-tabs">
          <button className="btn btn-sm" onClick={() => { tap(); setForm({}); setCoverPath(null); setBatch('edit') }}><Icon name="type" size={16} /> {t('tags.batchEdit', { n: fmtNum(selected.size) })}</button>
          <button className="btn btn-sm" onClick={() => { tap(); setBatch('fill') }}><Icon name="keyboard" size={16} /> {t('tags.fromName')}</button>
          <button className="btn btn-sm" onClick={() => { tap(); setBatch('rename') }}><Icon name="file" size={16} /> {t('tags.renameFrom')}</button>
        </div>
      )}

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            {editing.coverThumb && !coverPath ? <img className="cover" src={`data:image/jpeg;base64,${editing.coverThumb}`} alt="" /> : <span className="cover"><Icon name={coverPath ? 'check' : 'image'} size={26} /></span>}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ marginBottom: 2, wordBreak: 'break-all' }}>{editing.fileName}</h3>
              <div className="muted" style={{ fontSize: 12 }}>{editing.format} • {formatDuration(editing.durationSec)} • {formatBytes(editing.sizeBytes)}</div>
              <button className="btn btn-sm" style={{ marginTop: 7 }} onClick={() => Native.pickImage().then((r) => r.path && setCoverPath(r.path))}><Icon name="image" size={15} /> {coverPath ? t('tags.coverSet') : t('tags.changeCover')}</button>
            </div>
          </div>
          {!editing.writable && <Notice kind="warn">{t('tags.mp3Only')}</Notice>}
          {FIELDS.map((f) => (
            <div key={f.key} className="field">
              <label>{t(f.labelKey)}</label>
              <input type="text" value={form[f.key] ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div className="actions">
            <button className="btn" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button className="btn btn-dark" disabled={saving || !editing.writable} onClick={save}><Icon name="save" size={16} /> {saving ? t('common.loading') : t('common.save')}</button>
          </div>
        </Sheet>
      )}

      {batch === 'edit' && (
        <Sheet onClose={() => setBatch('none')}>
          <h3>{t('tags.batchEditTitle', { n: fmtNum(selected.size) })}</h3>
          <p>{t('tags.batchEditHint')}</p>
          <button className="btn btn-sm" style={{ marginBottom: 10 }} onClick={() => Native.pickImage().then((r) => r.path && setCoverPath(r.path))}><Icon name="image" size={15} /> {coverPath ? t('tags.coverSetAll') : t('tags.coverAll')}</button>
          {FIELDS.filter((f) => f.key !== 'title' && f.key !== 'track').map((f) => (
            <div key={f.key} className="field"><label>{t(f.labelKey)}</label><input type="text" value={form[f.key] ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))} /></div>
          ))}
          <div className="actions"><button className="btn" onClick={() => setBatch('none')}>{t('common.cancel')}</button><button className="btn btn-dark" disabled={saving} onClick={saveBatchEdit}>{t('tags.saveAll')}</button></div>
        </Sheet>
      )}

      {(batch === 'fill' || batch === 'rename') && (
        <Sheet onClose={() => setBatch('none')}>
          <h3>{batch === 'fill' ? t('tags.fillTitle') : t('tags.renameTitle')}</h3>
          <p>{t('tags.vars')} <code>%title%</code> <code>%artist%</code> <code>%album%</code> <code>%year%</code> <code>%track%</code></p>
          <input type="text" value={pattern} onChange={(e) => setPattern(e.target.value)} dir="ltr" />
          <div className="card" style={{ marginTop: 12, maxHeight: '30vh', overflowY: 'auto' }}>
            {[...selected].slice(0, 15).map((p) => {
              const tag = files.find((f) => f.path === p)!
              const preview = batch === 'fill' ? Object.entries(parseFileName(tag.fileName, pattern)).map(([k, v]) => `${k}: ${v}`).join(' • ') || t('tags.noMatch') : nameFromTags(tag, pattern)
              return <div key={p} className="row" style={{ minHeight: 44, cursor: 'default' }}><div className="text"><div className="desc">{tag.fileName}</div><div className="title" style={{ fontSize: 13.5 }}>{preview}</div></div></div>
            })}
          </div>
          <div className="actions"><button className="btn" onClick={() => setBatch('none')}>{t('common.cancel')}</button><button className="btn btn-dark" onClick={batch === 'fill' ? applyFill : applyRename}>{t('files.batchApply')}</button></div>
        </Sheet>
      )}

      {picking && <FolderPicker title={t('tags.pickFolder')} onPick={(p) => { setFolder(p); setPicking(false); load(p) }} onCancel={() => setPicking(false)} />}
    </div>
  )
}
