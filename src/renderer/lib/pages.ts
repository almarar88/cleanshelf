import type { IconName } from '../components/Icon'
import { t } from './i18n'

export type PageId =
  | 'dashboard'
  | 'overview'
  | 'plan'
  | 'cleaner'
  | 'uninstaller'
  | 'files'
  | 'tags'
  | 'duplicates'
  | 'largefiles'
  | 'startup'
  | 'system'
  | 'processes'
  | 'services'
  | 'network'
  | 'diskanalyzer'
  | 'extras'
  | 'history'
  | 'mactools'
  | 'privacy'
  | 'shredder'
  | 'downloads'
  | 'report'
  | 'settings'

export interface PageMeta {
  /** مفاتيح ترجمة لا نصوصًا جاهزة */
  title: string
  sub: string
  icon: IconName
  tone: string
}

/** عنوان الصفحة ووصفها باللغة الحالية */
export function pageTitle(id: PageId): string {
  return t(PAGE_META[id].title)
}

export function pageSub(id: PageId): string {
  return t(PAGE_META[id].sub)
}

export const PAGE_META: Record<PageId, PageMeta> = {
  dashboard: { title: 'page.dashboard', sub: 'page.dashboard.sub', icon: 'house', tone: 'tone-yellow' },
  overview: { title: 'page.overview', sub: 'page.overview.sub', icon: 'trendUp', tone: 'tone-orange' },
  plan: { title: 'page.plan', sub: 'page.plan.sub', icon: 'checkCircle', tone: 'tone-green' },
  cleaner: { title: 'page.cleaner', sub: 'page.cleaner.sub', icon: 'sparkles', tone: 'tone-yellow' },
  uninstaller: { title: 'page.uninstaller', sub: 'page.uninstaller.sub', icon: 'trash', tone: 'tone-red' },
  files: { title: 'page.files', sub: 'page.files.sub', icon: 'folder', tone: 'tone-blue' },
  tags: { title: 'page.tags', sub: 'page.tags.sub', icon: 'music', tone: 'tone-violet' },
  duplicates: { title: 'page.duplicates', sub: 'page.duplicates.sub', icon: 'copy', tone: 'tone-pink' },
  largefiles: { title: 'page.largefiles', sub: 'page.largefiles.sub', icon: 'package', tone: 'tone-orange' },
  startup: { title: 'page.startup', sub: 'page.startup.sub', icon: 'rocket', tone: 'tone-teal' },
  system: { title: 'page.system', sub: 'page.system.sub', icon: 'monitor', tone: 'tone-green' },
  processes: { title: 'page.processes', sub: 'page.processes.sub', icon: 'zap', tone: 'tone-yellow' },
  services: { title: 'page.services', sub: 'page.services.sub', icon: 'cog', tone: 'tone-ink' },
  network: { title: 'page.network', sub: 'page.network.sub', icon: 'globe', tone: 'tone-blue' },
  diskanalyzer: { title: 'page.diskanalyzer', sub: 'page.diskanalyzer.sub', icon: 'activity', tone: 'tone-teal' },
  extras: { title: 'page.extras', sub: 'page.extras.sub', icon: 'link', tone: 'tone-green' },
  history: { title: 'page.history', sub: 'page.history.sub', icon: 'history', tone: 'tone-green' },
  mactools: { title: 'page.mactools', sub: 'page.mactools.sub', icon: 'apple', tone: 'tone-ink' },
  privacy: { title: 'page.privacy', sub: 'page.privacy.sub', icon: 'eyeOff', tone: 'tone-violet' },
  shredder: { title: 'page.shredder', sub: 'page.shredder.sub', icon: 'scissors', tone: 'tone-red' },
  downloads: { title: 'page.downloads', sub: 'page.downloads.sub', icon: 'download', tone: 'tone-blue' },
  report: { title: 'page.report', sub: 'page.report.sub', icon: 'fileText', tone: 'tone-teal' },
  settings: { title: 'page.settings', sub: 'page.settings.sub', icon: 'cog', tone: 'tone-ink' }
}

/** الأدوات التي يمكن تثبيتها والبحث فيها */
export const TOOL_PAGES: PageId[] = [
  'overview',
  'plan',
  'cleaner',
  'uninstaller',
  'privacy',
  'diskanalyzer',
  'duplicates',
  'largefiles',
  'downloads',
  'extras',
  'startup',
  'files',
  'tags',
  'shredder',
  'processes',
  'services',
  'network',
  'system',
  'report',
  'history'
]
