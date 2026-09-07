import { useEffect, useMemo, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { formatBytes, formatDate } from '../lib/format'
import type { AppEntry, LeftoverEntry } from '../lib/types'
import { Icon } from '../components/Icon'
import { Sheet, Switch, ConfirmSheet, Notice } from '../components/ui'

type SortKey = 'size' | 'name' | 'unused' | 'updated'

export function Apps(): JSX.Element {
  const { settings, updateSettings, permissions } = useApp()
  const { showToast } = useToast()
  const [apps, setApps] = useState<AppEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('size')
  const [active, setActive] = useState<AppEntry | null>(null)
  const [leftovers, setLeftovers] = useState<LeftoverEntry[] | null>(null)
  const [confirmLeftovers, setConfirmLeftovers] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const r = await Native.listApps({ includeSystem: settings.showSystemApps })
      setApps(r.apps)
    } catch (err) {
      showToast('تعذّر قراءة التطبيقات: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.showSystemApps])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = apps.filter((a) => !q || a.label.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q))
    filtered.sort((a, b) => {
      if (sort === 'size') return b.sizeBytes - a.sizeBytes
      if (sort === 'unused') return (a.lastUsedAt || 0) - (b.lastUsedAt || 0)
      if (sort === 'updated') return b.updatedAt - a.updatedAt
      return a.label.localeCompare(b.label, 'ar')
    })
    return filtered
  }, [apps, query, sort])

  const totalBytes = apps.reduce((s, a) => s + a.sizeBytes, 0)

  async function openDetail(app: AppEntry): Promise<void> {
    setActive(app)
    setLeftovers(null)
  }

  async function scanLeftovers(): Promise<void> {
    if (!active) return
    try {
      const r = await Native.findLeftovers({ packageName: active.packageName, label: active.label })
      setLeftovers(r.items)
      if (r.items.length === 0) showToast('لا مخلّفات لهذا التطبيق في الذاكرة المشتركة')
    } catch (err) {
      showToast('فشل البحث: ' + (err as Error).message)
    }
  }

  async function trashLeftovers(): Promise<void> {
    setConfirmLeftovers(false)
    if (!leftovers) return
    const r = await Native.trash({ paths: leftovers.map((l) => l.path) })
    const ok = r.results.filter((x) => x.success).length
    showToast(`نُقل ${ok} من ${r.results.length} إلى سلة المهملات`)
    setLeftovers([])
  }

  function unusedLabel(a: AppEntry): string {
    if (!permissions.usageStats) return ''
    if (!a.lastUsedAt) return 'لم يُستخدم'
    const days = Math.floor((Date.now() - a.lastUsedAt) / 86_400_000)
    return days === 0 ? 'استُخدم اليوم' : `آخر استخدام قبل ${days} يوم`
  }

  return (
    <div className="page">
      <div className="search-box" style={{ marginBottom: 10 }}>
        <Icon name="search" size={16} />
        <input type="search" placeholder="ابحث باسم التطبيق…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="toolbar">
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ flex: 1 }}>
          <option value="size">الأكبر حجمًا</option>
          <option value="unused">الأقل استخدامًا</option>
          <option value="updated">الأحدث تحديثًا</option>
          <option value="name">الاسم</option>
        </select>
        <label className="fact-chip" style={{ gap: 8, minHeight: 44 }}>
          تطبيقات النظام
          <Switch checked={settings.showSystemApps} onChange={(v) => updateSettings({ showSystemApps: v })} label="إظهار تطبيقات النظام" />
        </label>
      </div>

      {!permissions.usageStats && (
        <Notice icon="clock">
          لعرض الحجم الحقيقي وآخر استخدام لكل تطبيق، امنح CleanShelf إذن "الوصول إلى بيانات الاستخدام".
          <div><button className="btn btn-sm" onClick={() => Native.requestUsageStats()}>فتح الإعدادات</button></div>
        </Notice>
      )}

      <div className="muted" style={{ fontSize: 12.5, margin: '0 4px 8px' }}>{loading ? 'جارٍ القراءة…' : `${list.length} تطبيق • ${formatBytes(totalBytes)}`}</div>

      <div className="card">
        {loading && apps.length === 0 ? [1, 2, 3, 4].map((i) => <div key={i} className="row"><div className="skeleton" style={{ width: 42, height: 42, borderRadius: 11 }} /><div className="text"><div className="skeleton" style={{ height: 14, width: '50%' }} /><div className="skeleton" style={{ height: 11, width: '30%', marginTop: 6 }} /></div></div>) : null}
        {list.map((a) => (
          <div key={a.packageName} className="row" onClick={() => openDetail(a)}>
            <img className="app-icon" src={`data:image/png;base64,${a.icon}`} alt="" />
            <div className="text">
              <div className="title">{a.label} {a.isSystem && <span className="badge badge-neutral">نظام</span>}</div>
              <div className="desc">{unusedLabel(a) || a.packageName}</div>
            </div>
            <span className="trail">{formatBytes(a.sizeBytes)}</span>
          </div>
        ))}
      </div>

      {active && (
        <Sheet onClose={() => setActive(null)}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img className="app-icon" style={{ width: 56, height: 56, borderRadius: 14 }} src={`data:image/png;base64,${active.icon}`} alt="" />
            <div style={{ minWidth: 0 }}>
              <h3 style={{ marginBottom: 2 }}>{active.label}</h3>
              <div className="muted mono" style={{ fontSize: 12 }}>{active.packageName}</div>
            </div>
          </div>
          <div className="grid grid-3" style={{ margin: '14px 0' }}>
            <div className="card stat-tile" style={{ padding: 10 }}><span className="label">الحجم</span><span className="value" style={{ fontSize: 15 }}>{formatBytes(active.sizeBytes)}</span></div>
            <div className="card stat-tile" style={{ padding: 10 }}><span className="label">الإصدار</span><span className="value" style={{ fontSize: 15 }} dir="ltr">{active.versionName || '—'}</span></div>
            <div className="card stat-tile" style={{ padding: 10 }}><span className="label">التحديث</span><span className="value" style={{ fontSize: 12.5 }}>{active.updatedAt ? formatDate(active.updatedAt).split('،')[0] : '—'}</span></div>
          </div>
          {leftovers && leftovers.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              {leftovers.map((l) => (
                <div key={l.path} className="row" style={{ cursor: 'default' }}>
                  <Icon name={l.isDirectory ? 'folder' : 'file'} size={17} className="muted" />
                  <div className="text"><div className="desc mono" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{l.path}</div></div>
                  <span className="trail">{formatBytes(l.sizeBytes)}</span>
                </div>
              ))}
              <div style={{ padding: 10 }}>
                <button className="btn btn-danger btn-block btn-sm" onClick={() => setConfirmLeftovers(true)}><Icon name="trash" size={15} /> نقل المخلّفات إلى سلة المهملات ({formatBytes(leftovers.reduce((s, l) => s + l.sizeBytes, 0))})</button>
              </div>
            </div>
          )}
          <div className="grid grid-2">
            <button className="btn" onClick={() => Native.launchApp({ packageName: active.packageName })}><Icon name="play" size={15} /> فتح</button>
            <button className="btn" onClick={() => Native.openAppInfo({ packageName: active.packageName })}><Icon name="info" size={15} /> معلومات وتنظيف الذاكرة</button>
            <button className="btn" onClick={scanLeftovers}><Icon name="folderSearch" size={15} /> البحث عن مخلّفات</button>
            <button className="btn btn-danger" disabled={active.isSystem} onClick={() => Native.uninstallApp({ packageName: active.packageName }).then(() => setTimeout(load, 3000))}><Icon name="trash" size={15} /> إزالة</button>
          </div>
          <p style={{ marginTop: 12, fontSize: 12 }}>"معلومات وتنظيف الذاكرة" تفتح صفحة التطبيق في النظام حيث يمكنك مسح ذاكرته المؤقتة — أندرويد لا يسمح لتطبيق آخر بفعل ذلك مباشرة.</p>
        </Sheet>
      )}

      {confirmLeftovers && <ConfirmSheet title="نقل المخلّفات" message="ستُنقل هذه المجلدات إلى سلة مهملات CleanShelf. المطابقة بالاسم قد تُخطئ أحيانًا، فراجع المسارات." confirmLabel="نقل" onConfirm={trashLeftovers} onCancel={() => setConfirmLeftovers(false)} />}
    </div>
  )
}
