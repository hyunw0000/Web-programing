import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'

function ForecastChart({ rows, formatNumber }) {
  const chartRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 260 })
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    const updateSize = () => {
      if (chartRef.current) setDimensions({ width: chartRef.current.offsetWidth, height: 260 })
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const chart = useMemo(() => {
    const normalized = rows
      .map((row) => ({
        date: row.target_date,
        day: `D+${row.horizon_days}`,
        base: Number(row.baseline_predicted_price ?? row.predicted_price),
        news: Number(row.news_adjusted_predicted_price ?? row.predicted_price),
      }))
      .filter((row) => Number.isFinite(row.base))

    if (normalized.length === 0) return null

    const { width, height } = dimensions
    const padding = { top: 40, right: 20, bottom: 40, left: 60 }
    const minVal = Math.min(...normalized.flatMap(r => [r.base, r.news]))
    const maxVal = Math.max(...normalized.flatMap(r => [r.base, r.news]))
    const range = (maxVal - minVal) * 1.5 || 10
    const min = minVal - (range - (maxVal - minVal)) / 2
    
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom
    const groupGap = innerWidth / (normalized.length || 1)

    return {
      width, height, min, range, innerHeight, padding,
      bars: normalized.map((r, i) => {
        const x = padding.left + i * groupGap + (groupGap / 2 - 15)
        return {
          ...r,
          x,
          baseX: x,
          newsX: x + 15,
          hBase: ((r.base - min) / range) * innerHeight,
          hNews: ((r.news - min) / range) * innerHeight
        }
      })
    }
  }, [rows, dimensions])

  if (!chart) return <p className="text-dim">데이터 분석 중...</p>

  return (
    <div ref={chartRef} style={{ width: '100%', marginTop: '20px', position: 'relative' }}>
      <div className="chart-legend" style={{ display: 'flex', gap: '20px', fontSize: '0.75rem', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: 'var(--primary)' }} /> 기본 예측</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', background: 'var(--warning)' }} /> 뉴스 반영</div>
      </div>
      
      <svg width="100%" height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ overflow: 'visible' }}>
        {[0, 0.5, 1].map(p => {
          const val = chart.min + (p * chart.range)
          const y = chart.height - chart.padding.bottom - (p * chart.innerHeight)
          return (
            <g key={p}>
              <text x={chart.padding.left - 10} y={y + 4} textAnchor="end" fill="var(--text-dim)" fontSize="10">{val.toFixed(0)}</text>
              <line x1={chart.padding.left} y1={y} x2={chart.width - chart.padding.right} y2={y} stroke="var(--border)" strokeDasharray="4" />
            </g>
          )
        })}

        {chart.bars.map((b, i) => (
          <g key={i} onMouseEnter={() => setHovered(b)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
            <rect x={b.baseX} y={chart.height - b.hBase - chart.padding.bottom} width={15} height={b.hBase} fill="var(--primary)" rx="1" />
            <rect x={b.newsX} y={chart.height - b.hNews - chart.padding.bottom} width={15} height={b.hNews} fill="var(--warning)" rx="1" />
            <text x={b.baseX + 15} y={chart.height - 20} textAnchor="middle" fill="var(--text-dim)" fontSize="10">{b.day}</text>
          </g>
        ))}

        {hovered && (
          <g transform={`translate(${hovered.x}, ${chart.height - Math.max(hovered.hBase, hovered.hNews) - chart.padding.bottom - 50})`}>
            <rect width="120" height="45" rx="6" fill="var(--bg-card)" stroke="var(--primary)" />
            <text x="60" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">{hovered.day} 상세</text>
            <text x="5" y="38" fill="var(--primary)" fontSize="10">기본: {hovered.base.toLocaleString()}</text>
            <text x="65" y="38" fill="var(--warning)" fontSize="10">뉴스: {hovered.news.toLocaleString()}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

function SideDrawer({ isOpen, onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: isOpen ? 0 : '-400px', width: '400px', height: '100%',
      background: 'var(--bg-card)', borderRight: '1px solid var(--border)', zIndex: 1000,
      transition: 'left 0.3s ease', padding: '40px', boxShadow: '10px 0 30px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <h2 style={{ color: '#fff' }}>점수 산정 원리</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Purchase Score는 단기/중기 가격 예측치를 가중 평균하여 산출된 0~100점 지표입니다.</p>
      
      <div className="card" style={{ background: 'var(--bg-input)', padding: '20px', marginBottom: '20px' }}>
        <h4 style={{ color: 'var(--primary)', marginBottom: '10px' }}>산식</h4>
        <p style={{ fontSize: '0.85rem', color: '#fff' }}>Score = 50 + (예측 변동폭 × 2.5)</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)' }} />
          <span style={{ fontWeight: 700, color: '#fff' }}>70점 이상 (오늘 구매)</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '22px' }}>단기 상승 가능성이 높아 오늘 선구매가 유리합니다.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--warning)' }} />
          <span style={{ fontWeight: 700, color: '#fff' }}>40~69점 (분할 구매)</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '22px' }}>가격 방향성이 혼조세입니다. 리스크 관리를 위해 나누어 구매하세요.</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--danger)' }} />
          <span style={{ fontWeight: 700, color: '#fff' }}>40점 이하 (관망)</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '22px' }}>가격 하락 가능성이 있어 관망 전략이 유리합니다.</p>
      </div>
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

function ChatDrawer({ isOpen, onClose, apiBaseUrl }) {
  return (
    <div style={{
      position: 'fixed', top: 0, right: isOpen ? 0 : '-400px', width: '400px', height: '100%',
      background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 1000,
      transition: 'right 0.3s ease', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
    }}>
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ color: '#fff', fontSize: '1.2rem' }}>AI Market Assistant</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
      </div>
      <div style={{ height: 'calc(100% - 160px)', overflowY: 'auto', padding: '20px' }}>
        <ChatPanel apiBaseUrl={apiBaseUrl} />
      </div>
    </div>
  )
}

function Dashboard() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [historicalData, setHistoricalData] = useState({ symbol: null, history: [] })
  const [historyDays, setHistoryDays] = useState(30)
  
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', [])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ realtime: null, forecast: [], briefing: null, purchaseScore: null })

  const [chartData, setChartData] = useState([])
  const [chartTitle, setChartTitle] = useState('Price Forecast')
  const [isHistorical, setIsHistorical] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. 트리거: 시장 데이터 수집 -> 예측 생성 -> 브리핑 생성
      await fetch(`${apiBaseUrl}/api/v1/dashboard/refresh`, { method: 'POST' })
      
      // 2. 대시보드 데이터 조회
      const endpoints = ['dashboard/realtime', 'forecast?horizon=7d', 'briefings/latest', 'purchase-score']
      const res = await Promise.all(endpoints.map(e => fetch(`${apiBaseUrl}/api/v1/${e}`).then(r => r.json())))
      
      setData({ realtime: res[0], forecast: res[1].predictions || [], briefing: res[2], purchaseScore: res[3] })
      setChartData(res[1].predictions || [])
      setChartTitle('Price Forecast')
      setIsHistorical(false)
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  const [historyRange, setHistoryRange] = useState({ 
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  const loadHistory = async (symbol, label, range = historyRange) => {
    try {
      const url = `${apiBaseUrl}/api/v1/history?symbol=${symbol}&start_date=${range.start}&end_date=${range.end}`
      const res = await fetch(url)
      const result = await res.json()
      setHistoricalData(result)
      const transformed = result.history.map(h => ({
        target_date: h.date,
        horizon_days: '',
        baseline_predicted_price: h.value,
        news_adjusted_predicted_price: h.value
      }))
      setChartData(transformed)
      setChartTitle(`${label} Trend (${range.start} ~ ${range.end})`)
      setIsHistorical(true)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }

  useEffect(() => { loadData() }, [loadData])

  const fmt = (v, d = 0) => v ? Number(v).toLocaleString('ko-KR', { maximumFractionDigits: d }) : '-'

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <Link to="/" className="brand-mark" style={{ fontSize: '1.25rem' }}>Oil Predict</Link>
            <Link to="/" style={{ 
              color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)'
            }}>← 홈으로</Link>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ marginBottom: '4px' }}>Market Analysis</h1>
              <p>실시간 데이터 기반 통합 대시보드</p>
            </div>
            
            <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
              <div 
                className="card metric-card active" 
                style={{ padding: '8px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0 }} 
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              >
                <div className="metric-label" style={{ fontSize: '0.6rem', marginBottom: 0 }}>Score ℹ</div>
                <div className="metric-value" style={{ fontSize: '1rem', margin: 0 }}>{data.purchaseScore?.score ?? '-'}</div>
              </div>
              <button className="btn-primary" onClick={() => setIsChatOpen(!isChatOpen)}>AI Chat</button>
              <button className="btn-primary" onClick={loadData}>Refresh</button>
            </div>
          </div>
        </div>
      </header>

      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} apiBaseUrl={apiBaseUrl} />

      {loading ? <p className="text-muted">데이터를 로드하는 중입니다...</p> : (
        <>
          <section className="grid grid-4">
            {[
              { label: 'WTI Crude', val: data.realtime?.wti_usd, unit: 'USD/b', symbol: 'WTI' },
              { label: 'USD / KRW', val: data.realtime?.usd_krw, unit: 'KRW', symbol: 'USDKRW' },
              { label: '국내 휘발유 평균', val: data.realtime?.domestic_avg_gasoline_krw, unit: '원/L', symbol: 'DOMESTIC_GASOLINE_AVG' },
              { 
                label: 'D+1 예측가', 
                val: data.purchaseScore?.predicted_tomorrow, 
                unit: '원/L', 
                symbol: 'PREDICT' 
              }
            ].map((m, i) => {
              const cardContent = (
                <article 
                  key={m.label} 
                  className={`card metric-card`}
                  style={{ border: '1px solid var(--border)' }}
                >
                  <p className="metric-label">{m.label}</p>
                  <h2 className="metric-value">{fmt(m.val, 1)}<span className="metric-unit">{m.unit}</span></h2>
                  {m.symbol && m.symbol !== 'PREDICT' && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '8px', display: 'block' }}>클릭하여 히스토리 분석 이동 →</span>}
                  {m.symbol === 'PREDICT' && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '8px', display: 'block' }}>클릭하여 상세 예측 분석 →</span>}
                </article>
              );

              return m.symbol === 'PREDICT' ? (
                <Link key={m.label} to={`/prediction-detail`} style={{ textDecoration: 'none' }}>
                  {cardContent}
                </Link>
              ) : m.symbol ? (
                <Link key={m.label} to={`/history/${m.symbol}`} style={{ textDecoration: 'none' }}>
                  {cardContent}
                </Link>
              ) : cardContent;
            })}
          </section>

          <section className="grid grid-main">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <article className="card briefing-card">
                <span className="card-title">AI Briefing</span>
                <h2>{data.briefing?.title || '시장 요약 정보가 없습니다.'}</h2>
                <p className="briefing-summary">{data.briefing?.summary}</p>
              </article>

              <article className="card">
                <span className="card-title">{chartTitle}</span>
                <ForecastChart rows={chartData} formatNumber={fmt} />
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        {isHistorical ? <th>Price</th> : <th>Forecast</th>}
                        {isHistorical ? null : <th>Adjusted</th>}
                        {isHistorical ? null : <th>Variation</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td className="text-dim">{r.target_date}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(r.baseline_predicted_price)}</td>
                          {!isHistorical && <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{fmt(r.news_adjusted_predicted_price)}</td>}
                          {!isHistorical && (
                            <td style={{ color: r.news_adjustment > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                              {r.news_adjustment > 0 ? '+' : ''}{fmt(r.news_adjustment)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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

              <article className="card">
                <span className="card-title">Historical Data Explorer</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { label: 'WTI', symbol: 'WTI' },
                      { label: 'USD/KRW', symbol: 'USDKRW' },
                      { label: '휘발유', symbol: 'DOMESTIC_GASOLINE_AVG' }
                    ].map(item => (
                      <button key={item.symbol} onClick={() => loadHistory(item.symbol, item.label)} className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.75rem' }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="date" value={historyRange.start} onChange={(e) => setHistoryRange({...historyRange, start: e.target.value})} style={{ flex: 1 }} />
                    <span style={{ color: 'var(--text-dim)' }}>~</span>
                    <input type="date" value={historyRange.end} onChange={(e) => setHistoryRange({...historyRange, end: e.target.value})} style={{ flex: 1 }} />
                  </div>
                </div>
                {historicalData.symbol && (
                  <div className="table-container" style={{ maxHeight: '200px' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontSize: '0.8rem' }}>{historicalData.symbol} 데이터</h4>
                    <table>
                      <thead><tr><th>날짜</th><th>가격</th></tr></thead>
                      <tbody>
                        {historicalData.history.slice().reverse().map((h, i) => (
                          <tr key={i}>
                            <td className="text-dim">{h.date}</td>
                            <td style={{ fontWeight: 600 }}>{h.value.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default Dashboard
