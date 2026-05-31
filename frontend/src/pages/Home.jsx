import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import '../App.css'

function Home() {
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
    [],
  )
  const [summary, setSummary] = useState({
    realtime: null,
    purchaseScore: null,
  })

  useEffect(() => {
    let ignore = false
    const loadSummary = async () => {
      try {
        const [realtimeRes, purchaseScoreRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/dashboard/realtime`),
          fetch(`${apiBaseUrl}/api/v1/purchase-score`),
        ])
        if (!realtimeRes.ok || !purchaseScoreRes.ok) return
        const [realtime, purchaseScore] = await Promise.all([
          realtimeRes.json(),
          purchaseScoreRes.json(),
        ])
        if (!ignore) setSummary({ realtime, purchaseScore })
      } catch {
        // Fallback
      }
    }
    loadSummary()
    return () => { ignore = true }
  }, [apiBaseUrl])

  const formatNumber = (value, fractionDigits = 2) => {
    if (value === null || value === undefined || value === '') return '-'
    const num = Number(value)
    if (Number.isNaN(num)) return '-'
    return num.toLocaleString('ko-KR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    })
  }

  const score = summary.purchaseScore?.score ?? '-'
  const action = summary.purchaseScore?.action === 'buy_today' ? '오늘 구매' : 
                 summary.purchaseScore?.action === 'split_buy' ? '분할 구매' : 
                 summary.purchaseScore?.action === 'wait' ? '관망' : '판단 대기'

  const metrics = [
    { label: 'WTI Crude', val: summary.realtime?.wti_usd, unit: 'USD/b', symbol: 'WTI' },
    { label: 'USD / KRW', val: summary.realtime?.usd_krw, unit: 'KRW', symbol: 'USDKRW' },
    { label: '국내 휘발유 평균', val: summary.realtime?.domestic_avg_gasoline_krw, unit: '원/L', symbol: 'DOMESTIC_GASOLINE_AVG' },
    { label: 'AI 예측 변동', val: summary.purchaseScore?.predicted_tomorrow ? (Number(summary.purchaseScore.predicted_tomorrow) - Number(summary.realtime?.domestic_avg_gasoline_krw)).toFixed(1) : '-', unit: '원/L', symbol: null }
  ]

  return (
    <div className="app-shell">
      <nav className="site-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
        <Link to="/" className="brand-mark">Oil Predict</Link>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a href="#value" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>서비스 특징</a>
          <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>대시보드 시작</Link>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="home-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center', marginBottom: '80px' }}>
          <div className="home-hero-copy">
            <span className="home-kicker">Artificial Intelligence</span>
            <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: '1.1', marginBottom: '24px', color: '#fff' }}>
              주유소 운영의<br />
              <span style={{ color: 'var(--primary)' }}>새로운 기준</span>을 세우다
            </h1>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '40px', maxWidth: '520px' }}>
              복잡한 지표 분석은 AI에게 맡기세요. 실시간 유가 데이터와 예측 모델을 통해 오늘 바로 실행 가능한 구매 전략을 제공합니다.
            </p>
            <Link to="/dashboard" className="btn-primary" style={{ padding: '16px 40px', fontSize: '1rem', textDecoration: 'none' }}>
              지금 무료로 체험하기
            </Link>
          </div>

          <div className="card active" style={{ padding: '32px', position: 'relative', overflow: 'hidden', border: '1px solid var(--primary)', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(56, 189, 248, 0.05) 100%)' }}>
            <span className="card-title">LIVE MARKET SCORE</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', margin: '20px 0' }}>
              <span style={{ fontSize: '5rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.05em' }}>{score}</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>{action}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: '8px', height: '60px', marginBottom: '24px' }}>
              {[40, 60, 45, 80, 75, 95, 85].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: 'var(--primary)', borderRadius: '3px', opacity: 0.3 + (i * 0.1) }} />
              ))}
            </div>
            <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>D+1 예측 가격</span>
              <strong style={{ color: '#fff' }}>{formatNumber(summary.purchaseScore?.predicted_tomorrow)} 원/L</strong>
            </div>
          </div>
        </section>

        {/* Quick Metrics */}
        <section className="grid grid-4" style={{ marginBottom: '100px' }}>
          {metrics.map((m) => {
            const content = (
              <>
                <p className="metric-label">{m.label}</p>
                <h2 className="metric-value" style={{ fontSize: '1.5rem' }}>
                  {formatNumber(m.val, 1)}<span className="metric-unit" style={{ fontSize: '0.8rem', marginLeft: '4px' }}>{m.unit}</span>
                </h2>
                {m.symbol && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '8px', fontWeight: 700 }}>클릭하여 히스토리 보기 →</span>}
              </>
            )
            
            if (m.symbol) {
              return (
                <Link key={m.label} to={`/history/${m.symbol}`} className="card metric-card" style={{ padding: '24px', textDecoration: 'none', transition: 'transform 0.2s, border-color 0.2s', cursor: 'pointer' }}>
                  {content}
                </Link>
              )
            }
            
            return (
              <div key={m.label} className="card metric-card" style={{ padding: '24px' }}>
                {content}
              </div>
            )
          })}
        </section>

        {/* Feature Grid */}
        <section id="value" style={{ marginBottom: '100px' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span className="home-kicker">Core Values</span>
            <h2 style={{ 
              fontSize: '3rem', 
              fontWeight: 900, 
              color: '#fff', 
              letterSpacing: '-0.04em', 
              background: 'linear-gradient(135deg, #fff 0%, #0ea5e9 100%)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent'
            }}>
              모든 판단은 데이터로 증명됩니다
            </h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            <article className="card" style={{ padding: '32px' }}>
              <span className="card-title" style={{ color: 'var(--primary)' }}>01 Analysis</span>
              <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: '16px 0 12px' }}>정교한 예측 모델</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>7일간의 가격 추세를 시뮬레이션하여 최적의 구매 시점을 소수점 단위까지 정밀하게 계산합니다.</p>
            </article>
            <article className="card" style={{ padding: '32px' }}>
              <span className="card-title" style={{ color: 'var(--primary)' }}>02 Insights</span>
              <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: '16px 0 12px' }}>AI 시장 브리핑</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>복잡한 국제 정세와 유가 뉴스를 주유소 운영에 필요한 정보로만 압축하여 매일 제공합니다.</p>
            </article>
            <article className="card" style={{ padding: '32px' }}>
              <span className="card-title" style={{ color: 'var(--primary)' }}>03 Response</span>
              <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: '16px 0 12px' }}>실시간 지능형 알림</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>급격한 시장 변동이 감지되면 즉시 알림을 통해 운영자가 대응할 수 있는 골든타임을 확보합니다.</p>
            </article>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="card" style={{ padding: '80px 40px', textAlign: 'center', border: '1px solid var(--border-bright)', background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(56, 189, 248, 0.03) 100%)' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>지금 바로 스마트한 운영을 시작하세요</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '40px' }}>이미 많은 주유소 운영자들이 데이터 기반의 의사결정으로 비용을 절감하고 있습니다.</p>
          <Link to="/dashboard" className="btn-primary" style={{ padding: '18px 60px', fontSize: '1.1rem', textDecoration: 'none' }}>무료로 대시보드 입장하기</Link>
        </section>
      </main>

      <footer className="app-footer" style={{ borderTop: '1px solid var(--border)', padding: '60px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
        © 2026 Oil Predict · Advanced Market Intelligence for Energy Business
      </footer>
    </div>
  )
}

export default Home
