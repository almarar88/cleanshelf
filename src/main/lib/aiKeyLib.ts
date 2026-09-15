import fs from 'node:fs/promises'
import path from 'node:path'
import { app, safeStorage } from 'electron'

/**
 * مفتاح Anthropic يخصّ المستخدم (BYOK). يُخزَّن مشفَّرًا عبر safeStorage الذي
 * يستعمل سلسلة مفاتيح النظام (DPAPI على ويندوز، Keychain على ماك)، في ملف
 * منفصل عن الإعدادات حتى لا يظهر في أي تصدير أو نسخة احتياطية للإعدادات.
 * لا يصل المفتاح إلى الواجهة أبدًا — كل النداءات تحدث في العملية الرئيسية.
 */

function keyPath(): string {
  return path.join(app.getPath('userData'), 'ai-key.bin')
}

let cache: string | null | undefined

export async function readApiKey(): Promise<string | null> {
  if (cache !== undefined) return cache
  try {
    const raw = await fs.readFile(keyPath())
    cache = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : Buffer.from(raw.toString('utf8'), 'base64').toString('utf8')
  } catch {
    cache = null
  }
  return cache
}

export async function writeApiKey(key: string): Promise<void> {
  const trimmed = key.trim()
  if (!trimmed) {
    await clearApiKey()
    return
  }
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(trimmed)
    : Buffer.from(Buffer.from(trimmed, 'utf8').toString('base64'), 'utf8')
  await fs.writeFile(keyPath(), payload, { mode: 0o600 })
  cache = trimmed
}

export async function clearApiKey(): Promise<void> {
  cache = null
  try {
    await fs.unlink(keyPath())
  } catch {
    // لم يكن هناك مفتاح أصلًا
  }
}

export async function hasApiKey(): Promise<boolean> {
  return (await readApiKey()) !== null
}

/** آخر أربعة أحرف فقط — يكفي ليتعرّف المستخدم على مفتاحه دون كشفه. */
export async function apiKeyHint(): Promise<string | null> {
  const key = await readApiKey()
  return key ? `…${key.slice(-4)}` : null
}

/** التشفير غير متاح على بعض توزيعات لينكس بلا سلسلة مفاتيح. */
export function encryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}
