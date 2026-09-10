import { useState } from 'react'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { t } from '../lib/i18n'
import { fmtNum } from '../lib/format'
import { markTaskDone, planSummary } from '../lib/plan'
import { Icon } from '../components/Icon'
import { Ico } from '../components/ui'
import { tap, success } from '../lib/haptics'

export function Plan(): JSX.Element {
  const { navigate } = useApp()
  const { showToast } = useToast()
  const [plan, setPlan] = useState(() => planSummary())

  function complete(id: string, label: string): void {
    markTaskDone(id)
    success()
    setPlan(planSummary())
    showToast(`${t('plan.doneBadge')} — ${label}`)
  }

  return (
    <div className="page no-tabs">
      <h1 className="display sm">{t('plan.title')}</h1>
      <p className="card-sub" style={{ marginTop: -8, marginBottom: 18 }}>{t('plan.sub')}</p>

      <section className="tile yellow">
        <div className="stat-steps">
          <div className="step"><span className="n">{fmtNum(plan.overdue)}</span><span className="l">{t('home.plan.overdue')}</span></div>
          <div className="step"><span className="n">{fmtNum(plan.due)}</span><span className="l">{t('home.plan.due')}</span></div>
          <div className="step"><span className="n">{fmtNum(plan.inPlan)}</span><span className="l">{t('home.plan.inplan')}</span></div>
          <div className="step"><span className="n">{fmtNum(plan.done)}</span><span className="l">{t('home.plan.done')}</span></div>
        </div>
        <div className="deco-row">
          <span className="deco dots" />
          <span className="deco hatch" />
          <span className="bars">
            {[30, 40, 36, 52, 62, 58, 74, 90].map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }} />)}
          </span>
        </div>
      </section>

      <div className="card" style={{ marginTop: 16 }}>
        {plan.tasks.map((task) => (
          <div key={task.id} className="row" onClick={() => { tap(); navigate(task.page) }}>
            <Ico name={task.icon} tone={task.tone} />
            <div className="text">
              <div className="title">{t(task.labelKey)}</div>
              <div className="desc">
                {task.daysAgo === null ? t('plan.never') : t('plan.doneRecently', { n: fmtNum(task.daysAgo) })} • {t('plan.every', { n: fmtNum(task.everyDays) })}
              </div>
            </div>
            <span className="trail" style={{ gap: 6 }}>
              <span className={`badge ${task.state === 'done' ? 'badge-safe' : task.state === 'due' ? 'badge-warn' : 'badge-danger'}`}>
                {task.state === 'done' ? t('plan.doneBadge') : task.state === 'due' ? t('plan.dueBadge') : t('plan.overdueBadge')}
              </span>
              <button
                className="round-btn"
                style={{ width: 36, height: 36 }}
                onClick={(e) => { e.stopPropagation(); complete(task.id, t(task.labelKey)) }}
                aria-label={t('plan.markDone')}
              >
                <Icon name="check" size={17} strokeWidth={2.6} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
