import { useApp } from '../lib/appContext'
import { PAGE_META, TOOL_PAGES } from '../lib/nav'
import { Icon } from '../components/Icon'

export function More(): JSX.Element {
  const { navigate } = useApp()
  return (
    <div className="page">
      <div className="grid grid-2">
        {TOOL_PAGES.map((id) => {
          const m = PAGE_META[id]
          return (
            <div key={id} className="card tool-tile" onClick={() => navigate(id)}>
              <div className={`tile-icon ${m.tone ?? ''}`}><Icon name={m.icon} size={20} /></div>
              <div>
                <div className="card-title">{m.title}</div>
                <div className="card-sub">{m.sub}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="section-title">التطبيق</div>
      <div className="card">
        <div className="row" onClick={() => navigate('settings')}>
          <div className="tile-icon sm"><Icon name="cog" size={17} /></div>
          <div className="text"><div className="title">الإعدادات</div><div className="desc">المظهر، الإشعارات، سلة المهملات، الأدوات</div></div>
          <Icon name="chevron" size={15} className="muted" style={{ transform: 'scaleX(-1)' }} />
        </div>
      </div>
    </div>
  )
}
