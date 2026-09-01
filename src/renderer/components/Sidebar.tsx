import { useEffect, useState } from 'react'
import type { AppInfo, PlatformInfo } from '../../shared/types'
import type { PageId } from '../App'
import { Icon, type IconName } from './Icon'

export interface NavItem {
  id: PageId
  label: string
  icon: IconName
  keywords?: string
}

export const MAIN_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: 'home', keywords: 'home dashboard صحة' },
  { id: 'cleaner', label: 'منظّف القرص', icon: 'sparkles', keywords: 'clean temp cache تنظيف' },
  { id: 'uninstaller', label: 'إزالة البرامج', icon: 'trash', keywords: 'uninstall apps برامج' },
  { id: 'files', label: 'مدير الملفات', icon: 'folder', keywords: 'files explorer ملفات' },
  { id: 'tags', label: 'وسوم الأغاني', icon: 'music', keywords: 'mp3 tags id3 أغاني' }
]

export const DISK_ITEMS: NavItem[] = [
  { id: 'diskanalyzer', label: 'محلّل المساحة', icon: 'activity', keywords: 'disk usage analyzer مساحة' },
  { id: 'duplicates', label: 'الملفات المكرّرة', icon: 'copy', keywords: 'duplicates مكرر' },
  { id: 'largefiles', label: 'أكبر الملفات', icon: 'package', keywords: 'large big files كبيرة' },
  { id: 'downloads', label: 'التنزيلات القديمة', icon: 'download', keywords: 'downloads old تنزيلات' },
  { id: 'extras', label: 'مجلدات واختصارات', icon: 'link', keywords: 'empty folders broken shortcuts فارغة' },
  { id: 'startup', label: 'بدء التشغيل', icon: 'rocket', keywords: 'startup login items إقلاع' }
]

export const PRIVACY_ITEMS: NavItem[] = [
  { id: 'privacy', label: 'خصوصية المتصفح', icon: 'eyeOff', keywords: 'browser history cookies privacy كوكيز' },
  { id: 'shredder', label: 'الممزّق الآمن', icon: 'scissors', keywords: 'shred secure delete حذف نهائي' }
]

export const SYSTEM_ITEMS: NavItem[] = [
  { id: 'processes', label: 'العمليات', icon: 'zap', keywords: 'processes tasks كيل' },
  { id: 'services', label: 'خدمات النظام', icon: 'cog', keywords: 'services launchd خدمات' },
  { id: 'network', label: 'الشبكة', icon: 'globe', keywords: 'network ping dns شبكة' },
  { id: 'system', label: 'معلومات النظام', icon: 'monitor', keywords: 'system info cpu memory' },
  { id: 'report', label: 'تقرير النظام', icon: 'fileText', keywords: 'report export تقرير' },
  { id: 'history', label: 'سجل التنظيف', icon: 'history', keywords: 'history log سجل' }
]

export const MAC_ITEM: NavItem = { id: 'mactools', label: 'أدوات ماك', icon: 'apple', keywords: 'mac orphans languages purge' }
export const SETTINGS_ITEM: NavItem = { id: 'settings', label: 'الإعدادات', icon: 'cog', keywords: 'settings preferences إعدادات' }

export function Sidebar({
  active,
  onNavigate
}: {
  active: PageId
  onNavigate: (id: PageId) => void
}): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [platform, setPlatform] = useState<PlatformInfo | null>(null)

  useEffect(() => {
    window.api.system.appInfo().then(setInfo).catch(() => setInfo(null))
    window.api.platform.info().then(setPlatform).catch(() => setPlatform(null))
  }, [])

  const render = (item: NavItem): JSX.Element => (
    <div
      key={item.id}
      className={`nav-item ${active === item.id ? 'active' : ''}`}
      onClick={() => onNavigate(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(item.id)}
    >
      <Icon name={item.icon} size={17} />
      <span>{item.label}</span>
    </div>
  )

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge">
          <Icon name="logo" size={19} strokeWidth={2} />
        </div>
        <div>
          CleanShelf
          <small>by Alcode</small>
        </div>
      </div>

      {MAIN_ITEMS.map(render)}

      <div className="nav-section-label">أدوات القرص</div>
      {DISK_ITEMS.map(render)}

      <div className="nav-section-label">الخصوصية والأمان</div>
      {PRIVACY_ITEMS.map(render)}

      <div className="nav-section-label">النظام</div>
      {(platform?.isMac ? [MAC_ITEM, ...SYSTEM_ITEMS] : SYSTEM_ITEMS).map(render)}

      <div style={{ marginTop: 14 }}>{render(SETTINGS_ITEM)}</div>

      <div className="sidebar-footer">
        <div>{info ? `${info.name} ${info.version}` : 'CleanShelf'}</div>
        <div className="company">من تطوير {info?.company ?? 'Alcode'}</div>
      </div>
    </aside>
  )
}
