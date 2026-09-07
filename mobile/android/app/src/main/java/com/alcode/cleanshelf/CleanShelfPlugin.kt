package com.alcode.cleanshelf

import android.Manifest
import android.app.ActivityManager
import android.app.AppOpsManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.usage.StorageStatsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.Process
import android.os.StatFs
import android.os.SystemClock
import android.os.storage.StorageManager
import android.provider.Settings
import android.provider.MediaStore
import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.graphics.Matrix
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.mpatric.mp3agic.ID3v24Tag
import com.mpatric.mp3agic.Mp3File
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.RandomAccessFile
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * الجسر الأصلي لـ CleanShelf. كل العمليات الثقيلة تعمل على خيط خلفي وتبثّ تقدّمها
 * إلى الواجهة عبر حدث scanProgress. الحذف من الأدوات يمر عبر سلة مهملات داخل
 * التطبيق (.CleanShelf/trash) ليبقى قابلًا للاسترجاع.
 */
@CapacitorPlugin(
    name = "CleanShelf",
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications"),
        Permission(strings = [Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE], alias = "storage")
    ]
)
class CleanShelfPlugin : Plugin() {

    private val io: ExecutorService = Executors.newSingleThreadExecutor()
    @Volatile private var cancelled = false
    private var lastJunk: Map<String, List<File>> = emptyMap()
    private val iconCache = HashMap<String, String>()

    private val root: File get() = Environment.getExternalStorageDirectory()
    private val trashDir: File get() = File(root, ".CleanShelf/trash")
    private val prefs get() = context.getSharedPreferences("cleanshelf", Context.MODE_PRIVATE)

    private class CancelledException : Exception("أُلغي الفحص")

    private fun bg(call: PluginCall, block: () -> JSObject) {
        io.execute {
            try {
                call.resolve(block())
            } catch (e: CancelledException) {
                call.reject("أُلغي الفحص")
            } catch (e: Exception) {
                call.reject(e.message ?: e.toString())
            }
        }
    }

    private fun progress(phase: String, seen: Int, processed: Int, total: Int, path: String) {
        val o = JSObject()
        o.put("phase", phase)
        o.put("filesSeen", seen)
        o.put("processed", processed)
        o.put("total", total)
        o.put("currentPath", path)
        notifyListeners("scanProgress", o)
    }

    private fun checkCancel() {
        if (cancelled) throw CancelledException()
    }

    // ---------- معلومات الجهاز ----------

    @PluginMethod
    fun deviceInfo(call: PluginCall) {
        val o = JSObject()
        o.put("model", Build.MODEL)
        o.put("manufacturer", Build.MANUFACTURER.replaceFirstChar { it.uppercase() })
        o.put("androidVersion", Build.VERSION.RELEASE)
        o.put("sdkInt", Build.VERSION.SDK_INT)
        o.put("cpuCores", Runtime.getRuntime().availableProcessors())
        o.put("uptimeSec", SystemClock.elapsedRealtime() / 1000)
        o.put("appVersion", try { context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "" } catch (e: Exception) { "" })
        call.resolve(o)
    }

    @PluginMethod
    fun storageStats(call: PluginCall) {
        val stat = StatFs(root.path)
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mem = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mem)
        val battery = context.registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val plugged = battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val temp = (battery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10.0
        val o = JSObject()
        o.put("storageTotalBytes", stat.totalBytes)
        o.put("storageFreeBytes", stat.availableBytes)
        o.put("ramTotalBytes", mem.totalMem)
        o.put("ramAvailableBytes", mem.availMem)
        o.put("batteryPercent", if (level >= 0 && scale > 0) level * 100 / scale else 0)
        o.put("batteryCharging", plugged != 0)
        o.put("batteryTempC", temp)
        call.resolve(o)
    }

    // ---------- الصلاحيات ----------

    private fun hasAllFiles(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager()
        else ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

    private fun hasUsageStats(): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        else @Suppress("DEPRECATION") ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun hasNotifications(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun permissionsJson(): JSObject {
        val o = JSObject()
        o.put("allFiles", hasAllFiles())
        o.put("usageStats", hasUsageStats())
        o.put("notifications", hasNotifications())
        return o
    }

    @PluginMethod
    fun permissions(call: PluginCall) = call.resolve(permissionsJson())

    @PluginMethod
    fun requestAllFiles(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val intent = try {
                Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + context.packageName))
            } catch (e: Exception) {
                Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                context.startActivity(intent)
            } catch (e: Exception) {
                context.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            call.resolve()
        } else {
            requestPermissionForAlias("storage", call, "storageResult")
        }
    }

    @PermissionCallback
    private fun storageResult(call: PluginCall) = call.resolve(permissionsJson())

    @PluginMethod
    fun requestUsageStats(call: PluginCall) {
        context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        call.resolve()
    }

    @PluginMethod
    fun requestNotifications(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifications()) {
            requestPermissionForAlias("notifications", call, "notificationsResult")
        } else call.resolve(permissionsJson())
    }

    @PermissionCallback
    private fun notificationsResult(call: PluginCall) = call.resolve(permissionsJson())

    // ---------- المشي على الملفات ----------

    private fun skipDir(dir: File): Boolean {
        val rel = dir.path.removePrefix(root.path)
        return rel.startsWith("/Android/data") || rel.startsWith("/Android/obb") || rel.startsWith("/.CleanShelf")
    }

    private fun walk(start: File, onFile: (File) -> Unit, onDirDone: ((File, Boolean) -> Unit)? = null, counter: IntArray = IntArray(1)): Boolean {
        // يعيد true إن كان المجلد فارغًا (لا ملفات، وكل الفرعيات فارغة)
        if (skipDir(start)) return false
        val children = start.listFiles() ?: return false
        var empty = true
        for (child in children) {
            checkCancel()
            if (child.isDirectory) {
                if (Files.isSymbolicLink(child.toPath())) continue
                val childEmpty = walk(child, onFile, onDirDone, counter)
                if (!childEmpty) empty = false
            } else {
                empty = false
                counter[0]++
                if (counter[0] % 400 == 0) progress("walking", counter[0], 0, 0, child.path)
                onFile(child)
            }
        }
        onDirDone?.invoke(start, empty)
        return empty
    }

    private fun dirSize(dir: File): Long {
        var size = 0L
        val stack = ArrayDeque<File>()
        stack.add(dir)
        while (stack.isNotEmpty()) {
            val current = stack.removeLast()
            val children = current.listFiles() ?: continue
            for (c in children) {
                if (Files.isSymbolicLink(c.toPath())) continue
                if (c.isDirectory) stack.add(c) else size += c.length()
            }
        }
        return size
    }

    private fun deleteRecursive(f: File): Long {
        var freed = 0L
        if (f.isDirectory && !Files.isSymbolicLink(f.toPath())) {
            f.listFiles()?.forEach { freed += deleteRecursive(it) }
        } else {
            freed += f.length()
        }
        f.delete()
        return freed
    }

    // ---------- المنظّف ----------

    private val tempExt = setOf("tmp", "temp", "bak", "old", "part", "crdownload", "partial", "download")
    private val apkExt = setOf("apk", "apks", "xapk")
    private val cacheNames = setOf("cache", ".cache", "Cache", "tmp", ".tmp", "temp")
    private val standardRootDirs = setOf(
        "Android", "DCIM", "Download", "Downloads", "Music", "Movies", "Pictures", "Documents", "Ringtones", "Alarms",
        "Notifications", "Podcasts", "Audiobooks", "Recordings", "WhatsApp", "Telegram", "Fonts", ".CleanShelf", "LOST.DIR", "Screenshots"
    )

    private fun normalize(s: String) = s.lowercase().replace(Regex("[^a-z0-9]"), "")

    private fun installedTokens(): Set<String> {
        val tokens = HashSet<String>()
        val pm = context.packageManager
        for (app in pm.getInstalledApplications(0)) {
            tokens.add(normalize(app.packageName))
            app.packageName.split('.').filter { it.length >= 4 }.forEach { tokens.add(normalize(it)) }
            val label = normalize(pm.getApplicationLabel(app).toString())
            if (label.length >= 4) tokens.add(label)
        }
        return tokens
    }

    @PluginMethod
    fun scanJunk(call: PluginCall) = bg(call) {
        cancelled = false
        val buckets = HashMap<String, MutableList<File>>()
        fun add(id: String, f: File) = buckets.getOrPut(id) { ArrayList() }.add(f)
        val cacheDirs = ArrayList<File>()
        val counter = IntArray(1)

        fun scanDir(dir: File): Boolean {
            if (skipDir(dir)) return false
            val name = dir.name
            if (name == ".thumbnails") { add("thumbnails", dir); return false }
            if (dir != root && name in cacheNames) { cacheDirs.add(dir); return false }
            val children = dir.listFiles() ?: return false
            var empty = true
            for (c in children) {
                checkCancel()
                if (c.isDirectory) {
                    if (Files.isSymbolicLink(c.toPath())) continue
                    if (!scanDir(c)) empty = false
                } else {
                    empty = false
                    counter[0]++
                    if (counter[0] % 400 == 0) progress("walking", counter[0], 0, 0, c.path)
                    val ext = c.extension.lowercase()
                    when {
                        ext in tempExt -> add("temp_files", c)
                        ext == "log" -> add("log_files", c)
                        ext in apkExt -> add("apk_files", c)
                        c.name.startsWith(".thumbdata") || c.name.startsWith(".thumbnails") -> add("thumbnails", c)
                    }
                }
            }
            if (empty && dir != root) add("empty_folders", dir)
            return empty
        }
        scanDir(root)
        cacheDirs.forEach { add("cache_folders", it) }

        // مخلّفات تطبيقات محذوفة: مجلدات في جذر الذاكرة لا تطابق أي تطبيق مثبَّت
        val tokens = installedTokens()
        root.listFiles()?.filter { it.isDirectory && it.name !in standardRootDirs && !it.name.startsWith(".") }?.forEach { dir ->
            val n = normalize(dir.name)
            if (n.length >= 4 && tokens.none { it.contains(n) || n.contains(it) }) add("residual_folders", dir)
        }
        buckets.getOrPut("own_cache") { ArrayList() }.apply {
            context.cacheDir?.listFiles()?.let { addAll(it) }
            context.externalCacheDir?.listFiles()?.let { addAll(it) }
        }

        lastJunk = buckets
        val order = listOf("temp_files", "log_files", "thumbnails", "empty_folders", "own_cache", "apk_files", "cache_folders", "residual_folders")
        val safe = setOf("temp_files", "log_files", "thumbnails", "empty_folders", "own_cache")
        val cats = JSArray()
        var total = 0L
        for (id in order) {
            val files = buckets[id] ?: emptyList()
            var size = 0L
            var count = 0
            for (f in files) {
                checkCancel()
                if (f.isDirectory) { size += dirSize(f); count += 1 } else { size += f.length(); count += 1 }
            }
            total += size
            val o = JSObject()
            o.put("id", id)
            o.put("sizeBytes", size)
            o.put("fileCount", count)
            o.put("risk", if (id in safe) "safe" else "caution")
            val samples = JSArray()
            files.take(5).forEach { samples.put(it.path) }
            o.put("samples", samples)
            cats.put(o)
        }
        JSObject().apply {
            put("categories", cats)
            put("totalBytes", total)
            put("scannedFiles", counter[0])
        }
    }

    @PluginMethod
    fun cleanJunk(call: PluginCall) = bg(call) {
        val ids = call.getArray("categoryIds")?.toList<String>() ?: emptyList()
        var freed = 0L
        var deleted = 0
        for (id in ids) {
            for (f in lastJunk[id] ?: emptyList()) {
                if (!f.exists()) continue
                freed += deleteRecursive(f)
                deleted += 1
            }
        }
        appendHistory(freed, ids)
        JSObject().apply { put("freedBytes", freed); put("deleted", deleted) }
    }

    private fun appendHistory(freed: Long, ids: List<String>) {
        val arr = JSONArray(prefs.getString("history", "[]"))
        val entry = JSONObject()
        entry.put("timestamp", System.currentTimeMillis())
        entry.put("freedBytes", freed)
        entry.put("categories", JSONArray(ids))
        val next = JSONArray()
        next.put(entry)
        for (i in 0 until minOf(arr.length(), 199)) next.put(arr.get(i))
        prefs.edit().putString("history", next.toString()).apply()
    }

    @PluginMethod
    fun history(call: PluginCall) {
        val arr = JSONArray(prefs.getString("history", "[]"))
        val out = JSArray()
        for (i in 0 until arr.length()) out.put(JSObject.fromJSONObject(arr.getJSONObject(i)))
        call.resolve(JSObject().apply { put("entries", out) })
    }

    @PluginMethod
    fun clearHistory(call: PluginCall) {
        prefs.edit().remove("history").apply()
        call.resolve()
    }

    // ---------- التطبيقات ----------

    private fun iconBase64(app: ApplicationInfo): String {
        iconCache[app.packageName]?.let { return it }
        return try {
            val drawable = context.packageManager.getApplicationIcon(app)
            val size = 96
            val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) Bitmap.createScaledBitmap(drawable.bitmap, size, size, true)
            else Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).also { b ->
                val canvas = Canvas(b)
                drawable.setBounds(0, 0, size, size)
                drawable.draw(canvas)
            }
            val out = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, out)
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP).also { iconCache[app.packageName] = it }
        } catch (e: Exception) {
            ""
        }
    }

    private fun lastUsedMap(days: Int): Map<String, Long> {
        if (!hasUsageStats()) return emptyMap()
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val end = System.currentTimeMillis()
        val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_YEARLY, end - days * 86_400_000L, end) ?: return emptyMap()
        val map = HashMap<String, Long>()
        for (s in stats) map[s.packageName] = maxOf(map[s.packageName] ?: 0L, s.lastTimeUsed)
        return map
    }

    private fun appSize(app: ApplicationInfo): Long {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && hasUsageStats()) {
            try {
                val ssm = context.getSystemService(Context.STORAGE_STATS_SERVICE) as StorageStatsManager
                val stats = ssm.queryStatsForUid(StorageManager.UUID_DEFAULT, app.uid)
                return stats.appBytes + stats.dataBytes + stats.cacheBytes
            } catch (e: Exception) {
                // نعود لحجم ملف APK
            }
        }
        return try { File(app.sourceDir).length() } catch (e: Exception) { 0L }
    }

    @PluginMethod
    fun listApps(call: PluginCall) = bg(call) {
        val includeSystem = call.getBoolean("includeSystem") ?: false
        val pm = context.packageManager
        val lastUsed = lastUsedMap(365)
        val arr = JSArray()
        for (app in pm.getInstalledApplications(0)) {
            val isSystem = (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0
            if (app.packageName == context.packageName) continue
            if (isSystem && !includeSystem) continue
            if (isSystem && pm.getLaunchIntentForPackage(app.packageName) == null) continue
            val info = try { pm.getPackageInfo(app.packageName, 0) } catch (e: Exception) { null }
            val o = JSObject()
            o.put("packageName", app.packageName)
            o.put("label", pm.getApplicationLabel(app).toString())
            o.put("versionName", info?.versionName ?: "")
            o.put("isSystem", isSystem)
            o.put("sizeBytes", appSize(app))
            o.put("icon", iconBase64(app))
            o.put("installedAt", info?.firstInstallTime ?: 0L)
            o.put("updatedAt", info?.lastUpdateTime ?: 0L)
            o.put("lastUsedAt", lastUsed[app.packageName] ?: 0L)
            arr.put(o)
        }
        JSObject().apply { put("apps", arr) }
    }

    @PluginMethod
    fun uninstallApp(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("packageName مطلوب")
        val intent = Intent(Intent.ACTION_DELETE, Uri.parse("package:$pkg")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun openAppInfo(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("packageName مطلوب")
        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        call.resolve()
    }

    @PluginMethod
    fun launchApp(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("packageName مطلوب")
        val intent = context.packageManager.getLaunchIntentForPackage(pkg) ?: return call.reject("لا يمكن فتح هذا التطبيق")
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        call.resolve()
    }

    @PluginMethod
    fun findLeftovers(call: PluginCall) = bg(call) {
        val pkg = call.getString("packageName") ?: ""
        val label = call.getString("label") ?: ""
        val tokens = HashSet<String>()
        tokens.add(normalize(pkg))
        pkg.split('.').filter { it.length >= 4 }.forEach { tokens.add(normalize(it)) }
        if (normalize(label).length >= 4) tokens.add(normalize(label))
        val candidates = ArrayList<File>()
        root.listFiles()?.filter { it.isDirectory }?.let { candidates.addAll(it) }
        File(root, "Android/media").listFiles()?.filter { it.isDirectory }?.let { candidates.addAll(it) }
        val arr = JSArray()
        for (dir in candidates) {
            val n = normalize(dir.name)
            if (n.length < 4 || dir.name in standardRootDirs) continue
            if (tokens.any { it.length >= 4 && (n.contains(it) || it.contains(n)) }) {
                val o = JSObject()
                o.put("path", dir.path)
                o.put("sizeBytes", dirSize(dir))
                o.put("isDirectory", true)
                arr.put(o)
            }
        }
        JSObject().apply { put("items", arr) }
    }

    // ---------- الملفات ----------

    private fun fileJson(f: File): JSObject {
        val o = JSObject()
        o.put("name", f.name)
        o.put("path", f.path)
        o.put("isDirectory", f.isDirectory)
        o.put("sizeBytes", if (f.isDirectory) 0L else f.length())
        o.put("modifiedAt", f.lastModified())
        o.put("extension", if (f.isDirectory) "" else f.extension.lowercase())
        o.put("childCount", if (f.isDirectory) (f.list()?.size ?: 0) else 0)
        return o
    }

    @PluginMethod
    fun roots(call: PluginCall) {
        val arr = JSArray()
        val seen = HashSet<String>()
        fun addRoot(dir: File, label: String, removable: Boolean) {
            if (!seen.add(dir.path)) return
            val o = JSObject()
            val stat = try { StatFs(dir.path) } catch (e: Exception) { null }
            o.put("path", dir.path)
            o.put("label", label)
            o.put("totalBytes", stat?.totalBytes ?: 0L)
            o.put("freeBytes", stat?.availableBytes ?: 0L)
            o.put("removable", removable)
            arr.put(o)
        }
        addRoot(root, "الذاكرة الداخلية", false)
        context.getExternalFilesDirs(null)?.forEachIndexed { i, dir ->
            if (dir == null || i == 0) return@forEachIndexed
            val volume = File(dir.path.substringBefore("/Android/"))
            if (volume.exists()) addRoot(volume, "بطاقة الذاكرة", true)
        }
        call.resolve(JSObject().apply { put("roots", arr) })
    }

    @PluginMethod
    fun listDir(call: PluginCall) = bg(call) {
        val dir = File(call.getString("path") ?: root.path)
        if (!dir.isDirectory) throw Exception("المجلد غير موجود")
        val arr = JSArray()
        dir.listFiles()?.forEach { arr.put(fileJson(it)) }
        JSObject().apply {
            put("path", dir.path)
            put("parent", if (dir.path == root.path || dir.parentFile == null || dir.parentFile?.canRead() != true) null else dir.parent)
            put("entries", arr)
        }
    }

    @PluginMethod
    fun rename(call: PluginCall) = bg(call) {
        val src = File(call.getString("path") ?: throw Exception("path مطلوب"))
        val newName = call.getString("newName") ?: throw Exception("newName مطلوب")
        if (newName.contains('/')) throw Exception("اسم غير صالح")
        val dst = File(src.parentFile, newName)
        if (dst.exists()) throw Exception("يوجد عنصر بهذا الاسم")
        if (!src.renameTo(dst)) throw Exception("تعذّرت إعادة التسمية")
        JSObject().apply { put("path", dst.path) }
    }

    private fun moveFile(src: File, dst: File): Boolean {
        if (dst.exists()) return false
        if (src.renameTo(dst)) return true
        return try {
            if (src.isDirectory) {
                copyDir(src, dst)
                deleteRecursive(src)
            } else {
                Files.move(src.toPath(), dst.toPath(), StandardCopyOption.COPY_ATTRIBUTES)
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun copyDir(src: File, dst: File) {
        dst.mkdirs()
        src.listFiles()?.forEach { c ->
            val target = File(dst, c.name)
            if (c.isDirectory) copyDir(c, target) else Files.copy(c.toPath(), target.toPath(), StandardCopyOption.COPY_ATTRIBUTES)
        }
    }

    @PluginMethod
    fun move(call: PluginCall) = bg(call) {
        val paths = call.getArray("paths")?.toList<String>() ?: emptyList()
        val dest = File(call.getString("destination") ?: throw Exception("destination مطلوب"))
        val results = JSArray()
        for (p in paths) {
            val src = File(p)
            val ok = moveFile(src, File(dest, src.name))
            results.put(JSObject().apply { put("path", p); put("success", ok); if (!ok) put("error", "تعذّر النقل (قد يوجد عنصر بالاسم نفسه)") })
        }
        JSObject().apply { put("results", results) }
    }

    @PluginMethod
    fun createFolder(call: PluginCall) = bg(call) {
        val dir = File(call.getString("parent") ?: root.path, call.getString("name") ?: "مجلد جديد")
        if (!dir.mkdirs() && !dir.isDirectory) throw Exception("تعذّر إنشاء المجلد")
        JSObject().apply { put("path", dir.path) }
    }

    @PluginMethod
    fun search(call: PluginCall) = bg(call) {
        cancelled = false
        val start = File(call.getString("root") ?: root.path)
        val q = (call.getString("query") ?: "").lowercase()
        val arr = JSArray()
        var count = 0
        walk(start, { f ->
            if (count < 500 && f.name.lowercase().contains(q)) { arr.put(fileJson(f)); count++ }
        }, { dir, _ -> if (count < 500 && dir != start && dir.name.lowercase().contains(q)) { arr.put(fileJson(dir)); count++ } })
        JSObject().apply { put("entries", arr) }
    }

    // ---------- سلة المهملات ----------

    @PluginMethod
    fun trash(call: PluginCall) = bg(call) {
        val paths = (call.getArray("paths")?.toList<String>() ?: emptyList()).sortedByDescending { it.count { c -> c == '/' } }
        trashDir.mkdirs()
        val results = JSArray()
        for (p in paths) {
            val src = File(p)
            val id = java.lang.Long.toHexString(System.nanoTime())
            val bucket = File(trashDir, id)
            bucket.mkdirs()
            val isDir = src.isDirectory
            val size = if (isDir) dirSize(src) else src.length()
            val ok = src.exists() && moveFile(src, File(bucket, src.name))
            if (ok) {
                val meta = JSONObject()
                meta.put("originalPath", p)
                meta.put("name", src.name)
                meta.put("sizeBytes", size)
                meta.put("trashedAt", System.currentTimeMillis())
                meta.put("isDirectory", isDir)
                File(bucket, ".meta.json").writeText(meta.toString())
            } else bucket.delete()
            results.put(JSObject().apply { put("path", p); put("success", ok); if (!ok) put("error", "تعذّر النقل إلى سلة المهملات") })
        }
        JSObject().apply { put("results", results) }
    }

    private fun trashItems(): List<Pair<File, JSONObject>> =
        trashDir.listFiles()?.filter { it.isDirectory }?.mapNotNull { bucket ->
            val meta = File(bucket, ".meta.json")
            if (!meta.exists()) null else try { bucket to JSONObject(meta.readText()) } catch (e: Exception) { null }
        }?.sortedByDescending { it.second.optLong("trashedAt") } ?: emptyList()

    @PluginMethod
    fun listTrash(call: PluginCall) = bg(call) {
        val arr = JSArray()
        var total = 0L
        for ((bucket, meta) in trashItems()) {
            val o = JSObject.fromJSONObject(meta)
            o.put("id", bucket.name)
            total += meta.optLong("sizeBytes")
            arr.put(o)
        }
        JSObject().apply { put("items", arr); put("totalBytes", total) }
    }

    @PluginMethod
    fun restoreTrash(call: PluginCall) = bg(call) {
        val ids = call.getArray("ids")?.toList<String>() ?: emptyList()
        val results = JSArray()
        for (id in ids) {
            val bucket = File(trashDir, id)
            val meta = try { JSONObject(File(bucket, ".meta.json").readText()) } catch (e: Exception) { null }
            var ok = false
            if (meta != null) {
                val src = File(bucket, meta.getString("name"))
                var dst = File(meta.getString("originalPath"))
                dst.parentFile?.mkdirs()
                if (dst.exists()) dst = File(dst.parentFile, "${dst.nameWithoutExtension} (مسترجع)${if (dst.extension.isEmpty()) "" else "." + dst.extension}")
                ok = moveFile(src, dst)
                if (ok) deleteRecursive(bucket)
            }
            results.put(JSObject().apply { put("path", id); put("success", ok) })
        }
        JSObject().apply { put("results", results) }
    }

    @PluginMethod
    fun deleteTrash(call: PluginCall) = bg(call) {
        val ids = call.getArray("ids")?.toList<String>() ?: emptyList()
        var freed = 0L
        for (id in ids) freed += deleteRecursive(File(trashDir, id))
        JSObject().apply { put("freedBytes", freed) }
    }

    @PluginMethod
    fun emptyTrash(call: PluginCall) = bg(call) {
        val freed = if (trashDir.exists()) deleteRecursive(trashDir) else 0L
        JSObject().apply { put("freedBytes", freed) }
    }

    @PluginMethod
    fun purgeOldTrash(call: PluginCall) = bg(call) {
        val days = call.getInt("days") ?: 30
        val cutoff = System.currentTimeMillis() - days * 86_400_000L
        var freed = 0L
        for ((bucket, meta) in trashItems()) if (meta.optLong("trashedAt") < cutoff) freed += deleteRecursive(bucket)
        JSObject().apply { put("freedBytes", freed) }
    }

    // ---------- أدوات الفحص ----------

    private fun hash(f: File, full: Boolean): String {
        val md = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            var read: Int
            var total = 0L
            while (input.read(buf).also { read = it } > 0) {
                md.update(buf, 0, read)
                total += read
                if (!full && total >= 64 * 1024) break
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    @PluginMethod
    fun findDuplicates(call: PluginCall) = bg(call) {
        cancelled = false
        val start = File(call.getString("root") ?: root.path)
        val minSize = call.getLong("minSizeBytes") ?: 65536L
        val bySize = HashMap<Long, MutableList<File>>()
        walk(start, { f -> if (f.length() >= minSize) bySize.getOrPut(f.length()) { ArrayList() }.add(f) })
        val candidates = bySize.values.filter { it.size > 1 }.flatten()
        val groups = HashMap<String, MutableList<File>>()
        var done = 0
        for (f in candidates) {
            checkCancel()
            done++
            progress("hashing", candidates.size, done, candidates.size, f.path)
            try {
                val quick = "${f.length()}:${hash(f, false)}"
                groups.getOrPut(quick) { ArrayList() }.add(f)
            } catch (e: Exception) {
                // ملف تعذّرت قراءته
            }
        }
        val arr = JSArray()
        for ((_, files) in groups) {
            if (files.size < 2) continue
            val byFull = HashMap<String, MutableList<File>>()
            for (f in files) {
                checkCancel()
                try { byFull.getOrPut(hash(f, true)) { ArrayList() }.add(f) } catch (e: Exception) { }
            }
            for ((h, same) in byFull) {
                if (same.size < 2) continue
                val o = JSObject()
                o.put("hash", h)
                o.put("sizeBytes", same[0].length())
                val list = JSArray()
                same.sortedBy { it.lastModified() }.forEach { list.put(it.path) }
                o.put("files", list)
                arr.put(o)
            }
        }
        JSObject().apply { put("groups", arr) }
    }

    @PluginMethod
    fun findLargeFiles(call: PluginCall) = bg(call) {
        cancelled = false
        val start = File(call.getString("root") ?: root.path)
        val minSize = call.getLong("minSizeBytes") ?: (50L * 1024 * 1024)
        val limit = call.getInt("limit") ?: 200
        val found = ArrayList<File>()
        walk(start, { f -> if (f.length() >= minSize) found.add(f) })
        val arr = JSArray()
        for (f in found.sortedByDescending { it.length() }.take(limit)) {
            val o = JSObject()
            o.put("path", f.path)
            o.put("name", f.name)
            o.put("sizeBytes", f.length())
            o.put("modifiedAt", f.lastModified())
            o.put("extension", f.extension.lowercase())
            arr.put(o)
        }
        JSObject().apply { put("files", arr) }
    }

    @PluginMethod
    fun findEmptyFolders(call: PluginCall) = bg(call) {
        cancelled = false
        val start = File(call.getString("root") ?: root.path)
        val arr = JSArray()
        walk(start, {}, { dir, empty -> if (empty && dir != start && dir != root) arr.put(dir.path) })
        JSObject().apply { put("folders", arr) }
    }

    @PluginMethod
    fun oldDownloads(call: PluginCall) = bg(call) {
        val days = call.getInt("days") ?: 30
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val cutoff = System.currentTimeMillis() - days * 86_400_000L
        val arr = JSArray()
        dir.listFiles()?.filter { !it.name.startsWith(".") && it.lastModified() < cutoff }?.sortedByDescending { if (it.isDirectory) dirSize(it) else it.length() }?.forEach { f ->
            val o = JSObject()
            o.put("path", f.path)
            o.put("name", f.name)
            o.put("isDirectory", f.isDirectory)
            o.put("sizeBytes", if (f.isDirectory) dirSize(f) else f.length())
            o.put("modifiedAt", f.lastModified())
            o.put("extension", if (f.isDirectory) "" else f.extension.lowercase())
            o.put("ageDays", ((System.currentTimeMillis() - f.lastModified()) / 86_400_000L).toInt())
            arr.put(o)
        }
        JSObject().apply { put("items", arr); put("folder", dir.path) }
    }

    @PluginMethod
    fun analyzeFolder(call: PluginCall) = bg(call) {
        cancelled = false
        val dir = File(call.getString("path") ?: root.path)
        val arr = JSArray()
        var total = 0L
        val children = dir.listFiles() ?: emptyArray()
        children.forEachIndexed { i, c ->
            checkCancel()
            progress("walking", 0, i, children.size, c.path)
            var files = 0
            var size = 0L
            if (c.isDirectory) {
                if (!skipDir(c)) walk(c, { f -> files++; size += f.length() })
            } else { files = 1; size = c.length() }
            total += size
            val o = JSObject()
            o.put("path", c.path)
            o.put("name", c.name)
            o.put("sizeBytes", size)
            o.put("fileCount", files)
            o.put("isDirectory", c.isDirectory)
            arr.put(o)
        }
        val sorted = JSArray()
        (0 until arr.length()).map { arr.getJSONObject(it) }.sortedByDescending { it.getLong("sizeBytes") }.forEach { sorted.put(it) }
        JSObject().apply {
            put("root", dir.path)
            put("parent", if (dir.path == root.path) null else dir.parent)
            put("totalBytes", total)
            put("children", sorted)
        }
    }

    @PluginMethod
    fun shred(call: PluginCall) = bg(call) {
        cancelled = false
        val paths = call.getArray("paths")?.toList<String>() ?: emptyList()
        val passes = (call.getInt("passes") ?: 3).coerceIn(1, 7)
        val results = JSArray()
        val random = SecureRandom()
        paths.forEachIndexed { i, p ->
            val f = File(p)
            var ok = false
            var error: String? = null
            try {
                checkCancel()
                val len = f.length()
                RandomAccessFile(f, "rws").use { raf ->
                    val buf = ByteArray(1024 * 1024)
                    for (pass in 1..passes) {
                        progress("shredding", 0, i, paths.size, "$p — ${pass}/${passes}")
                        raf.seek(0)
                        var written = 0L
                        while (written < len) {
                            checkCancel()
                            val n = minOf(buf.size.toLong(), len - written).toInt()
                            if (pass == passes) java.util.Arrays.fill(buf, 0, n, 0) else random.nextBytes(buf)
                            raf.write(buf, 0, n)
                            written += n
                        }
                        raf.fd.sync()
                    }
                }
                val anon = File(f.parentFile, java.lang.Long.toHexString(random.nextLong()))
                ok = if (f.renameTo(anon)) anon.delete() else f.delete()
            } catch (e: CancelledException) {
                error = "أُلغيت العملية"
            } catch (e: Exception) {
                error = e.message
            }
            results.put(JSObject().apply { put("path", p); put("success", ok); if (error != null) put("error", error) })
        }
        JSObject().apply { put("results", results) }
    }

    @PluginMethod
    fun cancelScan(call: PluginCall) {
        cancelled = true
        call.resolve()
    }

    // ---------- وسوم الأغاني ----------

    private val audioExt = setOf("mp3", "flac", "m4a", "ogg", "wav", "aac", "opus", "wma")

    private fun thumb(bytes: ByteArray?): String {
        if (bytes == null || bytes.isEmpty()) return ""
        return try {
            val opts = BitmapFactory.Options().apply { inSampleSize = 4 }
            val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts) ?: return ""
            val scaled = Bitmap.createScaledBitmap(bmp, 96, 96, true)
            val out = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, 80, out)
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            ""
        }
    }

    @PluginMethod
    fun readTags(call: PluginCall) = bg(call) {
        val dir = File(call.getString("folder") ?: root.path)
        val arr = JSArray()
        val files = dir.listFiles()?.filter { it.isFile && it.extension.lowercase() in audioExt }?.sortedBy { it.name } ?: emptyList()
        for (f in files) {
            val o = JSObject()
            o.put("path", f.path)
            o.put("fileName", f.name)
            o.put("format", f.extension.uppercase())
            o.put("sizeBytes", f.length())
            val isMp3 = f.extension.equals("mp3", true)
            o.put("writable", isMp3)
            var filled = false
            if (isMp3) {
                try {
                    val mp3 = Mp3File(f)
                    o.put("durationSec", mp3.lengthInSeconds)
                    val v2 = mp3.id3v2Tag
                    val v1 = mp3.id3v1Tag
                    o.put("title", v2?.title ?: v1?.title ?: "")
                    o.put("artist", v2?.artist ?: v1?.artist ?: "")
                    o.put("album", v2?.album ?: v1?.album ?: "")
                    o.put("albumArtist", v2?.albumArtist ?: "")
                    o.put("year", v2?.year ?: v1?.year ?: "")
                    o.put("genre", v2?.genreDescription ?: v1?.genreDescription ?: "")
                    o.put("track", v2?.track ?: v1?.track ?: "")
                    o.put("comment", v2?.comment ?: v1?.comment ?: "")
                    val image = v2?.albumImage
                    o.put("hasCover", image != null && image.isNotEmpty())
                    o.put("coverThumb", thumb(image))
                    filled = true
                } catch (e: Exception) {
                    // ملف MP3 تالف أو غير قياسي — نحاول القارئ العام
                }
            }
            if (!filled) {
                val r = MediaMetadataRetriever()
                try {
                    r.setDataSource(f.path)
                    fun g(key: Int) = r.extractMetadata(key) ?: ""
                    o.put("durationSec", (g(MediaMetadataRetriever.METADATA_KEY_DURATION).toLongOrNull() ?: 0L) / 1000)
                    o.put("title", g(MediaMetadataRetriever.METADATA_KEY_TITLE))
                    o.put("artist", g(MediaMetadataRetriever.METADATA_KEY_ARTIST))
                    o.put("album", g(MediaMetadataRetriever.METADATA_KEY_ALBUM))
                    o.put("albumArtist", g(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST))
                    o.put("year", g(MediaMetadataRetriever.METADATA_KEY_YEAR))
                    o.put("genre", g(MediaMetadataRetriever.METADATA_KEY_GENRE))
                    o.put("track", g(MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER))
                    o.put("comment", "")
                    val pic = r.embeddedPicture
                    o.put("hasCover", pic != null)
                    o.put("coverThumb", thumb(pic))
                } catch (e: Exception) {
                    o.put("durationSec", 0); o.put("title", ""); o.put("artist", ""); o.put("album", ""); o.put("albumArtist", "")
                    o.put("year", ""); o.put("genre", ""); o.put("track", ""); o.put("comment", ""); o.put("hasCover", false); o.put("coverThumb", "")
                } finally {
                    try { r.release() } catch (e: Exception) { }
                }
            }
            arr.put(o)
        }
        JSObject().apply { put("tags", arr) }
    }

    @PluginMethod
    fun writeTags(call: PluginCall) = bg(call) {
        val items = call.getArray("items") ?: JSArray()
        val results = JSArray()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val path = item.getString("path")
            val res = JSObject().apply { put("path", path) }
            try {
                val f = File(path)
                if (!f.extension.equals("mp3", true)) throw Exception("الحفظ مدعوم لملفات MP3 فقط")
                val mp3 = Mp3File(f)
                val tag = mp3.id3v2Tag ?: ID3v24Tag()
                fun s(key: String): String? = if (item.has(key) && !item.isNull(key)) item.getString(key) else null
                s("title")?.let { tag.title = it }
                s("artist")?.let { tag.artist = it }
                s("album")?.let { tag.album = it }
                s("albumArtist")?.let { tag.albumArtist = it }
                s("year")?.let { tag.year = it }
                s("genre")?.let { if (it.isNotBlank()) tag.genreDescription = it }
                s("track")?.let { tag.track = it }
                s("comment")?.let { tag.comment = it }
                s("coverPath")?.let { cover ->
                    val cf = File(cover)
                    if (cf.exists()) tag.setAlbumImage(cf.readBytes(), if (cf.extension.equals("png", true)) "image/png" else "image/jpeg")
                }
                mp3.id3v2Tag = tag
                val tmp = File(f.parentFile, ".${f.name}.cleanshelf.tmp")
                mp3.save(tmp.path)
                if (!tmp.renameTo(f)) {
                    Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.REPLACE_EXISTING)
                }
                res.put("success", true)
                res.put("message", "تم")
            } catch (e: Exception) {
                res.put("success", false)
                res.put("message", e.message ?: "فشل الحفظ")
            }
            results.put(res)
        }
        JSObject().apply { put("results", results) }
    }

    @PluginMethod
    fun pickImage(call: PluginCall) {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply { type = "image/*"; addCategory(Intent.CATEGORY_OPENABLE) }
        startActivityForResult(call, Intent.createChooser(intent, "اختر صورة الغلاف"), "pickImageResult")
    }

    @ActivityCallback
    private fun pickImageResult(call: PluginCall, result: ActivityResult) {
        val uri = result.data?.data
        if (uri == null) { call.resolve(JSObject().apply { put("path", JSObject.NULL) }); return }
        try {
            val out = File(context.cacheDir, "cover-${System.currentTimeMillis()}.jpg")
            context.contentResolver.openInputStream(uri)?.use { input -> out.outputStream().use { input.copyTo(it) } }
            call.resolve(JSObject().apply { put("path", out.path) })
        } catch (e: Exception) {
            call.reject("تعذّر قراءة الصورة")
        }
    }

    // ---------- الاستخدام والإشعارات ----------

    @PluginMethod
    fun usageStats(call: PluginCall) = bg(call) {
        val days = call.getInt("days") ?: 7
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val end = System.currentTimeMillis()
        val begin = if (days <= 1) java.util.Calendar.getInstance().apply { set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0); set(java.util.Calendar.SECOND, 0) }.timeInMillis else end - days * 86_400_000L
        val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, begin, end) ?: emptyList()
        val totals = HashMap<String, Long>()
        val lastUsed = HashMap<String, Long>()
        for (s in stats) {
            totals[s.packageName] = (totals[s.packageName] ?: 0L) + s.totalTimeInForeground
            lastUsed[s.packageName] = maxOf(lastUsed[s.packageName] ?: 0L, s.lastTimeUsed)
        }
        val pm = context.packageManager
        val arr = JSArray()
        for ((pkg, time) in totals.entries.sortedByDescending { it.value }.take(50)) {
            if (time < 1000 || pkg == context.packageName) continue
            val app = try { pm.getApplicationInfo(pkg, 0) } catch (e: Exception) { null } ?: continue
            if (pm.getLaunchIntentForPackage(pkg) == null) continue
            val o = JSObject()
            o.put("packageName", pkg)
            o.put("label", pm.getApplicationLabel(app).toString())
            o.put("icon", iconBase64(app))
            o.put("totalTimeMs", time)
            o.put("lastUsedAt", lastUsed[pkg] ?: 0L)
            arr.put(o)
        }
        JSObject().apply { put("entries", arr) }
    }

    @PluginMethod
    fun notify(call: PluginCall) {
        if (!hasNotifications()) return call.resolve()
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(NotificationChannel("clean", "التنظيف", NotificationManager.IMPORTANCE_DEFAULT))
        }
        val n = NotificationCompat.Builder(context, "clean")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(call.getString("title") ?: "CleanShelf")
            .setContentText(call.getString("body") ?: "")
            .setAutoCancel(true)
            .build()
        try { nm.notify((System.currentTimeMillis() % 10000).toInt(), n) } catch (e: Exception) { }
        call.resolve()
    }

    @PluginMethod
    fun clearOwnCache(call: PluginCall) = bg(call) {
        var freed = 0L
        context.cacheDir?.listFiles()?.forEach { freed += deleteRecursive(it) }
        context.externalCacheDir?.listFiles()?.forEach { freed += deleteRecursive(it) }
        JSObject().apply { put("freedBytes", freed) }
    }

    @PluginMethod
    fun log(call: PluginCall) {
        android.util.Log.i("CleanShelf", call.getString("message") ?: "")
        call.resolve()
    }

    @PluginMethod
    fun openUrl(call: PluginCall) {
        val url = call.getString("url") ?: return call.reject("url مطلوب")
        if (!url.startsWith("https://")) return call.reject("رابط غير مسموح")
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        call.resolve()
    }

    // ---------- تفصيل التخزين عبر MediaStore ----------

    private fun mediaTotal(uri: Uri): LongArray {
        var bytes = 0L
        var count = 0L
        try {
            context.contentResolver.query(uri, arrayOf(MediaStore.MediaColumns.SIZE), null, null, null)?.use { c ->
                val idx = c.getColumnIndex(MediaStore.MediaColumns.SIZE)
                while (c.moveToNext()) { bytes += c.getLong(idx); count++ }
            }
        } catch (e: Exception) { }
        return longArrayOf(bytes, count)
    }

    @PluginMethod
    fun mediaStats(call: PluginCall) = bg(call) {
        val images = mediaTotal(MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
        val videos = mediaTotal(MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
        val audio = mediaTotal(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI)
        var apps = 0L
        if (hasUsageStats()) {
            for (app in context.packageManager.getInstalledApplications(0)) {
                if ((app.flags and ApplicationInfo.FLAG_SYSTEM) != 0) continue
                apps += appSize(app)
            }
        }
        val stat = StatFs(root.path)
        JSObject().apply {
            put("imagesBytes", images[0]); put("imagesCount", images[1])
            put("videosBytes", videos[0]); put("videosCount", videos[1])
            put("audioBytes", audio[0]); put("audioCount", audio[1])
            put("appsBytes", apps)
            put("totalBytes", stat.totalBytes)
            put("freeBytes", stat.availableBytes)
        }
    }

    // ---------- واتساب وتيليجرام ----------

    private data class SocialCat(val id: String, val app: String, val label: String, val dirs: List<String>, val risk: String)

    private fun socialCategories(): List<SocialCat> {
        val wa = listOf("Android/media/com.whatsapp/WhatsApp/Media", "WhatsApp/Media")
        val wab = listOf("Android/media/com.whatsapp.w4b/WhatsApp Business/Media")
        val tg = listOf("Android/media/org.telegram.messenger/Telegram", "Telegram")
        fun waDirs(sub: String) = (wa + wab).map { "$it/$sub" }
        return listOf(
            SocialCat("wa_images", "WhatsApp", "صور واتساب", waDirs("WhatsApp Images"), "caution"),
            SocialCat("wa_video", "WhatsApp", "فيديو واتساب", waDirs("WhatsApp Video"), "caution"),
            SocialCat("wa_voice", "WhatsApp", "الرسائل الصوتية", waDirs("WhatsApp Voice Notes"), "safe"),
            SocialCat("wa_audio", "WhatsApp", "ملفات صوت واتساب", waDirs("WhatsApp Audio"), "caution"),
            SocialCat("wa_docs", "WhatsApp", "مستندات واتساب", waDirs("WhatsApp Documents"), "caution"),
            SocialCat("wa_status", "WhatsApp", "الحالات المؤقتة", waDirs(".Statuses"), "safe"),
            SocialCat("wa_stickers", "WhatsApp", "الملصقات", waDirs("WhatsApp Stickers"), "safe"),
            SocialCat("wa_gifs", "WhatsApp", "صور GIF", waDirs("WhatsApp Animated Gifs"), "safe"),
            SocialCat("wa_profile", "WhatsApp", "صور الملفات الشخصية", waDirs("WhatsApp Profile Photos"), "safe"),
            SocialCat("wa_wallpaper", "WhatsApp", "خلفيات الدردشة", waDirs("WallPaper"), "safe"),
            SocialCat("tg_images", "Telegram", "صور تيليجرام", tg.map { "$it/Telegram Images" }, "caution"),
            SocialCat("tg_video", "Telegram", "فيديو تيليجرام", tg.map { "$it/Telegram Video" }, "caution"),
            SocialCat("tg_audio", "Telegram", "صوتيات تيليجرام", tg.map { "$it/Telegram Audio" }, "safe"),
            SocialCat("tg_docs", "Telegram", "مستندات تيليجرام", tg.map { "$it/Telegram Documents" }, "caution"),
            SocialCat("tg_stories", "Telegram", "قصص تيليجرام", tg.map { "$it/Telegram Stories" }, "safe")
        )
    }

    @PluginMethod
    fun socialMedia(call: PluginCall) = bg(call) {
        cancelled = false
        val arr = JSArray()
        val apps = HashSet<String>()
        for (cat in socialCategories()) {
            checkCancel()
            var bytes = 0L
            var count = 0
            val paths = JSArray()
            var newest = 0L
            for (rel in cat.dirs) {
                val dir = File(root, rel)
                if (!dir.isDirectory) continue
                walk(dir, { f ->
                    if (f.name == ".nomedia") return@walk
                    bytes += f.length(); count++
                    if (f.lastModified() > newest) newest = f.lastModified()
                    if (paths.length() < 6000) paths.put(f.path)
                })
            }
            if (count == 0) continue
            apps.add(cat.app)
            val o = JSObject()
            o.put("id", cat.id); o.put("app", cat.app); o.put("label", cat.label)
            o.put("sizeBytes", bytes); o.put("fileCount", count); o.put("risk", cat.risk)
            o.put("newestAt", newest); o.put("paths", paths)
            arr.put(o)
        }
        val appsArr = JSArray(); apps.forEach { appsArr.put(it) }
        JSObject().apply { put("categories", arr); put("apps", appsArr) }
    }

    // ---------- لقطات الشاشة ----------

    private fun thumbnailOf(f: File, target: Int): String {
        return try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(f.path, bounds)
            var sample = 1
            while (bounds.outWidth / sample > target * 2 || bounds.outHeight / sample > target * 2) sample *= 2
            val bmp = BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return ""
            val scale = target.toFloat() / maxOf(bmp.width, bmp.height)
            val m = Matrix().apply { postScale(scale, scale) }
            val small = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
            val out = ByteArrayOutputStream()
            small.compress(Bitmap.CompressFormat.JPEG, 70, out)
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) { "" }
    }

    @PluginMethod
    fun screenshots(call: PluginCall) = bg(call) {
        cancelled = false
        val days = call.getInt("days") ?: 0
        val cutoff = System.currentTimeMillis() - days * 86_400_000L
        val dirs = listOf("DCIM/Screenshots", "Pictures/Screenshots", "Screenshots", "DCIM/Screen recordings", "Movies/Screen recordings")
        val found = ArrayList<File>()
        for (rel in dirs) {
            val dir = File(root, rel)
            if (!dir.isDirectory) continue
            walk(dir, { f -> if (f.lastModified() < cutoff && f.extension.lowercase() in setOf("png", "jpg", "jpeg", "webp", "mp4")) found.add(f) })
        }
        val sorted = found.sortedByDescending { it.lastModified() }.take(400)
        val arr = JSArray()
        sorted.forEachIndexed { i, f ->
            checkCancel()
            if (i % 20 == 0) progress("walking", sorted.size, i, sorted.size, f.path)
            val o = JSObject()
            o.put("path", f.path); o.put("name", f.name); o.put("sizeBytes", f.length())
            o.put("modifiedAt", f.lastModified()); o.put("isVideo", f.extension.equals("mp4", true))
            o.put("thumb", if (f.extension.equals("mp4", true)) "" else thumbnailOf(f, 220))
            arr.put(o)
        }
        JSObject().apply { put("items", arr); put("totalBytes", found.sumOf { it.length() }); put("totalCount", found.size) }
    }

    @PluginMethod
    fun thumbnail(call: PluginCall) = bg(call) {
        val f = File(call.getString("path") ?: "")
        JSObject().apply { put("thumb", if (f.isFile) thumbnailOf(f, call.getInt("size") ?: 220) else "") }
    }

    // ---------- مسرّع الذاكرة ----------

    @PluginMethod
    fun boostMemory(call: PluginCall) = bg(call) {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val before = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }.availMem
        val pm = context.packageManager
        val killed = JSArray()
        // التطبيقات المستخدمة مؤخرًا هي الأرجح أن تكون في الخلفية؛ النظام يتجاهل ما لا يجوز إنهاؤه
        val recent = if (hasUsageStats()) lastUsedMap(2).keys else pm.getInstalledApplications(0).map { it.packageName }
        for (pkg in recent) {
            if (pkg == context.packageName) continue
            val app = try { pm.getApplicationInfo(pkg, 0) } catch (e: Exception) { null } ?: continue
            if ((app.flags and ApplicationInfo.FLAG_SYSTEM) != 0) continue
            try {
                am.killBackgroundProcesses(pkg)
                killed.put(pm.getApplicationLabel(app).toString())
            } catch (e: Exception) { }
        }
        Thread.sleep(600)
        val after = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }.availMem
        JSObject().apply { put("beforeAvailable", before); put("afterAvailable", after); put("killed", killed) }
    }

    // ---------- التذكير الأسبوعي ----------

    @PluginMethod
    fun setReminder(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        val dayOfWeek = call.getInt("dayOfWeek") ?: 6 // 1=الأحد … 7=السبت (Calendar)
        val hour = call.getInt("hour") ?: 19
        prefs.edit().putBoolean("reminderEnabled", enabled).putInt("reminderDay", dayOfWeek).putInt("reminderHour", hour).apply()
        ReminderReceiver.schedule(context, enabled, dayOfWeek, hour)
        call.resolve()
    }

    // ---------- الودجت ----------

    @PluginMethod
    fun updateWidget(call: PluginCall) {
        prefs.edit()
            .putInt("widgetFreePercent", call.getInt("freePercent") ?: 0)
            .putLong("widgetJunkBytes", call.getLong("junkBytes") ?: 0L)
            .putInt("widgetScore", call.getInt("score") ?: 0)
            .apply()
        val mgr = AppWidgetManager.getInstance(context)
        val ids = mgr.getAppWidgetIds(ComponentName(context, CleanShelfWidget::class.java))
        if (ids.isNotEmpty()) CleanShelfWidget.render(context, mgr, ids)
        call.resolve()
    }
}
