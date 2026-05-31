import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import '../App.css'

function HistoryPage() {
  const { symbol } = useParams()
  const navigate = useNavigate()
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', [])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(30)
  
  // Interactive Tooltip State
  const [hoveredPoint, setHovererPoint] = useState(null)
  const svgRef = useRef(null)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/history?symbol=${symbol}&days=${range}`)
        const result = await res.json()
        setData(result.history || [])
      } catch (err) {
        console.error('Failed to fetch history:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [symbol, apiBaseUrl, range])

  const chart = useMemo(() => {
    if (data.length === 0) return null
    const width = 1000
    const height = 400
    const padding = { top: 60, right: 50, bottom: 80, left: 80 }
    const values = data.map(d => d.value)
    const min = Math.min(...values) * 0.98
    const max = Math.max(...values) * 1.02
    const rangeVal = max - min
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom
    const xStep = innerWidth / (data.length - 1 || 1)

    const points = data.map((d, i) => ({
      x: padding.left + i * xStep,
      y: padding.top + ((max - d.value) / rangeVal) * innerHeight,
      date: d.date,
      value: d.value,
      index: i
    }))

    const labelIndices = []
    const step = Math.max(1, Math.floor(data.length / 6))
    for (let i = 0; i < data.length; i += step) labelIndices.push(i)
    if (labelIndices[labelIndices.length - 1] !== data.length - 1) labelIndices.push(data.length - 1)

    return { width, height, points, padding, linePath: points.map(p => `${p.x},${p.y}`).join(' '), min, max, labelIndices }
  }, [data])

  const handleMouseMove = (e) => {
    if (!chart || !svgRef.current) return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * chart.width
    
    // Find closest point by X coordinate
    const closest = chart.points.reduce((prev, curr) => 
      Math.abs(curr.x - mouseX) < Math.abs(prev.x - mouseX) ? curr : prev
    )
    
    setHovererPoint(closest)
  }

  const symbolLabel = symbol === 'WTI' ? 'WTI Crude Oil' : 
                     symbol === 'USDKRW' ? 'USD / KRW 환율' : 
                     symbol === 'DOMESTIC_GASOLINE_AVG' ? '국내 휘발유 평균' : symbol

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <Link to="/" className="brand-mark" style={{ fontSize: '1.25rem' }}>Oil Predict</Link>
            <button onClick={() => navigate(-1)} style={{ color: 'var(--text-dim)', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
              ← 이전 페이지로
            </button>
          </div>
          <h1>{symbolLabel} 히스토리 분석</h1>
          <p>마우스를 올려 상세 가격을 확인하세요</p>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            {[ { label: '1주', val: 7 }, { label: '1개월', val: 30 }, { label: '3개월', val: 90 } ].map(r => (
              <button key={r.val} onClick={() => setRange(r.val)} style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', background: range === r.val ? 'var(--primary)' : 'transparent', color: range === r.val ? '#000' : 'var(--text-dim)', transition: 'all 0.2s' }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading ? <p className="text-dim">데이터 로딩 중...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <article className="card" style={{ padding: '40px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <span className="card-title">{range}일간의 추세 분석</span>
              {hoveredPoint && (
                <div style={{ background: 'var(--primary-soft)', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 800 }}>
                  {hoveredPoint.date} : {hoveredPoint.value.toLocaleString()}
                </div>
              )}
            </div>

            {chart ? (
              <svg 
                ref={svgRef}
                viewBox={`0 0 ${chart.width} ${chart.height}`} 
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHovererPoint(null)}
              >
                {/* Y-axis & Grid */}
                {[0, 0.25, 0.5, 0.75, 1].map(p => {
                  const val = chart.max - (p * (chart.max - chart.min))
                  const y = chart.padding.top + (p * (chart.height - chart.padding.top - chart.padding.bottom))
                  return (
                    <g key={p}>
                      <text x="70" y={y + 4} textAnchor="end" fill="var(--text-dim)" fontSize="12" fontWeight="600">{val.toFixed(1)}</text>
                      <line x1="80" y1={y} x2={chart.width - chart.padding.right} y2={y} stroke="var(--border)" strokeDasharray="4" />
                    </g>
                  )
                })}

                {/* X-axis labels */}
                {chart.labelIndices.map(idx => (
                  <text key={idx} x={chart.points[idx].x} y={chart.height - 40} textAnchor="middle" fill="var(--text-dim)" fontSize="11" fontWeight="600">
                    {data[idx].date.split('-').slice(1).join('/')}
                  </text>
                ))}

                {/* Main line */}
                <path d={`M ${chart.linePath}`} fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px var(--primary-soft))' }} />
                
                {/* Hover Interaction Elements */}
                {hoveredPoint && (
                  <g>
                    <line x1={hoveredPoint.x} y1={chart.padding.top} x2={hoveredPoint.x} y2={chart.height - chart.padding.bottom} stroke="var(--primary)" strokeWidth="1" strokeDasharray="4" />
                    <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="8" fill="var(--primary)" style={{ filter: 'glow(0 0 10px var(--primary))' }} />
                    <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill="#fff" />
                    
                    {/* Tooltip Box */}
                    <g transform={`translate(${hoveredPoint.x > chart.width - 150 ? hoveredPoint.x - 130 : hoveredPoint.x + 10}, ${hoveredPoint.y - 40})`}>
                      <rect width="120" height="50" rx="8" fill="var(--bg-card)" stroke="var(--primary)" strokeWidth="1" />
                      <text x="60" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">{hoveredPoint.date}</text>
                      <text x="10" y="40" fill="#fff" fontSize="14" fontWeight="800">{hoveredPoint.value.toLocaleString()}</text>
                    </g>
                  </g>
                )}

                {/* Static points (smaller) */}
                {!hoveredPoint && chart.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--primary)" opacity="0.5" />
                ))}
              </svg>
            ) : <p>데이터 부족</p>}
          </article>

          <article className="card">
            <span className="card-title">일자별 상세 데이터</span>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>날짜</th><th>수치</th><th>변동</th></tr>
                </thead>
                <tbody>
                  {data.slice().reverse().map((d, i, arr) => {
                    const prev = arr[i + 1]
                    const change = prev ? ((d.value - prev.value) / prev.value * 100).toFixed(2) : '0.00'
                    const isUp = parseFloat(change) > 0
                    return (
                      <tr key={i} onMouseEnter={() => {
                        const p = chart?.points.find(pt => pt.date === d.date)
                        if (p) setHovererPoint(p)
                      }} onMouseLeave={() => setHovererPoint(null)} style={{ background: hoveredPoint?.date === d.date ? 'rgba(56, 189, 248, 0.05)' : 'transparent', transition: 'background 0.2s' }}>
                        <td className="text-dim" style={{ fontWeight: 600 }}>{d.date}</td>
                        <td style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>{d.value.toLocaleString()}</td>
                        <td style={{ color: isUp ? 'var(--danger)' : 'var(--success)', fontWeight: 800 }}>{isUp ? '▲' : '▼'} {Math.abs(change)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

export default HistoryPage
