import { useEffect, useState } from 'react'
import { Native } from '../lib/native'
import { useApp } from '../lib/appContext'
import { useToast } from '../lib/toastContext'
import { t, type Lang } from '../lib/i18n'
import { ACCENTS, type ThemeMode } from '../lib/theme'
import { fmtNum, formatBytes } from '../lib/format'
import { tap, success } from '../lib/haptics'
import type { DeviceInfo } from '../lib/types'
import { Icon } from '../components/Icon'
import { Ico, Switch } from '../components/ui'

const RELEASES_URL = 'https://github.com/almarar88/cleanshelf/releases/latest'
const DAY_KEYS = ['set.sun', 'set.mon', 'set.tue', 'set.wed', 'set.thu', 'set.fri', 'set.sat']
const HOURS = [8, 10, 12, 15, 18, 19, 20, 21]

export function Settings(): JSX.Element {
  const { settings, updateSettings, permissions, refreshPermissions } = useApp()
  const { showToast } = useToast()
  const [info, setInfo] = useState<DeviceInfo | null>(null)

  useEffect(() => {
    Native.deviceInfo().then(setInfo).catch(() => setInfo(null))
  }, [])

  async function toggleNotifications(v: boolean): Promise<void> {
    if (v && !permissions.notifications) {
      await Native.requestNotifications().catch(() => undefined)
      await refreshPermissions()
    }
    updateSettings({ notifications: v })
  }

  function setReminder(patch: { enabled?: boolean; dayOfWeek?: number; hour?: number }): void {
    const enabled = patch.enabled ?? settings.reminderEnabled
    const dayOfWeek = patch.dayOfWeek ?? settings.reminderDay
    const hour = patch.hour ?? settings.reminderHour
    updateSettings({ reminderEnabled: enabled, reminderDay: dayOfWeek, reminderHour: hour })
    Native.setReminder({ enabled, dayOfWeek, hour }).catch(() => undefined)
  }

  function hourLabel(h: number): string {
    return `${fmtNum(h)}:00`
  }

  return (
    <div className="page no-tabs">
      {/* اللغة أولًا — أهم إعداد في هذا الإصدار */}
      <div className="section-title">{t('set.language')}</div>
      <div className="card card-pad">
        <div className="card-sub" style={{ marginBottom: 10 }}>{t('set.language.sub')}</div>
        <div className="segmented">
          {(['ar', 'en'] as Lang[]).map((l) => (
            <button key={l} className={settings.lang === l ? 'active' : ''} onClick={() => { tap(); updateSettings({ lang: l }) }}>
              {l === 'ar' ? t('set.arabic') : t('set.english')}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">{t('set.name')}</div>
      <div className="card card-pad">
        <div className="card-sub" style={{ marginBottom: 10 }}>{t('set.name.sub')}</div>
        <div className="field-row">
          <Icon name="heart" size={18} />
          <input
            type="text"
            value={settings.userName}
            maxLength={24}
            placeholder={t('set.namePlaceholder')}
            onChange={(e) => updateSettings({ userName: e.target.value })}
          />
        </div>
      </div>

      <div className="section-title">{t('set.appearance')}</div>
      <div className="card">
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div className="text"><div className="title">{t('set.theme')}</div></div>
          <div className="segmented">
            {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
              <button key={m} className={settings.theme === m ? 'active' : ''} onClick={() => { tap(); updateSettings({ theme: m }) }}>
                {t(`set.theme.${m}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div className="text"><div className="title">{t('set.accent')}</div><div className="desc">{t('set.accent.sub')}</div></div>
          <div className="swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.hue}
                className={`swatch ${settings.accentHue === a.hue ? 'active' : ''}`}
                style={{ background: `linear-gradient(135deg, ${a.yellow}, ${a.orange})` }}
                aria-label={a.name}
                onClick={() => { tap(); updateSettings({ accentHue: a.hue }) }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="section-title">{t('common.permission')}</div>
      <div className="card">
        <div className="row">
          <Ico name="shield" tone="tone-yellow" size="sm" />
          <div className="text"><div className="title">{t('perm.allFiles.label')}</div><div className="desc">{t('perm.allFiles.sub')}</div></div>
          {permissions.allFiles
            ? <span className="badge badge-safe"><Icon name="check" size={13} /> {t('common.granted')}</span>
            : <button className="btn btn-sm btn-dark" onClick={() => Native.requestAllFiles()}>{t('common.grant')}</button>}
        </div>
        <div className="row">
          <Ico name="clock" tone="tone-teal" size="sm" />
          <div className="text"><div className="title">{t('perm.usage.label')}</div><div className="desc">{t('perm.usage.sub')}</div></div>
          {permissions.usageStats
            ? <span className="badge badge-safe"><Icon name="check" size={13} /> {t('common.granted')}</span>
            : <button className="btn btn-sm" onClick={() => Native.requestUsageStats()}>{t('common.grant')}</button>}
        </div>
      </div>

      <div className="section-title">{t('set.behavior')}</div>
      <div className="card">
        <div className="row">
          <div className="text"><div className="title">{t('set.notif')}</div><div className="desc">{t('set.notif.sub')}</div></div>
          <Switch checked={settings.notifications} onChange={toggleNotifications} label={t('set.notif')} />
        </div>
        <div className="row">
          <div className="text"><div className="title">{t('set.autoscan')}</div><div className="desc">{t('set.autoscan.sub')}</div></div>
          <Switch checked={settings.scanOnLaunch} onChange={(v) => updateSettings({ scanOnLaunch: v })} label={t('set.autoscan')} />
        </div>
        <div className="row">
          <div className="text"><div className="title">{t('set.reminder')}</div><div className="desc">{t('set.reminder.sub')}</div></div>
          <Switch checked={settings.reminderEnabled} onChange={(v) => setReminder({ enabled: v })} label={t('set.reminder')} />
        </div>
        {settings.reminderEnabled && (
          <div className="row">
            <div className="text"><div className="title">{t('set.reminderWhen')}</div></div>
            <select value={settings.reminderDay} onChange={(e) => setReminder({ dayOfWeek: Number(e.target.value) })} style={{ width: 'auto', minWidth: 108 }}>
              {DAY_KEYS.map((k, i) => <option key={k} value={i + 1}>{t(k)}</option>)}
            </select>
            <select value={settings.reminderHour} onChange={(e) => setReminder({ hour: Number(e.target.value) })} style={{ width: 'auto', minWidth: 82 }}>
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
        )}
        <div className="row">
          <div className="text"><div className="title">{t('set.trashDays')}</div><div className="desc">{t('set.trashDays.sub')}</div></div>
          <select value={settings.trashRetentionDays} onChange={(e) => updateSettings({ trashRetentionDays: Number(e.target.value) })} style={{ width: 'auto', minWidth: 96 }}>
            {[3, 7, 14, 30, 60].map((d) => <option key={d} value={d}>{t('set.days', { n: fmtNum(d) })}</option>)}
          </select>
        </div>
      </div>

      <div className="section-title">{t('set.tools')}</div>
      <div className="card">
        <div className="row">
          <div className="text"><div className="title">{t('set.dlAge')}</div></div>
          <select value={settings.oldDownloadDays} onChange={(e) => updateSettings({ oldDownloadDays: Number(e.target.value) })} style={{ width: 'auto', minWidth: 96 }}>
            {[7, 14, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{t('set.days', { n: fmtNum(d) })}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="text"><div className="title">{t('set.shredPasses')}</div></div>
          <select value={settings.shredPasses} onChange={(e) => updateSettings({ shredPasses: Number(e.target.value) })} style={{ width: 'auto', minWidth: 96 }}>
            <option value={1}>{t('set.once')}</option>
            <option value={3}>{t('set.times', { n: fmtNum(3) })}</option>
            <option value={7}>{t('set.times', { n: fmtNum(7) })}</option>
          </select>
        </div>
        <div className="row">
          <div className="text"><div className="title">{t('set.ownCache')}</div><div className="desc">{t('set.ownCache.sub')}</div></div>
          <button className="btn btn-sm" onClick={() => Native.clearOwnCache().then((r) => { success(); showToast(t('set.freedToast', { size: formatBytes(r.freedBytes) })) })}>{t('set.clear')}</button>
        </div>
      </div>

      <div className="section-title">{t('set.homeScreen')}</div>
      <div className="card">
        <div className="row">
          <Ico name="widget" tone="tone-violet" size="sm" />
          <div className="text"><div className="title">{t('set.widget')}</div><div className="desc" style={{ whiteSpace: 'normal' }}>{t('set.widget.sub')}</div></div>
        </div>
      </div>

      <div className="section-title">{t('set.about')}</div>
      <div className="card">
        <div className="row">
          <span className="brand-mark" style={{ width: 40, height: 40 }}><Icon name="hourglass" size={21} strokeWidth={2.4} /></span>
          <div className="text"><div className="title">{t('app.name')} {info?.appVersion ?? ''}</div><div className="desc">{t('app.by')}</div></div>
        </div>
        <div className="row" onClick={() => { tap(); Native.openUrl({ url: RELEASES_URL }) }}>
          <Ico name="download" tone="tone-blue" size="sm" />
          <div className="text"><div className="title">{t('set.checkUpdate')}</div><div className="desc">{t('set.checkUpdate.sub')}</div></div>
          <Icon name="externalLink" size={16} className="muted" />
        </div>
      </div>
    </div>
  )
}
