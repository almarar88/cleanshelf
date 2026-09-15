import { contextBridge, ipcRenderer } from 'electron'
import type {
  CleanerScanResult,
  CleanProgress,
  InstalledApp,
  UninstallResult,
  LeftoverItem,
  DirListing,
  DuplicateGroup,
  LargeFileEntry,
  AudioTag,
  AudioTagWrite,
  StartupItem,
  SystemSummary,
  ScanProgress,
  ProcessEntry,
  ServiceEntry,
  NetworkAdapter,
  NetworkConnection,
  PingResult,
  DiskUsageResult,
  BrokenShortcut,
  CleanHistoryEntry,
  AppInfo,
  OrphanLeftover,
  LanguageFileGroup,
  PlatformInfo,
  AppSettings,
  HealthReport,
  SmartCleanResult,
  BrowserDataItem,
  BrowserClearResult,
  ShredProgress,
  ShredResult,
  OldDownload,
  SystemReport
} from '../shared/types'
import type { AiEvent, AiModelId, AiStatus, AiTurnInput } from '../shared/types'
import type { BatchRenamePlan, BatchRenameResult } from '../main/lib/fileManagerLib'

const api = {
  cleaner: {
    scan: (): Promise<CleanerScanResult> => ipcRenderer.invoke('cleaner:scan'),
    clean: (categoryIds: string[]): Promise<{ totalFreedBytes: number }> =>
      ipcRenderer.invoke('cleaner:clean', categoryIds),
    smartClean: (): Promise<SmartCleanResult> => ipcRenderer.invoke('cleaner:smartClean'),
    onProgress: (listener: (p: CleanProgress) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, p: CleanProgress): void => listener(p)
      ipcRenderer.on('cleaner:progress', handler)
      return (): void => {
        ipcRenderer.removeListener('cleaner:progress', handler)
      }
    }
  },
  uninstaller: {
    list: (): Promise<InstalledApp[]> => ipcRenderer.invoke('uninstaller:list'),
    uninstall: (app: InstalledApp): Promise<UninstallResult> =>
      ipcRenderer.invoke('uninstaller:uninstall', app),
    findLeftovers: (appName: string, publisher: string): Promise<LeftoverItem[]> =>
      ipcRenderer.invoke('uninstaller:findLeftovers', appName, publisher),
    removeLeftover: (target: string): Promise<void> =>
      ipcRenderer.invoke('uninstaller:removeLeftover', target)
  },
  fm: {
    list: (targetPath: string | null): Promise<DirListing> => ipcRenderer.invoke('fm:list', targetPath),
    rename: (targetPath: string, newName: string): Promise<string> =>
      ipcRenderer.invoke('fm:rename', targetPath, newName),
    move: (paths: string[], destinationDir: string): Promise<void> =>
      ipcRenderer.invoke('fm:move', paths, destinationDir),
    createFolder: (parentDir: string, name: string): Promise<string> =>
      ipcRenderer.invoke('fm:createFolder', parentDir, name),
    delete: (paths: string[]): Promise<{ path: string; success: boolean; error?: string }[]> =>
      ipcRenderer.invoke('fm:delete', paths),
    reveal: (targetPath: string): Promise<void> => ipcRenderer.invoke('fm:reveal', targetPath),
    openPath: (targetPath: string): Promise<void> => ipcRenderer.invoke('fm:openPath', targetPath),
    batchRenamePreview: (paths: string[], pattern: string, startNumber: number): Promise<BatchRenamePlan[]> =>
      ipcRenderer.invoke('fm:batchRenamePreview', paths, pattern, startNumber),
    batchRenameApply: (plan: BatchRenamePlan[]): Promise<BatchRenameResult> =>
      ipcRenderer.invoke('fm:batchRenameApply', plan),
    findDuplicates: (rootPath: string, minSizeBytes: number): Promise<DuplicateGroup[]> =>
      ipcRenderer.invoke('fm:findDuplicates', rootPath, minSizeBytes),
    findLargeFiles: (rootPath: string, minSizeBytes: number): Promise<LargeFileEntry[]> =>
      ipcRenderer.invoke('fm:findLargeFiles', rootPath, minSizeBytes),
    cancelScan: (): Promise<void> => ipcRenderer.invoke('fm:cancelScan'),
    onScanProgress: (listener: (p: ScanProgress) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, p: ScanProgress): void => listener(p)
      ipcRenderer.on('fm:scanProgress', handler)
      return (): void => {
        ipcRenderer.removeListener('fm:scanProgress', handler)
      }
    },
    homeDir: (): Promise<string> => ipcRenderer.invoke('fm:homeDir'),
    analyzeFolder: (rootPath: string): Promise<DiskUsageResult> =>
      ipcRenderer.invoke('fm:analyzeFolder', rootPath),
    findEmptyFolders: (rootPath: string): Promise<string[]> =>
      ipcRenderer.invoke('fm:findEmptyFolders', rootPath),
    findBrokenShortcuts: (rootPath: string): Promise<BrokenShortcut[]> =>
      ipcRenderer.invoke('fm:findBrokenShortcuts', rootPath),
    search: (rootPath: string, query: string): Promise<LargeFileEntry[]> =>
      ipcRenderer.invoke('fm:search', rootPath, query),
    trashPaths: (paths: string[]): Promise<{ path: string; success: boolean; error?: string }[]> =>
      ipcRenderer.invoke('fm:trashPaths', paths)
  },
  tags: {
    readFolder: (folderPath: string): Promise<AudioTag[]> => ipcRenderer.invoke('tags:readFolder', folderPath),
    write: (input: AudioTagWrite): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('tags:write', input),
    writeBatch: (
      inputs: AudioTagWrite[]
    ): Promise<{ path: string; success: boolean; message: string }[]> =>
      ipcRenderer.invoke('tags:writeBatch', inputs),
    renameFromPattern: (
      tag: AudioTag,
      pattern: string
    ): Promise<{ success: boolean; newPath?: string; message: string }> =>
      ipcRenderer.invoke('tags:renameFromPattern', tag, pattern),
    fillFromFileName: (
      folderPath: string,
      pattern: string
    ): Promise<{ path: string; fields: Record<string, string> }[]> =>
      ipcRenderer.invoke('tags:fillFromFileName', folderPath, pattern)
  },
  startup: {
    list: (): Promise<StartupItem[]> => ipcRenderer.invoke('startup:list'),
    setEnabled: (item: StartupItem, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('startup:setEnabled', item, enabled),
    remove: (item: StartupItem): Promise<void> => ipcRenderer.invoke('startup:remove', item)
  },
  proc: {
    list: (): Promise<ProcessEntry[]> => ipcRenderer.invoke('proc:list'),
    kill: (pid: number): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('proc:kill', pid)
  },
  svc: {
    list: (): Promise<ServiceEntry[]> => ipcRenderer.invoke('svc:list'),
    control: (
      name: string,
      action: 'start' | 'stop' | 'restart'
    ): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('svc:control', name, action)
  },
  net: {
    adapters: (): Promise<NetworkAdapter[]> => ipcRenderer.invoke('net:adapters'),
    connections: (): Promise<NetworkConnection[]> => ipcRenderer.invoke('net:connections'),
    ping: (host: string): Promise<PingResult> => ipcRenderer.invoke('net:ping', host),
    flushDns: (): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('net:flushDns')
  },
  mac: {
    orphanLeftovers: (): Promise<OrphanLeftover[]> => ipcRenderer.invoke('mac:orphanLeftovers'),
    languageFiles: (): Promise<LanguageFileGroup[]> => ipcRenderer.invoke('mac:languageFiles'),
    purgeMemory: (): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('mac:purgeMemory'),
    cancelScan: (): Promise<void> => ipcRenderer.invoke('mac:cancelScan')
  },
  platform: {
    info: (): Promise<PlatformInfo> => ipcRenderer.invoke('platform:info')
  },
  history: {
    list: (): Promise<CleanHistoryEntry[]> => ipcRenderer.invoke('history:list'),
    clear: (): Promise<void> => ipcRenderer.invoke('history:clear'),
    restorePoint: (): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('history:restorePoint')
  },
  system: {
    summary: (): Promise<SystemSummary> => ipcRenderer.invoke('system:summary'),
    isAdmin: (): Promise<boolean> => ipcRenderer.invoke('system:isAdmin'),
    appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('system:appInfo'),
    relaunchAsAdmin: (): Promise<{ started: boolean; message: string }> =>
      ipcRenderer.invoke('system:relaunchAsAdmin')
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:set', patch)
  },
  health: {
    compute: (): Promise<HealthReport> => ipcRenderer.invoke('health:compute')
  },
  privacy: {
    scan: (): Promise<BrowserDataItem[]> => ipcRenderer.invoke('privacy:scan'),
    clear: (items: BrowserDataItem[]): Promise<BrowserClearResult[]> =>
      ipcRenderer.invoke('privacy:clear', items)
  },
  shred: {
    run: (paths: string[], passes: number): Promise<ShredResult[]> =>
      ipcRenderer.invoke('shred:run', paths, passes),
    cancel: (): Promise<void> => ipcRenderer.invoke('shred:cancel'),
    onProgress: (listener: (p: ShredProgress) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, p: ShredProgress): void => listener(p)
      ipcRenderer.on('shred:progress', handler)
      return (): void => {
        ipcRenderer.removeListener('shred:progress', handler)
      }
    }
  },
  downloads: {
    findOld: (days: number): Promise<OldDownload[]> => ipcRenderer.invoke('downloads:findOld', days),
    path: (): Promise<string> => ipcRenderer.invoke('downloads:path')
  },
  report: {
    build: (): Promise<SystemReport> => ipcRenderer.invoke('report:build'),
    save: (markdown: string): Promise<{ saved: boolean; path?: string }> =>
      ipcRenderer.invoke('report:save', markdown)
  },
  app: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),
    /** أوامر قادمة من العملية الرئيسية (شريط النظام مثلاً) */
    onCommand: (listener: (command: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, command: string): void => listener(command)
      ipcRenderer.on('app:command', handler)
      return (): void => {
        ipcRenderer.removeListener('app:command', handler)
      }
    }
  },
  dialogs: {
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
    pickFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:pickFiles'),
    pickImageFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickImageFile'),
    confirm: (message: string, detail?: string): Promise<boolean> =>
      ipcRenderer.invoke('dialog:confirm', message, detail)
  },
  ai: {
    status: (): Promise<AiStatus> => ipcRenderer.invoke('ai:status'),
    setKey: (key: string): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('ai:setKey', key),
    clearKey: (): Promise<void> => ipcRenderer.invoke('ai:clearKey'),
    ask: (input: AiTurnInput): Promise<void> => ipcRenderer.invoke('ai:ask', input),
    cancel: (): Promise<void> => ipcRenderer.invoke('ai:cancel'),
    explain: (prompt: string, lang: 'ar' | 'en', model: AiModelId): Promise<string> =>
      ipcRenderer.invoke('ai:explain', prompt, lang, model),
    onEvent: (listener: (event: AiEvent) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, ev: AiEvent): void => listener(ev)
      ipcRenderer.on('ai:event', handler)
      return (): void => {
        ipcRenderer.removeListener('ai:event', handler)
      }
    }
  }
}

export type CleanShelfApi = typeof api

contextBridge.exposeInMainWorld('api', api)
