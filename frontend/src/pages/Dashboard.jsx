import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import '../App.css'

function ForecastChart({ rows, formatNumber }) {
  const chart = useMemo(() => {
    const normalized = rows
      .map((row) => ({
        ...row,
        predicted: Number(row.baseline_predicted_price ?? row.predicted_price),
        newsAdjusted: Number(row.news_adjusted_predicted_price ?? row.predicted_price),
        lower: Number(row.lower_bound),
        upper: Number(row.upper_bound),
      }))
      .filter((row) => (
        Number.isFinite(row.predicted)
        && Number.isFinite(row.newsAdjusted)
        && Number.isFinite(row.lower)
        && Number.isFinite(row.upper)
      ))

    if (normalized.length === 0) return null

    const width = 620
    const height = 210
    const padding = { top: 20, right: 22, bottom: 42, left: 54 }
    const minValue = Math.min(...normalized.flatMap((row) => [row.lower, row.newsAdjusted]))
    const maxValue = Math.max(...normalized.flatMap((row) => [row.upper, row.newsAdjusted]))
    const valueRange = maxValue - minValue || 1
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom
    const xStep = normalized.length > 1 ? innerWidth / (normalized.length - 1) : 0

    const pointFor = (row, value, index) => ({
      x: padding.left + (normalized.length > 1 ? index * xStep : innerWidth / 2),
      y: padding.top + ((maxValue - value) / valueRange) * innerHeight,
      row,
      value
    })

    const predictedPoints = normalized.map((row, index) => pointFor(row, row.predicted, index))
    const newsAdjustedPoints = normalized.map((row, index) => pointFor(row, row.newsAdjusted, index))
    const upperPoints = normalized.map((row, index) => pointFor(row, row.upper, index))
    const lowerPoints = normalized.map((row, index) => pointFor(row, row.lower, index))
    
    return {
      width, height, padding,
      bandPoints: [...upperPoints, ...lowerPoints.slice().reverse()].map(p => `${p.x},${p.y}`).join(' '),
      linePoints: predictedPoints.map(p => `${p.x},${p.y}`).join(' '),
      newsLinePoints: newsAdjustedPoints.map(p => `${p.x},${p.y}`).join(' '),
      predictedPoints,
      newsAdjustedPoints,
      maxValue, minValue
    }
  }, [rows])

  if (!chart) return null

  return (
    <div className="forecast-chart">
      <div className="chart-legend" style={{ marginBottom: '16px' }}>
        <span><i className="legend-line baseline" /> 예측 추세</span>
        <span><i className="legend-line news" /> 뉴스 반영</span>
      </div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`}>
        <polygon points={chart.bandPoints} className="chart-band" />
        <polyline points={chart.linePoints} className="chart-line" />
        <polyline points={chart.newsLinePoints} className="chart-line-news" />
        {chart.predictedPoints.map((p) => (
          <g key={p.row.horizon_days}>
            <circle cx={p.x} cy={p.y} r="4" fill="var(--primary)" />
            <text x={p.x} y={chart.height - 10} textAnchor="middle" fill="var(--text-dim)" fontSize="10">D+{p.row.horizon_days}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ChatPanel({ apiBaseUrl }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: '안녕하세요! 유가 분석 전문가 Oil Predict AI입니다. 궁금하신 점이 있나요?' }
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

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.response || '응답을 가져오지 못했습니다.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '죄송합니다. 서버 연결에 실패했습니다.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card chat-panel" style={{ display: 'flex', flexDirection: 'column', height: '400px', padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
        <h2 style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>AI MARKET CHAT</h2>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
            color: m.role === 'user' ? '#fff' : 'var(--text-main)',
            border: m.role === 'ai' ? '1px solid var(--border)' : 'none'
          }}>
            {m.text}
          </div>
        ))}
        {loading && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>AI가 생각 중입니다...</div>}
      </div>
      <form onSubmit={onSend} style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          placeholder="오늘 유가 전망은?" 
          style={{ flex: 1, padding: '8px 12px' }} 
        />
        <button type="submit" className="refresh-btn" style={{ padding: '8px 16px' }}>전송</button>
      </form>
    </div>
  )
}

function Dashboard() {
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({ realtime: null, forecast: [], briefing: null, purchaseScore: null })

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const endpoints = ['dashboard/realtime', 'forecast?horizon=7d', 'briefings/latest', 'purchase-score']
      const results = await Promise.all(endpoints.map(e => fetch(`${apiBaseUrl}/api/v1/${e}`).then(r => r.json())))
      setData({ realtime: results[0], forecast: results[1].predictions || [], briefing: results[2], purchaseScore: results[3] })
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const formatNumber = (v, d = 0) => v ? Number(v).toLocaleString('ko-KR', { maximumFractionDigits: d }) : '-'
  const actionClass = data.purchaseScore?.score >= 70 ? 'good' : data.purchaseScore?.score <= 40 ? 'bad' : 'mid'

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <span className="home-kicker">Intelligence Dashboard</span>
          <h1 className="text-gradient">시장 분석 및 구매 결정</h1>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className={`score-pill ${actionClass}`}>Score {data.purchaseScore?.score ?? '-'}</div>
          <button onClick={() => loadDashboard(true)} className="refresh-btn">데이터 갱신</button>
        </div>
      </header>

      {loading ? <p className="text-muted">분석 중...</p> : (
        <>
          <section className="grid cards-4">
            {[
              { label: 'WTI', val: data.realtime?.wti_usd, unit: 'USD/b' },
              { label: 'USD/KRW', val: data.realtime?.usd_krw, unit: 'KRW' },
              { label: '국내 휘발유', val: data.realtime?.domestic_avg_gasoline_krw, unit: '원/L' },
              { label: 'D+1 예측', val: data.purchaseScore?.predicted_tomorrow, unit: '원/L', highlight: true }
            ].map(m => (
              <article key={m.label} className={`metric ${m.highlight ? 'highlight' : ''}`}>
                <h2>{m.label}</h2>
                <p className="value">{formatNumber(m.val, 1)}</p>
                <span>{m.unit}</span>
              </article>
            ))}
          </section>

          <section className="grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
            <div className="grid" style={{ gridTemplateRows: 'auto 1fr' }}>
              <article className="card briefing-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1rem' }}>AI 시장 브리핑</h2>
                  <span className={`sentiment ${data.briefing?.sentiment}`} style={{ color: 'var(--primary)', fontWeight: 700 }}>{data.briefing?.sentiment?.toUpperCase()}</span>
                </div>
                <h3 style={{ marginBottom: '12px' }}>{data.briefing?.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.7 }}>{data.briefing?.summary}</p>
              </article>

              <article className="card">
                <h2 style={{ fontSize: '1rem', marginBottom: '20px' }}>7일 가격 예측 추세</h2>
                <ForecastChart rows={data.forecast} formatNumber={formatNumber} />
                <div className="table-wrap" style={{ marginTop: '20px' }}>
                  <table>
                    <thead>
                      <tr><th>날짜</th><th>예측가</th><th>뉴스 반영</th><th>변동</th></tr>
                    </thead>
                    <tbody>
                      {data.forecast.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td>{r.target_date}</td>
                          <td>{formatNumber(r.baseline_predicted_price)}</td>
                          <td>{formatNumber(r.news_adjusted_predicted_price)}</td>
                          <td style={{ color: r.news_adjustment > 0 ? 'var(--danger)' : 'var(--success)' }}>{r.news_adjustment > 0 ? '+' : ''}{r.news_adjustment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <div className="grid">
              <ChatPanel apiBaseUrl={apiBaseUrl} />
              
              <article className="card">
                <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>구매 판단 근거</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{data.purchaseScore?.reason}</p>
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {['예측 압력', '환율 부담', '뉴스 감성'].map((l, i) => (
                    <div key={l}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                        <span>{l}</span>
                        <span style={{ color: 'var(--primary)' }}>Stable</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${40 + i * 20}%`, height: '100%', background: 'var(--primary)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <footer className="app-footer">Oil Predict · AI-Powered Market Intelligence</footer>
        </>
      )}
    </div>
  )
}

export default Dashboard
