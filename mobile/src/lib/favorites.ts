import type { PageId } from './nav'

const KEY = 'cleanshelf.favorites'

export function loadFavorites(): PageId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as PageId[]) : []
  } catch {
    return []
  }
}

export function saveFavorites(list: PageId[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // تجاهل
  }
}
