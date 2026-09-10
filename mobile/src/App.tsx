import { useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { I18nProvider, t, useI18n } from './lib/i18n'
import { AppProvider, useApp } from './lib/appContext'
import { ToastProvider } from './lib/toastContext'
import { Native } from './lib/native'
import { PAGE_META, TABS, type PageId } from './lib/nav'
import { tap } from './lib/haptics'
import { Icon } from './components/Icon'
import { Home } from './pages/Home'
import { Overview } from './pages/Overview'
import { Plan } from './pages/Plan'
import { Cleaner } from './pages/Cleaner'
import { Files } from './pages/Files'
import { Apps } from './pages/Apps'
import { More } from './pages/More'
import { Settings } from './pages/Settings'
import { Duplicates, LargeFiles, OldDownloads, EmptyFolders } from './pages/tools/scanTools'
import { Analyzer } from './pages/tools/Analyzer'
import { Trash } from './pages/tools/Trash'
import { Shredder } from './pages/tools/Shredder'
import { TagEditor } from './pages/tools/TagEditor'
import { Usage, Device, Report, History } from './pages/tools/InfoPages'
import { Social } from './pages/tools/Social'
import { Screenshots } from './pages/tools/Screenshots'
import { Booster } from './pages/tools/Booster'

function renderPage(page: PageId): JSX.Element {
  switch (page) {
    case 'home': return <Home />
    case 'overview': return <Overview />
    case 'plan': return <Plan />
    case 'cleaner': return <Cleaner />
    case 'files': return <Files />
    case 'apps': return <Apps />
    case 'more': return <More />
    case 'settings': return <Settings />
    case 'duplicates': return <Duplicates />
    case 'largefiles': return <LargeFiles />
    case 'downloads': return <OldDownloads />
    case 'emptyfolders': return <EmptyFolders />
    case 'analyzer': return <Analyzer />
    case 'trash': return <Trash />
    case 'shredder': return <Shredder />
    case 'tags': return <TagEditor />
    case 'usage': return <Usage />
    case 'device': return <Device />
    case 'report': return <Report />
    case 'history': return <History />
    case 'social': return <Social />
    case 'screenshots': return <Screenshots />
    case 'booster': return <Booster />
  }
}

function Shell(): JSX.Element {
  const { tab, stack, navigate, back, settings } = useApp()
  const { lang } = useI18n()
  const page: PageId = stack[stack.length - 1] ?? tab
  const inTool = stack.length > 0

  // زر الرجوع في أندرويد
  useEffect(() => {
    const handle = CapApp.addListener('backButton', () => {
      if (back()) return
      if (tab !== 'home') {
        navigate('home')
        return
      }
      CapApp.minimizeApp()
    })
    return () => {
      handle.then((h) => h.remove())
    }
  }, [back, navigate, tab])

  // شريط الحالة يتبع السمة
  useEffect(() => {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined)
    StatusBar.setBackgroundColor({ color: dark ? '#131210' : '#faf7f0' }).catch(() => undefined)
  }, [settings.theme])

  useEffect(() => {
    Native.purgeOldTrash({ days: settings.trashRetentionDays }).catch(() => undefined)
    Native.deviceInfo()
      .then((d) => Native.log({ message: `CLEANSHELF_SMOKE_OK model=${d.model} sdk=${d.sdkInt} version=${d.appVersion}` }))
      .catch((err) => console.log('CLEANSHELF_SMOKE_FAIL ' + (err as Error).message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const meta = PAGE_META[page]

  return (
    <div className="shell" key={lang}>
      {inTool && (
        <header className="topbar">
          <button className="round-btn" onClick={back} aria-label={t('common.back')}>
            <Icon name="chevron" size={20} className="flip" />
          </button>
          <h1>{t(meta.title)}</h1>
          <button className="round-btn" onClick={() => navigate('settings')} aria-label={t('common.settings')}>
            <Icon name="dots" size={20} />
          </button>
        </header>
      )}
      <div key={page} style={{ display: 'contents' }}>{renderPage(page)}</div>
      {!inTool && (
        <nav className="tabbar">
          {TABS.map((tb) => (
            <button key={tb.id} className={`tab ${tab === tb.id ? 'active' : ''}`} onClick={() => { tap(); navigate(tb.id) }}>
              <span className="pillbox"><Icon name={tb.icon} size={20} strokeWidth={tab === tb.id ? 2.2 : 1.8} /></span>
              {t(tb.label)}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

export function App(): JSX.Element {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
