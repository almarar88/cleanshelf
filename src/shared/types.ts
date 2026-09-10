// أنواع مشتركة بين العملية الرئيسية (main) وواجهة المستخدم (renderer)

export interface CleanerCategory {
  id: string
  labelKey: string
  path: string | null
  sizeBytes: number
  fileCount: number
  scanned: boolean
  error?: string
  risk: 'safe' | 'caution'
  /** يحتاج تشغيل التطبيق بصلاحيات المدير لتنظيفه فعليًا */
  requiresAdmin: boolean
}

export interface AppInfo {
  name: string
  version: string
  company: string
}

export interface ProcessEntry {
  pid: number
  name: string
  cpuPercent: number
  memoryBytes: number
  user: string
  path: string
  started: string
}

export interface ServiceEntry {
  name: string
  displayName: string
  status: 'running' | 'stopped' | 'paused' | 'unknown'
  startType: 'boot' | 'system' | 'automatic' | 'manual' | 'disabled' | 'unknown'
}

export interface NetworkAdapter {
  name: string
  type: string
  ip4: string
  ip6: string
  mac: string
  speedMbps: number
  isUp: boolean
  rxBytes: number
  txBytes: number
}

export interface NetworkConnection {
  protocol: string
  localAddress: string
  remoteAddress: string
  state: string
  pid: number
  processName: string
}

export interface PingResult {
  host: string
  success: boolean
  averageMs: number
  message: string
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

export interface BrokenShortcut {
  shortcutPath: string
  targetPath: string
}

export interface OrphanLeftover {
  path: string
  name: string
  sizeBytes: number
  category: string
}

export interface LanguageFileGroup {
  appName: string
  appPath: string
  languagePaths: string[]
  sizeBytes: number
}

export interface PlatformInfo {
  isWindows: boolean
  isMac: boolean
}

export interface CleanHistoryEntry {
  timestamp: string
  freedBytes: number
  categories: string[]
}

export interface ScanProgress {
  phase: 'walking' | 'hashing'
  /** عدد الملفات التي عُثر عليها حتى الآن */
  filesSeen: number
  /** عدد الملفات التي جرت معالجتها في المرحلة الحالية */
  processed: number
  /** إجمالي المطلوب معالجته في المرحلة الحالية (0 إذا كان غير معروف بعد) */
  total: number
  currentPath: string
}

export interface CleanerScanResult {
  categories: CleanerCategory[]
  totalBytes: number
}

export interface CleanProgress {
  categoryId: string
  done: boolean
  freedBytes: number
  error?: string
}

export interface InstalledApp {
  key: string
  name: string
  version: string
  publisher: string
  installLocation: string
  installDate: string
  estimatedSizeKb: number
  uninstallString: string
  quietUninstallString: string
  hive: 'HKLM' | 'HKLM32' | 'HKCU'
}

export interface UninstallResult {
  key: string
  success: boolean
  message: string
}

export interface LeftoverItem {
  path: string
  kind: 'folder' | 'file' | 'registry'
  sizeBytes: number
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: string
  extension: string
}

export interface DirListing {
  path: string
  parent: string | null
  entries: FileEntry[]
  drives?: string[]
}

export interface DuplicateGroup {
  hash: string
  sizeBytes: number
  files: string[]
}

export interface LargeFileEntry {
  path: string
  sizeBytes: number
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
  sizeBytes: number
  error?: string
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

export interface StartupItem {
  id: string
  name: string
  command: string
  location: 'HKLM-Run' | 'HKCU-Run' | 'StartupFolder-User' | 'StartupFolder-Common'
  enabled: boolean
}

export interface SystemSummary {
  osName: string
  osVersion: string
  hostname: string
  cpuModel: string
  cpuLoadPercent: number
  totalMemBytes: number
  usedMemBytes: number
  uptimeSec: number
  disks: { mount: string; totalBytes: number; usedBytes: number; freeBytes: number }[]
}

export type ProgressListener<T> = (payload: T) => void

// ---------- الإعدادات ----------

export interface AppSettings {
  /** لغة الواجهة — تضبط أيضًا اتجاه الصفحة */
  lang: 'ar' | 'en'
  theme: 'system' | 'light' | 'dark'
  /** صبغة لون التمييز بدرجات HSL */
  accentHue: number
  minimizeToTray: boolean
  launchAtLogin: boolean
  notifications: boolean
  /** فحص منظّف القرص تلقائيًا عند فتح الرئيسية */
  scanOnLaunch: boolean
  /** عمر الملف بالأيام ليُعدّ "تنزيلًا قديمًا" */
  oldDownloadDays: number
  /** عدد مرات الكتابة فوق الملف في الممزّق الآمن */
  shredPasses: number
}

// ---------- صحة الجهاز ----------

export interface HealthFactor {
  id: string
  label: string
  status: 'good' | 'warn' | 'bad'
  detail: string
  /** صفحة تعالج هذا العامل، إن وُجدت */
  page?: string
}

export interface HealthReport {
  score: number
  factors: HealthFactor[]
  cleanableBytes: number
  safeCleanableBytes: number
  startupCount: number
  diskFreePercent: number
  memUsedPercent: number
  lastCleanDaysAgo: number | null
}

export interface SmartCleanResult {
  freedBytes: number
  categoryIds: string[]
}

// ---------- خصوصية المتصفح ----------

export type BrowserDataKind = 'history' | 'cookies' | 'sessions' | 'formdata'

export interface BrowserDataItem {
  id: string
  browser: string
  profile: string
  kind: BrowserDataKind
  paths: string[]
  sizeBytes: number
  risk: 'safe' | 'caution'
}

export interface BrowserClearResult {
  id: string
  success: boolean
  freedBytes: number
  error?: string
}

// ---------- الممزّق الآمن ----------

export interface ShredProgress {
  path: string
  pass: number
  totalPasses: number
  /** عدد الملفات المنتهية من الإجمالي */
  done: number
  total: number
}

export interface ShredResult {
  path: string
  success: boolean
  error?: string
}

// ---------- التنزيلات القديمة ----------

export interface OldDownload {
  path: string
  name: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: string
  ageDays: number
  extension: string
}

// ---------- تقرير النظام ----------

export interface SystemReport {
  generatedAt: string
  markdown: string
}
