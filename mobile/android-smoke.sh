#!/usr/bin/env bash
# فحص تشغيل على محاكي أندرويد: يثبّت APK، يمنح إذن الملفات، يفتح التطبيق،
# وينتظر علامتَي CLEANSHELF_SMOKE_OK (الواجهة + الجسر) و CLEANSHELF_SMOKE_SCAN
# (فحص الذاكرة عبر الكود الأصلي) في logcat. يُستدعى من GitHub Actions.
set -euo pipefail
APK="${1:-mobile/android/app/build/outputs/apk/release/CleanShelf.apk}"

adb install -r "$APK"
adb shell appops set com.alcode.cleanshelf MANAGE_EXTERNAL_STORAGE allow
adb shell mkdir -p /sdcard/Download
adb shell "echo junk > /sdcard/Download/smoke.tmp"
adb logcat -c
adb shell am start -n com.alcode.cleanshelf/.MainActivity

for i in $(seq 1 24); do
  sleep 5
  adb logcat -d > logcat.txt || true
  if grep -q "CLEANSHELF_SMOKE_SCAN" logcat.txt; then break; fi
done

adb exec-out screencap -p > android-smoke.png || true

echo "--- سطور الفحص ---"
grep -E "CLEANSHELF_SMOKE|AndroidRuntime|FATAL" logcat.txt || true

if ! adb shell dumpsys window | grep -E "mCurrentFocus|mFocusedApp" | grep -q cleanshelf; then
  echo "التطبيق ليس في المقدمة"; exit 1
fi
if ! grep -q "CLEANSHELF_SMOKE_OK" logcat.txt; then echo "لم تصل الواجهة أو الجسر"; exit 1; fi
if ! grep -q "CLEANSHELF_SMOKE_SCAN" logcat.txt; then echo "لم يكتمل فحص الذاكرة الأصلي"; exit 1; fi
if grep -q "FATAL EXCEPTION" logcat.txt; then echo "انهيار في التطبيق"; exit 1; fi
echo "فحص أندرويد نجح ✅"
