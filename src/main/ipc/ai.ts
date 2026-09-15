import { ipcMain, BrowserWindow } from 'electron'
import type { AiModelId, AiStatus, AiTurnInput } from '../../shared/types'
import { apiKeyHint, clearApiKey, encryptionAvailable, hasApiKey, writeApiKey } from '../lib/aiKeyLib'
import { askOnce, runAssistantTurn, verifyKey } from '../lib/aiLib'

/** جولة واحدة في كل مرة — الإلغاء يوقف البثّ ويمنع أي دورة أدوات جديدة. */
let cancelled = false

export function registerAiIpc(): void {
  ipcMain.handle('ai:status', async (): Promise<AiStatus> => ({
    hasKey: await hasApiKey(),
    keyHint: await apiKeyHint(),
    encryptionAvailable: encryptionAvailable()
  }))

  ipcMain.handle('ai:setKey', async (_e, key: string): Promise<{ ok: boolean; message?: string }> => {
    const trimmed = (key ?? '').trim()
    if (!trimmed) {
      await clearApiKey()
      return { ok: true }
    }
    // نتحقق قبل الحفظ حتى لا يبقى مفتاح خاطئ مخزَّنًا
    const check = await verifyKey(trimmed)
    if (!check.ok) return check
    await writeApiKey(trimmed)
    return { ok: true }
  })

  ipcMain.handle('ai:clearKey', async (): Promise<void> => {
    await clearApiKey()
  })

  ipcMain.handle('ai:cancel', (): void => {
    cancelled = true
  })

  ipcMain.handle('ai:ask', async (event, input: AiTurnInput): Promise<void> => {
    cancelled = false
    const win = BrowserWindow.fromWebContents(event.sender)
    await runAssistantTurn(
      input,
      (ev) => {
        if (!win || win.isDestroyed()) return
        win.webContents.send('ai:event', ev)
      },
      () => cancelled
    )
  })

  ipcMain.handle(
    'ai:explain',
    async (_e, prompt: string, lang: 'ar' | 'en', model: AiModelId): Promise<string> =>
      askOnce(prompt, lang, model)
  )
}
