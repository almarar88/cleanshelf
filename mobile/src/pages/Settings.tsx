import { useEffect, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { ACCENTS, THEME_LABEL, type ThemeMode } from '../lib/theme'
import { formatBytes } from '../lib/format'
import type { DeviceInfo } from '../lib/types'
import { Icon } from '../components/Icon'
import { Switch } from '../components/ui'

const RELEASES_URL = 'https://github.com/almarar88/cleanshelf/releases/latest'

export function Settings(): JSX.Element {
  const { settings, updateSettings, permissions, refreshPermissions } = useApp()
  const { showToast } = useToast()
  const [info, setInfo] = useState<DeviceInfo | null>(null)

  useEffect(() => {
    Native.deviceInfo().then(setInfo).catch(() => setInfo(null))
  }, [])

  async function toggleNotifications(v: boolean): Promise<void> {
    if (v && !permissions.notifications) {
      await Native.requestNotifications().catch(() => undefined)
      await refreshPermissions()
    }
    updateSettings({ notifications: v })
  }

  return (
    <div className="page no-tabs">
      <div className="section-title">المظهر</div>
      <div className="card">
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="text"><div className="title">السمة</div></div>
          <div className="segmented" style={{ marginTop: 8 }}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => <button key={m} className={settings.theme === m ? 'active' : ''} onClick={() => updateSettings({ theme: m })}>{THEME_LABEL[m]}</button>)}
          </div>
        </div>
        <div className="settings-row">
          <div className="text"><div className="title">لون التمييز</div><div className="desc">الأزرار والعناصر النشطة</div></div>
          <div className="swatches">
            {ACCENTS.map((a) => <button key={a.hue} className={`swatch ${settings.accentHue === a.hue ? 'active' : ''}`} style={{ background: `hsl(${a.hue} 90% 56%)` }} aria-label={a.name} onClick={() => updateSettings({ accentHue: a.hue })} />)}
          </div>
        </div>
      </div>

      <div className="section-title">الصلاحيات</div>
      <div className="card">
        <div className="settings-row">
          <div className="text"><div className="title">الوصول لكل الملفات</div><div className="desc">لازم للتنظيف ومدير الملفات وكل أدوات الفحص</div></div>
          {permissions.allFiles ? <span className="badge badge-safe"><Icon name="check" /> ممنوح</span> : <button className="btn btn-sm btn-primary" onClick={() => Native.requestAllFiles()}>منح</button>}
        </div>
        <div className="settings-row">
          <div className="text"><div className="title">بيانات الاستخدام</div><div className="desc">أحجام التطبيقات الحقيقية ووقت الاستخدام</div></div>
          {permissions.usageStats ? <span className="badge badge-safe"><Icon name="check" /> ممنوح</span> : <button className="btn btn-sm" onClick={() => Native.requestUsageStats()}>منح</button>}
        </div>
      </div>

      <div className="section-title">السلوك</div>
      <div className="card">
        <div className="settings-row">
          <div className="text"><div className="title">إشعار عند اكتمال التنظيف</div><div className="desc">يظهر ما تحرّر من مساحة</div></div>
          <Switch checked={settings.notifications} onChange={toggleNotifications} label="الإشعارات" />
        </div>
        <div className="settings-row">
          <div className="text"><div className="title">فحص تلقائي عند الفتح</div><div className="desc">يحسب درجة الصحة فور فتح التطبيق</div></div>
          <Switch checked={settings.scanOnLaunch} onChange={(v) => updateSettings({ scanOnLaunch: v })} label="الفحص التلقائي" />
        </div>
        <div className="settings-row">
          <div className="text"><div className="title">تذكير أسبوعي بالتنظيف</div><div className="desc">إشعار يذكّرك بما تراكم منذ آخر فحص</div></div>
          <Switch checked={settings.reminderEnabled} onChange={(v) => { updateSettings({ reminderEnabled: v }); Native.setReminder({ enabled: v, dayOfWeek: settings.reminderDay, hour: settings.reminderHour }).catch(() => undefined) }} label="التذكير الأسبوعي" />
        </div>
        {settings.reminderEnabled && (
          <div className="settings-row">
            <div className="text"><div className="title">موعد التذكير</div></div>
            <select value={settings.reminderDay} onChange={(e) => { const d = Number(e.target.value); updateSettings({ reminderDay: d }); Native.setReminder({ enabled: true, dayOfWeek: d, hour: settings.reminderHour }).catch(() => undefined) }}>
              {[['1', 'الأحد'], ['2', 'الاثنين'], ['3', 'الثلاثاء'], ['4', 'الأربعاء'], ['5', 'الخميس'], ['6', 'الجمعة'], ['7', 'السبت']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={settings.reminderHour} onChange={(e) => { const h = Number(e.target.value); updateSettings({ reminderHour: h }); Native.setReminder({ enabled: true, dayOfWeek: settings.reminderDay, hour: h }).catch(() => undefined) }}>
              {[8, 10, 12, 15, 18, 19, 20, 21].map((h) => <option key={h} value={h}>{h > 12 ? `${h - 12} م` : `${h} ص`}</option>)}
            </select>
          </div>
        )}
        <div className="settings-row">
          <div className="text"><div className="title">الاحتفاظ في سلة المهملات</div><div className="desc">يُحذف ما هو أقدم نهائيًا عند فتح التطبيق</div></div>
          <select value={settings.trashRetentionDays} onChange={(e) => updateSettings({ trashRetentionDays: Number(e.target.value) })}>
            {[3, 7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} يوم</option>)}
          </select>
        </div>
      </div>

      <div className="section-title">الأدوات</div>
      <div className="card">
        <div className="settings-row">
          <div className="text"><div className="title">عمر التنزيل القديم</div></div>
          <select value={settings.oldDownloadDays} onChange={(e) => updateSettings({ oldDownloadDays: Number(e.target.value) })}>
            {[7, 14, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} يوم</option>)}
          </select>
        </div>
        <div className="settings-row">
          <div className="text"><div className="title">مرات الكتابة في الممزّق</div></div>
          <select value={settings.shredPasses} onChange={(e) => updateSettings({ shredPasses: Number(e.target.value) })}>
            <option value={1}>مرة</option><option value={3}>3 مرات</option><option value={7}>7 مرات</option>
          </select>
        </div>
        <div className="settings-row">
          <div className="text"><div className="title">ذاكرة CleanShelf المؤقتة</div><div className="desc">ملفات هذا التطبيق المؤقتة</div></div>
          <button className="btn btn-sm" onClick={() => Native.clearOwnCache().then((r) => showToast(`تم تحرير ${formatBytes(r.freedBytes)}`))}>مسح</button>
        </div>
      </div>

      <div className="section-title">الشاشة الرئيسية</div>
      <div className="card">
        <div className="settings-row">
          <div className="tile-icon sm tone-cyan"><Icon name="widget" size={17} /></div>
          <div className="text"><div className="title">ودجت CleanShelf</div><div className="desc">اضغط مطوّلًا على الشاشة الرئيسية ← الأدوات (Widgets) ← CleanShelf لعرض درجة الصحة والمساحة وزر تنظيف سريع</div></div>
        </div>
      </div>

      <div className="section-title">حول</div>
      <div className="card">
        <div className="settings-row">
          <div className="brand-badge"><Icon name="logo" size={20} strokeWidth={2} /></div>
          <div className="text"><div className="title">CleanShelf {info?.appVersion ?? ''}</div><div className="desc">من تطوير Alcode — لأندرويد وويندوز وماك</div></div>
        </div>
        <div className="settings-row" style={{ cursor: 'pointer' }} onClick={() => Native.openUrl({ url: RELEASES_URL })}>
          <div className="text"><div className="title">التحقق من وجود إصدار أحدث</div><div className="desc">يفتح صفحة الإصدارات على GitHub</div></div>
          <Icon name="externalLink" size={16} className="muted" />
        </div>
      </div>
    </div>
  )
}
