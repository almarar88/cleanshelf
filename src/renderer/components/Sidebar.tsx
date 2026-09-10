import { useEffect, useState } from 'react'
import type { AppInfo, PlatformInfo } from '../../shared/types'
import { PAGE_META, pageTitle, type PageId } from '../lib/pages'
import { t } from '../lib/i18n'
import { Icon, type IconName } from './Icon'

export interface NavItem {
  id: PageId
  icon: IconName
  keywords?: string
}

function item(id: PageId, keywords: string): NavItem {
  return { id, icon: PAGE_META[id].icon, keywords }
}

export const MAIN_ITEMS: NavItem[] = [
  item('dashboard', 'home dashboard صحة'),
  item('overview', 'overview forecast توقع نظرة'),
  item('plan', 'plan tasks خطة مهام'),
  item('cleaner', 'clean temp cache تنظيف'),
  item('uninstaller', 'uninstall apps برامج'),
  item('files', 'files explorer ملفات'),
  item('tags', 'mp3 tags id3 أغاني')
]

export const DISK_ITEMS: NavItem[] = [
  item('diskanalyzer', 'disk usage analyzer مساحة'),
  item('duplicates', 'duplicates مكرر'),
  item('largefiles', 'large big files كبيرة'),
  item('downloads', 'downloads old تنزيلات'),
  item('extras', 'empty folders broken shortcuts فارغة'),
  item('startup', 'startup login items إقلاع')
]

export const PRIVACY_ITEMS: NavItem[] = [
  item('privacy', 'browser history cookies privacy كوكيز'),
  item('shredder', 'shred secure delete حذف نهائي')
]

export const SYSTEM_ITEMS: NavItem[] = [
  item('processes', 'processes tasks كيل'),
  item('services', 'services launchd خدمات'),
  item('network', 'network ping dns شبكة'),
  item('system', 'system info cpu memory'),
  item('report', 'report export تقرير'),
  item('history', 'history log سجل')
]

export const MAC_ITEM: NavItem = item('mactools', 'mac orphans languages purge')
export const SETTINGS_ITEM: NavItem = item('settings', 'settings preferences إعدادات لغة language')

export function Sidebar({
  active,
  onNavigate,
  pinned,
  onTogglePin
}: {
  active: PageId
  onNavigate: (id: PageId) => void
  pinned: PageId[]
  onTogglePin: (id: PageId) => void
}): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [platform, setPlatform] = useState<PlatformInfo | null>(null)

  useEffect(() => {
    window.api.system.appInfo().then(setInfo).catch(() => setInfo(null))
    window.api.platform.info().then(setPlatform).catch(() => setPlatform(null))
  }, [])

  const render = (item: NavItem, showPin = true): JSX.Element => (
    <div
      key={item.id}
      className={`nav-item ${active === item.id ? 'active' : ''}`}
      onClick={() => onNavigate(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(item.id)}
    >
      <Icon name={item.icon} size={17} />
      <span>{pageTitle(item.id)}</span>
      {showPin && item.id !== 'dashboard' && (
        <button
          className={`star ${pinned.includes(item.id) ? 'on' : ''}`}
          title={t(pinned.includes(item.id) ? 'nav.unpin' : 'nav.pin')}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin(item.id)
          }}
        >
          <Icon name="star" size={15} strokeWidth={pinned.includes(item.id) ? 2.4 : 1.8} />
        </button>
      )}
    </div>
  )

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge">
          <Icon name="logo" size={19} strokeWidth={2} />
        </div>
        <div>
          {t('app.name')}
          <small>{t('app.by')}</small>
        </div>
      </div>

      {MAIN_ITEMS.map((i) => render(i))}

      <div className="nav-section-label">{t('nav.disk')}</div>
      {DISK_ITEMS.map((i) => render(i))}

      <div className="nav-section-label">{t('nav.privacy')}</div>
      {PRIVACY_ITEMS.map((i) => render(i))}

      <div className="nav-section-label">{t('nav.system')}</div>
      {(platform?.isMac ? [MAC_ITEM, ...SYSTEM_ITEMS] : SYSTEM_ITEMS).map((i) => render(i))}

      <div style={{ marginTop: 14 }}>{render(SETTINGS_ITEM, false)}</div>

      <div className="sidebar-footer">
        <div>{info ? `${info.name} ${info.version}` : t('app.name')}</div>
        <div className="company">{t('app.byShort', { company: info?.company ?? 'Alcode' })}</div>
      </div>
    </aside>
  )
}
