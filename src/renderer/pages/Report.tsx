import { useState } from 'react'
import type { SystemReport } from '../../shared/types'
import { formatDate } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { Icon } from '../components/Icon'
import { t } from '../lib/i18n'

export function Report(): JSX.Element {
  const { showToast } = useToast()
  const [report, setReport] = useState<SystemReport | null>(null)
  const [building, setBuilding] = useState(false)

  async function build(): Promise<void> {
    setBuilding(true)
    try {
      setReport(await window.api.report.build())
    } catch (err) {
      showToast(t('rp.failed', { msg: (err as Error).message }))
    } finally {
      setBuilding(false)
    }
  }

  async function save(): Promise<void> {
    if (!report) return
    const result = await window.api.report.save(report.markdown)
    if (result.saved) showToast(t('rp.saved'))
  }

  async function copy(): Promise<void> {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report.markdown)
      showToast(t('rp.copied'))
    } catch {
      showToast(t('rp.copyFailed'), 'error')
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={build} disabled={building}>
          <Icon name="fileText" size={15} /> {building ? t('rp.building') : report ? t('rp.rebuild') : t('rp.build')}
        </button>
        {report && <span className="muted">{t('rp.generatedAt', { date: formatDate(report.generatedAt) })}</span>}
        <div className="spacer" />
        <button className="btn" onClick={copy} disabled={!report}>
          <Icon name="copy" size={15} /> {t('common.copy')}
        </button>
        <button className="btn" onClick={save} disabled={!report}>
          <Icon name="save" size={15} /> {t('rp.saveFile')}
        </button>
      </div>

      <div className="notice notice-info">
        <Icon name="info" size={17} />
        <div>
          {t('rp.hint')}
        </div>
      </div>

      {building ? (
        <div className="card card-pad">
          <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '75%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '85%' }} />
        </div>
      ) : !report ? (
        <div className="empty-state">
          <div className="tile-icon tone-teal"><Icon name="fileText" size={26} /></div>
          <div>{t('rp.empty')}</div>
        </div>
      ) : (
        <div className="card card-pad">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8 }}>{report.markdown}</pre>
        </div>
      )}
    </div>
  )
}
