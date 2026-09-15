import { useEffect, useRef, useState } from 'react'
import type { AiEvent, AiMessage, AppSettings } from '../../shared/types'
import { t, useI18n } from '../lib/i18n'
import { fmtNum } from '../lib/format'
import { Icon } from '../components/Icon'
import { Ico, Notice } from '../components/ui'
import type { PageId } from '../lib/pages'

const SUGGESTIONS = ['ai.sug.why', 'ai.sug.safe', 'ai.sug.slow', 'ai.sug.startup']

interface Turn extends AiMessage {
  /** الأدوات التي استدعاها هذا الردّ، بالترتيب */
  tools?: { name: string; status: 'start' | 'done' | 'error' }[]
  usage?: { input: number; output: number }
  error?: string
}

export function Assistant({
  settings,
  hasKey,
  onNavigate
}: {
  settings: AppSettings | null
  hasKey: boolean
  onNavigate: (id: PageId) => void
}): JSX.Element {
  const { lang } = useI18n()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  // الردّ يُبنى تدريجيًا من أحداث البثّ، ونحتفظ به في ref لأن الأحداث تتوالى بسرعة
  const streaming = useRef<Turn | null>(null)

  useEffect(() => {
    return window.api.ai.onEvent((ev: AiEvent) => {
      const current = streaming.current
      if (!current) return
      if (ev.type === 'text') {
        current.content += ev.text
      } else if (ev.type === 'tool') {
        current.tools = current.tools ?? []
        const existing = current.tools.find((x) => x.name === ev.name && x.status === 'start')
        if (existing && ev.status !== 'start') existing.status = ev.status
        else current.tools.push({ name: ev.name, status: ev.status })
      } else if (ev.type === 'usage') {
        current.usage = { input: ev.inputTokens, output: ev.outputTokens }
      } else if (ev.type === 'error') {
        current.error = ev.message
      } else if (ev.type === 'cancelled') {
        current.error = 'cancelled'
      }
      // نسخة جديدة في كل حدث حتى تُعاد الرسمة
      setTurns((prev) => [...prev.slice(0, -1), { ...current, tools: current.tools?.map((x) => ({ ...x })) }])
      if (ev.type === 'done' || ev.type === 'error' || ev.type === 'cancelled') {
        streaming.current = null
        setBusy(false)
      }
    })
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [turns])

  async function send(text: string): Promise<void> {
    const question = text.trim()
    if (!question || busy || !settings) return
    setDraft('')
    setBusy(true)

    const history: AiMessage[] = [
      ...turns.filter((x) => !x.error).map((x) => ({ role: x.role, content: x.content })),
      { role: 'user' as const, content: question }
    ]
    const reply: Turn = { role: 'assistant', content: '' }
    streaming.current = reply
    setTurns((prev) => [...prev, { role: 'user', content: question }, reply])

    try {
      await window.api.ai.ask({ messages: history, model: settings.aiModel, lang })
    } catch (err) {
      reply.error = (err as Error).message
      setTurns((prev) => [...prev.slice(0, -1), { ...reply }])
      streaming.current = null
      setBusy(false)
    }
  }

  function errorText(code: string): string {
    if (code === 'auth') return t('ai.err.auth')
    if (code === 'rate-limit') return t('ai.err.rate')
    if (code === 'offline') return t('ai.err.offline')
    if (code === 'refusal') return t('ai.err.refusal')
    if (code === 'no-key') return t('ai.err.noKey')
    if (code === 'cancelled') return t('ai.cancelled')
    return t('ai.err.generic', { msg: code })
  }

  if (!settings?.aiEnabled) {
    return (
      <div className="page">
        <div className="empty" style={{ paddingTop: 60 }}>
          <Ico name="brain" tone="tone-violet" size="lg" />
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('ai.disabledTitle')}</div>
          <p className="card-sub" style={{ maxWidth: 520, whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.7 }}>
            {t('ai.disabledBody')}
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('settings')}>
            <Icon name="cog" size={16} /> {t('ai.openSettings')}
          </button>
        </div>
      </div>
    )
  }

  if (!hasKey) {
    return (
      <div className="page">
        <div className="empty" style={{ paddingTop: 60 }}>
          <Ico name="lock" tone="tone-yellow" size="lg" />
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t('ai.noKeyTitle')}</div>
          <p className="card-sub" style={{ maxWidth: 520, whiteSpace: 'normal', textAlign: 'center' }}>{t('ai.noKeyBody')}</p>
          <button className="btn btn-primary" onClick={() => onNavigate('settings')}>
            <Icon name="cog" size={16} /> {t('ai.openSettings')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page ai-page">
      <div className="ai-thread" ref={listRef}>
        {turns.length === 0 && (
          <div className="ai-welcome">
            <span className="ico tone-violet lg"><Icon name="brain" size={26} /></span>
            <h2>{t('ai.title')}</h2>
            <p>{t('ai.privacy')}</p>
            <div className="pill-row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              {SUGGESTIONS.map((key) => (
                <button key={key} className="pill sm" onClick={() => send(t(key))}>{t(key)}</button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={`ai-turn ${turn.role}`}>
            {turn.role === 'assistant' && <Ico name="brain" tone="tone-violet" size="sm" />}
            <div className="ai-bubble">
              {turn.tools && turn.tools.length > 0 && (
                <div className="ai-tools">
                  {turn.tools.map((tool, j) => (
                    <span key={j} className={`ai-tool ${tool.status}`}>
                      <Icon
                        name={tool.status === 'done' ? 'check' : tool.status === 'error' ? 'alert' : 'activity'}
                        size={13}
                      />
                      {t(`ai.tool.${tool.name}`)}
                    </span>
                  ))}
                </div>
              )}
              {turn.content && <div className="ai-text">{turn.content}</div>}
              {!turn.content && !turn.error && turn.role === 'assistant' && (
                <div className="ai-text muted">{t('ai.thinking')}</div>
              )}
              {turn.error && <div className="ai-error">{errorText(turn.error)}</div>}
              {turn.usage && (
                <div className="ai-usage">{t('ai.usage', { in: fmtNum(turn.usage.input), out: fmtNum(turn.usage.output) })}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="ai-composer">
        <Notice icon="shield">{t('ai.cannotDelete')}</Notice>
        <div className="field-row">
          <input
            type="text"
            value={draft}
            placeholder={t('ai.placeholder')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(draft)}
            disabled={busy}
          />
          {busy ? (
            <button className="btn btn-sm" onClick={() => window.api.ai.cancel()}>
              <Icon name="square" size={15} /> {t('ai.stop')}
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={() => send(draft)} disabled={!draft.trim()}>
              <Icon name="arrowRight" size={15} className="flip-rtl" /> {t('ai.send')}
            </button>
          )}
        </div>
        {turns.length > 0 && !busy && (
          <button className="btn btn-sm btn-ghost" onClick={() => setTurns([])}>
            <Icon name="refresh" size={14} /> {t('ai.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
