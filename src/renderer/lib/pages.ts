import type { IconName } from '../components/Icon'

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
  title: string
  sub: string
  icon: IconName
  tone: string
}

export const PAGE_META: Record<PageId, PageMeta> = {
  dashboard: { title: 'الرئيسية', sub: 'نظرة عامة على صحة جهازك وتنظيف بضغطة واحدة', icon: 'house', tone: 'tone-yellow' },
  overview: { title: 'نظرة عامة', sub: 'توقّع امتلاء القرص وأكبر فرص التنظيف', icon: 'trendUp', tone: 'tone-orange' },
  plan: { title: 'خطة الصيانة', sub: 'مهام دورية تحافظ على جهازك نظيفًا', icon: 'checkCircle', tone: 'tone-green' },
  cleaner: { title: 'منظّف القرص', sub: 'حرّر المساحة بحذف الملفات غير الضرورية', icon: 'sparkles', tone: 'tone-yellow' },
  uninstaller: { title: 'إزالة البرامج', sub: 'أزل البرامج المثبَّتة مع مخلّفاتها', icon: 'trash', tone: 'tone-red' },
  files: { title: 'مدير الملفات', sub: 'تصفّح وأعد تسمية ونظّم ملفاتك', icon: 'folder', tone: 'tone-blue' },
  tags: { title: 'محرر وسوم الأغاني', sub: 'حرّر معلومات وأغلفة ملفات MP3 كما في Mp3tag', icon: 'music', tone: 'tone-violet' },
  duplicates: { title: 'الملفات المكرّرة', sub: 'اعثر على النسخ المكرّرة واسترجع المساحة', icon: 'copy', tone: 'tone-pink' },
  largefiles: { title: 'أكبر الملفات', sub: 'حدّد أكبر الملفات المستهلكة للمساحة', icon: 'package', tone: 'tone-orange' },
  startup: { title: 'برامج بدء التشغيل', sub: 'تحكّم بما يعمل تلقائيًا عند إقلاع الجهاز', icon: 'rocket', tone: 'tone-teal' },
  system: { title: 'معلومات النظام', sub: 'حالة المعالج والذاكرة والأقراص', icon: 'monitor', tone: 'tone-green' },
  processes: { title: 'العمليات', sub: 'ما يعمل الآن على جهازك، وإنهاء ما تريد', icon: 'zap', tone: 'tone-yellow' },
  services: { title: 'خدمات النظام', sub: 'تشغيل وإيقاف خدمات النظام وlaunchd', icon: 'cog', tone: 'tone-ink' },
  network: { title: 'الشبكة', sub: 'المحوّلات والاتصالات النشطة وأدوات التشخيص', icon: 'globe', tone: 'tone-blue' },
  diskanalyzer: { title: 'محلّل المساحة', sub: 'اعرف أين تذهب مساحة قرصك بالضبط', icon: 'activity', tone: 'tone-teal' },
  extras: { title: 'مجلدات واختصارات', sub: 'المجلدات الفارغة والاختصارات المعطوبة', icon: 'link', tone: 'tone-green' },
  history: { title: 'سجل التنظيف', sub: 'ما نُظّف سابقًا وكم مساحة تحرّرت', icon: 'history', tone: 'tone-green' },
  mactools: { title: 'أدوات ماك', sub: 'مخلّفات التطبيقات المحذوفة وملفات اللغات', icon: 'apple', tone: 'tone-ink' },
  privacy: { title: 'خصوصية المتصفح', sub: 'امسح سجل التصفح والكوكيز والجلسات من كل المتصفحات', icon: 'eyeOff', tone: 'tone-violet' },
  shredder: { title: 'الممزّق الآمن', sub: 'احذف الملفات الحساسة بحيث يستحيل استرجاعها', icon: 'scissors', tone: 'tone-red' },
  downloads: { title: 'التنزيلات القديمة', sub: 'ما نسيته في مجلد التنزيلات منذ شهور', icon: 'download', tone: 'tone-blue' },
  report: { title: 'تقرير النظام', sub: 'لقطة كاملة عن جهازك قابلة للحفظ والمشاركة', icon: 'fileText', tone: 'tone-teal' },
  settings: { title: 'الإعدادات', sub: 'المظهر واللغة والسلوك وخيارات الأدوات', icon: 'cog', tone: 'tone-ink' }
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
