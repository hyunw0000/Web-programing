import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import '../App.css'

function ForecastChart({ rows, formatNumber }) {
  const chartRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 200 })

  useEffect(() => {
    const updateSize = () => {
      if (chartRef.current) {
        setDimensions({
          width: chartRef.current.offsetWidth,
          height: 200
        })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const chart = useMemo(() => {
    const normalized = rows
      .map((row) => ({
        ...row,
        predicted: Number(row.baseline_predicted_price ?? row.predicted_price),
        newsAdjusted: Number(row.news_adjusted_predicted_price ?? row.predicted_price),
        lower: Number(row.lower_bound),
        upper: Number(row.upper_bound),
      }))
      .filter((row) => Number.isFinite(row.predicted))

    if (normalized.length === 0) return null

    const { width, height } = dimensions
    const padding = { top: 20, right: 30, bottom: 40, left: 60 }
    const minValue = Math.min(...normalized.flatMap(r => [r.lower, r.newsAdjusted])) - 5
    const maxValue = Math.max(...normalized.flatMap(r => [r.upper, r.newsAdjusted])) + 5
    const valueRange = maxValue - minValue || 1
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom
    const xStep = normalized.length > 1 ? innerWidth / (normalized.length - 1) : 0

    const pt = (index, val) => ({
      x: padding.left + index * xStep,
      y: padding.top + ((maxValue - val) / valueRange) * innerHeight
    })

    const predPts = normalized.map((r, i) => pt(i, r.predicted))
    const newsPts = normalized.map((r, i) => pt(i, r.newsAdjusted))
    const upperPts = normalized.map((r, i) => pt(i, r.upper))
    const lowerPts = normalized.map((r, i) => pt(i, r.lower))

    return {
      width, height,
      band: [...upperPts, ...lowerPts.reverse()].map(p => `${p.x},${p.y}`).join(' '),
      line: predPts.map(p => `${p.x},${p.y}`).join(' '),
      newsLine: newsPts.map(p => `${p.x},${p.y}`).join(' '),
      points: predPts,
      labels: normalized.map(r => `D+${r.horizon_days}`)
    }
  }, [rows, dimensions])

  if (!chart) return <p className="text-dim">차트 데이터를 준비 중입니다.</p>

  return (
    <div ref={chartRef} style={{ width: '100%', marginTop: '20px' }}>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="dot" style={{ backgroundColor: 'var(--primary)' }} />
          <span>기본 예측</span>
        </div>
        <div className="legend-item">
          <span className="dot" style={{ backgroundColor: 'var(--warning)' }} />
          <span>뉴스 보정</span>
        </div>
      </div>
      <svg width="100%" height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`}>
        <polygon points={chart.band} fill="rgba(56, 189, 248, 0.05)" />
        <polyline points={chart.line} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
        <polyline points={chart.newsLine} fill="none" stroke="var(--warning)" strokeWidth="3" strokeDasharray="6" />
        {chart.points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="var(--primary)" />
            <text x={p.x} y={chart.height - 5} textAnchor="middle" fill="var(--text-dim)" fontSize="11">{chart.labels[i]}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ChatPanel({ apiBaseUrl }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: '안녕하세요! 오일 프리딕트 AI입니다. 유가 전망에 대해 무엇이든 물어보세요.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const onSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.response }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '서버 연결에 실패했습니다.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className="card chat-card">
      <div className="chat-header">AI Market Assistant</div>
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'ai' ? 'msg-ai' : 'msg-user'}>{m.text}</div>
        ))}
        {loading && <div className="text-dim" style={{ fontSize: '0.8rem' }}>AI 분석 중...</div>}
      </div>
      <form className="chat-input" onSubmit={onSend}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="메시지를 입력하세요..." />
        <button type="submit" className="btn-primary">전송</button>
      </form>
    </article>
  )
}

function Dashboard() {
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', [])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ realtime: null, forecast: [], briefing: null, purchaseScore: null })

  const loadData = useCallback(async () => {
    try {
      const endpoints = ['dashboard/realtime', 'forecast?horizon=7d', 'briefings/latest', 'purchase-score']
      const res = await Promise.all(endpoints.map(e => fetch(`${apiBaseUrl}/api/v1/${e}`).then(r => r.json())))
      setData({ realtime: res[0], forecast: res[1].predictions || [], briefing: res[2], purchaseScore: res[3] })
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (v, d = 0) => v ? Number(v).toLocaleString('ko-KR', { maximumFractionDigits: d }) : '-'

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <div className="header-title">
          <h1>Market Analysis</h1>
          <p>실시간 데이터 기반 통합 대시보드</p>
        </div>
        <div className="header-actions">
          <div className="card metric-card active" style={{ padding: '12px 24px' }}>
            <div className="metric-label">Purchase Score</div>
            <div className="metric-value" style={{ fontSize: '1.25rem' }}>{data.purchaseScore?.score ?? '-'}</div>
          </div>
          <button className="btn-primary" onClick={loadData}>Refresh</button>
        </div>
      </header>

      {loading ? <p className="text-muted">데이터를 로드하는 중입니다...</p> : (
        <>
          <section className="grid grid-4">
            <article className="card metric-card">
              <p className="metric-label">WTI Crude</p>
              <h2 className="metric-value">{fmt(data.realtime?.wti_usd, 1)}<span className="metric-unit">USD/b</span></h2>
            </article>
            <article className="card metric-card">
              <p className="metric-label">USD / KRW</p>
              <h2 className="metric-value">{fmt(data.realtime?.usd_krw, 1)}<span className="metric-unit">KRW</span></h2>
            </article>
            <article className="card metric-card">
              <p className="metric-label">국내 휘발유 평균</p>
              <h2 className="metric-value">{fmt(data.realtime?.domestic_avg_gasoline_krw, 0)}<span className="metric-unit">원/L</span></h2>
            </article>
            <article className="card metric-card active">
              <p className="metric-label" style={{ color: 'var(--primary)' }}>D+1 예측가</p>
              <h2 className="metric-value">{fmt(data.purchaseScore?.predicted_tomorrow, 0)}<span className="metric-unit">원/L</span></h2>
            </article>
          </section>

          <section className="grid grid-main">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <article className="card briefing-card">
                <span className="card-title">AI Briefing</span>
                <h2>{data.briefing?.title || '시장 요약 정보가 없습니다.'}</h2>
                <p className="briefing-summary">{data.briefing?.summary}</p>
              </article>

              <article className="card">
                <span className="card-title">Price Forecast</span>
                <ForecastChart rows={data.forecast} formatNumber={fmt} />
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Forecast</th><th>Adjusted</th><th>Variation</th></tr>
                    </thead>
                    <tbody>
                      {data.forecast.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td className="text-dim">{r.target_date}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(r.baseline_predicted_price)}</td>
                          <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{fmt(r.news_adjusted_predicted_price)}</td>
                          <td style={{ color: r.news_adjustment > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                            {r.news_adjustment > 0 ? '+' : ''}{fmt(r.news_adjustment)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ChatPanel apiBaseUrl={apiBaseUrl} />
              
              <article className="card">
                <span className="card-title">Decision Basis</span>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px' }}>{data.purchaseScore?.reason}</p>
                {[
                  { label: 'Forecast Pressure', val: 75 },
                  { label: 'Currency Risk', val: 40 },
                  { label: 'Sentiment Index', val: 60 }
                ].map(f => (
                  <div key={f.label} className="factor-bar">
                    <div className="factor-header">
                      <span>{f.label}</span>
                      <span style={{ color: 'var(--primary)' }}>Stable</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${f.val}%` }} />
                    </div>
                  </div>
                ))}
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default Dashboard
