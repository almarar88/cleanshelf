import os from 'node:os'
import Anthropic from '@anthropic-ai/sdk'
import { readApiKey } from './aiKeyLib'
import { AI_TOOLS, runAiTool } from './aiTools'
import type { AiEvent, AiModelId, AiTurnInput } from '../../shared/types'

/** الطرازات المعروضة للمستخدم — يختار بين الجودة والتكلفة بنفسه. */
export const AI_MODELS: { id: AiModelId; label: string }[] = [
  { id: 'claude-opus-5', label: 'Claude Opus 5' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
]

function client(apiKey: string): Anthropic {
  return new Anthropic({ apiKey })
}

function platformName(): string {
  if (process.platform === 'win32') return 'Windows'
  if (process.platform === 'darwin') return 'macOS'
  return 'Linux'
}

/**
 * المساعد يقرأ حالة الجهاز عبر الأدوات ثم ينصح. لا يحذف شيئًا بنفسه —
 * التنفيذ يبقى بيد المستخدم داخل صفحات التطبيق، وهذا مقصود: أداة تنظيف
 * تحذف بناءً على استنتاج نموذج دون مراجعة خطيرة.
 */
function systemPrompt(lang: 'ar' | 'en'): string {
  const shared = `You are the assistant built into CleanShelf, a disk-cleaning and maintenance app by Alcode, running on ${platformName()}. The user's home folder is ${os.homedir()}.

How to work:
- Call the read-only tools to look at this machine before answering. Never guess numbers; if you did not measure it, say so.
- Prefer the smallest set of tools that answers the question. get_device_health is cheap; scan_cleanable takes tens of seconds; analyze_folder and find_large_files walk the disk.
- Report sizes in human units and always say where a number came from.
- End with concrete next steps naming the CleanShelf page that does the job: Disk cleaner, Uninstall programs, Space analyser, Duplicate files, Largest files, Old downloads, Browser privacy, Startup programs, Secure shredder, Maintenance plan.

Safety:
- You cannot delete anything. Never claim you cleaned or removed something.
- Before recommending a deletion, say what the files are and what is lost. Flag anything that needs administrator rights.
- Never recommend deleting something you have not identified. If a folder is unfamiliar, say so and suggest the Space analyser instead of guessing.`

  return lang === 'ar'
    ? `${shared}

اكتب بالعربية الفصحى الواضحة، بجُمل قصيرة وبلا حشو. استعمل الأرقام اللاتينية. سمِّ صفحات التطبيق بأسمائها العربية: منظّف القرص، إزالة البرامج، محلّل المساحة، الملفات المكرّرة، أكبر الملفات، التنزيلات القديمة، خصوصية المتصفح، برامج بدء التشغيل، الممزّق الآمن، خطة الصيانة.`
    : `${shared}

Write in clear English, short sentences, no filler.`
}

/**
 * جولة كاملة: يستدعي النموذج، ينفّذ ما يطلبه من أدوات، ويعيد الكرّة حتى ينتهي.
 * يبثّ الأحداث أولًا بأول ليظهر النص أثناء كتابته وتظهر الأدوات أثناء عملها.
 */
export async function runAssistantTurn(
  input: AiTurnInput,
  emit: (event: AiEvent) => void,
  isCancelled: () => boolean
): Promise<void> {
  const apiKey = await readApiKey()
  if (!apiKey) {
    emit({ type: 'error', message: 'no-key' })
    return
  }

  const anthropic = client(apiKey)
  const messages: Anthropic.MessageParam[] = input.messages.map((m) => ({
    role: m.role,
    content: m.content
  }))

  // الاستهلاك تراكمي عبر الدورات، وإلا أظهرت الواجهة آخر دورة فقط وبدت الجولة أرخص مما هي
  let totalIn = 0
  let totalOut = 0

  // حدّ أعلى لدورات الأدوات حتى لا تدور الحلقة بلا نهاية على فاتورة المستخدم
  for (let round = 0; round < 8; round += 1) {
    if (isCancelled()) {
      emit({ type: 'cancelled' })
      return
    }

    let assistantBlocks: Anthropic.ContentBlock[] = []
    let stopReason: string | null = null

    try {
      const stream = anthropic.messages.stream({
        model: input.model,
        max_tokens: 8000,
        system: [{ type: 'text', text: systemPrompt(input.lang), cache_control: { type: 'ephemeral' } }],
        tools: AI_TOOLS,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        messages
      })

      stream.on('text', (delta) => {
        if (!isCancelled()) emit({ type: 'text', text: delta })
      })

      const final = await stream.finalMessage()
      assistantBlocks = final.content
      stopReason = final.stop_reason
      if (final.usage) {
        totalIn += final.usage.input_tokens
        totalOut += final.usage.output_tokens
        emit({ type: 'usage', inputTokens: totalIn, outputTokens: totalOut })
      }
    } catch (err) {
      emit({ type: 'error', message: describeError(err) })
      return
    }

    if (isCancelled()) {
      emit({ type: 'cancelled' })
      return
    }

    if (stopReason === 'refusal') {
      emit({ type: 'error', message: 'refusal' })
      return
    }

    messages.push({ role: 'assistant', content: assistantBlocks })

    const toolUses = assistantBlocks.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    if (toolUses.length === 0) {
      emit({ type: 'done' })
      return
    }

    // ننفّذ كل الأدوات المطلوبة ونعيدها في رسالة واحدة كما تتطلّب الواجهة
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const use of toolUses) {
      emit({ type: 'tool', name: use.name, status: 'start' })
      try {
        const output = await runAiTool(use.name, (use.input ?? {}) as Record<string, unknown>)
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(output)
        })
        emit({ type: 'tool', name: use.name, status: 'done' })
      } catch (err) {
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: (err as Error).message,
          is_error: true
        })
        emit({ type: 'tool', name: use.name, status: 'error' })
      }
    }
    messages.push({ role: 'user', content: results })
  }

  emit({ type: 'done' })
}

/** نداء واحد بلا أدوات — للأزرار التي تشرح عنصرًا بعينه. */
export async function askOnce(
  prompt: string,
  lang: 'ar' | 'en',
  model: AiModelId,
  maxTokens = 1200
): Promise<string> {
  const apiKey = await readApiKey()
  if (!apiKey) throw new Error('no-key')
  const response = await client(apiKey).messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt(lang),
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: prompt }]
  })
  if (response.stop_reason === 'refusal') throw new Error('refusal')
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

/** يتحقق أن المفتاح يعمل فعلًا بأرخص نداء ممكن. */
export async function verifyKey(apiKey: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await client(apiKey).messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ping' }]
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, message: describeError(err) }
  }
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'auth'
  if (err instanceof Anthropic.RateLimitError) return 'rate-limit'
  if (err instanceof Anthropic.APIConnectionError) return 'offline'
  if (err instanceof Anthropic.APIError) return `api:${err.status}:${err.message}`
  return (err as Error)?.message ?? 'unknown'
}
