import { WebPlugin } from '@capacitor/core'
import type { CleanShelfNativePlugin } from './native'
import type {
  AppEntry,
  AudioTag,
  DirListing,
  DiskUsageResult,
  FileEntry,
  JunkScan,
  OldDownload,
  ScanProgress,
  StorageStats,
  TrashItem
} from './types'

const MB = 1024 ** 2
const GB = 1024 ** 3
const ROOT = '/storage/emulated/0'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function png(color: string): string {
  // مربّع ملوّن 48×48 كأيقونة تطبيق وهمية
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(0, 0, 48, 48, 12)
  ctx.fill()
  return canvas.toDataURL('image/png').split(',')[1]
}

const SAMPLE_FILES: FileEntry[] = [
  { name: 'DCIM', path: `${ROOT}/DCIM`, isDirectory: true, sizeBytes: 0, modifiedAt: Date.now() - 86_400_000, extension: '', childCount: 3 },
  { name: 'Download', path: `${ROOT}/Download`, isDirectory: true, sizeBytes: 0, modifiedAt: Date.now() - 3_600_000, extension: '', childCount: 12 },
  { name: 'Music', path: `${ROOT}/Music`, isDirectory: true, sizeBytes: 0, modifiedAt: Date.now() - 5 * 86_400_000, extension: '', childCount: 48 },
  { name: 'Pictures', path: `${ROOT}/Pictures`, isDirectory: true, sizeBytes: 0, modifiedAt: Date.now(), extension: '', childCount: 210 },
  { name: 'WhatsApp', path: `${ROOT}/WhatsApp`, isDirectory: true, sizeBytes: 0, modifiedAt: Date.now(), extension: '', childCount: 4 },
  { name: 'تقرير المشروع.pdf', path: `${ROOT}/تقرير المشروع.pdf`, isDirectory: false, sizeBytes: 2.4 * MB, modifiedAt: Date.now() - 2 * 86_400_000, extension: 'pdf', childCount: 0 },
  { name: 'backup-2025.zip', path: `${ROOT}/backup-2025.zip`, isDirectory: false, sizeBytes: 812 * MB, modifiedAt: Date.now() - 90 * 86_400_000, extension: 'zip', childCount: 0 },
  { name: 'IMG_2031.jpg', path: `${ROOT}/IMG_2031.jpg`, isDirectory: false, sizeBytes: 3.1 * MB, modifiedAt: Date.now() - 6 * 3_600_000, extension: 'jpg', childCount: 0 }
]

/** محاكاة الإضافة الأصلية للمعاينة في المتصفح — بيانات ثابتة وتأخير بسيط يشبه الجهاز. */
export class CleanShelfMock extends WebPlugin implements CleanShelfNativePlugin {
  private trashItems: TrashItem[] = []
  private cancelled = false

  async deviceInfo() {
    return { model: 'Pixel 8', manufacturer: 'Google', androidVersion: '15', sdkInt: 35, cpuCores: 8, uptimeSec: 3 * 86_400 + 4_100, appVersion: '1.3.0' }
  }

  async storageStats(): Promise<StorageStats> {
    return { storageTotalBytes: 128 * GB, storageFreeBytes: 21.4 * GB, ramTotalBytes: 8 * GB, ramAvailableBytes: 2.9 * GB, batteryPercent: 76, batteryCharging: false, batteryTempC: 31.2 }
  }

  async permissions() {
    return { allFiles: true, usageStats: false, notifications: true }
  }
  async requestAllFiles() {}
  async requestUsageStats() {}
  async requestNotifications() {
    return { allFiles: true, usageStats: false, notifications: true }
  }

  async scanJunk(): Promise<JunkScan> {
    await this.emitWalk(1800)
    const categories = [
      { id: 'temp_files', sizeBytes: 148 * MB, fileCount: 312, risk: 'safe' as const, samples: [`${ROOT}/Download/video.mp4.part`] },
      { id: 'log_files', sizeBytes: 22 * MB, fileCount: 40, risk: 'safe' as const, samples: [`${ROOT}/logs/app.log`] },
      { id: 'thumbnails', sizeBytes: 96 * MB, fileCount: 1_204, risk: 'safe' as const, samples: [`${ROOT}/DCIM/.thumbnails`] },
      { id: 'empty_folders', sizeBytes: 0, fileCount: 17, risk: 'safe' as const, samples: [`${ROOT}/Pictures/Old`] },
      { id: 'own_cache', sizeBytes: 4 * MB, fileCount: 9, risk: 'safe' as const, samples: [] },
      { id: 'apk_files', sizeBytes: 410 * MB, fileCount: 6, risk: 'caution' as const, samples: [`${ROOT}/Download/app-release.apk`] },
      { id: 'cache_folders', sizeBytes: 230 * MB, fileCount: 890, risk: 'caution' as const, samples: [`${ROOT}/Telegram/cache`] },
      { id: 'residual_folders', sizeBytes: 1.2 * GB, fileCount: 2_310, risk: 'caution' as const, samples: [`${ROOT}/OldGameData`] }
    ]
    return { categories, totalBytes: categories.reduce((s, c) => s + c.sizeBytes, 0), scannedFiles: 18_402 }
  }

  async cleanJunk({ categoryIds }: { categoryIds: string[] }) {
    await delay(1200)
    return { freedBytes: categoryIds.length * 90 * MB, deleted: categoryIds.length * 120 }
  }

  async listApps({ includeSystem }: { includeSystem: boolean }) {
    await delay(400)
    const apps: AppEntry[] = [
      { packageName: 'com.whatsapp', label: 'WhatsApp', versionName: '2.26.4', isSystem: false, sizeBytes: 1.9 * GB, icon: png('#25d366'), installedAt: Date.now() - 400 * 86_400_000, updatedAt: Date.now() - 3 * 86_400_000, lastUsedAt: Date.now() - 1_200_000 },
      { packageName: 'com.instagram.android', label: 'Instagram', versionName: '390.0', isSystem: false, sizeBytes: 1.1 * GB, icon: png('#e1306c'), installedAt: Date.now() - 300 * 86_400_000, updatedAt: Date.now() - 86_400_000, lastUsedAt: Date.now() - 7_200_000 },
      { packageName: 'com.example.oldgame', label: 'Old Game', versionName: '1.0', isSystem: false, sizeBytes: 2.8 * GB, icon: png('#f97316'), installedAt: Date.now() - 500 * 86_400_000, updatedAt: Date.now() - 500 * 86_400_000, lastUsedAt: 0 },
      { packageName: 'com.spotify.music', label: 'Spotify', versionName: '9.0', isSystem: false, sizeBytes: 640 * MB, icon: png('#1db954'), installedAt: Date.now() - 200 * 86_400_000, updatedAt: Date.now() - 10 * 86_400_000, lastUsedAt: Date.now() - 86_400_000 }
    ]
    if (includeSystem) apps.push({ packageName: 'com.android.chrome', label: 'Chrome', versionName: '131', isSystem: true, sizeBytes: 420 * MB, icon: png('#4285f4'), installedAt: 0, updatedAt: Date.now(), lastUsedAt: Date.now() })
    return { apps }
  }
  async uninstallApp() {}
  async openAppInfo() {}
  async launchApp() {}
  async findLeftovers({ label }: { packageName: string; label: string }) {
    await delay(500)
    return { items: [{ path: `${ROOT}/${label.replace(/\s+/g, '')}`, sizeBytes: 84 * MB, isDirectory: true }] }
  }

  async roots() {
    return { roots: [{ path: ROOT, label: 'الذاكرة الداخلية', totalBytes: 128 * GB, freeBytes: 21.4 * GB, removable: false }] }
  }
  async listDir({ path }: { path: string }): Promise<DirListing> {
    await delay(150)
    if (path === ROOT) return { path, parent: null, entries: SAMPLE_FILES }
    return {
      path,
      parent: path.slice(0, path.lastIndexOf('/')),
      entries: [
        { name: 'song-01.mp3', path: `${path}/song-01.mp3`, isDirectory: false, sizeBytes: 8.2 * MB, modifiedAt: Date.now(), extension: 'mp3', childCount: 0 },
        { name: 'notes.txt', path: `${path}/notes.txt`, isDirectory: false, sizeBytes: 2 * 1024, modifiedAt: Date.now(), extension: 'txt', childCount: 0 }
      ]
    }
  }
  async rename({ path, newName }: { path: string; newName: string }) {
    return { path: `${path.slice(0, path.lastIndexOf('/'))}/${newName}` }
  }
  async move({ paths }: { paths: string[]; destination: string }) {
    return { results: paths.map((p) => ({ path: p, success: true })) }
  }
  async createFolder({ parent, name }: { parent: string; name: string }) {
    return { path: `${parent}/${name}` }
  }
  async search({ query }: { root: string; query: string }) {
    await delay(500)
    return { entries: SAMPLE_FILES.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())) }
  }

  async trash({ paths }: { paths: string[] }) {
    for (const p of paths) {
      this.trashItems.push({ id: String(Date.now() + Math.random()), originalPath: p, name: p.split('/').pop() ?? p, sizeBytes: 5 * MB, trashedAt: Date.now(), isDirectory: false })
    }
    return { results: paths.map((p) => ({ path: p, success: true })) }
  }
  async listTrash() {
    return { items: this.trashItems, totalBytes: this.trashItems.reduce((s, i) => s + i.sizeBytes, 0) }
  }
  async restoreTrash({ ids }: { ids: string[] }) {
    this.trashItems = this.trashItems.filter((i) => !ids.includes(i.id))
    return { results: ids.map((id) => ({ path: id, success: true })) }
  }
  async deleteTrash({ ids }: { ids: string[] }) {
    this.trashItems = this.trashItems.filter((i) => !ids.includes(i.id))
    return { freedBytes: ids.length * 5 * MB }
  }
  async emptyTrash() {
    const n = this.trashItems.length
    this.trashItems = []
    return { freedBytes: n * 5 * MB }
  }
  async purgeOldTrash() {
    return { freedBytes: 0 }
  }

  async findDuplicates() {
    await this.emitWalk(1500)
    return {
      groups: [
        { hash: 'a1', sizeBytes: 3.1 * MB, files: [`${ROOT}/IMG_2031.jpg`, `${ROOT}/WhatsApp/Media/IMG_2031.jpg`, `${ROOT}/Download/IMG_2031 (1).jpg`] },
        { hash: 'b2', sizeBytes: 8.2 * MB, files: [`${ROOT}/Music/song-01.mp3`, `${ROOT}/Download/song-01.mp3`] }
      ]
    }
  }
  async findLargeFiles() {
    await this.emitWalk(1000)
    return {
      files: [
        { path: `${ROOT}/backup-2025.zip`, name: 'backup-2025.zip', sizeBytes: 812 * MB, modifiedAt: Date.now() - 90 * 86_400_000, extension: 'zip' },
        { path: `${ROOT}/Movies/trip.mp4`, name: 'trip.mp4', sizeBytes: 1.6 * GB, modifiedAt: Date.now() - 30 * 86_400_000, extension: 'mp4' }
      ]
    }
  }
  async findEmptyFolders() {
    await this.emitWalk(800)
    return { folders: [`${ROOT}/Pictures/Old`, `${ROOT}/Download/tmp`] }
  }
  async oldDownloads({ days }: { days: number }) {
    await delay(300)
    const items: OldDownload[] = [
      { path: `${ROOT}/Download/app-release.apk`, name: 'app-release.apk', sizeBytes: 68 * MB, modifiedAt: Date.now() - 120 * 86_400_000, extension: 'apk', ageDays: 120, isDirectory: false },
      { path: `${ROOT}/Download/invoice.pdf`, name: 'invoice.pdf', sizeBytes: 400 * 1024, modifiedAt: Date.now() - 45 * 86_400_000, extension: 'pdf', ageDays: 45, isDirectory: false }
    ].filter((i) => i.ageDays >= days)
    return { items, folder: `${ROOT}/Download` }
  }
  async analyzeFolder({ path }: { path: string }): Promise<DiskUsageResult> {
    await this.emitWalk(900)
    return {
      root: path,
      parent: path === ROOT ? null : path.slice(0, path.lastIndexOf('/')),
      totalBytes: 61 * GB,
      children: [
        { path: `${path}/DCIM`, name: 'DCIM', sizeBytes: 24 * GB, fileCount: 3_100, isDirectory: true },
        { path: `${path}/WhatsApp`, name: 'WhatsApp', sizeBytes: 18 * GB, fileCount: 12_000, isDirectory: true },
        { path: `${path}/Movies`, name: 'Movies', sizeBytes: 12 * GB, fileCount: 40, isDirectory: true },
        { path: `${path}/Music`, name: 'Music', sizeBytes: 5 * GB, fileCount: 700, isDirectory: true },
        { path: `${path}/backup-2025.zip`, name: 'backup-2025.zip', sizeBytes: 812 * MB, fileCount: 1, isDirectory: false }
      ]
    }
  }
  async shred({ paths, passes }: { paths: string[]; passes: number }) {
    for (let i = 0; i < paths.length; i += 1) {
      for (let p = 1; p <= passes; p += 1) {
        this.notifyListeners('scanProgress', { phase: 'shredding', filesSeen: 0, processed: i, total: paths.length, currentPath: `${paths[i]} — المرور ${p}/${passes}` } satisfies ScanProgress)
        await delay(250)
      }
    }
    return { results: paths.map((p) => ({ path: p, success: true })) }
  }
  async cancelScan() {
    this.cancelled = true
  }

  async readTags({ folder }: { folder: string }) {
    await delay(400)
    const tags: AudioTag[] = [1, 2, 3].map((n) => ({
      path: `${folder}/track-0${n}.mp3`,
      fileName: `track-0${n}.mp3`,
      format: 'MP3',
      durationSec: 180 + n * 20,
      title: n === 2 ? '' : `أغنية رقم ${n}`,
      artist: 'فنان تجريبي',
      album: 'ألبوم تجريبي',
      albumArtist: '',
      year: '2024',
      genre: 'Pop',
      track: String(n),
      comment: '',
      hasCover: n === 1,
      coverThumb: n === 1 ? png('#8b5cf6') : '',
      sizeBytes: 8 * MB,
      writable: true
    }))
    return { tags }
  }
  async writeTags({ items }: { items: { path: string }[] }) {
    await delay(300)
    return { results: items.map((i) => ({ path: i.path, success: true, message: 'تم' })) }
  }
  async pickImage() {
    return { path: `${ROOT}/Pictures/cover.jpg` }
  }

  async usageStats() {
    await delay(300)
    return {
      entries: [
        { packageName: 'com.instagram.android', label: 'Instagram', icon: png('#e1306c'), totalTimeMs: 3.2 * 3_600_000, lastUsedAt: Date.now() - 3_600_000 },
        { packageName: 'com.whatsapp', label: 'WhatsApp', icon: png('#25d366'), totalTimeMs: 1.4 * 3_600_000, lastUsedAt: Date.now() - 600_000 }
      ]
    }
  }
  async history() {
    return { entries: [{ timestamp: Date.now() - 2 * 86_400_000, freedBytes: 1.3 * GB, categories: ['temp_files', 'thumbnails'] }] }
  }
  async clearHistory() {}
  async notify() {}
  async clearOwnCache() {
    return { freedBytes: 4 * MB }
  }
  async openUrl({ url }: { url: string }) {
    window.open(url, '_blank')
  }

  private async emitWalk(totalMs: number): Promise<void> {
    this.cancelled = false
    const steps = 6
    for (let i = 1; i <= steps; i += 1) {
      if (this.cancelled) throw new Error('أُلغي الفحص')
      this.notifyListeners('scanProgress', { phase: 'walking', filesSeen: i * 3_000, processed: i, total: 0, currentPath: `${ROOT}/DCIM/Camera/IMG_${1000 + i}.jpg` } satisfies ScanProgress)
      await delay(totalMs / steps)
    }
  }
}
