import { isWindows } from './platform'
import type { CategoryDef } from './cleanerTypes'
import { WINDOWS_CATEGORY_DEFS } from './cleanerCategories.win'
import { MAC_CATEGORY_DEFS } from './cleanerCategories.mac'

/**
 * فئات التنظيف الخاصة بالمنصة الحالية. تُختار مرة واحدة عند التحميل،
 * فبقية التطبيق لا تحتاج أن تعرف على أي نظام تعمل.
 */
export const CATEGORY_DEFS: CategoryDef[] = isWindows
  ? WINDOWS_CATEGORY_DEFS
  : MAC_CATEGORY_DEFS

export type { CategoryDef }
export { scanCategory, clearDirectoryContents } from './cleanerShared'
