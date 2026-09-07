import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
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
        <strong>يلزم إذن الوصول لكل الملفات</strong>
        {!compact && (
          <div style={{ marginTop: 2 }}>
            بدونه لا يستطيع CleanShelf رؤية الملفات المؤقتة والتنزيلات والصور. لن يُرسل أي شيء خارج هاتفك.
          </div>
        )}
        <button className="btn btn-sm btn-primary" onClick={() => Native.requestAllFiles()}>
          منح الإذن
        </button>
      </div>
    </div>
  )
}
