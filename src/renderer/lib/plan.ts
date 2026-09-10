import type { IconName } from '../components/Icon'
import type { PageId } from './pages'

export type PlanState = 'done' | 'due' | 'overdue'

export interface PlanTaskDef {
  id: string
  label: string
  page: PageId
  icon: IconName
  tone: string
  /** كل كم يوم تُعاد المهمة */
  everyDays: number
  /** المهام الخاصة بماك فقط */
  macOnly?: boolean
}

export const PLAN_TASKS: PlanTaskDef[] = [
  { id: 'junk', label: 'plan.task.junk', page: 'cleaner', icon: 'sparkles', tone: 'tone-yellow', everyDays: 7 },
  { id: 'privacy', label: 'plan.task.privacy', page: 'privacy', icon: 'eyeOff', tone: 'tone-violet', everyDays: 14 },
  { id: 'downloads', label: 'plan.task.downloads', page: 'downloads', icon: 'download', tone: 'tone-blue', everyDays: 30 },
  { id: 'duplicates', label: 'plan.task.duplicates', page: 'duplicates', icon: 'copy', tone: 'tone-pink', everyDays: 60 },
  { id: 'largefiles', label: 'plan.task.largefiles', page: 'largefiles', icon: 'package', tone: 'tone-orange', everyDays: 60 },
  { id: 'startup', label: 'plan.task.startup', page: 'startup', icon: 'rocket', tone: 'tone-teal', everyDays: 90 },
  { id: 'uninstaller', label: 'plan.task.uninstaller', page: 'uninstaller', icon: 'trash', tone: 'tone-red', everyDays: 90 },
  { id: 'extras', label: 'plan.task.extras', page: 'extras', icon: 'link', tone: 'tone-green', everyDays: 60 }
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
    // التخزين قد يكون معطّلًا
  }
}

export interface PlanTask extends PlanTaskDef {
  lastDone: number
  daysAgo: number | null
  state: PlanState
}

/** حالة كل مهمة: منجزة إن نُفِّذت داخل دورتها، مستحقة إن قاربت، متأخرة إن تجاوزت الضعف. */
export function planTasks(isMac = false): PlanTask[] {
  const store = read()
  return PLAN_TASKS.filter((d) => !d.macOnly || isMac).map((def) => {
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

export function planSummary(isMac = false): PlanSummary {
  const tasks = planTasks(isMac)
  return {
    overdue: tasks.filter((x) => x.state === 'overdue').length,
    due: tasks.filter((x) => x.state === 'due').length,
    inPlan: tasks.length,
    done: tasks.filter((x) => x.state === 'done').length,
    tasks
  }
}
