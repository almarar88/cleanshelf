import { ipcMain } from 'electron'
import type {
  ProcessEntry,
  ServiceEntry,
  NetworkAdapter,
  NetworkConnection,
  PingResult,
  CleanHistoryEntry,
  OrphanLeftover,
  LanguageFileGroup,
  PlatformInfo,
  ScanProgress
} from '../../shared/types'
import { listProcesses, killProcess } from '../lib/processesLib'
import { listServices, controlService } from '../lib/servicesLib'
import { listAdapters, listConnections, pingHost, flushDns } from '../lib/networkLib'
import { readHistory, clearHistory, createRestorePoint } from '../lib/historyLib'
import { findOrphanLeftovers, findLanguageFiles, purgeMemory } from '../lib/macExtrasLib'
import { isWindows } from '../lib/platform'
import { BrowserWindow } from 'electron'

export function registerSystemToolsIpc(): void {
  ipcMain.handle('proc:list', async (): Promise<ProcessEntry[]> => listProcesses())
  ipcMain.handle('proc:kill', async (_event, pid: number) => killProcess(pid))

  ipcMain.handle('svc:list', async (): Promise<ServiceEntry[]> => listServices())
  ipcMain.handle('svc:control', async (_event, name: string, action: 'start' | 'stop' | 'restart') =>
    controlService(name, action)
  )

  ipcMain.handle('net:adapters', async (): Promise<NetworkAdapter[]> => listAdapters())
  ipcMain.handle('net:connections', async (): Promise<NetworkConnection[]> => listConnections())
  ipcMain.handle('net:ping', async (_event, host: string): Promise<PingResult> => pingHost(host))
  ipcMain.handle('net:flushDns', async () => flushDns())

  ipcMain.handle('history:list', async (): Promise<CleanHistoryEntry[]> => readHistory())
  ipcMain.handle('history:clear', async () => clearHistory())
  ipcMain.handle('history:restorePoint', async () => createRestorePoint())

  ipcMain.handle(
    'platform:info',
    async (): Promise<PlatformInfo> => ({ isWindows, isMac: !isWindows })
  )

  // أدوات خاصة بماك — فحص واحد نشط في كل لحظة كما في بقية الفحوصات
  let macScanCancelled = false

  function macHooks(event: Electron.IpcMainInvokeEvent): {
    onProgress: (p: ScanProgress) => void
    shouldCancel: () => boolean
  } {
    const win = BrowserWindow.fromWebContents(event.sender)
    return {
      onProgress: (p) => win?.webContents.send('fm:scanProgress', p),
      shouldCancel: () => macScanCancelled
    }
  }

  ipcMain.handle('mac:cancelScan', async () => {
    macScanCancelled = true
  })

  ipcMain.handle('mac:orphanLeftovers', async (event): Promise<OrphanLeftover[]> => {
    macScanCancelled = false
    return findOrphanLeftovers(macHooks(event))
  })

  ipcMain.handle('mac:languageFiles', async (event): Promise<LanguageFileGroup[]> => {
    macScanCancelled = false
    return findLanguageFiles(macHooks(event))
  })

  ipcMain.handle('mac:purgeMemory', async () => purgeMemory())
}
