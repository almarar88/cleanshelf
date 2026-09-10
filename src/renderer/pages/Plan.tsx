import { useState } from 'react'
import { markTaskDone, planSummary, type PlanSummary } from '../lib/plan'
import { useToast } from '../lib/toastContext'
import { Icon } from '../components/Icon'
import { Ico } from '../components/ui'
import type { PageId } from '../lib/pages'
import { fmtNum } from '../lib/format'
import { t } from '../lib/i18n'

const BADGE: Record<string, { cls: string; label: string }> = {
  overdue: { cls: 'badge-danger', label: 'plan.badge.overdue' },
  due: { cls: 'badge-caution', label: 'plan.badge.due' },
  done: { cls: 'badge-safe', label: 'plan.badge.done' }
}

export function Plan({ onNavigate, isMac }: { onNavigate: (id: PageId) => void; isMac: boolean }): JSX.Element {
  const { showToast } = useToast()
  const [plan, setPlan] = useState<PlanSummary>(() => planSummary(isMac))

  function complete(id: string, label: string): void {
    markTaskDone(id)
    setPlan(planSummary(isMac))
    showToast(t('plan.marked', { label: t(label) }))
  }

  return (
    <div className="page">
      <section className="tile yellow" style={{ marginBottom: 18, maxWidth: 760 }}>
        <div className="tile-head">
          <h3>{t('page.plan')}</h3>
          <span className="tile-btn"><Icon name="checkCircle" size={17} /></span>
        </div>
        <div className="stat-steps tall">
          <div className="step">
            <span className="n">{fmtNum(plan.overdue)}</span>
            <span className="l">{t('dash.overdue')}</span>
            <span className="deco dots" />
          </div>
          <div className="step">
            <span className="n">{fmtNum(plan.due)}</span>
            <span className="l">{t('dash.due')}</span>
            <span className="deco hatch" />
          </div>
          <div className="step">
            <span className="n">{fmtNum(plan.inPlan)}</span>
            <span className="l">{t('dash.inPlan')}</span>
            <span className="bars">
              {[34, 46, 58, 52, 70, 84].map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }} />
              ))}
            </span>
          </div>
          <div className="step">
            <span className="n">{fmtNum(plan.done)}</span>
            <span className="l">{t('dash.done')}</span>
            <span className="deco solid" />
          </div>
        </div>
      </section>

      <div className="card">
        {plan.tasks.map((task, i) => {
          const badge = BADGE[task.state]
          return (
            <div key={task.id} className="row" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }} onClick={() => onNavigate(task.page)}>
              <Ico name={task.icon} tone={task.tone} size="sm" />
              <div className="text">
                <div className="title">{t(task.label)}</div>
                <div className="desc">
                  {task.daysAgo === null ? t('plan.never') : task.daysAgo === 0 ? t('plan.today') : t('plan.daysAgo', { n: fmtNum(task.daysAgo) })} • {t('plan.every', { n: fmtNum(task.everyDays) })}
                </div>
              </div>
              <span className={`badge ${badge.cls}`}>{t(badge.label)}</span>
              <button
                className="round-btn"
                style={{ width: 36, height: 36 }}
                title={t('plan.markDone')}
                onClick={(e) => {
                  e.stopPropagation()
                  complete(task.id, task.label)
                }}
              >
                <Icon name="check" size={17} strokeWidth={2.6} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
