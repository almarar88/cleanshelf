import type { PageId } from './pages'

const KEY = 'cleanshelf.pinned'
const MAX = 6

export function loadPinned(): PageId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as PageId[]
    return Array.isArray(raw) ? raw.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function savePinned(pages: PageId[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pages.slice(0, MAX)))
  } catch {
    // تجاهل
  }
}

export function togglePinned(pages: PageId[], page: PageId): PageId[] {
  const next = pages.includes(page) ? pages.filter((p) => p !== page) : [...pages, page].slice(-MAX)
  savePinned(next)
  return next
}
