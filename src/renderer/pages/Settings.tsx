import { useEffect, useState } from 'react'
import type { AppInfo, AppSettings, PlatformInfo } from '../../shared/types'
import { ACCENTS, THEME_LABEL, type ThemeMode } from '../lib/theme'
import { Icon } from '../components/Icon'
import { Switch } from '../components/Switch'

const RELEASES_URL = 'https://github.com/almarar88/cleanshelf/releases/latest'

export function Settings({
  settings,
  onChange
}: {
  settings: AppSettings | null
  onChange: (patch: Partial<AppSettings>) => void
}): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [platform, setPlatform] = useState<PlatformInfo | null>(null)

  useEffect(() => {
    window.api.system.appInfo().then(setInfo).catch(() => setInfo(null))
    window.api.platform.info().then(setPlatform).catch(() => setPlatform(null))
  }, [])

  if (!settings) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <Section icon="palette" title="المظهر" desc="اختر ما يريح عينك — يُحفظ تلقائيًا">
        <div className="settings-row">
          <div className="text">
            <div className="title">السمة</div>
            <div className="desc">"حسب النظام" تتبع إعداد {platform?.isMac ? 'ماك' : 'ويندوز'} تلقائيًا</div>
          </div>
          <div className="segmented">
            {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
              <button key={m} className={settings.theme === m ? 'active' : ''} onClick={() => onChange({ theme: m })}>
                {THEME_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="text">
            <div className="title">لون التمييز</div>
            <div className="desc">يغيّر لون الأزرار والعناصر النشطة في كل التطبيق</div>
          </div>
          <div className="swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.hue}
                className={`swatch ${settings.accentHue === a.hue ? 'active' : ''}`}
                style={{ background: `hsl(${a.hue} 90% 56%)` }}
                title={a.name}
                aria-label={a.name}
                onClick={() => onChange({ accentHue: a.hue })}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section icon="cog" title="السلوك" desc="كيف يتصرف التطبيق في الخلفية">
        <Row title="أيقونة في شريط النظام" desc="إغلاق النافذة يخفيها بدل إنهاء التطبيق، ويبقى التنظيف الذكي متاحًا من الأيقونة">
          <Switch checked={settings.minimizeToTray} onChange={(v) => onChange({ minimizeToTray: v })} label="التصغير إلى شريط النظام" />
        </Row>
        <Row title="التشغيل عند تسجيل الدخول" desc="يبدأ CleanShelf مخفيًا مع النظام (يعمل في النسخة المثبَّتة فقط)">
          <Switch checked={settings.launchAtLogin} onChange={(v) => onChange({ launchAtLogin: v })} label="التشغيل عند تسجيل الدخول" />
        </Row>
        <Row title="إشعارات النظام" desc="تنبيه عند اكتمال التنظيف بما تحرّر من مساحة">
          <Switch checked={settings.notifications} onChange={(v) => onChange({ notifications: v })} label="الإشعارات" />
        </Row>
        <Row title="فحص الجهاز عند فتح الرئيسية" desc="يحسب درجة الصحة تلقائيًا — أوقفه إن كان الفحص بطيئًا على جهازك">
          <Switch checked={settings.scanOnLaunch} onChange={(v) => onChange({ scanOnLaunch: v })} label="الفحص التلقائي" />
        </Row>
      </Section>

      <Section icon="layers" title="الأدوات" desc="إعدادات افتراضية للأدوات">
        <Row title="عمر التنزيل القديم" desc="الملفات الأقدم من هذا العدد من الأيام تُعرض في أداة التنزيلات القديمة">
          <select value={settings.oldDownloadDays} onChange={(e) => onChange({ oldDownloadDays: Number(e.target.value) })}>
            {[7, 14, 30, 60, 90, 180].map((d) => (
              <option key={d} value={d}>{d} يوم</option>
            ))}
          </select>
        </Row>
        <Row title="مرات الكتابة في الممزّق الآمن" desc="أكثر = أبطأ وأصعب استرجاعًا؛ 3 مرات كافية لمعظم الاستخدامات">
          <select value={settings.shredPasses} onChange={(e) => onChange({ shredPasses: Number(e.target.value) })}>
            <option value={1}>مرة واحدة (سريع)</option>
            <option value={3}>3 مرات (موصى به)</option>
            <option value={7}>7 مرات (أقصى حماية)</option>
          </select>
        </Row>
      </Section>

      <Section icon="info" title="حول التطبيق" desc="">
        <div className="settings-row">
          <div className="brand-badge" style={{ width: 44, height: 44, borderRadius: 13 }}>
            <Icon name="logo" size={22} />
          </div>
          <div className="text">
            <div className="title">{info ? `${info.name} ${info.version}` : 'CleanShelf'}</div>
            <div className="desc">من تطوير {info?.company ?? 'Alcode'} — لويندوز وماك</div>
          </div>
          <button className="btn btn-sm" onClick={() => window.api.app.openExternal(RELEASES_URL)}>
            <Icon name="externalLink" size={14} /> التحقق من وجود إصدار أحدث
          </button>
        </div>
      </Section>
    </div>
  )
}

function Section({ icon, title, desc, children }: { icon: 'palette' | 'cog' | 'layers' | 'info'; title: string; desc: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div className="tile-icon" style={{ width: 32, height: 32, borderRadius: 9 }}>
          <Icon name={icon} size={16} />
        </div>
        <div>
          <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>
          {desc && <div className="card-sub">{desc}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="settings-row">
      <div className="text">
        <div className="title">{title}</div>
        <div className="desc">{desc}</div>
      </div>
      {children}
    </div>
  )
}
