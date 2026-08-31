import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { StartupItem } from '../../shared/types'
import { pathExists } from './fsWalk'
import { run, runAppleScript } from './shell'

const home = os.homedir()

const AGENT_DIRS: { dir: string; location: StartupItem['location'] }[] = [
  { dir: path.join(home, 'Library', 'LaunchAgents'), location: 'StartupFolder-User' },
  { dir: '/Library/LaunchAgents', location: 'StartupFolder-Common' },
  { dir: '/Library/LaunchDaemons', location: 'StartupFolder-Common' }
]

async function listLoginItems(): Promise<StartupItem[]> {
  try {
    const out = await runAppleScript(
      'tell application "System Events" to get the name of every login item'
    )
    return out
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({
        id: `LoginItem:${name}`,
        name,
        command: 'عنصر تسجيل دخول',
        location: 'HKCU-Run' as const,
        enabled: true
      }))
  } catch {
    // يحتاج إذن "التشغيل الآلي" — نتخطاه بدل إسقاط الصفحة كلها
    return []
  }
}

async function listAgents(): Promise<StartupItem[]> {
  const items: StartupItem[] = []

  for (const { dir, location } of AGENT_DIRS) {
    if (!(await pathExists(dir))) continue
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.name.endsWith('.plist') && !entry.name.endsWith('.plist.disabled')) continue
      const disabled = entry.name.endsWith('.disabled')
      const label = entry.name.replace(/\.plist(\.disabled)?$/, '')
      items.push({
        id: `${location}:${entry.name}`,
        name: label,
        command: path.join(dir, entry.name),
        location,
        enabled: !disabled
      })
    }
  }

  return items
}

export async function listStartupItemsMac(): Promise<StartupItem[]> {
  const [loginItems, agents] = await Promise.all([listLoginItems(), listAgents()])
  return [...loginItems, ...agents]
}

export async function setStartupItemEnabledMac(
  item: StartupItem,
  enabled: boolean
): Promise<void> {
  if (item.location === 'HKCU-Run') {
    if (enabled) {
      throw new Error('إعادة تفعيل عنصر تسجيل الدخول تتم من إعدادات النظام')
    }
    await runAppleScript(
      'on run argv\ntell application "System Events" to delete login item (item 1 of argv)\nend run',
      [item.name]
    )
    return
  }

  // وكلاء launchd: التعطيل بإضافة لاحقة .disabled فلا يحمّلها النظام
  const current = item.command
  const target = enabled ? current.replace(/\.disabled$/, '') : `${current}.disabled`
  if (current === target) return

  try {
    await run('launchctl', [enabled ? 'load' : 'unload', '-w', current], 20_000)
  } catch {
    // قد يكون غير محمّل أصلًا — نكمل لإعادة التسمية على أي حال
  }
  await fs.rename(current, target)
}

export async function removeStartupItemMac(item: StartupItem): Promise<void> {
  if (item.location === 'HKCU-Run') {
    await runAppleScript(
      'on run argv\ntell application "System Events" to delete login item (item 1 of argv)\nend run',
      [item.name]
    )
    return
  }
  try {
    await run('launchctl', ['unload', '-w', item.command], 20_000)
  } catch {
    // غير محمّل
  }
  await fs.unlink(item.command)
}
