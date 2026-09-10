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
import { Overview } from './pages/Overview'
import { Plan } from './pages/Plan'
import { PAGE_META, type PageId as Page } from './lib/pages'
import { loadPinned, togglePinned } from './lib/pinned'
import { ToastProvider, useToast } from './lib/toastContext'
import { applyAccent, applyTheme, loadAccent, loadTheme, nextTheme, THEME_ICON, THEME_LABEL, type ThemeMode } from './lib/theme'

export type { PageId } from './lib/pages'


function AppInner(): JSX.Element {
  const { showToast } = useToast()
  const [page, setPage] = useState<Page>('dashboard')
  const [theme, setTheme] = useState<ThemeMode>(loadTheme)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [command, setCommand] = useState<string | null>(null)
  const [isMac, setIsMac] = useState(false)
  const [pinned, setPinned] = useState<Page[]>(loadPinned)
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
      })
      .catch(() => setSettings(null))
    window.api.platform.info().then((p) => setIsMac(p.isMac)).catch(() => setIsMac(false))
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
        showToast('تعذّر حفظ الإعداد: ' + (err as Error).message)
      }
    },
    [showToast]
  )

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
      label: n.label,
      group: 'الصفحات',
      icon: n.icon,
      keywords: n.keywords,
      hint: PAGE_META[n.id].sub,
      action: () => setPage(n.id)
    }))
    const actions: PaletteItem[] = [
      {
        id: 'act:smartClean',
        label: 'تنظيف ذكي الآن',
        group: 'إجراءات',
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
        label: `تبديل المظهر (الحالي: ${THEME_LABEL[theme]})`,
        group: 'إجراءات',
        icon: THEME_ICON[theme],
        tone: 'tone-amber',
        keywords: 'theme dark light مظهر داكن فاتح',
        hint: isMac ? '⌘⇧L' : 'Ctrl+Shift+L',
        action: cycleTheme
      },
      {
        id: 'act:report',
        label: 'إنشاء تقرير عن الجهاز',
        group: 'إجراءات',
        icon: 'fileText',
        tone: 'tone-teal',
        keywords: 'report export',
        action: () => setPage('report')
      }
    ]
    return [...actions, ...pages]
  }, [isMac, theme, cycleTheme])

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
        return <Settings settings={settings} onChange={updateSettings} />
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active={page} onNavigate={setPage} pinned={pinned} onTogglePin={onTogglePin} />
      <div className="main-area">
        <div className="topbar">
          <div>
            <h1>{meta.title}</h1>
            <div className="sub">{meta.sub}</div>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setPaletteOpen(true)} title="ابحث عن صفحة أو إجراء">
              <Icon name="search" size={15} />
              <span>بحث سريع…</span>
              <span className="kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
            </button>
            <button className="btn btn-icon" onClick={cycleTheme} title={`المظهر: ${THEME_LABEL[theme]} — اضغط للتبديل`}>
              <Icon name={THEME_ICON[theme]} size={17} />
            </button>
            <button className={`btn btn-icon ${page === 'settings' ? 'btn-primary' : ''}`} onClick={() => setPage('settings')} title="الإعدادات">
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

export function App(): JSX.Element {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
