import { useState } from 'react'
import { Native } from '../../lib/native'
import { useToast } from '../../lib/toastContext'
import { formatBytes, formatDuration } from '../../lib/format'
import type { AudioTag, AudioTagWrite } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { Check, EmptyState, Sheet, Notice } from '../../components/ui'
import { FolderPicker } from '../../components/FolderPicker'
import { PermissionGate } from '../../components/PermissionGate'

type Form = Omit<AudioTagWrite, 'path'>

const FIELDS: { key: keyof Form; label: string }[] = [
  { key: 'title', label: 'العنوان' },
  { key: 'artist', label: 'الفنان' },
  { key: 'album', label: 'الألبوم' },
  { key: 'albumArtist', label: 'فنان الألبوم' },
  { key: 'year', label: 'السنة' },
  { key: 'genre', label: 'النوع' },
  { key: 'track', label: 'رقم المسار' },
  { key: 'comment', label: 'تعليق' }
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
      if (r.tags.length === 0) showToast('لا ملفات صوتية في هذا المجلد')
    } catch (err) {
      showToast('فشلت القراءة: ' + (err as Error).message)
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
      showToast(r.results[0].success ? 'تم حفظ الوسوم' : 'فشل الحفظ: ' + r.results[0].message)
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
      showToast(`حُفظ ${r.results.filter((x) => x.success).length} من ${r.results.length}`)
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
      showToast('لم يطابق النمط أي اسم ملف')
      return
    }
    const r = await Native.writeTags({ items })
    showToast(`عُبّئت وسوم ${r.results.filter((x) => x.success).length} ملف`)
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
    showToast(`أُعيدت تسمية ${ok} ملف`)
    setBatch('none')
    if (folder) load(folder)
  }

  function toggle(p: string): void {
    setSelected((prev) => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n })
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      <div className="toolbar">
        <button className="btn btn-sm btn-primary" onClick={() => setPicking(true)} style={{ flex: 1 }}><Icon name="folderOpen" size={15} /> {folder ? folder.replace('/storage/emulated/0', 'الداخلية') : 'اختر مجلد أغاني'}</button>
        {files.length > 0 && <button className="btn btn-sm" onClick={() => setSelected(selected.size === files.length ? new Set() : new Set(files.map((f) => f.path)))}>{selected.size === files.length ? 'إلغاء الكل' : 'تحديد الكل'}</button>}
      </div>
      {loading ? <div className="card"><div className="skeleton" style={{ height: 60 }} /></div> : files.length === 0 ? <EmptyState icon="music" tone="tone-violet" text="اختر مجلدًا يحوي ملفات MP3 لعرض وتحرير وسومها والأغلفة" /> : (
        <div className="card">
          {files.map((f) => (
            <div key={f.path} className={`row ${selected.has(f.path) ? 'selected' : ''}`} onClick={() => openEdit(f)}>
              <span onClick={(e) => { e.stopPropagation(); toggle(f.path) }}><Check on={selected.has(f.path)} /></span>
              {f.coverThumb ? <img className="app-icon" src={`data:image/jpeg;base64,${f.coverThumb}`} alt="" /> : <div className="tile-icon sm tone-violet"><Icon name="music" size={17} /></div>}
              <div className="text">
                <div className="title">{f.title || <span className="muted">بلا عنوان</span>} {!f.writable && <span className="badge badge-neutral">قراءة فقط</span>}</div>
                <div className="desc">{[f.artist, f.album].filter(Boolean).join(' • ') || f.fileName}</div>
              </div>
              <span className="trail">{formatDuration(f.durationSec)}</span>
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="action-bar no-tabs">
          <button className="btn btn-sm" onClick={() => { setForm({}); setCoverPath(null); setBatch('edit') }}><Icon name="type" size={15} /> تعديل {selected.size}</button>
          <button className="btn btn-sm" onClick={() => setBatch('fill')}><Icon name="keyboard" size={15} /> من الاسم</button>
          <button className="btn btn-sm" onClick={() => setBatch('rename')}><Icon name="file" size={15} /> تسمية</button>
        </div>
      )}

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            {editing.coverThumb && !coverPath ? <img className="cover" src={`data:image/jpeg;base64,${editing.coverThumb}`} alt="" /> : <div className="cover tile-icon tone-violet"><Icon name={coverPath ? 'check' : 'image'} size={24} /></div>}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ marginBottom: 2, wordBreak: 'break-all' }}>{editing.fileName}</h3>
              <div className="muted" style={{ fontSize: 12 }}>{editing.format} • {formatDuration(editing.durationSec)} • {formatBytes(editing.sizeBytes)}</div>
              <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => Native.pickImage().then((r) => r.path && setCoverPath(r.path))}><Icon name="image" size={14} /> {coverPath ? 'غلاف جديد محدَّد' : 'تغيير الغلاف'}</button>
            </div>
          </div>
          {!editing.writable && <Notice kind="warn">الحفظ مدعوم لملفات MP3 فقط؛ هذا الملف للعرض.</Notice>}
          {FIELDS.map((f) => (
            <div key={f.key} className="field">
              <label>{f.label}</label>
              <input type="text" value={form[f.key] ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div className="actions">
            <button className="btn" onClick={() => setEditing(null)}>إلغاء</button>
            <button className="btn btn-primary" disabled={saving || !editing.writable} onClick={save}><Icon name="save" size={15} /> {saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </div>
        </Sheet>
      )}

      {batch === 'edit' && (
        <Sheet onClose={() => setBatch('none')}>
          <h3>تعديل {selected.size} ملف دفعة واحدة</h3>
          <p>تُكتب الحقول التي تملؤها فقط، ويبقى الباقي كما هو.</p>
          <button className="btn btn-sm" style={{ marginBottom: 10 }} onClick={() => Native.pickImage().then((r) => r.path && setCoverPath(r.path))}><Icon name="image" size={14} /> {coverPath ? 'غلاف محدَّد للكل' : 'غلاف للكل'}</button>
          {FIELDS.filter((f) => f.key !== 'title' && f.key !== 'track').map((f) => (
            <div key={f.key} className="field"><label>{f.label}</label><input type="text" value={form[f.key] ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))} /></div>
          ))}
          <div className="actions"><button className="btn" onClick={() => setBatch('none')}>إلغاء</button><button className="btn btn-primary" disabled={saving} onClick={saveBatchEdit}>حفظ للكل</button></div>
        </Sheet>
      )}

      {(batch === 'fill' || batch === 'rename') && (
        <Sheet onClose={() => setBatch('none')}>
          <h3>{batch === 'fill' ? 'تعبئة الوسوم من اسم الملف' : 'إعادة التسمية من الوسوم'}</h3>
          <p>المتغيّرات: <code>%title%</code> <code>%artist%</code> <code>%album%</code> <code>%year%</code> <code>%track%</code></p>
          <input type="text" value={pattern} onChange={(e) => setPattern(e.target.value)} dir="ltr" />
          <div className="card" style={{ marginTop: 12, maxHeight: '30vh', overflowY: 'auto' }}>
            {[...selected].slice(0, 15).map((p) => {
              const tag = files.find((f) => f.path === p)!
              const preview = batch === 'fill' ? Object.entries(parseFileName(tag.fileName, pattern)).map(([k, v]) => `${k}: ${v}`).join(' • ') || 'لا مطابقة' : nameFromTags(tag, pattern)
              return <div key={p} className="row" style={{ minHeight: 44, padding: '8px 14px', cursor: 'default' }}><div className="text"><div className="desc">{tag.fileName}</div><div className="title" style={{ fontSize: 13 }}>{preview}</div></div></div>
            })}
          </div>
          <div className="actions"><button className="btn" onClick={() => setBatch('none')}>إلغاء</button><button className="btn btn-primary" onClick={batch === 'fill' ? applyFill : applyRename}>تطبيق</button></div>
        </Sheet>
      )}

      {picking && <FolderPicker title="مجلد الأغاني" onPick={(p) => { setFolder(p); setPicking(false); load(p) }} onCancel={() => setPicking(false)} />}
    </div>
  )
}
