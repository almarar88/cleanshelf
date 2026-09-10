import type { IconName } from '../components/Icon'
import type { PageId } from './nav'

export type PlanState = 'done' | 'due' | 'overdue'

export interface PlanTaskDef {
  id: string
  labelKey: string
  page: PageId
  icon: IconName
  tone: string
  /** كل كم يوم تُعاد المهمة */
  everyDays: number
}

export const PLAN_TASKS: PlanTaskDef[] = [
  { id: 'junk', labelKey: 'plan.task.junk', page: 'cleaner', icon: 'sparkles', tone: 'tone-yellow', everyDays: 7 },
  { id: 'social', labelKey: 'plan.task.social', page: 'social', icon: 'message', tone: 'tone-green', everyDays: 30 },
  { id: 'shots', labelKey: 'plan.task.shots', page: 'screenshots', icon: 'image', tone: 'tone-violet', everyDays: 30 },
  { id: 'downloads', labelKey: 'plan.task.downloads', page: 'downloads', icon: 'download', tone: 'tone-blue', everyDays: 30 },
  { id: 'dup', labelKey: 'plan.task.dup', page: 'duplicates', icon: 'copy', tone: 'tone-pink', everyDays: 60 },
  { id: 'trash', labelKey: 'plan.task.trash', page: 'trash', icon: 'trash', tone: 'tone-red', everyDays: 14 },
  { id: 'apps', labelKey: 'plan.task.apps', page: 'apps', icon: 'grid', tone: 'tone-orange', everyDays: 60 }
]

const KEY = 'cleanshelf.plan'
const DAY = 86_400_000

type Store = Record<string, number>

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

export function markTaskDone(id: string): void {
  const store = read()
  store[id] = Date.now()
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // تجاهل
  }
}

export interface PlanTask extends PlanTaskDef {
  lastDone: number
  daysAgo: number | null
  state: PlanState
}

/** حالة كل مهمة: منجزة إن نُفِّذت داخل دورتها، مستحقة إن قاربت، متأخرة إن تجاوزت الضعف. */
export function planTasks(): PlanTask[] {
  const store = read()
  return PLAN_TASKS.map((def) => {
    const lastDone = store[def.id] ?? 0
    const daysAgo = lastDone ? Math.floor((Date.now() - lastDone) / DAY) : null
    let state: PlanState = 'overdue'
    if (daysAgo !== null && daysAgo <= def.everyDays) state = 'done'
    else if (daysAgo !== null && daysAgo <= def.everyDays * 2) state = 'due'
    return { ...def, lastDone, daysAgo, state }
  })
}

export interface PlanSummary {
  overdue: number
  due: number
  inPlan: number
  done: number
  tasks: PlanTask[]
}

export function planSummary(): PlanSummary {
  const tasks = planTasks()
  return {
    overdue: tasks.filter((x) => x.state === 'overdue').length,
    due: tasks.filter((x) => x.state === 'due').length,
    inPlan: tasks.length,
    done: tasks.filter((x) => x.state === 'done').length,
    tasks
  }
}
