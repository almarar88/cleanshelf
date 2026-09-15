import { Fragment, useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import type { ProcessEntry } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { fmtNum } from '../lib/format'
import { t, useI18n } from '../lib/i18n'
import { ExplainPanel, useAiReady } from '../components/Explain'

type SortKey = 'memoryBytes' | 'cpuPercent' | 'name'

export function Processes(): JSX.Element {
  const { showToast } = useToast()
  const { lang } = useI18n()
  const ai = useAiReady()
  const [explainPid, setExplainPid] = useState<number | null>(null)
  const [processes, setProcesses] = useState<ProcessEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('memoryBytes')
  const [autoRefresh, setAutoRefresh] = useState(false)

  async function load(): Promise<void> {
    try {
      setProcesses(await window.api.proc.list())
    } catch (err) {
      showToast(t('pr.failed', { msg: (err as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? processes.filter((p) => p.name.toLowerCase().includes(q)) : processes
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      return b[sortKey] - a[sortKey]
    })
  }, [processes, query, sortKey])

  const totalMemory = visible.reduce((sum, p) => sum + p.memoryBytes, 0)

  async function kill(p: ProcessEntry): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(
      t('pr.killConfirm', { name: p.name }),
      t('pr.killDetail')
    )
    if (!confirmed) return
    const result = await window.api.proc.kill(p.pid)
    showToast(result.message)
    if (result.success) load()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          placeholder={t('pr.searchPh')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 240 }}
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="memoryBytes">{t('pr.sortMem')}</option>
          <option value="cpuPercent">{t('pr.sortCpu')}</option>
          <option value="name">{t('pr.sortName')}</option>
        </select>
        <label className="checkbox-row" style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          {t('pr.autoRefresh')}
        </label>
        <div className="spacer" />
        <span className="muted">
          {loading ? t('common.loading') : t('pr.count', { n: fmtNum(visible.length), size: formatBytes(totalMemory) })}
        </span>
        <button className="btn btn-sm" onClick={load}>
          <Icon name="refresh" size={15} /> {t('common.refresh')}
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('pr.thPid')}</th>
              <th>{t('dash.cpu')}</th>
              <th>{t('pr.thMem')}</th>
              <th>{t('pr.thUser')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 300).map((p) => (
              <Fragment key={p.pid}>
                <tr>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="muted">{p.pid}</td>
                  <td>{p.cpuPercent}%</td>
                  <td>{formatBytes(p.memoryBytes)}</td>
                  <td className="muted">{p.user || '—'}</td>
                  <td className="row-actions">
                    {ai.ready && (
                      <button
                        className={`btn btn-sm btn-ghost explain-btn${explainPid === p.pid ? ' on' : ''}`}
                        title={t('ai.explainBtn')}
                        onClick={() => setExplainPid(explainPid === p.pid ? null : p.pid)}
                      >
                        <Icon name="brain" size={14} />
                      </button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => kill(p)}>
                      {t('pr.kill')}
                    </button>
                  </td>
                </tr>
                {ai.ready && explainPid === p.pid && (
                  <tr className="explain-row">
                    <td colSpan={6}>
                      <ExplainPanel
                        question={t('ai.explainProcess')}
                        context={`${p.name} • PID ${p.pid} • CPU ${p.cpuPercent}% • RAM ${formatBytes(p.memoryBytes)} • ${p.user || '—'}`}
                        lang={lang}
                        model={ai.model}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
