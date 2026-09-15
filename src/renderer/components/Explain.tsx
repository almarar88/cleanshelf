import { useEffect, useState } from 'react'
import type { AiModelId } from '../../shared/types'
import { Icon } from './Icon'
import { t } from '../lib/i18n'

interface AiReady {
  ready: boolean
  model: AiModelId
}

/** نتيجة الفحص تُخزَّن هنا حتى لا يستعلم كل زرّ شرحٍ على حدة. */
let cached: AiReady | null = null

/** هل المساعد مفعَّل ومعه مفتاح؟ أزرار الشرح تختفي تمامًا إن لم يكن كذلك. */
export function useAiReady(): AiReady {
  const [state, setState] = useState<AiReady>(cached ?? { ready: false, model: 'claude-opus-5' })

  useEffect(() => {
    let alive = true
    Promise.all([window.api.ai.status(), window.api.settings.get()])
      .then(([status, settings]) => {
        const next: AiReady = { ready: settings.aiEnabled && status.hasKey, model: settings.aiModel }
        cached = next
        if (alive) setState(next)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  return state
}

function messageFor(err: unknown): string {
  const msg = (err as Error)?.message ?? ''
  if (msg.includes('auth')) return t('ai.err.auth')
  if (msg.includes('offline')) return t('ai.err.offline')
  if (msg.includes('rate-limit')) return t('ai.err.rate')
  if (msg.includes('refusal')) return t('ai.err.refusal')
  if (msg.includes('no-key')) return t('ai.err.noKey')
  return t('ai.err.generic', { msg })
}

/**
 * لوحة شرح تسأل النموذج فور ظهورها وتعرض الجواب مكانها.
 * تُستعمل حين يكون الزرّ في مكان لا يتّسع للجواب (صفّ جدول مثلًا).
 */
export function ExplainPanel({
  question,
  context,
  lang,
  model
}: {
  question: string
  /** وصف العنصر المعنيّ — بيانات وصفية فقط، لا محتوى ملفات */
  context: string
  lang: 'ar' | 'en'
  model: AiModelId
}): JSX.Element {
  const [answer, setAnswer] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.api.ai
      .explain(`${question}\n\n${context}`, lang, model)
      .then((text) => alive && setAnswer(text))
      .catch((err) => alive && setAnswer(messageFor(err)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])

  return (
    <div className="explain-answer">
      <span className="ico tone-violet sm">
        <Icon name="brain" size={14} />
      </span>
      <div>
        <div className={`ai-text${answer ? '' : ' muted'}`}>{answer ?? t('ai.explaining')}</div>
        {answer && <div className="explain-foot">{t('ai.explainFoot')}</div>}
      </div>
    </div>
  )
}

/** زرّ «اشرح لي» يفتح اللوحة أسفله ويغلقها بضغطة ثانية. */
export function ExplainButton({
  question,
  context,
  lang,
  model
}: {
  question: string
  context: string
  lang: 'ar' | 'en'
  model: AiModelId
}): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="btn btn-sm btn-ghost explain-btn" onClick={() => setOpen(!open)}>
        <Icon name="brain" size={14} /> {t('ai.explainBtn')}
      </button>
      {open && <ExplainPanel question={question} context={context} lang={lang} model={model} />}
    </>
  )
}
