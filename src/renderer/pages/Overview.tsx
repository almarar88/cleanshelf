import { useEffect, useState } from 'react'
import type { HealthReport, SystemSummary } from '../../shared/types'
import { formatBytes, splitBytes } from '../lib/format'
import { forecastDays, loadTrend, recordTrend, type TrendPoint } from '../lib/trend'
import { planSummary } from '../lib/plan'
import { Icon } from '../components/Icon'
import { EmptyState, Ico } from '../components/ui'
import { PAGE_META, type PageId } from '../lib/pages'

interface Opportunity {
  id: PageId
  title: string
  detail: string
  bytes: number
}

export function Overview({ onNavigate }: { onNavigate: (id: PageId) => void }): JSX.Element {
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>(loadTrend)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      window.api.system.summary().catch(() => null),
      window.api.health.compute().catch(() => null)
    ]).then(([s, h]) => {
      if (!alive) return
      setSummary(s)
      setHealth(h)
      const d = s?.disks.find((x) => x.mount === '/' || /^C:/i.test(x.mount)) ?? s?.disks[0]
      if (d) setTrend(recordTrend(d.freeBytes))
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const disk = summary?.disks.find((d) => d.mount === '/' || /^C:/i.test(d.mount)) ?? summary?.disks[0]
  const freeNow = disk?.freeBytes ?? 0
  const forecast = forecastDays(trend, freeNow)
  const freePct = disk && disk.totalBytes ? Math.round((disk.freeBytes / disk.totalBytes) * 100) : null
  const plan = planSummary()

  const headline =
    freePct === null
      ? 'نقيس مساحة قرصك…'
      : freePct < 10
        ? 'قرصك على وشك الامتلاء'
        : freePct < 25
          ? 'مساحة قرصك تتناقص'
          : 'مساحة قرصك بحالة جيدة'

  const opportunities: Opportunity[] = []
  if (health && health.cleanableBytes > 0) {
    opportunities.push({
      id: 'cleaner',
      title: PAGE_META.cleaner.title,
      detail: `${formatBytes(health.cleanableBytes)} من الملفات المؤقتة والذواكر`,
      bytes: health.cleanableBytes
    })
  }
  opportunities.push(
    { id: 'duplicates', title: PAGE_META.duplicates.title, detail: 'نسخ متطابقة تهدر المساحة بلا فائدة', bytes: 0 },
    { id: 'largefiles', title: PAGE_META.largefiles.title, detail: 'أكبر الملفات المستهلكة للمساحة', bytes: 0 },
    { id: 'downloads', title: PAGE_META.downloads.title, detail: 'ما نسيته في مجلد التنزيلات منذ شهور', bytes: 0 }
  )
  const top = opportunities[0]
  const rest = opportunities.slice(1)
  const freeSplit = splitBytes(freeNow)

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="display" style={{ flex: 1, minWidth: 260 }}>{headline}</h1>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
          {rest.slice(0, 2).map((o, i) => (
            <span key={o.id} className={`ico ${PAGE_META[o.id].tone}`} style={{ marginInlineStart: i ? -14 : 0, border: '2px solid var(--bg)' }}>
              <Icon name={PAGE_META[o.id].icon} size={18} />
            </span>
          ))}
          {rest.length > 2 && (
            <span className="ico tone-ink" style={{ marginInlineStart: -14, border: '2px solid var(--bg)', fontSize: 12.5, fontWeight: 800 }}>
              +{rest.length - 2}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <div className="card-sub">المساحة المتاحة</div>
          <div className="display sm" style={{ margin: '4px 0 0' }}>
            {freeSplit.value}
            <small>{freeSplit.unit}</small>
          </div>
          {freePct !== null && (
            <div className="bar warm" style={{ marginTop: 12 }}>
              <div style={{ width: `${100 - freePct}%` }} />
            </div>
          )}
        </div>
        <div className="card card-pad">
          <div className="card-sub">يُستهلك يوميًا</div>
          <div className="display sm" style={{ margin: '4px 0 0' }}>
            {forecast.perDay > 0 ? splitBytes(forecast.perDay).value : '—'}
            {forecast.perDay > 0 && <small>{splitBytes(forecast.perDay).unit}</small>}
          </div>
          <div className="card-sub" style={{ marginTop: 10, whiteSpace: 'normal' }}>
            {forecast.perDay > 0 ? 'متوسط ما تستهلكه مساحتك كل يوم' : 'نحتاج بضعة أيام من القياسات'}
          </div>
        </div>
        <div className="card card-pad">
          <div className="card-sub">توقّع امتلاء القرص</div>
          <div className="display sm" style={{ margin: '4px 0 0' }}>
            {forecast.days === null ? '—' : forecast.days}
            {forecast.days !== null && <small>يوم</small>}
          </div>
          <div className="card-sub" style={{ marginTop: 10, whiteSpace: 'normal' }}>
            {forecast.days === null
              ? 'يُحسب من قياسات الأيام السابقة'
              : `بهذا المعدّل يمتلئ القرص بعد نحو ${forecast.days} يومًا`}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad"><div className="skeleton" style={{ height: 120 }} /></div>
      ) : (
        <>
          <div className="section-title">أكبر فرصة تنظيف</div>
          <section className="tile dark" style={{ marginBottom: 16 }} onClick={() => onNavigate(top.id)}>
            <div className="tile-head">
              <span className="badge badge-yellow"><Icon name="trendUp" size={14} /> أثر كبير</span>
              <span className="tile-btn" style={{ marginInlineStart: 'auto' }}><Icon name={PAGE_META[top.id].icon} size={17} /></span>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '18px 0 6px' }}>{top.title}</h2>
            <div style={{ fontSize: 14, opacity: 0.72, fontWeight: 600 }}>{top.detail}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22, alignItems: 'center' }}>
              <button className="btn" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }} onClick={() => onNavigate(top.id)}>
                عرض التفاصيل <Icon name="arrowRight" size={16} className="flip-rtl" />
              </button>
              <span className="fab" style={{ background: 'var(--yellow)', color: 'var(--ink)' }}>
                <Icon name="sparkles" size={20} />
              </span>
            </div>
          </section>

          <div className="section-title">فرص أخرى</div>
          <div className="card" style={{ marginBottom: 16 }}>
            {rest.map((o) => (
              <div key={o.id} className="row" onClick={() => onNavigate(o.id)}>
                <Ico name={PAGE_META[o.id].icon} tone={PAGE_META[o.id].tone} size="sm" />
                <div className="text">
                  <div className="title">{o.title}</div>
                  <div className="desc">{o.detail}</div>
                </div>
                <Icon name="chevron" size={16} className="muted flip-rtl" />
              </div>
            ))}
          </div>

          <div className="section-title">
            مهام الخطة
            <button className="more" onClick={() => onNavigate('plan')}>عرض الكل</button>
          </div>
          {plan.tasks.filter((t) => t.state !== 'done').length === 0 ? (
            <EmptyState icon="checkCircle" tone="tone-green" text="كل مهام الخطة منجزة — جهازك في أفضل حال" />
          ) : (
            <div className="card">
              {plan.tasks
                .filter((t) => t.state !== 'done')
                .slice(0, 4)
                .map((t) => (
                  <div key={t.id} className="row" onClick={() => onNavigate(t.page)}>
                    <Ico name={t.icon} tone={t.tone} size="sm" />
                    <div className="text">
                      <div className="title">{t.label}</div>
                      <div className="desc">{t.daysAgo === null ? 'لم تُنفَّذ بعد' : `آخر مرة قبل ${t.daysAgo} يوم`} • كل {t.everyDays} يوم</div>
                    </div>
                    <span className={`badge ${t.state === 'overdue' ? 'badge-danger' : 'badge-caution'}`}>
                      {t.state === 'overdue' ? 'متأخرة' : 'مستحقة'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
