export interface CategoryDef {
  id: string
  labelKey: string
  risk: 'safe' | 'caution'
  /** يحتاج صلاحيات مرتفعة للحذف الفعلي (مسارات يملكها النظام) */
  requiresAdmin: boolean
  /** يعيد المجلدات المرشّحة لهذه الفئة (بعضها قد لا يكون موجودًا فعليًا). */
  resolvePaths: () => Promise<string[]>
  /** حساب الحجم بطريقة خاصة (سلة المحذوفات على ويندوز مثلاً)، اختياري. */
  customScan?: () => Promise<{ sizeBytes: number; fileCount: number }>
  /** تنظيف بطريقة خاصة، اختياري. */
  customClean?: () => Promise<number>
}
