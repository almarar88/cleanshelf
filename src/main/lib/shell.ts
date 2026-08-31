import { execFile } from 'node:child_process'

/**
 * ينفّذ أمرًا مع وسائط منفصلة (لا عبر صدفة) فلا مجال لحقن الأوامر.
 */
export function run(
  command: string,
  args: string[],
  timeoutMs = 30_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.toString().trim() || error.message))
          return
        }
        resolve(stdout.toString())
      }
    )
  })
}

export async function runJson<T>(
  command: string,
  args: string[],
  timeoutMs = 30_000
): Promise<T> {
  const out = (await run(command, args, timeoutMs)).trim()
  if (!out) return [] as unknown as T
  try {
    return JSON.parse(out) as T
  } catch {
    throw new Error('تعذّر تحليل الخرج: ' + out.slice(0, 300))
  }
}

/**
 * ينفّذ سكربت AppleScript. النصوص المتغيّرة تُمرَّر عبر وسائط `--` لا بالدمج
 * في النص، حتى لا يستطيع اسم ملف يحوي علامات اقتباس تغيير معنى السكربت.
 */
export function runAppleScript(script: string, args: string[] = []): Promise<string> {
  return run('osascript', ['-e', script, ...args])
}

/**
 * ينفّذ أمرًا بصلاحيات المدير عبر حوار النظام على ماك.
 * يُستخدم فقط عند الحاجة الفعلية (حذف من مجلدات النظام مثلاً).
 */
export async function runWithAdmin(shellCommand: string): Promise<string> {
  return runAppleScript(
    `do shell script ${JSON.stringify(shellCommand)} with administrator privileges`
  )
}
