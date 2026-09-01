import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { BrowserDataItem, BrowserDataKind, BrowserClearResult } from '../../shared/types'
import { dirStats, pathExists } from './fsWalk'
import { isWindows, env } from './platform'

const home = os.homedir()

interface ChromiumBrowser {
  name: string
  userData: string
}

/** مجلدات بيانات المتصفحات المبنية على Chromium حسب المنصة */
function chromiumBrowsers(): ChromiumBrowser[] {
  if (isWindows) {
    const local = env('LOCALAPPDATA')
    const roaming = env('APPDATA')
    return [
      { name: 'Google Chrome', userData: path.join(local, 'Google', 'Chrome', 'User Data') },
      { name: 'Microsoft Edge', userData: path.join(local, 'Microsoft', 'Edge', 'User Data') },
      { name: 'Brave', userData: path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data') },
      { name: 'Vivaldi', userData: path.join(local, 'Vivaldi', 'User Data') },
      { name: 'Opera', userData: path.join(roaming, 'Opera Software', 'Opera Stable') }
    ]
  }
  const support = path.join(home, 'Library', 'Application Support')
  return [
    { name: 'Google Chrome', userData: path.join(support, 'Google', 'Chrome') },
    { name: 'Microsoft Edge', userData: path.join(support, 'Microsoft Edge') },
    { name: 'Brave', userData: path.join(support, 'BraveSoftware', 'Brave-Browser') },
    { name: 'Vivaldi', userData: path.join(support, 'Vivaldi') },
    { name: 'Arc', userData: path.join(support, 'Arc', 'User Data') }
  ]
}

function firefoxProfilesRoot(): string {
  return isWindows
    ? path.join(env('APPDATA'), 'Mozilla', 'Firefox', 'Profiles')
    : path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles')
}

/**
 * ما يُحذف لكل نوع داخل ملف تعريف Chromium. المفضّلة (Bookmarks) وكلمات المرور
 * (Login Data) ليست هنا عمدًا — لا يُحذف شيء لا يُعاد بناؤه تلقائيًا إلا بعلم المستخدم.
 */
const CHROMIUM_KINDS: Record<BrowserDataKind, { files: string[]; risk: 'safe' | 'caution' }> = {
  history: {
    files: ['History', 'History-journal', 'Visited Links', 'Top Sites', 'Top Sites-journal', 'Favicons', 'Favicons-journal'],
    risk: 'safe'
  },
  cookies: {
    files: ['Cookies', 'Cookies-journal', path.join('Network', 'Cookies'), path.join('Network', 'Cookies-journal')],
    risk: 'caution'
  },
  sessions: { files: ['Sessions', 'Session Storage', 'Current Session', 'Last Session', 'Current Tabs', 'Last Tabs'], risk: 'caution' },
  formdata: { files: ['Web Data', 'Web Data-journal'], risk: 'caution' }
}

/** فايرفوكس: places.sqlite يحوي المفضّلة مع السجل، فلا نعرض حذف السجل هنا. */
const FIREFOX_KINDS: Partial<Record<BrowserDataKind, { files: string[]; risk: 'safe' | 'caution' }>> = {
  cookies: { files: ['cookies.sqlite', 'cookies.sqlite-wal', 'cookies.sqlite-shm'], risk: 'caution' },
  sessions: { files: ['sessionstore-backups', 'sessionstore.jsonlz4'], risk: 'caution' },
  formdata: { files: ['formhistory.sqlite'], risk: 'caution' }
}

async function sizeOf(target: string): Promise<number> {
  try {
    const stat = await fs.lstat(target)
    if (stat.isDirectory()) return (await dirStats(target, 50_000)).sizeBytes
    return stat.size
  } catch {
    return 0
  }
}

async function buildItem(
  browser: string,
  profile: string,
  kind: BrowserDataKind,
  base: string,
  files: string[],
  risk: 'safe' | 'caution'
): Promise<BrowserDataItem | null> {
  const paths: string[] = []
  let sizeBytes = 0
  for (const rel of files) {
    const full = path.join(base, rel)
    if (!(await pathExists(full))) continue
    paths.push(full)
    sizeBytes += await sizeOf(full)
  }
  if (paths.length === 0) return null
  return { id: `${browser}|${profile}|${kind}`, browser, profile, kind, paths, sizeBytes, risk }
}

async function chromiumProfiles(userData: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(userData, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && (e.name === 'Default' || /^Profile \d+$/.test(e.name)))
      .map((e) => e.name)
  } catch {
    return []
  }
}

export async function scanBrowserData(): Promise<BrowserDataItem[]> {
  const items: BrowserDataItem[] = []

  for (const browser of chromiumBrowsers()) {
    if (!(await pathExists(browser.userData))) continue
    // Opera لا يستخدم ملفات تعريف فرعية — مجلده هو الملف نفسه
    const profiles = browser.name === 'Opera' ? [''] : await chromiumProfiles(browser.userData)
    for (const profile of profiles) {
      const base = profile ? path.join(browser.userData, profile) : browser.userData
      for (const kind of Object.keys(CHROMIUM_KINDS) as BrowserDataKind[]) {
        const def = CHROMIUM_KINDS[kind]
        const item = await buildItem(browser.name, profile || 'Default', kind, base, def.files, def.risk)
        if (item) items.push(item)
      }
    }
  }

  const ffRoot = firefoxProfilesRoot()
  if (await pathExists(ffRoot)) {
    let profiles: string[] = []
    try {
      profiles = (await fs.readdir(ffRoot, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    } catch {
      profiles = []
    }
    for (const profile of profiles) {
      const base = path.join(ffRoot, profile)
      for (const kind of Object.keys(FIREFOX_KINDS) as BrowserDataKind[]) {
        const def = FIREFOX_KINDS[kind]!
        const item = await buildItem('Firefox', profile, kind, base, def.files, def.risk)
        if (item) items.push(item)
      }
    }
  }

  if (!isWindows) {
    // سفاري: يحمي النظام هذه الملفات، فقد يفشل الحذف حتى بصلاحيات كاملة
    const safari = path.join(home, 'Library', 'Safari')
    const history = await buildItem('Safari', 'Default', 'history', safari, ['History.db', 'History.db-wal', 'History.db-shm', 'Downloads.plist'], 'safe')
    if (history) items.push(history)
    const sessions = await buildItem('Safari', 'Default', 'sessions', safari, ['LastSession.plist'], 'caution')
    if (sessions) items.push(sessions)
  }

  return items.sort((a, b) => b.sizeBytes - a.sizeBytes)
}

function friendlyError(err: Error): string {
  const code = (err as NodeJS.ErrnoException).code
  if (code === 'EBUSY' || code === 'EPERM' || /being used|locked/i.test(err.message))
    return 'الملف مستخدَم — أغلق المتصفح ثم أعد المحاولة'
  if (code === 'EACCES' || /operation not permitted/i.test(err.message))
    return 'يمنع النظام الوصول لهذا الملف (امنح التطبيق "الوصول الكامل للقرص" من إعدادات الخصوصية)'
  return err.message
}

export async function clearBrowserData(items: BrowserDataItem[]): Promise<BrowserClearResult[]> {
  const results: BrowserClearResult[] = []
  for (const item of items) {
    let freed = 0
    let firstError: string | undefined
    for (const target of item.paths) {
      try {
        const size = await sizeOf(target)
        const stat = await fs.lstat(target)
        if (stat.isDirectory()) await fs.rm(target, { recursive: true, force: true })
        else await fs.unlink(target)
        freed += size
      } catch (err) {
        firstError ??= friendlyError(err as Error)
      }
    }
    results.push({ id: item.id, success: !firstError, freedBytes: freed, error: firstError })
  }
  return results
}
