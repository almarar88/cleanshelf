import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AR } from './dict.ar'
import { EN } from './dict.en'

export type Lang = 'ar' | 'en'

const DICTS: Record<Lang, Record<string, string>> = { ar: AR, en: EN }

/**
 * اللغة الحالية على مستوى الوحدة لا داخل React، حتى تعمل t() في الدوال
 * المساعدة وملفات الصيغ التي تُستدعى خارج شجرة المكوّنات.
 */
let current: Lang = 'ar'

export function getLang(): Lang {
  return current
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = DICTS[current][key] ?? EN[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

const STORAGE_KEY = 'cleanshelf.lang'

export function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ar' || saved === 'en') return saved
  } catch {
    // التخزين المحلي قد يكون معطّلًا
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'ar'
}

function applyLangToDocument(lang: Lang): void {
  current = lang
  const root = document.documentElement
  root.lang = lang
  root.dir = lang === 'ar' ? 'rtl' : 'ltr'
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // تجاهل
  }
}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: typeof t
  dir: 'rtl' | 'ltr'
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [lang, setLangState] = useState<Lang>(loadLang)

  // نضبط اللغة قبل رسم الأبناء حتى تقرأ t() القيمة الصحيحة في نفس الدورة
  current = lang

  useEffect(() => {
    applyLangToDocument(lang)
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    applyLangToDocument(next)
    setLangState(next)
  }, [])

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr' }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n خارج I18nProvider')
  return ctx
}
