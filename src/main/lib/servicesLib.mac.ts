import type { ServiceEntry } from '../../shared/types'
import { run } from './shell'

/**
 * خدمات ماك هي وظائف launchd. خرج `launchctl list` ثلاثة أعمدة:
 * PID ورمز الخروج والتسمية. وجود PID رقمي يعني أنها تعمل الآن.
 */
export async function listServicesMac(): Promise<ServiceEntry[]> {
  const out = await run('launchctl', ['list'], 30_000)
  const lines = out.split('\n').slice(1)
  const services: ServiceEntry[] = []

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 3) continue
    const [pid, , label] = parts
    if (!label) continue

    services.push({
      name: label,
      displayName: label,
      status: pid !== '-' && /^\d+$/.test(pid) ? 'running' : 'stopped',
      // launchd لا يفرّق بين "تلقائي" و"يدوي" كويندوز؛ المحمَّل هنا يعني مُهيّأ للعمل
      startType: 'automatic'
    })
  }

  return services.sort((a, b) => a.name.localeCompare(b.name))
}

export async function controlServiceMac(
  name: string,
  action: 'start' | 'stop' | 'restart'
): Promise<{ success: boolean; message: string }> {
  try {
    if (action === 'restart') {
      await run('launchctl', ['kickstart', '-k', `gui/${process.getuid?.() ?? 501}/${name}`], 30_000)
    } else if (action === 'start') {
      await run('launchctl', ['start', name], 30_000)
    } else {
      await run('launchctl', ['stop', name], 30_000)
    }
    return { success: true, message: 'تم تنفيذ الأمر' }
  } catch (err) {
    const message = (err as Error).message
    return {
      success: false,
      message: /denied|not privileged|Operation not permitted/i.test(message)
        ? 'رُفض الوصول — خدمات النظام تحتاج صلاحيات مرتفعة'
        : message.trim().split('\n')[0]
    }
  }
}
