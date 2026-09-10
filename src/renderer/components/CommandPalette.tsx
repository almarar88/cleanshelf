import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { t } from '../lib/i18n'

export interface PaletteItem {
  id: string
  label: string
  group: string
  icon: IconName
  tone?: string
  hint?: string
  keywords?: string
  action: () => void
}

/** مطابقة تقريبية: كل أحرف الاستعلام تظهر بالترتيب، والبادئة والكلمة الكاملة تُرفع الترتيب. */
function score(query: string, item: PaletteItem): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const text = `${item.label} ${item.keywords ?? ''} ${item.group}`.toLowerCase()
  if (text.includes(q)) return item.label.toLowerCase().startsWith(q) ? 100 : 60
  let i = 0
  for (const ch of text) {
    if (ch === q[i]) i += 1
    if (i === q.length) return 20
  }
  return 0
}

export function CommandPalette({
  items,
  onClose
}: {
  items: PaletteItem[]
  onClose: () => void
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    return items
      .map((item) => ({ item, s: score(query, item) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.item)
  }, [items, query])

  useEffect(() => setCursor(0), [query])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.palette-item.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  function run(item: PaletteItem): void {
    onClose()
    item.action()
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[cursor]) run(results[cursor])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // تجميع مع الحفاظ على ترتيب النتائج
  const groups: { name: string; items: PaletteItem[] }[] = []
  for (const item of results) {
    const g = groups.find((x) => x.name === item.group)
    if (g) g.items.push(item)
    else groups.push({ name: item.group, items: [item] })
  }
  let flatIndex = -1

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('palette.placeholder')}
            spellCheck={false}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="palette-empty">{t('palette.empty', { q: query })}</div>
          ) : (
            groups.map((g) => (
              <div key={g.name}>
                <div className="palette-group">{g.name}</div>
                {g.items.map((item) => {
                  flatIndex += 1
                  const idx = flatIndex
                  return (
                    <div
                      key={item.id}
                      className={`palette-item ${idx === cursor ? 'active' : ''}`}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => run(item)}
                    >
                      <div className={`tile-icon ${item.tone ?? ''}`}>
                        <Icon name={item.icon} size={16} />
                      </div>
                      <span>{item.label}</span>
                      {item.hint && <span className="hint">{item.hint}</span>}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette-footer">
          <span>
            <span className="kbd">↑↓</span> {t('palette.kMove')}
          </span>
          <span>
            <span className="kbd">↵</span> {t('palette.kOpen')}
          </span>
          <span>
            <span className="kbd">Esc</span> {t('palette.kClose')}
          </span>
        </div>
      </div>
    </div>
  )
}
