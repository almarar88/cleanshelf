package com.alcode.cleanshelf

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import java.util.Calendar

/** تذكير أسبوعي بالتنظيف عبر AlarmManager، يُعاد ضبطه بعد إعادة التشغيل. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences("cleanshelf", Context.MODE_PRIVATE)
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            if (prefs.getBoolean("reminderEnabled", false)) schedule(context, true, prefs.getInt("reminderDay", 6), prefs.getInt("reminderHour", 19))
            return
        }
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) nm.createNotificationChannel(NotificationChannel("reminder", "تذكير التنظيف", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(context, 0, context.packageManager.getLaunchIntentForPackage(context.packageName), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val junk = prefs.getLong("widgetJunkBytes", 0L)
        val body = if (junk > 0) "آخر فحص وجد ${humanBytes(junk)} قابلة للتنظيف — افتح CleanShelf ونظّف هاتفك" else "حان وقت التنظيف الأسبوعي — افتح CleanShelf لفحص هاتفك"
        val n = NotificationCompat.Builder(context, "reminder")
            .setSmallIcon(R.mipmap.ic_launcher).setContentTitle("تذكير CleanShelf").setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(open).setAutoCancel(true).build()
        try { nm.notify(7001, n) } catch (e: Exception) { }
        // نعيد الجدولة للأسبوع القادم
        schedule(context, true, prefs.getInt("reminderDay", 6), prefs.getInt("reminderHour", 19))
    }

    companion object {
        fun humanBytes(b: Long): String {
            if (b < 1024) return "$b بايت"
            val units = arrayOf("كيلوبايت", "ميغابايت", "غيغابايت")
            var v = b.toDouble(); var i = -1
            while (v >= 1024 && i < units.size - 1) { v /= 1024; i++ }
            return String.format("%.1f %s", v, units[i])
        }

        fun schedule(context: Context, enabled: Boolean, dayOfWeek: Int, hour: Int) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pi = PendingIntent.getBroadcast(context, 7001, Intent(context, ReminderReceiver::class.java).setAction("com.alcode.cleanshelf.REMIND"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            am.cancel(pi)
            if (!enabled) return
            val next = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0)
                set(Calendar.DAY_OF_WEEK, dayOfWeek)
                if (timeInMillis <= System.currentTimeMillis()) add(Calendar.WEEK_OF_YEAR, 1)
            }
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.timeInMillis, pi)
        }
    }
}
