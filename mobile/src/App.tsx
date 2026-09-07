import { useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import { AppProvider, useApp } from './lib/appContext'
import { ToastProvider } from './lib/toastContext'
import { Native } from './lib/native'
import { PAGE_META, TABS, type PageId } from './lib/nav'
import { Icon } from './components/Icon'
import { Home } from './pages/Home'
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

function renderPage(page: PageId): JSX.Element {
  switch (page) {
    case 'home': return <Home />
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
  }
}

function Shell(): JSX.Element {
  const { tab, stack, navigate, back, settings } = useApp()
  const page: PageId = stack[stack.length - 1] ?? tab
  const meta = PAGE_META[page]
  const inTool = stack.length > 0

  // زر الرجوع في أندرويد: يغلق الصفحة الفرعية، أو يعود للرئيسية، أو يصغّر التطبيق
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

  // تنظيف سلة المهملات القديمة عند الفتح، وإبلاغ فحص التشغيل الآلي أن الواجهة والجسر يعملان
  useEffect(() => {
    Native.purgeOldTrash({ days: settings.trashRetentionDays }).catch(() => undefined)
    Native.deviceInfo()
      .then((d) => console.log(`CLEANSHELF_SMOKE_OK model=${d.model} sdk=${d.sdkInt} version=${d.appVersion}`))
      .catch((err) => console.log('CLEANSHELF_SMOKE_FAIL ' + (err as Error).message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="shell">
      <header className="topbar">
        {inTool ? (
          <button className="icon-btn" onClick={back} aria-label="رجوع"><Icon name="chevron" size={22} /></button>
        ) : (
          <div className="brand-badge"><Icon name="logo" size={18} strokeWidth={2} /></div>
        )}
        <div className="titles">
          <h1>{meta.title}</h1>
          <div className="sub">{meta.sub}</div>
        </div>
        {!inTool && page !== 'more' && <button className="icon-btn" onClick={() => navigate('settings')} aria-label="الإعدادات"><Icon name="cog" size={20} /></button>}
      </header>
      <div key={page} style={{ display: 'contents' }}>{renderPage(page)}</div>
      {!inTool && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => navigate(t.id)}>
              <span className="pill"><Icon name={t.icon} size={20} strokeWidth={tab === t.id ? 2.2 : 1.8} /></span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

export function App(): JSX.Element {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  )
}
