import { Notification } from 'electron'
import { readSettings } from './settingsLib'

/** إشعار نظام أصلي — يحترم خيار المستخدم في الإعدادات. */
export async function notify(title: string, body: string): Promise<void> {
  try {
    const settings = await readSettings()
    if (!settings.notifications || !Notification.isSupported()) return
    new Notification({ title, body, silent: false }).show()
  } catch {
    // الإشعارات ليست حرجة — لا نُسقط العملية لأجلها
  }
}
