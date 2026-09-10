import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { t } from '../lib/i18n'
import { Icon } from './Icon'

/**
 * أندرويد 11+ يمنع قراءة الذاكرة المشتركة دون إذن "الوصول لكل الملفات".
 * نعرض التنبيه فقط عند غيابه، ونعيد الفحص تلقائيًا عند العودة من الإعدادات.
 */
export function PermissionGate({ compact }: { compact?: boolean }): JSX.Element | null {
  const { permissions } = useApp()
  if (permissions.allFiles) return null
  return (
    <div className="notice notice-warn">
      <Icon name="shield" size={18} />
      <div style={{ flex: 1 }}>
        <strong>{t('perm.allFiles.title')}</strong>
        {!compact && <div style={{ marginTop: 3 }}>{t('perm.allFiles.desc')}</div>}
        <button className="btn btn-sm btn-dark" onClick={() => Native.requestAllFiles()}>{t('common.grant')}</button>
      </div>
    </div>
  )
}
