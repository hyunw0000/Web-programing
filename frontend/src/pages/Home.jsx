import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import '../App.css'

const FeatureCard = ({ id, subtitle, summary, details }) => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <article className="card" style={{ padding: '32px', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => setIsOpen(!isOpen)}>
      <span className="card-title" style={{ color: 'var(--primary)' }}>{id}</span>
      <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: '16px 0 12px' }}>{subtitle}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>{summary}</p>
      
      <div style={{ 
        maxHeight: isOpen ? '200px' : '0px', 
        overflow: 'hidden', 
        transition: 'all 0.4s ease',
        opacity: isOpen ? 1 : 0,
        marginTop: isOpen ? '20px' : '0px',
        borderTop: isOpen ? '1px solid var(--border)' : 'none',
        paddingTop: isOpen ? '20px' : '0px'
      }}>
        <h4 style={{ color: 'var(--primary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>분석 원리</h4>
        <p style={{ color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: '1.5' }}>{details}</p>
      </div>
      <div style={{ marginTop: '16px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
        {isOpen ? '닫기 ▴' : '더보기 ▾'}
      </div>
    </article>
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

function Home() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
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
    { 
      label: '오늘 매수 시 절감액 (1KL)', 
      val: summary.purchaseScore?.predicted_tomorrow 
        ? (Number(summary.purchaseScore.predicted_tomorrow) - Number(summary.realtime?.domestic_avg_gasoline_krw)) * 1000 
        : 0, 
      unit: '원', 
      symbol: null 
    }
    ]


  return (
    <div className="app-shell">
      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

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

          <div 
            className="card active" 
            style={{ 
              padding: '32px', position: 'relative', overflow: 'hidden', border: '1px solid var(--primary)', 
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(56, 189, 248, 0.05) 100%)',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }} 
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
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
            <FeatureCard 
              id="01 Analysis" 
              subtitle="정교한 예측 모델" 
              summary="7일간의 가격 추세를 시뮬레이션하여 최적의 구매 시점을 소수점 단위까지 정밀하게 계산합니다."
              details="LSTM 기반의 시계열 분석 알고리즘을 사용하여 WTI 유가, 환율, 과거 데이터를 다차원으로 상관 분석합니다. 95% 신뢰구간을 적용하여 D+7일까지의 가격 범위를 산출합니다."
            />
            <FeatureCard 
              id="02 Insights" 
              subtitle="AI 시장 브리핑" 
              summary="복잡한 국제 정세와 유가 뉴스를 주유소 운영에 필요한 정보로만 압축하여 매일 제공합니다."
              details="Alpha Vantage의 뉴스 감성 분석 엔진으로 글로벌 원자재 뉴스를 스코어링하고, Gemini Pro 모델이 이를 한국어로 요약하여 비즈니스 영향력을 분석합니다."
            />
            <FeatureCard 
              id="03 Response" 
              subtitle="실시간 지능형 알림" 
              summary="급격한 시장 변동이 감지되면 즉시 알림을 통해 운영자가 대응할 수 있는 골든타임을 확보합니다."
              details="가격 변동폭이 임계치(예: 3%)를 넘어서는 순간, 데이터베이스가 이를 감지하여 대시보드 히스토리 및 알림 서비스로 즉각 전송합니다."
            />
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
