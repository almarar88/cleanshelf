import { useState } from 'react'
import type { SystemReport } from '../../shared/types'
import { formatDate } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { Icon } from '../components/Icon'

export function Report(): JSX.Element {
  const { showToast } = useToast()
  const [report, setReport] = useState<SystemReport | null>(null)
  const [building, setBuilding] = useState(false)

  async function build(): Promise<void> {
    setBuilding(true)
    try {
      setReport(await window.api.report.build())
    } catch (err) {
      showToast('فشل إنشاء التقرير: ' + (err as Error).message)
    } finally {
      setBuilding(false)
    }
  }

  async function save(): Promise<void> {
    if (!report) return
    const result = await window.api.report.save(report.markdown)
    if (result.saved) showToast('تم حفظ التقرير')
  }

  async function copy(): Promise<void> {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report.markdown)
      showToast('تم نسخ التقرير')
    } catch {
      showToast('تعذّر النسخ', 'error')
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={build} disabled={building}>
          <Icon name="fileText" size={15} /> {building ? 'جارٍ جمع المعلومات…' : report ? 'إعادة إنشاء التقرير' : 'إنشاء التقرير'}
        </button>
        {report && <span className="muted">أُنشئ {formatDate(report.generatedAt)}</span>}
        <div className="spacer" />
        <button className="btn" onClick={copy} disabled={!report}>
          <Icon name="copy" size={15} /> نسخ
        </button>
        <button className="btn" onClick={save} disabled={!report}>
          <Icon name="save" size={15} /> حفظ كملف
        </button>
      </div>

      <div className="notice notice-info">
        <Icon name="info" size={17} />
        <div>
          يجمع التقرير معلومات النظام والأقراص وما يمكن تنظيفه وبرامج بدء التشغيل والبرامج المثبَّتة في ملف
          Markdown واحد — مناسب لإرساله للدعم الفني أو لحفظ لقطة عن حالة الجهاز قبل أي تغيير كبير.
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
          <div>اضغط "إنشاء التقرير" لجمع لقطة كاملة عن جهازك</div>
        </div>
      ) : (
        <div className="card card-pad">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8 }}>{report.markdown}</pre>
        </div>
      )}
    </div>
  )
}
