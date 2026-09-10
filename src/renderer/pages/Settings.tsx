import { useEffect, useState } from 'react'
import type { AppInfo, AppSettings, PlatformInfo } from '../../shared/types'
import { ACCENTS, THEME_LABEL, type ThemeMode } from '../lib/theme'
import { t, useI18n, type Lang } from '../lib/i18n'
import { fmtNum } from '../lib/format'
import { Icon } from '../components/Icon'
import { Switch } from '../components/Switch'

const RELEASES_URL = 'https://github.com/almarar88/cleanshelf/releases/latest'

export function Settings({
  settings,
  onChange
}: {
  settings: AppSettings | null
  onChange: (patch: Partial<AppSettings>) => void
}): JSX.Element {
  const { lang, setLang } = useI18n()
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [platform, setPlatform] = useState<PlatformInfo | null>(null)

  function chooseLang(next: Lang): void {
    setLang(next)
    onChange({ lang: next })
  }

  useEffect(() => {
    window.api.system.appInfo().then(setInfo).catch(() => setInfo(null))
    window.api.platform.info().then(setPlatform).catch(() => setPlatform(null))
  }, [])

  if (!settings) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <Section icon="globe" title={t('set.language')} desc={t('set.language.sub')}>
        <div className="settings-row">
          <div className="text">
            <div className="title">{t('set.language')}</div>
            <div className="desc">{t('set.language.sub')}</div>
          </div>
          <div className="segmented">
            {(['ar', 'en'] as Lang[]).map((l) => (
              <button key={l} className={lang === l ? 'active' : ''} onClick={() => chooseLang(l)}>
                {l === 'ar' ? t('set.arabic') : t('set.english')}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section icon="palette" title={t('set.appearance')} desc={t('set.appearance.sub')}>
        <div className="settings-row">
          <div className="text">
            <div className="title">{t('set.theme')}</div>
            <div className="desc">{t('set.theme.sub', { os: t(platform?.isMac ? 'os.mac' : 'os.windows') })}</div>
          </div>
          <div className="segmented">
            {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
              <button key={m} className={settings.theme === m ? 'active' : ''} onClick={() => onChange({ theme: m })}>
                {t(THEME_LABEL[m])}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div className="text">
            <div className="title">{t('set.accent')}</div>
            <div className="desc">{t('set.accent.sub2')}</div>
          </div>
          <div className="swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.hue}
                className={`swatch ${settings.accentHue === a.hue ? 'active' : ''}`}
                style={{ background: `linear-gradient(135deg, ${a.yellow}, ${a.orange})` }}
                title={a.name}
                aria-label={a.name}
                onClick={() => onChange({ accentHue: a.hue })}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section icon="cog" title={t('set.behavior')} desc={t('set.behavior.sub')}>
        <Row title={t('set.tray')} desc={t('set.tray.sub2')}>
          <Switch checked={settings.minimizeToTray} onChange={(v) => onChange({ minimizeToTray: v })} label={t('set.tray')} />
        </Row>
        <Row title={t('set.launch')} desc={t('set.launch.sub2')}>
          <Switch checked={settings.launchAtLogin} onChange={(v) => onChange({ launchAtLogin: v })} label={t('set.launch')} />
        </Row>
        <Row title={t('set.notif')} desc={t('set.notif.sub2')}>
          <Switch checked={settings.notifications} onChange={(v) => onChange({ notifications: v })} label={t('set.notif')} />
        </Row>
        <Row title={t('set.autoscan')} desc={t('set.autoscan.sub2')}>
          <Switch checked={settings.scanOnLaunch} onChange={(v) => onChange({ scanOnLaunch: v })} label={t('set.autoscan')} />
        </Row>
      </Section>

      <Section icon="layers" title={t('set.tools')} desc={t('set.tools.sub')}>
        <Row title={t('set.dlAge')} desc={t('set.dlAge.sub')}>
          <select value={settings.oldDownloadDays} onChange={(e) => onChange({ oldDownloadDays: Number(e.target.value) })}>
            {[7, 14, 30, 60, 90, 180].map((d) => (
              <option key={d} value={d}>{t('set.daysN', { n: fmtNum(d) })}</option>
            ))}
          </select>
        </Row>
        <Row title={t('set.shredPasses')} desc={t('set.shred.sub')}>
          <select value={settings.shredPasses} onChange={(e) => onChange({ shredPasses: Number(e.target.value) })}>
            <option value={1}>{t('set.shred.1')}</option>
            <option value={3}>{t('set.shred.3')}</option>
            <option value={7}>{t('set.shred.7')}</option>
          </select>
        </Row>
      </Section>

      <Section icon="info" title={t('set.about')} desc="">
        <div className="settings-row">
          <div className="brand-badge" style={{ width: 44, height: 44, borderRadius: 13 }}>
            <Icon name="logo" size={22} />
          </div>
          <div className="text">
            <div className="title">{info ? `${info.name} ${info.version}` : t('app.name')}</div>
            <div className="desc">{t('app.byShort', { company: info?.company ?? 'Alcode' })} — {t('set.forWinMac')}</div>
          </div>
          <button className="btn btn-sm" onClick={() => window.api.app.openExternal(RELEASES_URL)}>
            <Icon name="externalLink" size={14} /> {t('set.checkUpdate')}
          </button>
        </div>
      </Section>
    </div>
  )
}

function Section({ icon, title, desc, children }: { icon: 'palette' | 'cog' | 'layers' | 'info' | 'globe'; title: string; desc: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div className="tile-icon" style={{ width: 32, height: 32, borderRadius: 9 }}>
          <Icon name={icon} size={16} />
        </div>
        <div>
          <div className="card-title" style={{ marginBottom: 0 }}>{title}</div>
          {desc && <div className="card-sub">{desc}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="settings-row">
      <div className="text">
        <div className="title">{title}</div>
        <div className="desc">{desc}</div>
      </div>
      {children}
    </div>
  )
}
