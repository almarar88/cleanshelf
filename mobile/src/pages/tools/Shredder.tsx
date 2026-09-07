import { useEffect, useState } from 'react'
import { Native } from '../../lib/native'
import { useApp } from '../../lib/appContext'
import { useToast } from '../../lib/toastContext'
import type { FileEntry, OpResult, ScanProgress } from '../../lib/types'
import { Icon } from '../../components/Icon'
import { ConfirmSheet, EmptyState, Notice, ProgressPanel, Sheet, Check, fileIcon } from '../../components/ui'
import { formatBytes } from '../../lib/format'

/** اختيار ملفات بالتصفّح — أندرويد لا يعطي مسارات حقيقية من منتقي النظام */
function FilePicker({ onPick, onCancel }: { onPick: (paths: string[]) => void; onCancel: () => void }): JSX.Element {
  const [path, setPath] = useState('/storage/emulated/0')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [parent, setParent] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  useEffect(() => {
    Native.listDir({ path }).then((r) => { setEntries(r.entries); setParent(r.parent) }).catch(() => setEntries([]))
  }, [path])

  return (
    <Sheet onClose={onCancel}>
      <h3>اختر ما تريد تمزيقه</h3>
      <div className="muted mono" style={{ marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{path}</div>
      <div className="card" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
        {parent && <div className="row" onClick={() => setPath(parent)}><Icon name="arrowUp" size={17} className="muted" /><div className="text"><div className="title">المجلد الأعلى</div></div></div>}
        {entries.map((e) => (
          <div key={e.path} className={`row ${chosen.has(e.path) ? 'selected' : ''}`} onClick={() => e.isDirectory ? setPath(e.path) : setChosen((prev) => { const n = new Set(prev); if (n.has(e.path)) n.delete(e.path); else n.add(e.path); return n })}>
            {!e.isDirectory && <Check on={chosen.has(e.path)} />}
            <Icon name={fileIcon(e.isDirectory, e.extension)} size={17} className="muted" />
            <div className="text"><div className="title">{e.name}</div>{!e.isDirectory && <div className="desc">{formatBytes(e.sizeBytes)}</div>}</div>
            {e.isDirectory && <Icon name="chevron" size={14} className="muted" style={{ transform: 'scaleX(-1)' }} />}
          </div>
        ))}
      </div>
      <div className="actions">
        <button className="btn" onClick={onCancel}>إلغاء</button>
        <button className="btn btn-primary" disabled={chosen.size === 0} onClick={() => onPick([...chosen])}>إضافة {chosen.size || ''}</button>
      </div>
    </Sheet>
  )
}

export function Shredder(): JSX.Element {
  const { settings } = useApp()
  const { showToast } = useToast()
  const [paths, setPaths] = useState<string[]>([])
  const [passes, setPasses] = useState(settings.shredPasses)
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [results, setResults] = useState<OpResult[] | null>(null)

  useEffect(() => {
    const handle = Native.addListener('scanProgress', setProgress)
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  async function shred(): Promise<void> {
    setConfirm(false)
    setRunning(true)
    setResults(null)
    try {
      const r = await Native.shred({ paths, passes })
      setResults(r.results)
      const failed = r.results.filter((x) => !x.success).length
      showToast(failed ? `اكتمل مع تعذّر ${failed}` : `تم تمزيق ${r.results.length} ملف نهائيًا`)
      if (!failed) setPaths([])
    } catch (err) {
      showToast('فشل التمزيق: ' + (err as Error).message)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <div className="page no-tabs">
      <Notice kind="warn"><strong>الحذف هنا نهائي ولا يمر بسلة المهملات.</strong> يُكتب فوق المحتوى ببيانات عشوائية ثم أصفار قبل الحذف. ذاكرة الهواتف (فلاش) قد تحتفظ بنسخ داخلية، فالتمزيق يقلّل الاحتمال ولا يضمن.</Notice>
      <div className="toolbar">
        <button className="btn btn-sm" onClick={() => setPicking(true)} disabled={running} style={{ flex: 1 }}><Icon name="plus" size={15} /> إضافة ملفات</button>
        <select value={passes} onChange={(e) => setPasses(Number(e.target.value))} disabled={running} style={{ width: 'auto', minHeight: 36, padding: '4px 10px' }}>
          <option value={1}>مرة واحدة</option>
          <option value={3}>3 مرات</option>
          <option value={7}>7 مرات</option>
        </select>
      </div>
      {running ? <ProgressPanel progress={progress} onCancel={() => Native.cancelScan()} /> : paths.length === 0 && !results ? <EmptyState icon="scissors" tone="tone-red" text="أضف ملفات حساسة تريد إتلافها بحيث لا يمكن استرجاعها" /> : (
        <div className="card">
          {(results ?? paths.map((p) => ({ path: p, success: false }))).map((r) => (
            <div key={r.path} className="row" style={{ cursor: 'default' }}>
              <Icon name="file" size={17} className="muted" />
              <div className="text"><div className="title">{r.path.split('/').pop()}</div><div className="desc mono">{r.path.slice(0, r.path.lastIndexOf('/')).replace('/storage/emulated/0', '')}</div></div>
              {results ? <span className={`badge ${r.success ? 'badge-safe' : 'badge-danger'}`}>{r.success ? 'مُزِّق' : 'فشل'}</span> : <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setPaths((prev) => prev.filter((p) => p !== r.path))}><Icon name="x" size={15} /></button>}
            </div>
          ))}
        </div>
      )}
      {paths.length > 0 && !running && <div className="action-bar no-tabs"><button className="btn btn-danger" onClick={() => setConfirm(true)}><Icon name="scissors" size={16} /> تمزيق {paths.length} نهائيًا</button></div>}
      {picking && <FilePicker onPick={(p) => { setPaths((prev) => [...new Set([...prev, ...p])]); setResults(null); setPicking(false) }} onCancel={() => setPicking(false)} />}
      {confirm && <ConfirmSheet title={`تمزيق ${paths.length} ملف نهائيًا؟`} message="لا يمكن التراجع ولا الاسترجاع من سلة المهملات." confirmLabel="تمزيق نهائي" danger onConfirm={shred} onCancel={() => setConfirm(false)} />}
    </div>
  )
}
