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
        // 홈페이지는 백엔드가 꺼져 있어도 소개 화면을 유지합니다.
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
      <nav className="site-nav" aria-label="주요 메뉴">
        <Link to="/" className="brand-mark">Oil Predict</Link>
        <div className="nav-links">
          <a href="#value">서비스 소개</a>
          <a href="#preview">대시보드</a>
          <a href="#workflow">사용 흐름</a>
        </div>
        <Link to="/dashboard" className="nav-cta">대시보드 보기</Link>
      </nav>

      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-kicker">Oil purchase intelligence</span>
            <h1>개인 주유소를 위한 유가 구매 타이밍 의사결정 플랫폼</h1>
            <p>
              실시간 유가, 환율, 뉴스, AI 예측을 한 화면에 모아 오늘 구매할지,
              기다릴지, 분할 구매할지 판단합니다.
            </p>
            <div className="home-actions">
              <Link to="/dashboard" className="primary-link">실시간 대시보드 보기</Link>
              <a href="#preview" className="secondary-link">구매 점수 확인</a>
            </div>
          </div>

          <div className="hero-panel" aria-label="구매 판단 미리보기">
            <div className="hero-panel-head">
              <span>Smart Purchase Score</span>
              <strong>{score}</strong>
            </div>
            <p className="hero-decision">{action}</p>
            <div className="mini-chart" aria-hidden="true">
              <span style={{ height: '42%' }} />
              <span style={{ height: '58%' }} />
              <span style={{ height: '48%' }} />
              <span style={{ height: '66%' }} />
              <span style={{ height: '74%' }} />
              <span style={{ height: '62%' }} />
              <span style={{ height: '70%' }} />
            </div>
            <div className="hero-panel-foot">
              <span>D+1 예측</span>
              <strong>{formatNumber(summary.purchaseScore?.predicted_tomorrow)} 원/L</strong>
            </div>
          </div>
        </section>

        <section className="home-metrics" aria-label="핵심 시장 지표">
          <article>
            <span>WTI</span>
            <strong>{formatNumber(summary.realtime?.wti_usd)}</strong>
            <small>USD/barrel</small>
          </article>
          <article>
            <span>브렌트유</span>
            <strong>{formatNumber(summary.realtime?.brent_usd)}</strong>
            <small>USD/barrel</small>
          </article>
          <article>
            <span>USD/KRW</span>
            <strong>{formatNumber(summary.realtime?.usd_krw)}</strong>
            <small>KRW/USD</small>
          </article>
          <article>
            <span>국내 평균 휘발유</span>
            <strong>{formatNumber(summary.realtime?.domestic_avg_gasoline_krw)}</strong>
            <small>KRW/L</small>
          </article>
        </section>

        <section className="home-section" id="value">
          <div className="section-heading">
            <span>Why Oil Predict</span>
            <h2>구매 판단에 필요한 신호만 압축합니다</h2>
          </div>
          <div className="value-grid">
            <article>
              <span className="value-index">01</span>
              <h3>구매 타이밍 판단</h3>
              <p>D+1, D+3, D+7 예측을 기반으로 선구매와 관망 여부를 빠르게 비교합니다.</p>
            </article>
            <article>
              <span className="value-index">02</span>
              <h3>AI 시장 브리핑</h3>
              <p>뉴스와 시장 요인을 요약해 상승 압력과 하락 압력을 운영자가 이해하기 쉽게 보여줍니다.</p>
            </article>
            <article>
              <span className="value-index">03</span>
              <h3>알림 자동화</h3>
              <p>예측가와 현재가 차이가 임계치를 넘으면 규칙 기반 알림 이력을 남깁니다.</p>
            </article>
          </div>
        </section>

        <section className="preview-section" id="preview">
          <div className="section-heading">
            <span>Dashboard preview</span>
            <h2>실시간 운영 화면으로 바로 연결됩니다</h2>
          </div>
          <div className="preview-layout">
            <article className="preview-card score-preview">
              <span>현재 구매 판단</span>
              <strong>{score}</strong>
              <p>{action}</p>
            </article>
            <article className="preview-card chart-preview">
              <div className="preview-chart-line" />
              <h3>7일 예측 추세</h3>
              <p>기준 예측과 뉴스 보정 예측을 함께 비교합니다.</p>
            </article>
            <article className="preview-card briefing-preview">
              <span>AI Briefing</span>
              <h3>상승·하락 요인 요약</h3>
              <p>시장 이벤트를 구매 판단 근거로 변환합니다.</p>
            </article>
          </div>
        </section>

        <section className="workflow-section" id="workflow">
          <div className="section-heading">
            <span>Workflow</span>
            <h2>데이터 수집부터 구매 판단까지 한 흐름으로 처리합니다</h2>
          </div>
          <div className="workflow-list">
            <article>
              <strong>1</strong>
              <span>시장 데이터 수집</span>
            </article>
            <article>
              <strong>2</strong>
              <span>단기 가격 예측</span>
            </article>
            <article>
              <strong>3</strong>
              <span>AI 브리핑 생성</span>
            </article>
            <article>
              <strong>4</strong>
              <span>구매 점수와 알림 판단</span>
            </article>
          </div>
        </section>

        <section className="home-cta">
          <h2>오늘의 구매 판단을 확인하세요</h2>
          <Link to="/dashboard" className="primary-link">대시보드 열기</Link>
        </section>
      </main>
    </div>
  )
}

export default Home
