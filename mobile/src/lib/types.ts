// أنواع مشتركة بين واجهة React والإضافة الأصلية (Kotlin)

export interface DeviceInfo {
  model: string
  manufacturer: string
  androidVersion: string
  sdkInt: number
  cpuCores: number
  uptimeSec: number
  appVersion: string
}

export interface StorageStats {
  storageTotalBytes: number
  storageFreeBytes: number
  ramTotalBytes: number
  ramAvailableBytes: number
  batteryPercent: number
  batteryCharging: boolean
  batteryTempC: number
}

export interface PermissionState {
  allFiles: boolean
  usageStats: boolean
  notifications: boolean
}

export interface JunkCategory {
  id: string
  sizeBytes: number
  fileCount: number
  risk: 'safe' | 'caution'
  /** عيّنات من المسارات لعرضها */
  samples: string[]
}

export interface JunkScan {
  categories: JunkCategory[]
  totalBytes: number
  scannedFiles: number
}

export interface AppEntry {
  packageName: string
  label: string
  versionName: string
  isSystem: boolean
  sizeBytes: number
  /** صورة PNG بترميز base64 */
  icon: string
  installedAt: number
  updatedAt: number
  lastUsedAt: number
}

export interface LeftoverEntry {
  path: string
  sizeBytes: number
  isDirectory: boolean
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: number
  extension: string
  childCount: number
}

export interface DirListing {
  path: string
  parent: string | null
  entries: FileEntry[]
}

export interface StorageRoot {
  path: string
  label: string
  totalBytes: number
  freeBytes: number
  removable: boolean
}

export interface TrashItem {
  id: string
  originalPath: string
  name: string
  sizeBytes: number
  trashedAt: number
  isDirectory: boolean
}

export interface OpResult {
  path: string
  success: boolean
  error?: string
}

export interface DuplicateGroup {
  hash: string
  sizeBytes: number
  files: string[]
}

export interface LargeFile {
  path: string
  name: string
  sizeBytes: number
  modifiedAt: number
  extension: string
}

export interface OldDownload extends LargeFile {
  ageDays: number
  isDirectory: boolean
}

export interface FolderUsage {
  path: string
  name: string
  sizeBytes: number
  fileCount: number
  isDirectory: boolean
}

export interface DiskUsageResult {
  root: string
  parent: string | null
  totalBytes: number
  children: FolderUsage[]
}

export interface ScanProgress {
  phase: 'walking' | 'hashing' | 'shredding'
  filesSeen: number
  processed: number
  total: number
  currentPath: string
}

export interface AudioTag {
  path: string
  fileName: string
  format: string
  durationSec: number
  title: string
  artist: string
  album: string
  albumArtist: string
  year: string
  genre: string
  track: string
  comment: string
  hasCover: boolean
  /** غلاف مصغّر base64 إن وُجد */
  coverThumb: string
  sizeBytes: number
  writable: boolean
}

export interface AudioTagWrite {
  path: string
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  year?: string
  genre?: string
  track?: string
  comment?: string
  coverPath?: string | null
}

export interface UsageEntry {
  packageName: string
  label: string
  icon: string
  totalTimeMs: number
  lastUsedAt: number
}

export interface CleanHistoryEntry {
  timestamp: number
  freedBytes: number
  categories: string[]
}

export interface AppSettings {
  lang: 'ar' | 'en'
  userName: string
  theme: 'system' | 'light' | 'dark'
  accentHue: number
  notifications: boolean
  scanOnLaunch: boolean
  oldDownloadDays: number
  shredPasses: number
  trashRetentionDays: number
  showSystemApps: boolean
  reminderEnabled: boolean
  reminderDay: number
  reminderHour: number
}

export interface HealthFactor {
  id: string
  label: string
  status: 'good' | 'warn' | 'bad'
  detail: string
  page?: string
}

// ---------- تفصيل التخزين ----------

export interface MediaStats {
  imagesBytes: number
  imagesCount: number
  videosBytes: number
  videosCount: number
  audioBytes: number
  audioCount: number
  appsBytes: number
  totalBytes: number
  freeBytes: number
}

// ---------- واتساب وتيليجرام ----------

export interface SocialCategory {
  id: string
  app: string
  label: string
  sizeBytes: number
  fileCount: number
  risk: 'safe' | 'caution'
  newestAt: number
  paths: string[]
}

// ---------- لقطات الشاشة ----------

export interface ScreenshotItem {
  path: string
  name: string
  sizeBytes: number
  modifiedAt: number
  isVideo: boolean
  thumb: string
}

// ---------- مسرّع الذاكرة ----------

export interface BoostResult {
  beforeAvailable: number
  afterAvailable: number
  killed: string[]
}
