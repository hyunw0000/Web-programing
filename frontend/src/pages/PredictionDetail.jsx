import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import '../App.css'

function PredictionDetail() {
  const navigate = useNavigate()
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', [])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const [forecastRes, briefingRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/forecast?horizon=7d`),
          fetch(`${apiBaseUrl}/api/v1/briefings/latest`)
        ])
        const forecast = await forecastRes.json()
        const briefing = await briefingRes.json()
        setData({ forecast: forecast.predictions || [], briefing })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPrediction()
  }, [apiBaseUrl])

  const fmt = (v) => Number(v).toLocaleString('ko-KR')

  return (
    <div className="app-shell">
      <header className="dashboard-header">
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <Link to="/" className="brand-mark" style={{ fontSize: '1.25rem' }}>Oil Predict</Link>
            <button onClick={() => navigate(-1)} style={{ color: 'var(--text-dim)', background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
              ← 대시보드로 돌아가기
            </button>
          </div>
          <h1>가격 예측 상세 분석</h1>
          <p>D+1, D+3, D+7 예측 모델 및 근거 데이터</p>
        </div>
      </header>

      {loading ? <p className="text-dim">데이터 분석 중...</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <article className="card">
            <span className="card-title">예측 정밀도 시뮬레이션</span>
            <div style={{ marginTop: '20px' }}>
              {data.forecast.filter(r => [1, 3, 7].includes(r.horizon_days)).map(r => (
                <div key={r.horizon_days} style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-input)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)' }}>D+{r.horizon_days} 예측 분석</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '8px' }}>
                    {fmt(r.baseline_predicted_price)} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>원/L</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    뉴스 반영 변동폭: <span style={{ color: r.news_adjustment > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                      {r.news_adjustment > 0 ? '+' : ''}{r.news_adjustment} 원/L
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card briefing-card">
            <span className="card-title">AI 판단 근거 (뉴스 기반)</span>
            <h2 style={{ fontSize: '1.1rem', margin: '15px 0' }}>{data.briefing?.title}</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>{data.briefing?.summary}</p>
            <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-app)', borderRadius: '8px' }}>
              <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>주요 뉴스 감성 지수</h4>
              <div style={{ fontSize: '2rem', fontWeight: 900 }}>{data.briefing?.score}</div>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

export default PredictionDetail
