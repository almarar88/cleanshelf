import { t } from './i18n'

/** كل الفئات التي يعرفها المنظّف — الأسماء تأتي من القاموس حسب اللغة. */
const CATEGORY_KEYS = [
  'cleaner.userTemp',
  'cleaner.windowsTemp',
  'cleaner.prefetch',
  'cleaner.windowsUpdate',
  'cleaner.thumbnails',
  'cleaner.errorReports',
  'cleaner.recentList',
  'cleaner.chromeCache',
  'cleaner.edgeCache',
  'cleaner.firefoxCache',
  'cleaner.deliveryOptimization',
  'cleaner.minidumps',
  'cleaner.recycleBin',
  'cleaner.mac.userCaches',
  'cleaner.mac.systemCaches',
  'cleaner.mac.userLogs',
  'cleaner.mac.trash',
  'cleaner.mac.xcodeDerived',
  'cleaner.mac.xcodeDeviceSupport',
  'cleaner.mac.xcodeArchives',
  'cleaner.mac.homebrew',
  'cleaner.mac.packageManagers',
  'cleaner.mac.safariCache',
  'cleaner.mac.mailDownloads',
  'cleaner.mac.iosBackups',
  'cleaner.mac.crashReports',
  'cleaner.mac.quicklook',
  'cleaner.mac.savedState'
]

export function categoryLabel(key: string): { title: string; desc: string } {
  if (!CATEGORY_KEYS.includes(key)) return { title: key, desc: '' }
  return { title: t(`${key}.t`), desc: t(`${key}.d`) }
}

/**
 * معرّف الفئة كما يُخزَّن في سجل التنظيف → مفتاح الاسم المعروض.
 * صريح لا مشتق بتحويل الأحرف، لأن بعض المعرّفات لا تطابق مفاتيحها
 * (windows_update_cache مقابل windowsUpdate مثلاً).
 */
const CATEGORY_ID_TO_LABEL_KEY: Record<string, string> = {
  user_temp: 'cleaner.userTemp',
  windows_temp: 'cleaner.windowsTemp',
  prefetch: 'cleaner.prefetch',
  windows_update_cache: 'cleaner.windowsUpdate',
  thumbnail_cache: 'cleaner.thumbnails',
  windows_error_reports: 'cleaner.errorReports',
  recent_list: 'cleaner.recentList',
  chrome_cache: 'cleaner.chromeCache',
  edge_cache: 'cleaner.edgeCache',
  firefox_cache: 'cleaner.firefoxCache',
  delivery_optimization: 'cleaner.deliveryOptimization',
  minidumps: 'cleaner.minidumps',
  recycle_bin: 'cleaner.recycleBin'
}

export function categoryTitleById(categoryId: string): string {
  const key = CATEGORY_ID_TO_LABEL_KEY[categoryId]
  return key ? categoryLabel(key).title : categoryId
}
