import { useMemo, useState } from 'react'
import { useApp } from '../lib/appContext'
import { t } from '../lib/i18n'
import { PAGE_META, TOOL_PAGES, type PageId } from '../lib/nav'
import { tap } from '../lib/haptics'
import { Icon } from '../components/Icon'
import { EmptyState, Ico } from '../components/ui'

export function More(): JSX.Element {
  const { navigate, favorites, toggleFavorite } = useApp()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TOOL_PAGES
    return TOOL_PAGES.filter((id) => {
      const m = PAGE_META[id]
      return `${t(m.title)} ${t(m.sub)}`.toLowerCase().includes(q)
    })
  }, [query])

  const pinned = favorites.filter((id) => results.includes(id))
  const rest = results.filter((id) => !pinned.includes(id))

  return (
    <div className="page">
      <h1 className="display sm">{t('page.more')}</h1>

      <div className="field-row">
        <Icon name="search" size={18} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('more.searchTools')} />
        {query && (
          <button className="round-btn plain" style={{ width: 28, height: 28 }} onClick={() => setQuery('')} aria-label={t('common.clearAll')}>
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div style={{ marginTop: 24 }}><EmptyState icon="search" tone="tone-ink" text={t('more.noResults')} /></div>
      ) : (
        <>
          {pinned.length > 0 && (
            <>
              <div className="section-title">{t('more.pinned')}</div>
              <div className="items-grid">
                {pinned.map((id, i) => <Tile key={id} id={id} index={i} onOpen={() => navigate(id)} fav onFav={() => toggleFavorite(id)} />)}
              </div>
            </>
          )}
          {rest.length > 0 && (
            <>
              {pinned.length > 0 && <div className="section-title">{t('home.tools')}</div>}
              <div className="items-grid">
                {rest.map((id, i) => <Tile key={id} id={id} index={i} onOpen={() => navigate(id)} fav={false} onFav={() => toggleFavorite(id)} />)}
              </div>
            </>
          )}
        </>
      )}

      <div className="section-title">{t('more.app')}</div>
      <div className="card">
        <div className="row" onClick={() => { tap(); navigate('settings') }}>
          <Ico name="cog" tone="tone-ink" size="sm" />
          <div className="text">
            <div className="title">{t('page.settings')}</div>
            <div className="desc">{t('page.settings.sub')}</div>
          </div>
          <Icon name="chevron" size={16} className="muted flip-rtl" />
        </div>
      </div>
    </div>
  )
}

function Tile({ id, index, onOpen, fav, onFav }: { id: PageId; index: number; onOpen: () => void; fav: boolean; onFav: () => void }): JSX.Element {
  const m = PAGE_META[id]
  return (
    <div className="item-card" style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }} onClick={() => { tap(); onOpen() }}>
      <div className="top">
        <Ico name={m.icon} tone={m.tone} size="sm" />
        <button
          className={`star ${fav ? 'on' : ''}`}
          style={{ marginInlineStart: 'auto' }}
          onClick={(e) => { e.stopPropagation(); tap(); onFav() }}
          aria-label={t(m.title)}
        >
          <Icon name="star" size={17} strokeWidth={fav ? 2.4 : 1.8} />
        </button>
      </div>
      <div className="name" style={{ marginTop: 4 }}>{t(m.title)}</div>
      <div className="card-sub" style={{ whiteSpace: 'normal' }}>{t(m.sub)}</div>
    </div>
  )
}
