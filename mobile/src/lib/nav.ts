import type { IconName } from '../components/Icon'

export type TabId = 'home' | 'cleaner' | 'files' | 'apps' | 'more'

export type PageId =
  | TabId
  | 'overview'
  | 'plan'
  | 'social'
  | 'screenshots'
  | 'booster'
  | 'duplicates'
  | 'largefiles'
  | 'downloads'
  | 'emptyfolders'
  | 'analyzer'
  | 'trash'
  | 'tags'
  | 'shredder'
  | 'usage'
  | 'device'
  | 'report'
  | 'history'
  | 'settings'

export interface PageMeta {
  /** مفاتيح ترجمة، لا نصوص جاهزة */
  title: string
  sub: string
  icon: IconName
  tone: string
}

export const PAGE_META: Record<PageId, PageMeta> = {
  home: { title: 'home.title', sub: 'page.overview.sub', icon: 'home', tone: 'tone-yellow' },
  cleaner: { title: 'clean.title', sub: 'clean.sub', icon: 'sparkles', tone: 'tone-yellow' },
  files: { title: 'page.files', sub: 'page.files.sub', icon: 'folder', tone: 'tone-blue' },
  apps: { title: 'page.apps', sub: 'page.apps.sub', icon: 'grid', tone: 'tone-orange' },
  more: { title: 'page.more', sub: 'page.more.sub', icon: 'layers', tone: 'tone-ink' },
  overview: { title: 'page.overview', sub: 'page.overview.sub', icon: 'trendUp', tone: 'tone-orange' },
  plan: { title: 'plan.title', sub: 'plan.sub', icon: 'checkCircle', tone: 'tone-green' },
  social: { title: 'page.social', sub: 'page.social.sub', icon: 'message', tone: 'tone-green' },
  screenshots: { title: 'page.screenshots', sub: 'page.screenshots.sub', icon: 'image', tone: 'tone-violet' },
  booster: { title: 'page.booster', sub: 'page.booster.sub', icon: 'zap', tone: 'tone-yellow' },
  duplicates: { title: 'page.duplicates', sub: 'page.duplicates.sub', icon: 'copy', tone: 'tone-pink' },
  largefiles: { title: 'page.largefiles', sub: 'page.largefiles.sub', icon: 'package', tone: 'tone-orange' },
  downloads: { title: 'page.downloads', sub: 'page.downloads.sub', icon: 'download', tone: 'tone-blue' },
  emptyfolders: { title: 'page.emptyfolders', sub: 'page.emptyfolders.sub', icon: 'folderSearch', tone: 'tone-yellow' },
  analyzer: { title: 'page.analyzer', sub: 'page.analyzer.sub', icon: 'activity', tone: 'tone-teal' },
  trash: { title: 'page.trash', sub: 'page.trash.sub', icon: 'trash', tone: 'tone-red' },
  tags: { title: 'page.tags', sub: 'page.tags.sub', icon: 'music', tone: 'tone-violet' },
  shredder: { title: 'page.shredder', sub: 'page.shredder.sub', icon: 'scissors', tone: 'tone-red' },
  usage: { title: 'page.usage', sub: 'page.usage.sub', icon: 'clock', tone: 'tone-teal' },
  device: { title: 'page.device', sub: 'page.device.sub', icon: 'monitor', tone: 'tone-green' },
  report: { title: 'page.report', sub: 'page.report.sub', icon: 'fileText', tone: 'tone-teal' },
  history: { title: 'page.history', sub: 'page.history.sub', icon: 'history', tone: 'tone-green' },
  settings: { title: 'page.settings', sub: 'page.settings.sub', icon: 'cog', tone: 'tone-ink' }
}

export const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'tab.home', icon: 'house' },
  { id: 'cleaner', label: 'tab.clean', icon: 'sparkles' },
  { id: 'files', label: 'tab.files', icon: 'folder' },
  { id: 'apps', label: 'tab.apps', icon: 'grid' },
  { id: 'more', label: 'tab.more', icon: 'dots' }
]

/** كل الأدوات القابلة للبحث والتثبيت في الرئيسية */
export const TOOL_PAGES: PageId[] = [
  'overview',
  'plan',
  'social',
  'screenshots',
  'booster',
  'analyzer',
  'duplicates',
  'largefiles',
  'downloads',
  'emptyfolders',
  'trash',
  'tags',
  'shredder',
  'usage',
  'device',
  'report',
  'history'
]
