import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppSettings } from '../shared/types'
import { Sidebar, MAIN_ITEMS, DISK_ITEMS, PRIVACY_ITEMS, SYSTEM_ITEMS, MAC_ITEM, SETTINGS_ITEM } from './components/Sidebar'
import { CommandPalette, type PaletteItem } from './components/CommandPalette'
import { Icon } from './components/Icon'
import { Dashboard } from './pages/Dashboard'
import { Cleaner } from './pages/Cleaner'
import { Uninstaller } from './pages/Uninstaller'
import { FileManager } from './pages/FileManager'
import { TagEditor } from './pages/TagEditor'
import { Duplicates } from './pages/Duplicates'
import { LargeFiles } from './pages/LargeFiles'
import { Startup } from './pages/Startup'
import { SystemInfo } from './pages/SystemInfo'
import { Processes } from './pages/Processes'
import { Services } from './pages/Services'
import { Network } from './pages/Network'
import { DiskAnalyzer } from './pages/DiskAnalyzer'
import { CleanupExtras } from './pages/CleanupExtras'
import { History } from './pages/History'
import { MacTools } from './pages/MacTools'
import { Privacy } from './pages/Privacy'
import { Shredder } from './pages/Shredder'
import { OldDownloads } from './pages/OldDownloads'
import { Report } from './pages/Report'
import { Settings } from './pages/Settings'
import { Assistant } from './pages/Assistant'
import { Overview } from './pages/Overview'
import { Plan } from './pages/Plan'
import { PAGE_META, pageSub, pageTitle, type PageId as Page } from './lib/pages'
import { I18nProvider, t, useI18n, type Lang } from './lib/i18n'
import { loadPinned, togglePinned } from './lib/pinned'
import { ToastProvider, useToast } from './lib/toastContext'
import { applyAccent, applyTheme, loadAccent, loadTheme, nextTheme, THEME_ICON, THEME_LABEL, type ThemeMode } from './lib/theme'

export type { PageId } from './lib/pages'


function AppInner(): JSX.Element {
  const { showToast } = useToast()
  const { lang, setLang } = useI18n()
  const [page, setPage] = useState<Page>('dashboard')
  const [theme, setTheme] = useState<ThemeMode>(loadTheme)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [command, setCommand] = useState<string | null>(null)
  const [isMac, setIsMac] = useState(false)
  const [pinned, setPinned] = useState<Page[]>(loadPinned)
  const [hasAiKey, setHasAiKey] = useState(false)
  const meta = PAGE_META[page]

  const onTogglePin = useCallback((id: Page) => {
    setPinned((prev) => togglePinned(prev, id))
  }, [])

  // الإعدادات المحفوظة هي المرجع؛ التخزين المحلي مجرد قيمة أولية تمنع وميض السمة
  useEffect(() => {
    applyAccent(loadAccent())
    window.api.settings
      .get()
      .then((s) => {
        setSettings(s)
        setTheme(s.theme)
        applyAccent(s.accentHue)
        if (s.lang && s.lang !== lang) setLang(s.lang)
      })
      .catch(() => setSettings(null))
    window.api.platform.info().then((p) => setIsMac(p.isMac)).catch(() => setIsMac(false))
    window.api.ai.status().then((s) => setHasAiKey(s.hasKey)).catch(() => setHasAiKey(false))
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      try {
        const next = await window.api.settings.set(patch)
        setSettings(next)
        if (patch.theme) setTheme(next.theme)
        if (patch.accentHue !== undefined) applyAccent(next.accentHue)
      } catch (err) {
        showToast(t('set.saveFailed', { msg: (err as Error).message }))
      }
    },
    [showToast]
  )

  const toggleLang = useCallback(() => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    updateSettings({ lang: next })
  }, [lang, setLang, updateSettings])

  const cycleTheme = useCallback(() => {
    const next = nextTheme(theme)
    setTheme(next)
    updateSettings({ theme: next })
  }, [theme, updateSettings])

  // أوامر من العملية الرئيسية (شريط النظام)
  useEffect(
    () =>
      window.api.app.onCommand((cmd) => {
        if (cmd === 'smartClean') {
          setPage('dashboard')
          setCommand('smartClean')
        }
      }),
    []
  )

  // اختصارات لوحة المفاتيح
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (mod && e.key === ',') {
        e.preventDefault()
        setPage('settings')
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        cycleTheme()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleTheme])

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const nav = [...MAIN_ITEMS, ...DISK_ITEMS, ...PRIVACY_ITEMS, ...(isMac ? [MAC_ITEM] : []), ...SYSTEM_ITEMS, SETTINGS_ITEM]
    const pages: PaletteItem[] = nav.map((n) => ({
      id: `page:${n.id}`,
      label: pageTitle(n.id),
      group: t('palette.pages'),
      icon: n.icon,
      keywords: n.keywords,
      hint: pageSub(n.id),
      action: () => setPage(n.id)
    }))
    const actions: PaletteItem[] = [
      {
        id: 'act:smartClean',
        label: t('palette.smartClean'),
        group: t('palette.actions'),
        icon: 'sparkles',
        tone: 'tone-green',
        keywords: 'smart clean quick',
        action: () => {
          setPage('dashboard')
          setCommand('smartClean')
        }
      },
      {
        id: 'act:theme',
        label: t('palette.theme', { mode: t(THEME_LABEL[theme]) }),
        group: t('palette.actions'),
        icon: THEME_ICON[theme],
        tone: 'tone-amber',
        keywords: 'theme dark light مظهر داكن فاتح',
        hint: isMac ? '⌘⇧L' : 'Ctrl+Shift+L',
        action: cycleTheme
      },
      {
        id: 'act:lang',
        label: t('palette.lang', { lang: lang === 'ar' ? t('set.arabic') : t('set.english') }),
        group: t('palette.actions'),
        icon: 'globe',
        tone: 'tone-blue',
        keywords: 'language lang arabic english لغة عربي إنجليزي',
        action: toggleLang
      },
      {
        id: 'act:report',
        label: t('palette.report'),
        group: t('palette.actions'),
        icon: 'fileText',
        tone: 'tone-teal',
        keywords: 'report export',
        action: () => setPage('report')
      },
      {
        id: 'act:ask',
        label: t('palette.ask'),
        group: t('palette.actions'),
        icon: 'brain',
        tone: 'tone-violet',
        keywords: 'ai assistant ask claude ذكاء مساعد اسأل',
        action: () => setPage('assistant')
      },
      {
        id: 'act:ai',
        label: t(settings?.aiEnabled ? 'palette.aiOff' : 'palette.aiOn'),
        group: t('palette.actions'),
        icon: 'brain',
        tone: 'tone-violet',
        keywords: 'ai enable disable تفعيل تعطيل ذكاء',
        action: () => updateSettings({ aiEnabled: !settings?.aiEnabled })
      }
    ]
    return [...actions, ...pages]
  }, [isMac, theme, cycleTheme, lang, toggleLang, settings?.aiEnabled, updateSettings])

  const onCommandHandled = useCallback(() => setCommand(null), [])

  function renderPage(): JSX.Element {
    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={setPage}
            settings={settings}
            command={command}
            onCommandHandled={onCommandHandled}
            pinned={pinned}
            onTogglePin={onTogglePin}
          />
        )
      case 'assistant':
        return <Assistant settings={settings} hasKey={hasAiKey} onNavigate={setPage} />
      case 'overview':
        return <Overview onNavigate={setPage} />
      case 'plan':
        return <Plan onNavigate={setPage} isMac={isMac} />
      case 'cleaner':
        return <Cleaner />
      case 'uninstaller':
        return <Uninstaller />
      case 'files':
        return <FileManager />
      case 'tags':
        return <TagEditor />
      case 'duplicates':
        return <Duplicates />
      case 'largefiles':
        return <LargeFiles />
      case 'startup':
        return <Startup />
      case 'system':
        return <SystemInfo />
      case 'processes':
        return <Processes />
      case 'services':
        return <Services />
      case 'network':
        return <Network />
      case 'diskanalyzer':
        return <DiskAnalyzer />
      case 'extras':
        return <CleanupExtras />
      case 'history':
        return <History />
      case 'mactools':
        return <MacTools />
      case 'privacy':
        return <Privacy />
      case 'shredder':
        return <Shredder settings={settings} />
      case 'downloads':
        return <OldDownloads settings={settings} />
      case 'report':
        return <Report />
      case 'settings':
        return <Settings settings={settings} onChange={updateSettings} onKeyChange={setHasAiKey} />
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active={page} onNavigate={setPage} pinned={pinned} onTogglePin={onTogglePin} />
      <div className="main-area">
        <div className="topbar">
          <div>
            <h1>{t(meta.title)}</h1>
            <div className="sub">{t(meta.sub)}</div>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setPaletteOpen(true)} title={t('palette.placeholder')}>
              <Icon name="search" size={15} />
              <span>{t('common.searchQuick')}</span>
              <span className="kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
            </button>
            <button className="btn btn-icon" onClick={toggleLang} title={t('set.language')}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
            <button className="btn btn-icon" onClick={cycleTheme} title={t('theme.tip', { mode: t(THEME_LABEL[theme]) })}>
              <Icon name={THEME_ICON[theme]} size={17} />
            </button>
            <button className={`btn btn-icon ${page === 'settings' ? 'btn-primary' : ''}`} onClick={() => setPage('settings')} title={t('common.settings')}>
              <Icon name="cog" size={17} />
            </button>
          </div>
        </div>
        {/* المفتاح يعيد تشغيل حركة الدخول عند كل تنقّل */}
        <div key={page} style={{ display: 'contents' }}>
          {renderPage()}
        </div>
      </div>
      {paletteOpen && <CommandPalette items={paletteItems} onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}

function AppWithLang(): JSX.Element {
  const { lang } = useI18n()
  // المفتاح يعيد بناء الشجرة عند تبديل اللغة فتُقرأ كل النصوص من جديد
  return <AppInner key={lang} />
}

export function App(): JSX.Element {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppWithLang />
      </ToastProvider>
    </I18nProvider>
  )
}
