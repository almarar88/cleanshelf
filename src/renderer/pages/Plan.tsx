import { useState } from 'react'
import { markTaskDone, planSummary, type PlanSummary } from '../lib/plan'
import { useToast } from '../lib/toastContext'
import { Icon } from '../components/Icon'
import { Ico } from '../components/ui'
import type { PageId } from '../lib/pages'

const BADGE: Record<string, { cls: string; label: string }> = {
  overdue: { cls: 'badge-danger', label: 'متأخرة' },
  due: { cls: 'badge-caution', label: 'مستحقة' },
  done: { cls: 'badge-safe', label: 'منجزة' }
}

export function Plan({ onNavigate, isMac }: { onNavigate: (id: PageId) => void; isMac: boolean }): JSX.Element {
  const { showToast } = useToast()
  const [plan, setPlan] = useState<PlanSummary>(() => planSummary(isMac))

  function complete(id: string, label: string): void {
    markTaskDone(id)
    setPlan(planSummary(isMac))
    showToast(`سُجّلت "${label}" كمنجزة`)
  }

  return (
    <div className="page">
      <section className="tile yellow" style={{ marginBottom: 18, maxWidth: 760 }}>
        <div className="tile-head">
          <h3>خطة الصيانة</h3>
          <span className="tile-btn"><Icon name="checkCircle" size={17} /></span>
        </div>
        <div className="stat-steps tall">
          <div className="step">
            <span className="n">{plan.overdue}</span>
            <span className="l">متأخرة</span>
            <span className="deco dots" />
          </div>
          <div className="step">
            <span className="n">{plan.due}</span>
            <span className="l">مستحقة</span>
            <span className="deco hatch" />
          </div>
          <div className="step">
            <span className="n">{plan.inPlan}</span>
            <span className="l">في الخطة</span>
            <span className="bars">
              {[34, 46, 58, 52, 70, 84].map((h, i) => (
                <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }} />
              ))}
            </span>
          </div>
          <div className="step">
            <span className="n">{plan.done}</span>
            <span className="l">منجزة</span>
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
                <div className="title">{task.label}</div>
                <div className="desc">
                  {task.daysAgo === null ? 'لم تُنفَّذ بعد' : task.daysAgo === 0 ? 'نُفِّذت اليوم' : `آخر مرة قبل ${task.daysAgo} يوم`} • كل {task.everyDays} يوم
                </div>
              </div>
              <span className={`badge ${badge.cls}`}>{badge.label}</span>
              <button
                className="round-btn"
                style={{ width: 36, height: 36 }}
                title="تسجيلها كمنجزة"
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
