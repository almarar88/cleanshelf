import { useEffect, useState } from 'react'
import type { AppSettings, ShredProgress, ShredResult } from '../../shared/types'
import { useToast } from '../lib/toastContext'
import { Icon } from '../components/Icon'

export function Shredder({ settings }: { settings: AppSettings | null }): JSX.Element {
  const { showToast } = useToast()
  const [paths, setPaths] = useState<string[]>([])
  const [passes, setPasses] = useState(3)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ShredProgress | null>(null)
  const [results, setResults] = useState<ShredResult[] | null>(null)

  useEffect(() => {
    if (settings) setPasses(settings.shredPasses)
  }, [settings])

  useEffect(() => window.api.shred.onProgress(setProgress), [])

  function add(newPaths: string[]): void {
    setPaths((prev) => [...new Set([...prev, ...newPaths])])
    setResults(null)
  }

  async function pickFiles(): Promise<void> {
    add(await window.api.dialogs.pickFiles())
  }

  async function pickFolder(): Promise<void> {
    const folder = await window.api.dialogs.pickFolder()
    if (folder) add([folder])
  }

  async function shred(): Promise<void> {
    if (paths.length === 0) return
    const confirmed = await window.api.dialogs.confirm(
      `تمزيق ${paths.length} عنصر نهائيًا؟`,
      'لا يمكن التراجع ولا الاسترجاع من المهملات — سيُكتب فوق المحتوى قبل الحذف.'
    )
    if (!confirmed) return
    setRunning(true)
    setProgress(null)
    setResults(null)
    try {
      const res = await window.api.shred.run(paths, passes)
      setResults(res)
      const failed = res.filter((r) => !r.success).length
      showToast(failed ? `اكتمل مع تعذّر ${failed} ملف` : `تم تمزيق ${res.length} ملف نهائيًا`)
      if (!failed) setPaths([])
    } catch (err) {
      showToast('فشل التمزيق: ' + (err as Error).message)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const percent = progress && progress.total > 0 ? Math.round(((progress.done + (progress.pass - 1) / progress.totalPasses) / progress.total) * 100) : 0

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="notice notice-warn">
        <Icon name="alert" size={17} />
        <div>
          <strong>الحذف هنا نهائي ولا يمر بالمهملات.</strong> يُكتب فوق محتوى الملف ببيانات عشوائية ثم أصفار قبل حذفه، فيصعب
          استرجاعه ببرامج الاسترداد. على أقراص SSD قد يبقي القرص نسخًا داخلية، فالتمزيق يقلّل الاحتمال ولا يضمن.
        </div>
      </div>

      <div className="toolbar">
        <button className="btn" onClick={pickFiles} disabled={running}>
          <Icon name="file" size={15} /> إضافة ملفات
        </button>
        <button className="btn" onClick={pickFolder} disabled={running}>
          <Icon name="folder" size={15} /> إضافة مجلد
        </button>
        <div className="spacer" />
        <label className="checkbox-row muted" style={{ fontSize: 13 }}>
          مرات الكتابة
          <select value={passes} onChange={(e) => setPasses(Number(e.target.value))} disabled={running}>
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={7}>7</option>
          </select>
        </label>
        <button className="btn btn-danger" onClick={shred} disabled={paths.length === 0 || running}>
          <Icon name="scissors" size={15} /> {running ? 'جارٍ التمزيق…' : `تمزيق ${paths.length || ''} نهائيًا`}
        </button>
      </div>

      {running && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="toolbar" style={{ marginBottom: 10 }}>
            <strong>
              {progress ? `الملف ${progress.done + 1} من ${progress.total} — المرور ${progress.pass}/${progress.totalPasses}` : 'جارٍ التحضير…'}
            </strong>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={() => window.api.shred.cancel()}>إيقاف</button>
          </div>
          <div className="progress-bar"><div style={{ width: `${percent}%` }} /></div>
          <div className="muted mono" style={{ fontSize: 11.5, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {progress?.path ?? ''}
          </div>
        </div>
      )}

      {paths.length === 0 && !results ? (
        <div className="empty-state">
          <div className="tile-icon tone-red"><Icon name="scissors" size={26} /></div>
          <div>أضف ملفات أو مجلدات تريد إتلافها بحيث لا يمكن استرجاعها</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>المسار</th>
                <th style={{ width: 160 }}>الحالة</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {(results ?? paths.map((p) => ({ path: p, success: false, error: undefined as string | undefined }))).map((row) => {
                const pending = !results
                return (
                  <tr key={row.path}>
                    <td className="mono" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{row.path}</td>
                    <td>
                      {pending ? (
                        <span className="badge badge-neutral">في الانتظار</span>
                      ) : row.success ? (
                        <span className="badge badge-safe"><Icon name="check" /> مُزِّق</span>
                      ) : (
                        <span className="badge badge-danger" title={row.error}>فشل</span>
                      )}
                    </td>
                    <td>
                      {pending && (
                        <button className="btn btn-sm btn-ghost btn-icon" onClick={() => setPaths((prev) => prev.filter((p) => p !== row.path))} disabled={running} title="إزالة من القائمة">
                          <Icon name="x" size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
