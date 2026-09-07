import type { IconName } from '../components/Icon'

export type TabId = 'home' | 'cleaner' | 'files' | 'apps' | 'more'
export type PageId =
  | TabId
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
  | 'settings'
  | 'history'
  | 'social'
  | 'screenshots'
  | 'booster'

export const PAGE_META: Record<PageId, { title: string; sub: string; icon: IconName; tone?: string }> = {
  home: { title: 'CleanShelf', sub: 'صحة هاتفك بنظرة واحدة', icon: 'home' },
  cleaner: { title: 'التنظيف', sub: 'ملفات غير ضرورية تشغل مساحتك', icon: 'sparkles' },
  files: { title: 'الملفات', sub: 'تصفّح ونظّم ذاكرة الهاتف', icon: 'folder' },
  apps: { title: 'التطبيقات', sub: 'أحجام التطبيقات وإزالتها مع مخلّفاتها', icon: 'grid' },
  more: { title: 'الأدوات', sub: 'كل أدوات CleanShelf', icon: 'layers' },
  duplicates: { title: 'الملفات المكرّرة', sub: 'نسخ متطابقة تهدر المساحة', icon: 'copy', tone: 'tone-pink' },
  largefiles: { title: 'أكبر الملفات', sub: 'ما يستهلك مساحتك أكثر', icon: 'package', tone: 'tone-orange' },
  downloads: { title: 'التنزيلات القديمة', sub: 'ما نسيته في مجلد التنزيلات', icon: 'download', tone: 'tone-cyan' },
  emptyfolders: { title: 'المجلدات الفارغة', sub: 'مجلدات لا تحوي شيئًا', icon: 'folderSearch', tone: 'tone-amber' },
  analyzer: { title: 'محلّل المساحة', sub: 'أين تذهب مساحة هاتفك بالضبط', icon: 'activity', tone: 'tone-cyan' },
  trash: { title: 'سلة المهملات', sub: 'ما حذفته من CleanShelf ويمكن استرجاعه', icon: 'trash', tone: 'tone-red' },
  tags: { title: 'وسوم الأغاني', sub: 'العنوان والفنان والغلاف لملفات MP3', icon: 'music', tone: 'tone-violet' },
  shredder: { title: 'الممزّق الآمن', sub: 'حذف نهائي لا يمكن استرجاعه', icon: 'scissors', tone: 'tone-red' },
  usage: { title: 'استخدام التطبيقات', sub: 'أكثر التطبيقات استهلاكًا لوقتك', icon: 'clock', tone: 'tone-teal' },
  device: { title: 'معلومات الجهاز', sub: 'الذاكرة والتخزين والبطارية', icon: 'monitor', tone: 'tone-green' },
  report: { title: 'تقرير الجهاز', sub: 'لقطة كاملة قابلة للمشاركة', icon: 'fileText', tone: 'tone-teal' },
  settings: { title: 'الإعدادات', sub: 'المظهر والسلوك', icon: 'cog' },
  history: { title: 'سجل التنظيف', sub: 'كم مساحة تحرّرت سابقًا', icon: 'history', tone: 'tone-green' },
  social: { title: 'واتساب وتيليجرام', sub: 'وسائط الدردشات التي تلتهم مساحتك', icon: 'message', tone: 'tone-green' },
  screenshots: { title: 'لقطات الشاشة', sub: 'لقطات قديمة نسيتها في المعرض', icon: 'image', tone: 'tone-violet' },
  booster: { title: 'مسرّع الذاكرة', sub: 'أغلق ما يعمل في الخلفية بضغطة', icon: 'zap', tone: 'tone-amber' }
}

export const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'الرئيسية', icon: 'home' },
  { id: 'cleaner', label: 'التنظيف', icon: 'sparkles' },
  { id: 'files', label: 'الملفات', icon: 'folder' },
  { id: 'apps', label: 'التطبيقات', icon: 'grid' },
  { id: 'more', label: 'المزيد', icon: 'layers' }
]

export const TOOL_PAGES: PageId[] = ['social', 'screenshots', 'booster', 'analyzer', 'duplicates', 'largefiles', 'downloads', 'emptyfolders', 'trash', 'tags', 'shredder', 'usage', 'device', 'report', 'history']
