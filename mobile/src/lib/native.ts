import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type {
  AppEntry,
  AudioTag,
  AudioTagWrite,
  CleanHistoryEntry,
  DeviceInfo,
  DirListing,
  DiskUsageResult,
  DuplicateGroup,
  FileEntry,
  JunkScan,
  LargeFile,
  LeftoverEntry,
  OldDownload,
  OpResult,
  PermissionState,
  ScanProgress,
  StorageRoot,
  StorageStats,
  TrashItem,
  UsageEntry
} from './types'

/**
 * واجهة الإضافة الأصلية. كل دالة تقابل @PluginMethod في CleanShelfPlugin.kt،
 * والوسائط تُمرَّر ككائن واحد كما تفرض Capacitor.
 */
export interface CleanShelfNativePlugin {
  deviceInfo(): Promise<DeviceInfo>
  storageStats(): Promise<StorageStats>
  permissions(): Promise<PermissionState>
  requestAllFiles(): Promise<void>
  requestUsageStats(): Promise<void>
  requestNotifications(): Promise<PermissionState>

  scanJunk(): Promise<JunkScan>
  cleanJunk(options: { categoryIds: string[] }): Promise<{ freedBytes: number; deleted: number }>

  listApps(options: { includeSystem: boolean }): Promise<{ apps: AppEntry[] }>
  uninstallApp(options: { packageName: string }): Promise<void>
  openAppInfo(options: { packageName: string }): Promise<void>
  launchApp(options: { packageName: string }): Promise<void>
  findLeftovers(options: { packageName: string; label: string }): Promise<{ items: LeftoverEntry[] }>

  roots(): Promise<{ roots: StorageRoot[] }>
  listDir(options: { path: string }): Promise<DirListing>
  rename(options: { path: string; newName: string }): Promise<{ path: string }>
  move(options: { paths: string[]; destination: string }): Promise<{ results: OpResult[] }>
  createFolder(options: { parent: string; name: string }): Promise<{ path: string }>
  search(options: { root: string; query: string }): Promise<{ entries: FileEntry[] }>

  trash(options: { paths: string[] }): Promise<{ results: OpResult[] }>
  listTrash(): Promise<{ items: TrashItem[]; totalBytes: number }>
  restoreTrash(options: { ids: string[] }): Promise<{ results: OpResult[] }>
  deleteTrash(options: { ids: string[] }): Promise<{ freedBytes: number }>
  emptyTrash(): Promise<{ freedBytes: number }>
  purgeOldTrash(options: { days: number }): Promise<{ freedBytes: number }>

  findDuplicates(options: { root: string; minSizeBytes: number }): Promise<{ groups: DuplicateGroup[] }>
  findLargeFiles(options: { root: string; minSizeBytes: number; limit: number }): Promise<{ files: LargeFile[] }>
  findEmptyFolders(options: { root: string }): Promise<{ folders: string[] }>
  oldDownloads(options: { days: number }): Promise<{ items: OldDownload[]; folder: string }>
  analyzeFolder(options: { path: string }): Promise<DiskUsageResult>
  shred(options: { paths: string[]; passes: number }): Promise<{ results: OpResult[] }>
  cancelScan(): Promise<void>

  readTags(options: { folder: string }): Promise<{ tags: AudioTag[] }>
  writeTags(options: { items: AudioTagWrite[] }): Promise<{ results: { path: string; success: boolean; message: string }[] }>
  pickImage(): Promise<{ path: string | null }>

  usageStats(options: { days: number }): Promise<{ entries: UsageEntry[] }>
  history(): Promise<{ entries: CleanHistoryEntry[] }>
  clearHistory(): Promise<void>
  notify(options: { title: string; body: string }): Promise<void>
  clearOwnCache(): Promise<{ freedBytes: number }>
  openUrl(options: { url: string }): Promise<void>
  /** يكتب سطرًا في logcat بوسم CleanShelf — لفحص التشغيل الآلي */
  log(options: { message: string }): Promise<void>

  addListener(
    eventName: 'scanProgress',
    listener: (progress: ScanProgress) => void
  ): Promise<PluginListenerHandle>
}

export const Native = registerPlugin<CleanShelfNativePlugin>('CleanShelf', {
  // في المتصفح (للتطوير والمعاينة) نستخدم محاكاة بالبيانات
  web: () => import('./nativeMock').then((m) => new m.CleanShelfMock())
})
