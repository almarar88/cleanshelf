import { useEffect, useState } from 'react'
import type { AppInfo, PlatformInfo } from '../../shared/types'
import type { PageId } from '../App'

interface NavItem {
  id: PageId
  label: string
  icon: string
}

const MAIN_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
  { id: 'cleaner', label: 'منظّف القرص', icon: '🧹' },
  { id: 'uninstaller', label: 'إزالة البرامج', icon: '🗑️' },
  { id: 'files', label: 'مدير الملفات', icon: '📁' },
  { id: 'tags', label: 'محرر وسوم الأغاني', icon: '🎵' }
]

const ADVANCED_ITEMS: NavItem[] = [
  { id: 'diskanalyzer', label: 'محلّل المساحة', icon: '📊' },
  { id: 'duplicates', label: 'الملفات المكرّرة', icon: '🧬' },
  { id: 'largefiles', label: 'أكبر الملفات', icon: '📦' },
  { id: 'extras', label: 'مجلدات واختصارات', icon: '🗂️' },
  { id: 'startup', label: 'برامج بدء التشغيل', icon: '🚀' }
]

const SYSTEM_ITEMS: NavItem[] = [
  { id: 'processes', label: 'العمليات', icon: '⚡' },
  { id: 'services', label: 'خدمات النظام', icon: '⚙️' },
  { id: 'network', label: 'الشبكة', icon: '🌐' },
  { id: 'system', label: 'معلومات النظام', icon: '💻' },
  { id: 'history', label: 'سجل التنظيف', icon: '🧾' }
]

const MAC_ITEM: NavItem = { id: 'mactools', label: 'أدوات ماك', icon: '🍎' }

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
    window.api.system
      .appInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
    window.api.platform
      .info()
      .then(setPlatform)
      .catch(() => setPlatform(null))
  }, [])

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge">🧼</div>
        <span>CleanShelf</span>
      </div>

      {MAIN_ITEMS.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}

      <div className="nav-section-label">أدوات القرص</div>
      {ADVANCED_ITEMS.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}

      <div className="nav-section-label">النظام</div>
      {(platform?.isMac ? [MAC_ITEM, ...SYSTEM_ITEMS] : SYSTEM_ITEMS).map((item) => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}

      <div className="sidebar-footer">
        <div>{info ? `${info.name} ${info.version}` : 'CleanShelf'}</div>
        <div className="company">من تطوير {info?.company ?? 'Alcode'}</div>
      </div>
    </aside>
  )
}
