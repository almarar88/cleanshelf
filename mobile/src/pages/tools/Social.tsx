import { useEffect, useMemo, useState } from 'react'
import { Native } from '../../lib/native'
import { useToast } from '../../lib/toastContext'
import { formatBytes, formatDate } from '../../lib/format'
import type { ScanProgress, SocialCategory } from '../../lib/types'
import { Icon, type IconName } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, ProgressPanel } from '../../components/ui'
import { PermissionGate } from '../../components/PermissionGate'
import { CleanOverlay } from '../../components/CleanOverlay'
import { tap, success } from '../../lib/haptics'
import { useApp } from '../../lib/appContext'

const ICONS: Record<string, IconName> = { images: 'image', video: 'play', voice: 'music', audio: 'music', docs: 'fileText', status: 'clock', stickers: 'heart', gifs: 'image', profile: 'grid', wallpaper: 'palette', stories: 'clock' }

export function Social(): JSX.Element {
  const { permissions } = useApp()
  const { showToast } = useToast()
  const [cats, setCats] = useState<SocialCategory[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const [overlay, setOverlay] = useState<{ phase: 'working' | 'done'; freed: number } | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const h = Native.addListener('scanProgress', setProgress)
    return () => {
      h.then((x) => x.remove())
    }
  }, [])

  async function scan(): Promise<void> {
    setScanning(true)
    try {
      const r = await Native.socialMedia()
      setCats(r.categories)
      setSelected(new Set(r.categories.filter((c) => c.risk === 'safe').map((c) => c.id)))
      if (r.categories.length === 0) showToast('لا وسائط واتساب أو تيليجرام على هذا الهاتف')
    } catch (err) {
      showToast('فشل الفحص: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (permissions.allFiles && !cats && !scanning) scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.allFiles])

  const apps = useMemo(() => [...new Set((cats ?? []).map((c) => c.app))], [cats])
  const visible = (cats ?? []).filter((c) => filter === 'all' || c.app === filter)
  const total = (cats ?? []).reduce((s, c) => s + c.sizeBytes, 0)
  const selBytes = (cats ?? []).filter((c) => selected.has(c.id)).reduce((s, c) => s + c.sizeBytes, 0)
  const selFiles = (cats ?? []).filter((c) => selected.has(c.id)).reduce((s, c) => s + c.fileCount, 0)

  function toggle(id: string): void {
    tap()
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function clean(): Promise<void> {
    setConfirm(false)
    setOverlay({ phase: 'working', freed: 0 })
    const paths = (cats ?? []).filter((c) => selected.has(c.id)).flatMap((c) => c.paths)
    try {
      const r = await Native.trash({ paths })
      const ok = r.results.filter((x) => x.success).length
      setOverlay({ phase: 'done', freed: selBytes * (paths.length ? ok / paths.length : 0) })
      success()
      scan()
    } catch (err) {
      setOverlay(null)
      showToast('فشل: ' + (err as Error).message)
    }
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />
      {cats && cats.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="tile-icon tone-green"><Icon name="message" size={22} /></div>
            <div style={{ flex: 1 }}>
              <div className="card-title">{formatBytes(total)} من وسائط الدردشات</div>
              <div className="card-sub">محدَّد {formatBytes(selBytes)} • {selFiles.toLocaleString('ar')} ملف</div>
            </div>
            <button className="icon-btn raised" onClick={scan} disabled={scanning}><Icon name="refresh" size={17} /></button>
          </div>
          <div className="chip-list" style={{ marginTop: 12 }}>
            <button className={`app-tag ${filter === 'all' ? '' : ''}`} style={{ borderColor: filter === 'all' ? 'var(--accent)' : undefined }} onClick={() => setFilter('all')}>الكل</button>
            {apps.map((a) => <button key={a} className={`app-tag ${a === 'WhatsApp' ? 'wa' : 'tg'}`} style={{ borderColor: filter === a ? 'currentColor' : undefined }} onClick={() => setFilter(a)}>{a === 'WhatsApp' ? 'واتساب' : 'تيليجرام'}</button>)}
          </div>
        </div>
      )}
      {scanning ? <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /> : !cats ? <EmptyState icon="message" tone="tone-green" text="يفحص مجلدات وسائط واتساب وتيليجرام: الصور والفيديو والرسائل الصوتية والحالات" /> : cats.length === 0 ? <EmptyState icon="checkCircle" tone="tone-green" text="لا وسائط دردشات على هذا الهاتف" /> : (
        <div className="card">
          {visible.map((c) => {
            const kind = c.id.split('_')[1]
            return (
              <div key={c.id} className={`row ${selected.has(c.id) ? 'selected' : ''}`} onClick={() => toggle(c.id)}>
                <Check on={selected.has(c.id)} />
                <div className={`tile-icon sm ${c.risk === 'caution' ? 'tone-amber' : 'tone-green'}`}><Icon name={ICONS[kind] ?? 'file'} size={17} /></div>
                <div className="text">
                  <div className="title">{c.label} {c.risk === 'caution' && <span className="badge badge-caution">راجع</span>}</div>
                  <div className="desc">{c.fileCount.toLocaleString('ar')} ملف • آخر ملف {formatDate(c.newestAt).split('،')[0]}</div>
                </div>
                <span className="trail">{formatBytes(c.sizeBytes)}</span>
              </div>
            )
          })}
        </div>
      )}
      {selected.size > 0 && !scanning && (
        <div className="action-bar no-tabs">
          <button className="btn btn-danger" onClick={() => setConfirm(true)}><Icon name="trash" size={16} /> نقل {formatBytes(selBytes)} إلى سلة المهملات</button>
        </div>
      )}
      {confirm && <ConfirmSheet title="تنظيف وسائط الدردشات" message={`سيُنقل ${selFiles.toLocaleString('ar')} ملف (${formatBytes(selBytes)}) إلى سلة مهملات CleanShelf. الرسائل نفسها تبقى، والوسائط يمكن استرجاعها من السلة خلال أيام الاحتفاظ.`} confirmLabel="نقل" danger onConfirm={clean} onCancel={() => setConfirm(false)} />}
      {overlay && <CleanOverlay phase={overlay.phase} freedBytes={overlay.freed} label="جارٍ نقل الوسائط…" onClose={() => setOverlay(null)} />}
    </div>
  )
}
