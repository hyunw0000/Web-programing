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

        if (!ignore) {
          setSummary({ realtime, purchaseScore })
        }
      } catch {
        // 백엔드 미연결 시에도 기본 레이아웃 유지
      }
    }

    loadSummary()
    return () => {
      ignore = true
    }
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

  const actionLabel = {
    buy_today: '오늘 구매',
    split_buy: '분할 구매',
    wait: '관망',
    insufficient_data: '데이터 부족',
  }

  const score = summary.purchaseScore?.score ?? '-'
  const action = actionLabel[summary.purchaseScore?.action] || '판단 대기'

  return (
    <div className="site-shell">
      <nav className="site-nav">
        <Link to="/" className="brand-mark">Oil Predict</Link>
        <div className="nav-links">
          <a href="#value">서비스 소개</a>
          <a href="#preview">대시보드 미리보기</a>
          <a href="#workflow">워크플로우</a>
        </div>
        <Link to="/dashboard" className="nav-cta">시작하기</Link>
      </nav>

      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-kicker">Purchase Intelligence</span>
            <h1 className="text-gradient">개인 주유소를 위한<br />유가 구매 의사결정 플랫폼</h1>
            <p>
              실시간 유가 지표와 AI 예측을 결합하여 최적의 주유 시점을 제안합니다.
              이제 복잡한 분석 대신 데이터가 말해주는 점수를 믿으세요.
            </p>
            <div className="home-actions">
              <Link to="/dashboard" className="primary-link">대시보드 바로가기</Link>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-head">
              <span>Current Score</span>
              <strong className="text-gradient" style={{ fontSize: '3rem' }}>{score}</strong>
            </div>
            <p className="hero-decision" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>{action}</p>
            <div className="mini-chart" style={{ height: '100px', display: 'flex', alignItems: 'end', gap: '8px', margin: '20px 0' }}>
              {[40, 60, 45, 80, 70, 90, 85].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: 'var(--primary)', borderRadius: '4px', opacity: 0.3 + (i * 0.1) }} />
              ))}
            </div>
            <div className="hero-panel-foot">
              <span style={{ color: 'var(--text-muted)' }}>D+1 예측 가격</span>
              <strong>{formatNumber(summary.purchaseScore?.predicted_tomorrow)} 원/L</strong>
            </div>
          </div>
        </section>

        <section className="home-metrics grid cards-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '80px' }}>
          {[
            { label: 'WTI', val: summary.realtime?.wti_usd, unit: 'USD/b' },
            { label: 'BRENT', val: summary.realtime?.brent_usd, unit: 'USD/b' },
            { label: 'USD/KRW', val: summary.realtime?.usd_krw, unit: 'KRW' },
            { label: '국내 휘발유', val: summary.realtime?.domestic_avg_gasoline_krw, unit: '원/L' }
          ].map((m) => (
            <article key={m.label} className="metric">
              <h2>{m.label}</h2>
              <p className="value">{formatNumber(m.val)}</p>
              <span>{m.unit}</span>
            </article>
          ))}
        </section>

        <section className="home-section" id="value" style={{ textAlign: 'center', marginBottom: '100px' }}>
          <div className="section-heading" style={{ margin: '0 auto 48px' }}>
            <span className="home-kicker">Why Oil Predict</span>
            <h2 style={{ fontSize: '2.5rem', marginTop: '16px' }}>구매 판단에 필요한 신호만 압축합니다</h2>
          </div>
          <div className="value-grid grid cards-3">
            <article className="card">
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>01</span>
              <h3>타이밍 포착</h3>
              <p>D+7일 예측 데이터를 기반으로 선구매와 관망 여부를 과학적으로 비교합니다.</p>
            </article>
            <article className="card">
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>02</span>
              <h3>AI 브리핑</h3>
              <p>복잡한 뉴스와 거시 경제 요인을 운영자가 이해하기 쉽게 요약해 드립니다.</p>
            </article>
            <article className="card">
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>03</span>
              <h3>알림 자동화</h3>
              <p>설정한 임계치를 넘는 가격 변동이 감지되면 즉시 히스토리에 기록됩니다.</p>
            </article>
          </div>
        </section>

        <section className="home-cta card" style={{ padding: '60px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, transparent 100%)' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '24px' }}>오늘의 구매 판단을 확인하시겠습니까?</h2>
          <Link to="/dashboard" className="nav-cta" style={{ fontSize: '1.1rem', padding: '14px 32px' }}>대시보드 시작하기</Link>
        </section>
      </main>

      <footer className="app-footer">
        © 2026 Oil Predict · Smart Oil Purchase Decision Support
      </footer>
    </div>
  )
}

export default Home
