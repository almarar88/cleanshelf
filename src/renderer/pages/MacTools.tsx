import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import type { OrphanLeftover, LanguageFileGroup, ScanProgress } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { ScanProgressPanel } from '../components/ScanProgressPanel'

type Mode = 'orphans' | 'languages'

export function MacTools(): JSX.Element {
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('orphans')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [orphans, setOrphans] = useState<OrphanLeftover[]>([])
  const [languages, setLanguages] = useState<LanguageFileGroup[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function scan(which: Mode): Promise<void> {
    setScanning(true)
    setProgress(null)
    setChecked(new Set())
    setOrphans([])
    setLanguages([])
    try {
      if (which === 'orphans') {
        const result = await window.api.mac.orphanLeftovers()
        setOrphans(result)
        if (result.length === 0) showToast('لا توجد مخلّفات يتيمة')
      } else {
        const result = await window.api.mac.languageFiles()
        setLanguages(result)
        if (result.length === 0) showToast('لا توجد ملفات لغات قابلة للحذف')
      }
    } catch (err) {
      const message = (err as Error).message
      showToast(message.includes('أُلغي') ? 'أُوقف الفحص' : 'فشل الفحص: ' + message)
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  function toggle(key: string): void {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalSelected =
    mode === 'orphans'
      ? orphans.filter((o) => checked.has(o.path)).reduce((s, o) => s + o.sizeBytes, 0)
      : languages.filter((g) => checked.has(g.appPath)).reduce((s, g) => s + g.sizeBytes, 0)

  async function deleteChecked(): Promise<void> {
    if (checked.size === 0) return
    const paths =
      mode === 'orphans'
        ? [...checked]
        : languages.filter((g) => checked.has(g.appPath)).flatMap((g) => g.languagePaths)

    const confirmed = await window.api.dialogs.confirm(
      `نقل ${paths.length} عنصر إلى المهملات؟`,
      `سيتحرّر نحو ${formatBytes(totalSelected)}. يمكنك استرجاعها من المهملات.`
    )
    if (!confirmed) return

    const results = await window.api.fm.trashPaths(paths)
    const failed = results.filter((r) => !r.success)
    showToast(
      failed.length
        ? `حُذف ${results.length - failed.length}، وتعذّر ${failed.length} (قد تحتاج صلاحيات)`
        : `تم حذف ${results.length} عنصر`
    )
    await scan(mode)
  }

  async function purge(): Promise<void> {
    const result = await window.api.mac.purgeMemory()
    showToast(result.message)
  }

  const items = mode === 'orphans' ? orphans : languages

  return (
    <div className="page">
      <div className="toolbar">
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode)
            setOrphans([])
            setLanguages([])
            setChecked(new Set())
          }}
        >
          <option value="orphans">مخلّفات تطبيقات محذوفة</option>
          <option value="languages">ملفات اللغات غير المستخدمة</option>
        </select>
        <button className="btn btn-primary" onClick={() => scan(mode)} disabled={scanning}>
          <Icon name="search" size={15} /> ابدأ الفحص
        </button>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={purge}>
          <Icon name="brain" size={15} /> تحرير الذاكرة
        </button>
        {items.length > 0 && (
          <button className="btn btn-danger" disabled={checked.size === 0} onClick={deleteChecked}>
            حذف المحدَّد ({formatBytes(totalSelected)})
          </button>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13 }}>
        {mode === 'orphans'
          ? 'سحب تطبيق إلى المهملات على ماك لا يحذف ما تركه في Library. هنا نعرض ملفات دعم لتطبيقات لم تعد مثبَّتة — راجعها قبل الحذف، فالمطابقة بالاسم قد تُخطئ أحيانًا.'
          : 'تحمل معظم التطبيقات عشرات اللغات التي لن تستخدمها. نُبقي دائمًا الإنجليزية والعربية، ونعرض الباقي. قد يعيد تحديث التطبيق إضافتها.'}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={() => window.api.mac.cancelScan()} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="tile-icon tone-teal"><Icon name={mode === 'orphans' ? 'sparkles' : 'globe'} size={26} /></div>
          <div>اضغط "ابدأ الفحص" لبدء البحث</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>{mode === 'orphans' ? 'العنصر' : 'التطبيق'}</th>
                <th>{mode === 'orphans' ? 'الموقع' : 'عدد اللغات'}</th>
                <th>الحجم</th>
              </tr>
            </thead>
            <tbody>
              {mode === 'orphans'
                ? orphans.map((o) => (
                    <tr key={o.path}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked.has(o.path)}
                          onChange={() => toggle(o.path)}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.name}</div>
                        <div
                          className="muted"
                          style={{ fontSize: 11.5, direction: 'ltr', textAlign: 'right' }}
                        >
                          {o.path}
                        </div>
                      </td>
                      <td className="muted">{o.category}</td>
                      <td>{formatBytes(o.sizeBytes)}</td>
                    </tr>
                  ))
                : languages.map((g) => (
                    <tr key={g.appPath}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked.has(g.appPath)}
                          onChange={() => toggle(g.appPath)}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{g.appName}</td>
                      <td className="muted">{g.languagePaths.length} لغة</td>
                      <td>{formatBytes(g.sizeBytes)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
