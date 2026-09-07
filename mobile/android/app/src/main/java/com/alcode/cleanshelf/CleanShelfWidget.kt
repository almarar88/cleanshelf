package com.alcode.cleanshelf

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/** ودجت للشاشة الرئيسية: المساحة المتاحة، آخر حجم قابل للتنظيف، وزر يفتح التطبيق. */
class CleanShelfWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = render(context, manager, ids)

    companion object {
        fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val prefs = context.getSharedPreferences("cleanshelf", Context.MODE_PRIVATE)
            val free = prefs.getInt("widgetFreePercent", -1)
            val junk = prefs.getLong("widgetJunkBytes", 0L)
            val score = prefs.getInt("widgetScore", -1)
            val open = PendingIntent.getActivity(context, 1, context.packageManager.getLaunchIntentForPackage(context.packageName), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_cleanshelf)
                views.setTextViewText(R.id.widget_score, if (score >= 0) "$score" else "—")
                views.setTextViewText(R.id.widget_free, if (free >= 0) "$free% مساحة متاحة" else "افتح التطبيق للفحص")
                views.setTextViewText(R.id.widget_junk, if (junk > 0) "${ReminderReceiver.humanBytes(junk)} قابلة للتنظيف" else "لا ملفات غير ضرورية")
                views.setOnClickPendingIntent(R.id.widget_root, open)
                views.setOnClickPendingIntent(R.id.widget_button, open)
                manager.updateAppWidget(id, views)
            }
        }
    }
}
