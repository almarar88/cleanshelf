import type { IconName } from '../components/Icon'

export const JUNK_LABELS: Record<string, { title: string; desc: string; icon: IconName }> = {
  temp_files: { title: 'ملفات مؤقتة', desc: 'ملفات .tmp و .part و .bak تركتها التطبيقات والتنزيلات المقطوعة', icon: 'file' },
  log_files: { title: 'ملفات السجلات', desc: 'سجلات .log تشخيصية لا يحتاجها أحد', icon: 'fileText' },
  thumbnails: { title: 'الصور المصغّرة', desc: 'مجلدات .thumbnails يعيد النظام بناءها', icon: 'image' },
  empty_folders: { title: 'مجلدات فارغة', desc: 'مجلدات لا تحوي أي ملف', icon: 'folder' },
  own_cache: { title: 'ذاكرة CleanShelf المؤقتة', desc: 'ملفات هذا التطبيق المؤقتة', icon: 'sparkles' },
  apk_files: { title: 'ملفات تثبيت APK', desc: 'حزم تثبيت منزَّلة — احذفها إن ثبّت التطبيقات بالفعل', icon: 'package' },
  cache_folders: { title: 'مجلدات ذاكرة مؤقتة', desc: 'مجلدات باسم cache خارج مجلد Android تُعاد بناؤها عادةً', icon: 'layers' },
  residual_folders: { title: 'مخلّفات تطبيقات محذوفة', desc: 'مجلدات في الذاكرة لا تطابق أي تطبيق مثبَّت — راجعها قبل الحذف', icon: 'trash' }
}

export function junkLabel(id: string): { title: string; desc: string; icon: IconName } {
  return JUNK_LABELS[id] ?? { title: id, desc: '', icon: 'file' }
}
