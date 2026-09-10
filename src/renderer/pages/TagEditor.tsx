import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import type { AudioTag } from '../../shared/types'
import { formatDuration } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

type FormState = Partial<
  Pick<AudioTag, 'title' | 'artist' | 'album' | 'albumArtist' | 'year' | 'genre' | 'track' | 'comment'>
>

const EMPTY_FORM: FormState = {}

export function TagEditor(): JSX.Element {
  const { showToast } = useToast()
  const [folder, setFolder] = useState<string | null>(null)
  const [files, setFiles] = useState<AudioTag[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [namePattern, setNamePattern] = useState('%artist% - %title%')
  const [fillPattern, setFillPattern] = useState('%artist% - %title%')
  const [saving, setSaving] = useState(false)
  const [coverPath, setCoverPath] = useState<string | null>(null)

  async function pickFolder(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (!picked) return
    setFolder(picked)
    setSelected(new Set())
    setLoading(true)
    try {
      setFiles(await window.api.tags.readFolder(picked))
    } catch (err) {
      showToast(t('tg.readFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const selectedFiles = useMemo(() => files.filter((f) => selected.has(f.path)), [files, selected])

  useEffect(() => {
    if (selectedFiles.length === 1) {
      const f = selectedFiles[0]
      setForm({
        title: f.title,
        artist: f.artist,
        album: f.album,
        albumArtist: f.albumArtist,
        year: f.year,
        genre: f.genre,
        track: f.track,
        comment: f.comment
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setCoverPath(null)
  }, [selectedFiles.map((f) => f.path).join('|')])

  function toggle(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function toggleAll(): void {
    setSelected((prev) => (prev.size === files.length ? new Set() : new Set(files.map((f) => f.path))))
  }

  async function pickCover(): Promise<void> {
    const p = await window.api.dialogs.pickImageFile()
    if (p) setCoverPath(p)
  }

  async function save(): Promise<void> {
    if (selectedFiles.length === 0) return
    setSaving(true)
    try {
      const inputs = selectedFiles.map((f) => ({
        path: f.path,
        ...form,
        coverPath: coverPath || undefined
      }))
      const results = await window.api.tags.writeBatch(inputs)
      const failed = results.filter((r) => !r.success)
      showToast(failed.length ? t('tg.savePartial', { fail: fmtNum(failed.length), n: fmtNum(results.length) }) : t('tg.saved'))
      if (folder) setFiles(await window.api.tags.readFolder(folder))
    } finally {
      setSaving(false)
    }
  }

  async function renameSelectedFromTags(): Promise<void> {
    if (selectedFiles.length === 0) return
    let ok = 0
    for (const f of selectedFiles) {
      const result = await window.api.tags.renameFromPattern(f, namePattern)
      if (result.success) ok += 1
    }
    showToast(t('tg.renamed', { ok: fmtNum(ok), n: fmtNum(selectedFiles.length) }))
    if (folder) setFiles(await window.api.tags.readFolder(folder))
  }

  async function fillFromFileNames(): Promise<void> {
    if (!folder) return
    const results = await window.api.tags.fillFromFileName(folder, fillPattern)
    const writes = results.map((r) => ({ path: r.path, ...r.fields }))
    if (writes.length === 0) {
      showToast(t('tg.noMatch'))
      return
    }
    const written = await window.api.tags.writeBatch(writes)
    showToast(t('tg.filled', { n: fmtNum(written.filter((w) => w.success).length) }))
    setFiles(await window.api.tags.readFolder(folder))
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={pickFolder} disabled={loading}>
          <Icon name="folderOpen" size={15} /> {t('tg.pickFolder')}
        </button>
        {folder && <span className="muted">{folder}</span>}
        <div className="spacer" />
        {files.length > 0 && (
          <button className="btn btn-sm" onClick={toggleAll}>
            {t(selected.size === files.length ? 'od.clearAll' : 'common.selectAll')}
          </button>
        )}
      </div>

      {files.length === 0 ? (
        <div className="empty-state">
          <div className="tile-icon tone-violet"><Icon name="music" size={26} /></div>
          <div>{loading ? t('tg.reading') : t('tg.empty')}</div>
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }} />
                  <th>{t('tg.thFile')}</th>
                  <th>{t('tg.artist')}</th>
                  <th>{t('tg.title')}</th>
                  <th>{t('tg.duration')}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.path} onClick={() => toggle(f.path)} style={{ cursor: 'pointer' }}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(f.path)} onChange={() => toggle(f.path)} />
                    </td>
                    <td>{f.fileName}</td>
                    <td className="muted">{f.artist || '—'}</td>
                    <td className="muted">{f.title || '—'}</td>
                    <td className="muted">{formatDuration(f.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            {selectedFiles.length === 0 ? (
              <div className="muted">{t('tg.pickOne')}</div>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>
                  {selectedFiles.length === 1 ? selectedFiles[0].fileName : t('tg.nSelected', { n: fmtNum(selectedFiles.length) })}
                </h3>
                {selectedFiles.length > 1 && (
                  <p className="muted" style={{ fontSize: 12 }}>
                    {t('tg.batchNote')}
                  </p>
                )}
                <Field label={t('tg.title')} value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
                <Field label={t('tg.artist')} value={form.artist} onChange={(v) => setForm((f) => ({ ...f, artist: v }))} />
                <Field label={t('tg.album')} value={form.album} onChange={(v) => setForm((f) => ({ ...f, album: v }))} />
                <Field
                  label={t('tg.albumArtist')}
                  value={form.albumArtist}
                  onChange={(v) => setForm((f) => ({ ...f, albumArtist: v }))}
                />
                <div className="grid grid-2" style={{ gap: 10 }}>
                  <Field label={t('tg.year')} value={form.year} onChange={(v) => setForm((f) => ({ ...f, year: v }))} />
                  <Field label={t('tg.track')} value={form.track} onChange={(v) => setForm((f) => ({ ...f, track: v }))} />
                </div>
                <Field label={t('tg.genre')} value={form.genre} onChange={(v) => setForm((f) => ({ ...f, genre: v }))} />
                <Field
                  label={t('tg.comment')}
                  value={form.comment}
                  onChange={(v) => setForm((f) => ({ ...f, comment: v }))}
                />

                <div className="toolbar" style={{ marginTop: 10 }}>
                  <button className="btn btn-sm" onClick={pickCover}>
                    <Icon name="image" size={15} /> {t('tg.changeCover')}
                  </button>
                  {coverPath && <span className="muted" style={{ fontSize: 12 }}>{t('tg.coverChosen')}</span>}
                </div>

                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
                  <Icon name="save" size={15} /> {saving ? t('tg.saving') : t('tg.saveTags')}
                </button>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                  {t('tg.mp3Only')}
                </p>

                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

                <h4 style={{ marginBottom: 6 }}>{t('tg.renameFromTags')}</h4>
                <div className="toolbar">
                  <input
                    type="text"
                    value={namePattern}
                    onChange={(e) => setNamePattern(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-sm" onClick={renameSelectedFromTags}>
                    {t('common.apply')}
                  </button>
                </div>
              </>
            )}

            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <h4 style={{ marginBottom: 6 }}>{t('tg.fillFromName')}</h4>
            <div className="toolbar">
              <input
                type="text"
                value={fillPattern}
                onChange={(e) => setFillPattern(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm" onClick={fillFromFileNames}>
                {t('tg.applyFolder')}
              </button>
            </div>
            <p className="muted" style={{ fontSize: 11.5 }}>
              {t('tg.patternExample')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange
}: {
  label: string
  value?: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      />
    </div>
  )
}
