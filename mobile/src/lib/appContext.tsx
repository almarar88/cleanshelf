import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Native } from './native'
import type { AppSettings, PermissionState } from './types'
import { loadSettings, saveSettings } from './settings'
import { applyAccent, applyTheme } from './theme'
import { useI18n } from './i18n'
import { loadFavorites, saveFavorites } from './favorites'
import type { PageId, TabId } from './nav'

interface AppContextValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  permissions: PermissionState
  refreshPermissions: () => Promise<void>
  navigate: (page: PageId) => void
  back: () => boolean
  tab: TabId
  stack: PageId[]
  favorites: PageId[]
  toggleFavorite: (page: PageId) => void
}

const AppContext = createContext<AppContextValue | null>(null)
const TAB_IDS: TabId[] = ['home', 'cleaner', 'files', 'apps', 'more']

export function AppProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { lang, setLang } = useI18n()
  const [settings, setSettings] = useState<AppSettings>(() => ({ ...loadSettings(), lang }))
  const [permissions, setPermissions] = useState<PermissionState>({ allFiles: false, usageStats: false, notifications: false })
  const [tab, setTab] = useState<TabId>('home')
  const [stack, setStack] = useState<PageId[]>([])
  const [favorites, setFavorites] = useState<PageId[]>(loadFavorites)

  useEffect(() => {
    applyTheme(settings.theme)
    applyAccent(settings.accentHue)
    saveSettings(settings)
    if (settings.lang !== lang) setLang(settings.lang)
  }, [settings, lang, setLang])

  const refreshPermissions = useCallback(async () => {
    try {
      setPermissions(await Native.permissions())
    } catch {
      // في المتصفح أو قبل تحميل الإضافة
    }
  }, [])

  useEffect(() => {
    refreshPermissions()
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') refreshPermissions()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshPermissions])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const navigate = useCallback((page: PageId) => {
    if ((TAB_IDS as string[]).includes(page)) {
      setTab(page as TabId)
      setStack([])
    } else {
      setStack((prev) => (prev[prev.length - 1] === page ? prev : [...prev, page]))
    }
    document.querySelector('.page')?.scrollTo({ top: 0 })
  }, [])

  const back = useCallback((): boolean => {
    let handled = false
    setStack((prev) => {
      if (prev.length === 0) return prev
      handled = true
      return prev.slice(0, -1)
    })
    return handled
  }, [])

  const toggleFavorite = useCallback((page: PageId) => {
    setFavorites((prev) => {
      const next = prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page].slice(-6)
      saveFavorites(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ settings, updateSettings, permissions, refreshPermissions, navigate, back, tab, stack, favorites, toggleFavorite }),
    [settings, updateSettings, permissions, refreshPermissions, navigate, back, tab, stack, favorites, toggleFavorite]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp خارج AppProvider')
  return ctx
}
