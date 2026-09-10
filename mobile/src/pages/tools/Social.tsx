import { useEffect, useMemo, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import { t } from '../../lib/i18n'
import { fmtNum, formatBytes, formatShortDate, splitBytes } from '../../lib/format'
import { markTaskDone } from '../../lib/plan'
import { tap, success } from '../../lib/haptics'
import type { ScanProgress, SocialCategory } from '../../lib/types'
import { Icon, type IconName } from '../../components/Icon'
import { Check, ConfirmSheet, EmptyState, Ico, ProgressPanel } from '../../components/ui'
import { PermissionGate } from '../../components/PermissionGate'
import { CleanOverlay } from '../../components/CleanOverlay'

const ICONS: Record<string, IconName> = {
  images: 'image',
  video: 'play',
  voice: 'music',
  audio: 'music',
  docs: 'fileText',
  status: 'clock',
  stickers: 'heart',
  gifs: 'image',
  profile: 'grid',
  wallpaper: 'palette',
  stories: 'clock'
}

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
      if (r.categories.length === 0) showToast(t('social.none'))
    } catch (err) {
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
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
  const totalSplit = splitBytes(total)

  function toggle(id: string): void {
    tap()
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
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
      markTaskDone('social')
      scan()
    } catch (err) {
      setOverlay(null)
      showToast(t('toast.scanFailed', { msg: (err as Error).message }))
    }
  }

  return (
    <div className="page no-tabs">
      <PermissionGate compact />

      {cats && cats.length > 0 && (
        <section className="tile orange">
          <div className="tile-head">
            <h3>{t('page.social')}</h3>
            <button className="tile-btn" onClick={() => { tap(); scan() }} disabled={scanning} aria-label={t('common.rescan')}><Icon name="refresh" size={17} /></button>
          </div>
          <div className="display sm" style={{ margin: '4px 0 2px' }}>
            {totalSplit.value}
            <small>{totalSplit.unit}</small>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.75 }}>{t('social.selectedInfo', { size: formatBytes(selBytes), n: fmtNum(selFiles) })}</div>
          <div className="pill-row" style={{ marginTop: 14, marginBottom: 0 }}>
            <button className={`pill sm ${filter === 'all' ? 'active' : ''}`} onClick={() => { tap(); setFilter('all') }}>{t('common.all')}</button>
            {apps.map((a) => (
              <button key={a} className={`pill sm ${filter === a ? 'active' : ''}`} onClick={() => { tap(); setFilter(a) }}>
                {a === 'WhatsApp' ? t('social.whatsapp') : t('social.telegram')}
              </button>
            ))}
          </div>
        </section>
      )}

      {scanning ? (
        <div style={{ marginTop: 14 }}><ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /></div>
      ) : !cats ? (
        <EmptyState icon="message" tone="tone-green" text={t('social.empty')} />
      ) : cats.length === 0 ? (
        <EmptyState icon="checkCircle" tone="tone-green" text={t('social.none')} />
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          {visible.map((c, i) => {
            const kind = c.id.split('_')[1]
            return (
              <div key={c.id} className={`row ${selected.has(c.id) ? 'on' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} onClick={() => toggle(c.id)}>
                <Check on={selected.has(c.id)} />
                <Ico name={ICONS[kind] ?? 'file'} tone={c.risk === 'caution' ? 'tone-yellow' : 'tone-green'} size="sm" />
                <div className="text">
                  <div className="title">{c.label} {c.risk === 'caution' && <span className="badge badge-warn">{t('common.review')}</span>}</div>
                  <div className="desc">{fmtNum(c.fileCount)} {t('common.files')} • {t('social.lastFile', { date: formatShortDate(c.newestAt) })}</div>
                </div>
                <span className="trail">{formatBytes(c.sizeBytes)}</span>
              </div>
            )
          })}
        </div>
      )}

      {selected.size > 0 && !scanning && (
        <div className="action-bar no-tabs">
          <button className="btn btn-dark" onClick={() => { tap(); setConfirm(true) }}>
            <Icon name="trash" size={17} /> {t('trashBar.move', { n: fmtNum(selFiles), size: formatBytes(selBytes) })}
          </button>
        </div>
      )}

      {confirm && (
        <ConfirmSheet
          title={t('page.social')}
          message={t('social.confirm', { n: fmtNum(selFiles), size: formatBytes(selBytes) })}
          confirmLabel={t('common.moveToTrash')}
          danger
          onConfirm={clean}
          onCancel={() => setConfirm(false)}
        />
      )}
      {overlay && <CleanOverlay phase={overlay.phase} freedBytes={overlay.freed} label={t('social.moving')} onClose={() => setOverlay(null)} />}
    </div>
  )
}
