import os from 'node:os'
import type Anthropic from '@anthropic-ai/sdk'
import { computeHealth } from './healthLib'
import { getSystemSummary } from './systemInfoLib'
import { analyzeFolder } from './diskAnalyzerLib'
import { findLargeFiles } from './duplicatesLib'
import { listStartupItems } from './startupLib'
import { listProcesses } from './processesLib'
import { listInstalledApps } from './uninstallerLib'
import { findOldDownloads } from './downloadsLib'
import { readHistory } from './historyLib'
import { scanAllCategories } from '../ipc/cleaner'

/**
 * الأدوات التي يستطيع المساعد استدعاءها. كلها للقراءة فقط ولا تحذف شيئًا —
 * الحذف يبقى بيد المستخدم عبر أدوات التطبيق المعتادة. وكلها تُرجع بيانات
 * وصفية (أسماء وأحجام وأعداد) ولا تقرأ محتوى أي ملف.
 */

export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_device_health',
    description:
      'درجة صحة الجهاز من 100 مع العوامل المؤثّرة: حجم ما يمكن تنظيفه، نسبة المساحة الحرة، نسبة الذاكرة المستخدمة، عدد برامج بدء التشغيل، وعدد الأيام منذ آخر تنظيف. ابدأ بهذه الأداة عادةً.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true
  },
  {
    name: 'scan_cleanable',
    description:
      'يفحص كل فئات الملفات غير الضرورية (ملفات مؤقتة، ذواكر المتصفحات، سلة المحذوفات…) ويُرجع لكل فئة حجمها وعدد ملفاتها ودرجة خطورتها وهل تحتاج صلاحيات مدير. الفحص قد يستغرق عشرات الثواني.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true
  },
  {
    name: 'get_system_summary',
    description: 'نظام التشغيل والمعالج والذاكرة وكل الأقراص بأحجامها ومساحتها الحرة.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true
  },
  {
    name: 'analyze_folder',
    description:
      'يحلّل مجلدًا ويُرجع أكبر العناصر داخله بالحجم وعدد الملفات — لمعرفة أين تذهب المساحة. استعمله للتنقّل خطوة خطوة من مجلد المستخدم نحو الأكبر.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'المسار المطلق للمجلد المراد تحليله' }
      },
      required: ['path'],
      additionalProperties: false
    },
    strict: true
  },
  {
    name: 'find_large_files',
    description: 'أكبر الملفات تحت مسار معيّن، مرتّبة تنازليًا بالحجم.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'المسار المطلق للبحث تحته' },
        min_size_mb: { type: 'number', description: 'أصغر حجم بالميغابايت (افتراضي 100)' }
      },
      required: ['path'],
      additionalProperties: false
    },
    strict: true
  },
  {
    name: 'list_startup_items',
    description: 'البرامج التي تعمل تلقائيًا عند إقلاع الجهاز، مع حالتها وموقعها.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true
  },
  {
    name: 'list_installed_apps',
    description: 'البرامج المثبَّتة مع الناشر والحجم التقديري وتاريخ التثبيت. مفيدة لاقتراح ما لم يعد مستخدمًا.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true
  },
  {
    name: 'list_processes',
    description: 'العمليات التي تعمل الآن مع استهلاك المعالج والذاكرة. مفيدة لتفسير بطء الجهاز أو امتلاء الذاكرة.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true
  },
  {
    name: 'find_old_downloads',
    description: 'الملفات المنسيّة في مجلد التنزيلات الأقدم من عدد أيام معيّن.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'أقل عمر بالأيام (افتراضي 30)' } },
      required: [],
      additionalProperties: false
    },
    strict: true
  },
  {
    name: 'get_clean_history',
    description: 'سجل عمليات التنظيف السابقة: متى جرت وكم مساحة حرّرت.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true
  }
]

/** نقصّ القوائم الطويلة حتى لا نغرق السياق ولا نضخّم الفاتورة على المستخدم. */
function top<T>(items: T[], n: number): T[] {
  return items.slice(0, n)
}

export async function runAiTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_device_health': {
      const h = await computeHealth()
      return {
        score: h.score,
        cleanableBytes: h.cleanableBytes,
        safeCleanableBytes: h.safeCleanableBytes,
        diskFreePercent: h.diskFreePercent,
        memUsedPercent: h.memUsedPercent,
        startupCount: h.startupCount,
        lastCleanDaysAgo: h.lastCleanDaysAgo,
        factors: h.factors.map((f) => ({ id: f.id, status: f.status, detail: f.detail }))
      }
    }
    case 'scan_cleanable': {
      const scan = await scanAllCategories()
      return {
        totalBytes: scan.totalBytes,
        categories: scan.categories
          .filter((c) => c.sizeBytes > 0 || c.fileCount > 0)
          .map((c) => ({
            id: c.id,
            sizeBytes: c.sizeBytes,
            fileCount: c.fileCount,
            risk: c.risk,
            requiresAdmin: c.requiresAdmin
          }))
      }
    }
    case 'get_system_summary': {
      const s = await getSystemSummary()
      return {
        os: `${s.osName} ${s.osVersion}`,
        cpu: s.cpuModel,
        cpuLoadPercent: s.cpuLoadPercent,
        totalMemBytes: s.totalMemBytes,
        usedMemBytes: s.usedMemBytes,
        uptimeSec: s.uptimeSec,
        disks: s.disks
      }
    }
    case 'analyze_folder': {
      const target = String(input.path ?? os.homedir())
      const r = await analyzeFolder(target)
      return {
        root: r.root,
        totalBytes: r.totalBytes,
        children: top(r.children, 25).map((c) => ({
          name: c.name,
          path: c.path,
          sizeBytes: c.sizeBytes,
          fileCount: c.fileCount,
          isDirectory: c.isDirectory
        }))
      }
    }
    case 'find_large_files': {
      const target = String(input.path ?? os.homedir())
      const minMb = typeof input.min_size_mb === 'number' ? input.min_size_mb : 100
      const files = await findLargeFiles(target, minMb * 1024 * 1024, 60)
      return top(files, 40).map((f) => ({ path: f.path, sizeBytes: f.sizeBytes }))
    }
    case 'list_startup_items': {
      const items = await listStartupItems()
      return items.map((i) => ({ name: i.name, enabled: i.enabled, location: i.location, command: i.command }))
    }
    case 'list_installed_apps': {
      const apps = await listInstalledApps()
      return top(
        [...apps].sort((a, b) => (b.estimatedSizeKb ?? 0) - (a.estimatedSizeKb ?? 0)),
        60
      ).map((a) => ({
        name: a.name,
        publisher: a.publisher,
        sizeBytes: (a.estimatedSizeKb ?? 0) * 1024,
        installDate: a.installDate
      }))
    }
    case 'list_processes': {
      const procs = await listProcesses()
      return top(
        [...procs].sort((a, b) => b.memoryBytes - a.memoryBytes),
        40
      ).map((p) => ({ name: p.name, pid: p.pid, cpuPercent: p.cpuPercent, memoryBytes: p.memoryBytes }))
    }
    case 'find_old_downloads': {
      const days = typeof input.days === 'number' ? input.days : 30
      const items = await findOldDownloads(days)
      return {
        count: items.length,
        totalBytes: items.reduce((s, i) => s + i.sizeBytes, 0),
        items: top(items, 40).map((i) => ({ name: i.name, sizeBytes: i.sizeBytes, ageDays: i.ageDays }))
      }
    }
    case 'get_clean_history': {
      const entries = await readHistory()
      return {
        count: entries.length,
        totalFreedBytes: entries.reduce((s, e) => s + e.freedBytes, 0),
        recent: top(entries, 10).map((e) => ({ timestamp: e.timestamp, freedBytes: e.freedBytes }))
      }
    }
    default:
      throw new Error(`أداة غير معروفة: ${name}`)
  }
}
