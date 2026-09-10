import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import type { CleanerCategory, CleanProgress } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { categoryLabel } from '../lib/labels'
import { useToast } from '../lib/toastContext'
import { getLang, t } from '../lib/i18n'
import { fmtNum } from '../lib/format'

export function Cleaner(): JSX.Element {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<CleanerCategory[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cleaning, setCleaning] = useState(false)
  const [progress, setProgress] = useState<Record<string, CleanProgress>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [isAdmin, setIsAdmin] = useState(true)
  const [isMac, setIsMac] = useState(false)
  const [makeRestorePoint, setMakeRestorePoint] = useState(false)

  const scan = async (): Promise<void> => {
    setLoading(true)
    setProgress({})
    try {
      const result = await window.api.cleaner.scan()
      setCategories(result.categories)
      setSelected(new Set(result.categories.filter((c) => c.risk === 'safe' && c.sizeBytes > 0).map((c) => c.id)))
    } catch (err) {
      showToast(t('cl.scanFailed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scan()
    window.api.system.isAdmin().then(setIsAdmin).catch(() => setIsAdmin(true))
    window.api.platform
      .info()
      .then((p) => setIsMac(p.isMac))
      .catch(() => setIsMac(false))
    const off = window.api.cleaner.onProgress((p) => {
      setProgress((prev) => ({ ...prev, [p.categoryId]: p }))
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedSizeBytes = useMemo(
    () => categories.filter((c) => selected.has(c.id)).reduce((sum, c) => sum + c.sizeBytes, 0),
    [categories, selected]
  )

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runClean(): Promise<void> {
    setShowConfirm(false)
    setCleaning(true)
    try {
      if (makeRestorePoint) {
        showToast(t('cl.restorePoint'))
        const rp = await window.api.history.restorePoint()
        if (!rp.success) {
          showToast(t('cl.restoreFailed', { msg: rp.message }))
        }
      }
      const ids = [...selected]
      const { totalFreedBytes } = await window.api.cleaner.clean(ids)
      showToast(t('cl.freed', { size: formatBytes(totalFreedBytes) }))
      await scan()
    } catch (err) {
      showToast(t('cl.cleanError', { msg: (err as Error).message }))
    } finally {
      setCleaning(false)
    }
  }

  const hasCautionSelected = categories.some((c) => selected.has(c.id) && c.risk === 'caution')

  // فئات محمية فيها بيانات فعلًا — لا فائدة من تنبيه المستخدم لفئات فارغة أصلًا
  const adminCategoriesWithData = categories.filter((c) => c.requiresAdmin && c.sizeBytes > 0)

  async function relaunchAsAdmin(): Promise<void> {
    const result = await window.api.system.relaunchAsAdmin()
    if (!result.started) showToast(result.message)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" onClick={scan} disabled={loading || cleaning}>
          <Icon name="refresh" size={15} /> {t('common.rescan')}
        </button>
        <span className="muted">
          {loading
            ? t('common.scanning')
            : t('cl.summary', { n: fmtNum(categories.length), size: formatBytes(categories.reduce((s, c) => s + c.sizeBytes, 0)) })}
        </span>
        <div className="spacer" />
        <div className="card-pad" style={{ padding: '6px 14px' }}>
          {t('cl.selectedLabel')} <strong>{formatBytes(selectedSizeBytes)}</strong>
        </div>
        <button
          className="btn btn-primary"
          disabled={selected.size === 0 || cleaning || loading}
          onClick={() => setShowConfirm(true)}
        >
          <Icon name="sparkles" size={15} /> {cleaning ? t('cl.cleaning') : t('cl.cleanSelected')}
        </button>
      </div>

      {!isAdmin && adminCategoriesWithData.length > 0 && (
        <div
          className="card card-pad"
          style={{ marginBottom: 16, borderRight: '3px solid var(--warning)' }}
        >
          <strong><Icon name="shield" size={14} /> {t('cl.adminTitle')}</strong>
          <div className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
            {t('cl.adminBody')}{' '}
            {adminCategoriesWithData.map((c) => categoryLabel(c.labelKey).title).join(getLang() === 'ar' ? '، ' : ', ')}.
            {isMac && t('cl.adminMac')}
          </div>
          {!isMac && (
            <button className="btn btn-sm" onClick={relaunchAsAdmin}>
              {t('cl.relaunchAdmin')}
            </button>
          )}
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>{t('cl.thCategory')}</th>
              <th>{t('common.size')}</th>
              <th>{t('cl.thFiles')}</th>
              <th>{t('common.status')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const label = categoryLabel(cat.labelKey)
              const prog = progress[cat.id]
              return (
                <tr key={cat.id} className={cat.risk === 'caution' ? 'risk-caution-row' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(cat.id)}
                      onChange={() => toggle(cat.id)}
                      disabled={cleaning}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {label.title}{' '}
                      {cat.risk === 'caution' && <span className="badge badge-caution">{t('cl.caution')}</span>}{' '}
                      {cat.requiresAdmin && !isAdmin && (
                        <span className="badge badge-caution" title={t('cl.adminBadgeTip')}>
                          <Icon name="shield" /> {t('cl.adminBadge')}
                        </span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {label.desc}
                    </div>
                  </td>
                  <td>{formatBytes(cat.sizeBytes)}</td>
                  <td>{cat.fileCount.toLocaleString('ar')}</td>
                  <td>
                    {prog?.done ? (
                      prog.error ? (
                        <span className="badge badge-danger">{t('cl.failed')}</span>
                      ) : (
                        <span className="badge badge-safe">{t('cl.freedBadge', { size: formatBytes(prog.freedBytes) })}</span>
                      )
                    ) : prog ? (
                      <span className="muted">{t('cl.working')}</span>
                    ) : cat.error ? (
                      <span className="badge badge-danger" title={cat.error}>
                        {t('cl.error')}
                      </span>
                    ) : (
                      <span className="badge badge-safe">{t('cl.ready')}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showConfirm && (
        <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('cl.confirmTitle')}</h3>
            <p>
              {t('cl.confirmBody', { size: formatBytes(selectedSizeBytes), n: fmtNum(selected.size) })}
            </p>
            {hasCautionSelected && (
              <p style={{ color: 'var(--warning)' }}>
                <Icon name="alert" size={15} /> {t('cl.confirmCaution')}
              </p>
            )}
            <label className="checkbox-row" style={{ fontSize: 13, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={makeRestorePoint}
                onChange={(e) => setMakeRestorePoint(e.target.checked)}
              />
              {t('cl.makeRestore')}
            </label>
            <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="spacer" />
              <button className="btn" onClick={() => setShowConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={runClean}>
                {t('cl.confirmTitle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
