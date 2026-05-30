import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

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

    if (normalized.length === 0) {
      return null
    }

    const width = 620
    const height = 210
    const padding = { top: 20, right: 22, bottom: 42, left: 54 }
    const minValue = Math.min(...normalized.flatMap((row) => [row.lower, row.newsAdjusted]))
    const maxValue = Math.max(...normalized.flatMap((row) => [row.upper, row.newsAdjusted]))
    const valueRange = maxValue - minValue || 1
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom
    const xStep = normalized.length > 1 ? innerWidth / (normalized.length - 1) : 0

    const pointFor = (row, value, index) => {
      const x = padding.left + (normalized.length > 1 ? index * xStep : innerWidth / 2)
      const y = padding.top + ((maxValue - value) / valueRange) * innerHeight
      return { x, y, row, value }
    }

    const predictedPoints = normalized.map((row, index) => pointFor(row, row.predicted, index))
    const newsAdjustedPoints = normalized.map((row, index) => pointFor(row, row.newsAdjusted, index))
    const upperPoints = normalized.map((row, index) => pointFor(row, row.upper, index))
    const lowerPoints = normalized.map((row, index) => pointFor(row, row.lower, index))
    const bandPoints = [...upperPoints, ...lowerPoints.slice().reverse()]
      .map((point) => `${point.x},${point.y}`)
      .join(' ')
    const linePoints = predictedPoints.map((point) => `${point.x},${point.y}`).join(' ')
    const newsLinePoints = newsAdjustedPoints.map((point) => `${point.x},${point.y}`).join(' ')

    return {
      width,
      height,
      padding,
      minValue,
      maxValue,
      predictedPoints,
      newsAdjustedPoints,
      bandPoints,
      linePoints,
      newsLinePoints,
    }
  }, [rows])

  if (!chart) {
    return null
  }

  return (
    <div className="forecast-chart" aria-label="단기 가격 예측 차트">
      <div className="chart-legend">
        <span><i className="legend-line baseline" />유가 예측 추세</span>
        <span><i className="legend-line news" />뉴스 공시 포함 예측</span>
      </div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img">
        <line
          x1={chart.padding.left}
          y1={chart.padding.top}
          x2={chart.padding.left}
          y2={chart.height - chart.padding.bottom}
          className="chart-axis"
        />
        <line
          x1={chart.padding.left}
          y1={chart.height - chart.padding.bottom}
          x2={chart.width - chart.padding.right}
          y2={chart.height - chart.padding.bottom}
          className="chart-axis"
        />
        <text x="8" y={chart.padding.top + 4} className="chart-label">
          {formatNumber(chart.maxValue, 0)}
        </text>
        <text x="8" y={chart.height - chart.padding.bottom} className="chart-label">
          {formatNumber(chart.minValue, 0)}
        </text>
        <polygon points={chart.bandPoints} className="chart-band" />
        <polyline points={chart.linePoints} className="chart-line" />
        <polyline points={chart.newsLinePoints} className="chart-line-news" />
        {chart.predictedPoints.map((point) => (
          <g key={point.row.horizon_days}>
            <circle cx={point.x} cy={point.y} r="4.5" className="chart-point" />
            <text x={point.x} y={chart.height - 14} textAnchor="middle" className="chart-label">
              D+{point.row.horizon_days}
            </text>
          </g>
        ))}
        {chart.newsAdjustedPoints.map((point) => (
          <circle
            key={`news-${point.row.horizon_days}`}
            cx={point.x}
            cy={point.y}
            r="4"
            className="chart-point-news"
          />
        ))}
      </svg>
    </div>
  )
}

function App() {
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [realtime, setRealtime] = useState(null)
  const [forecast, setForecast] = useState([])
  const [forecastInfo, setForecastInfo] = useState(null)
  const [briefing, setBriefing] = useState(null)
  const [purchaseScore, setPurchaseScore] = useState(null)
  const [alertRules, setAlertRules] = useState([])
  const [alertHistory, setAlertHistory] = useState([])
  const [newRule, setNewRule] = useState({ name: '', rule_type: 'rise', threshold: '' })
  const [alertFormMessage, setAlertFormMessage] = useState('')
  const [evaluatingAlerts, setEvaluatingAlerts] = useState(false)
  const [tankLevel, setTankLevel] = useState(30)

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
    }
    setError('')
    try {
      const [realtimeRes, forecastRes, briefingRes, purchaseScoreRes, alertRulesRes, alertHistoryRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/dashboard/realtime`),
        fetch(`${apiBaseUrl}/api/v1/forecast?horizon=7d`),
        fetch(`${apiBaseUrl}/api/v1/briefings/latest`),
        fetch(`${apiBaseUrl}/api/v1/purchase-score`),
        fetch(`${apiBaseUrl}/api/v1/alerts/rules`),
        fetch(`${apiBaseUrl}/api/v1/alerts/history`),
      ])

      if (
        !realtimeRes.ok
        || !forecastRes.ok
        || !briefingRes.ok
        || !purchaseScoreRes.ok
        || !alertRulesRes.ok
        || !alertHistoryRes.ok
      ) {
        throw new Error('서버 응답에 실패했습니다.')
      }

      const realtimeJson = await realtimeRes.json()
      const forecastJson = await forecastRes.json()
      const briefingJson = await briefingRes.json()
      const purchaseScoreJson = await purchaseScoreRes.json()
      const alertRulesJson = await alertRulesRes.json()
      const alertHistoryJson = await alertHistoryRes.json()

      setRealtime(realtimeJson)
      setForecast(forecastJson.predictions || [])
      setForecastInfo({
        newsSentimentScore: forecastJson.news_sentiment_score,
        newsAdjustmentMethod: forecastJson.news_adjustment_method,
      })
      setBriefing(briefingJson)
      setPurchaseScore(purchaseScoreJson)
      setAlertRules(alertRulesJson)
      setAlertHistory(alertHistoryJson)
    } catch (err) {
      setError(err.message || '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard(false)
    }, 0)
    const interval = setInterval(() => {
      loadDashboard(false)
    }, 5 * 60 * 1000)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [loadDashboard])

  const sentimentClass = briefing?.sentiment || 'neutral'
  const sentimentLabel = {
    bullish: '상승 우세',
    bearish: '하락 우세',
    neutral: '중립',
  }
  const scoreClass = (purchaseScore?.score ?? 50) >= 70 ? 'good' : (purchaseScore?.score ?? 50) <= 40 ? 'bad' : 'mid'

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

  const decisionMetrics = useMemo(() => {
    const currentPrice = Number(purchaseScore?.current_price ?? realtime?.domestic_avg_gasoline_krw)
    const predictedTomorrow = Number(purchaseScore?.predicted_tomorrow)
    const predicted3d = Number(purchaseScore?.predicted_3d)
    const score = Number(purchaseScore?.score ?? 50)
    const newsScore = Number(forecastInfo?.newsSentimentScore ?? briefing?.score ?? 0)
    const tankCapacity = 20000
    const normalizedTankLevel = Math.min(100, Math.max(0, Number(tankLevel) || 0))
    const availableLiters = Math.round(tankCapacity * ((100 - normalizedTankLevel) / 100))
    const tomorrowDiff = Number.isFinite(predictedTomorrow) && Number.isFinite(currentPrice)
      ? predictedTomorrow - currentPrice
      : 0
    const d3Diff = Number.isFinite(predicted3d) && Number.isFinite(currentPrice)
      ? predicted3d - currentPrice
      : tomorrowDiff
    const weightedDiff = (tomorrowDiff * 0.6) + (d3Diff * 0.4)
    const weeklyVolume = 12000
    const monthlyVolume = weeklyVolume * 4
    const basePrice = Number.isFinite(currentPrice) ? currentPrice : 1700
    const mechanicalCost = Math.round(basePrice * monthlyVolume)
    const scoreSavingsPerLiter = Math.max(0, Math.min(38, (score - 45) * 0.9 + Math.max(0, weightedDiff) * 0.35))
    const platformCost = Math.round(mechanicalCost - (scoreSavingsPerLiter * monthlyVolume))
    const savings = Math.max(0, mechanicalCost - platformCost)
    const avoidableCost = Math.max(0, Math.round(availableLiters * tomorrowDiff))

    let tankAction = '가격 방향성이 약해 분할 구매를 권장합니다.'
    if (tomorrowDiff >= 8 && availableLiters > 0) {
      tankAction = `탱크 여유 ${availableLiters.toLocaleString('ko-KR')}L. 오늘 최대 ${availableLiters.toLocaleString('ko-KR')}L 선구매 권장.`
    } else if (tomorrowDiff <= -5) {
      tankAction = '단기 하락 예상. 필수 재고만 유지하고 추가 구매는 대기하십시오.'
    } else if (availableLiters < 3000) {
      tankAction = '탱크 여유가 낮습니다. 가격보다 안전 재고 확보를 우선하십시오.'
    }

    const oilTrendScore = Math.max(0, Math.min(100, 50 + (weightedDiff * 2.4)))
    const fxScore = Number.isFinite(Number(realtime?.usd_krw))
      ? Math.max(0, Math.min(100, 62 - ((Number(realtime.usd_krw) - 1350) * 0.08)))
      : 50
    const newsImpactScore = Math.max(0, Math.min(100, 50 + (newsScore * 12)))
    const inventoryPressureScore = Math.max(0, Math.min(100, 100 - normalizedTankLevel))

    const xaiFactors = [
      {
        label: '예측 가격 압력',
        value: oilTrendScore,
        tone: oilTrendScore >= 65 ? 'bad' : oilTrendScore <= 42 ? 'good' : 'mid',
        summary: weightedDiff > 0 ? '상승 압력' : weightedDiff < 0 ? '하락 압력' : '보합',
      },
      {
        label: '환율 부담',
        value: fxScore,
        tone: fxScore >= 60 ? 'good' : fxScore <= 40 ? 'bad' : 'mid',
        summary: fxScore >= 60 ? '우호적' : fxScore <= 40 ? '부담' : '중립',
      },
      {
        label: '뉴스 감성',
        value: newsImpactScore,
        tone: newsImpactScore >= 60 ? 'bad' : newsImpactScore <= 40 ? 'good' : 'mid',
        summary: newsScore > 0.2 ? '상승 재료' : newsScore < -0.2 ? '하락 재료' : '중립',
      },
      {
        label: '재고 여유',
        value: inventoryPressureScore,
        tone: inventoryPressureScore >= 65 ? 'bad' : inventoryPressureScore <= 35 ? 'good' : 'mid',
        summary: `${Math.round(availableLiters).toLocaleString('ko-KR')}L 여유`,
      },
    ]

    const notifications = [
      {
        level: score >= 70 ? 'urgent' : score <= 40 ? 'notice' : 'normal',
        title: score >= 70 ? '선구매 검토 필요' : score <= 40 ? '관망 권장' : '분할 구매 권장',
        body: purchaseScore?.reason || '구매 점수 계산 데이터가 부족합니다.',
      },
      {
        level: tomorrowDiff >= 8 ? 'urgent' : tomorrowDiff <= -5 ? 'notice' : 'normal',
        title: 'D+1 가격 변화 감지',
        body: `내일 예측가는 현재가 대비 ${formatNumber(tomorrowDiff)}원/L 차이입니다.`,
      },
    ]

    if (alertHistory[0]) {
      notifications.unshift({
        level: 'urgent',
        title: alertHistory[0].rule_name || '알림 발생',
        body: alertHistory[0].message,
      })
    }

    return {
      normalizedTankLevel,
      availableLiters,
      mechanicalCost,
      platformCost,
      savings,
      scoreSavingsPerLiter,
      avoidableCost,
      tankAction,
      tomorrowDiff,
      xaiFactors,
      notifications: notifications.slice(0, 3),
    }
  }, [alertHistory, briefing, forecastInfo, purchaseScore, realtime, tankLevel])

  const isSuccessMessage = (message) => (
    message.includes('등록되었습니다')
    || message.includes('삭제되었습니다')
    || message.includes('변경되었습니다')
    || message.includes('평가 완료')
  )

  const validateAlertForm = () => {
    const name = newRule.name.trim()
    const thresholdText = String(newRule.threshold).trim()

    if (!name || !thresholdText) {
      return '값을 입력하시오.'
    }

    const threshold = Number(thresholdText)
    if (Number.isNaN(threshold) || threshold <= 0) {
      return '임계치는 0보다 큰 숫자로 입력하시오.'
    }

    return null
  }

  const createAlertRule = async () => {
    setAlertFormMessage('')
    const validationError = validateAlertForm()
    if (validationError) {
      setAlertFormMessage(validationError)
      return
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRule.name.trim(),
          rule_type: newRule.rule_type,
          threshold: Number(newRule.threshold),
          enabled: true,
        }),
      })
      if (!res.ok) {
        let message = '알림 규칙 저장에 실패했습니다.'
        try {
          const payload = await res.json()
          if (payload?.name?.[0]) message = payload.name[0]
          else if (payload?.threshold?.[0]) message = payload.threshold[0]
          else if (payload?.detail) message = payload.detail
        } catch {
          // ignore json parse errors
        }
        setAlertFormMessage(message)
        return
      }

      setNewRule({ name: '', rule_type: 'rise', threshold: '' })
      setAlertFormMessage('알림 규칙이 등록되었습니다.')
      await loadDashboard(false)
    } catch (err) {
      setAlertFormMessage(err.message || '알림 규칙 저장에 실패했습니다. 백엔드 서버를 확인하시오.')
    }
  }

  const deleteAlertRule = async (ruleId) => {
    if (!window.confirm('이 알림 규칙을 삭제할까요?')) {
      return
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/rules/${ruleId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) {
        throw new Error('알림 규칙 삭제 실패')
      }
      setAlertFormMessage('알림 규칙이 삭제되었습니다.')
      await loadDashboard(false)
    } catch (err) {
      setAlertFormMessage(err.message || '알림 규칙 삭제에 실패했습니다.')
    }
  }

  const toggleAlertRule = async (rule) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      })
      if (!res.ok) {
        throw new Error('알림 규칙 상태 변경 실패')
      }
      setAlertFormMessage('알림 규칙 상태가 변경되었습니다.')
      await loadDashboard(false)
    } catch (err) {
      setAlertFormMessage(err.message || '알림 규칙 상태 변경에 실패했습니다.')
    }
  }

  const evaluateAlerts = async () => {
    setEvaluatingAlerts(true)
    setAlertFormMessage('')
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/alerts/evaluate`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error('알림 평가 실패')
      }
      const payload = await res.json()
      setAlertFormMessage(`알림 평가 완료: ${payload.triggered_count ?? 0}건 기록`)
      await loadDashboard(false)
    } catch (err) {
      setAlertFormMessage(err.message || '알림 평가에 실패했습니다.')
    } finally {
      setEvaluatingAlerts(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-left">
          <p className="hero-kicker">B2B 의사결정 지원</p>
          <h1>유가 예측 대시보드</h1>
          <p>실시간 지표, 단기 예측, AI 브리핑으로 구매 타이밍을 빠르게 판단합니다.</p>
        </div>
        <div className="hero-actions">
          <div className={`score-pill ${scoreClass}`}>
            Score {purchaseScore?.score ?? '-'} / 100 · {actionLabel[purchaseScore?.action] || '판단 중'}
          </div>
          <button type="button" onClick={loadDashboard} className="refresh-btn">
            최신 데이터 갱신
          </button>
        </div>
      </header>

      {loading && (
        <p className="state-banner">
          <span className="spinner" aria-hidden="true" />
          데이터를 불러오는 중입니다...
        </p>
      )}
      {error && <p className="state-banner error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="grid cards-5">
            <article className="card metric">
              <h2>WTI</h2>
              <p className="value">{formatNumber(realtime?.wti_usd)}</p>
              <span>USD/barrel</span>
            </article>
            <article className="card metric">
              <h2>브렌트유</h2>
              <p className="value">{formatNumber(realtime?.brent_usd)}</p>
              <span>USD/barrel</span>
            </article>
            <article className="card metric">
              <h2>USD/KRW</h2>
              <p className="value">{formatNumber(realtime?.usd_krw)}</p>
              <span>KRW/USD</span>
            </article>
            <article className="card metric">
              <h2>국내 평균 휘발유</h2>
              <p className="value">{formatNumber(realtime?.domestic_avg_gasoline_krw)}</p>
              <span>KRW/L</span>
            </article>
            <article className="card metric highlight">
              <h2>Smart Purchase Score</h2>
              <p className="value">{purchaseScore?.score ?? '-'}</p>
              <span>{actionLabel[purchaseScore?.action] || '데이터 부족'}</span>
            </article>
          </section>

          <section className="grid cards-3">
            <article className="card savings-card">
              <div className="card-head">
                <h2>지난 30일 구매 시뮬레이션</h2>
                <span className="card-badge">Backtest</span>
              </div>
              <p className="section-note">
                월요일마다 고정 구매하는 방식과 구매 점수 기반 구매를 비교한 데모 시뮬레이션입니다.
              </p>
              <div className="savings-hero">
                <span>예상 개선 효과</span>
                <strong>{formatNumber(decisionMetrics.savings, 0)}원</strong>
              </div>
              <div className="compare-list">
                <div>
                  <span>고정 구매 비용</span>
                  <strong>{formatNumber(decisionMetrics.mechanicalCost, 0)}원</strong>
                </div>
                <div>
                  <span>플랫폼 구매 비용</span>
                  <strong>{formatNumber(decisionMetrics.platformCost, 0)}원</strong>
                </div>
              </div>
              <p className="compact-note">
                리터당 평균 {formatNumber(decisionMetrics.scoreSavingsPerLiter)}원 절감 가정, 월 48,000L 기준.
              </p>
            </article>

            <article className="card tank-card">
              <div className="card-head">
                <h2>가상 재고통</h2>
                <span className="card-badge">Tank</span>
              </div>
              <div className="tank-layout">
                <div className="tank-visual" aria-label="가상 재고통">
                  <div
                    className="tank-fill"
                    style={{ height: `${decisionMetrics.normalizedTankLevel}%` }}
                  />
                  <span>{Math.round(decisionMetrics.normalizedTankLevel)}%</span>
                </div>
                <div className="tank-control">
                  <label className="field">
                    <span>현재 재고율</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={tankLevel}
                      onChange={(e) => setTankLevel(Number(e.target.value))}
                    />
                  </label>
                  <div className="tank-stats">
                    <strong>{formatNumber(decisionMetrics.availableLiters, 0)}L 여유</strong>
                    <span>기회비용 {formatNumber(decisionMetrics.avoidableCost, 0)}원</span>
                  </div>
                </div>
              </div>
              <p className="briefing-summary">{decisionMetrics.tankAction}</p>
            </article>

            <article className="card notify-card">
              <div className="card-head">
                <h2>알림 내역 패널</h2>
                <span className="card-badge">Push</span>
              </div>
              <div className="notification-list">
                {decisionMetrics.notifications.map((item) => (
                  <div className={`notification ${item.level}`} key={`${item.title}-${item.body}`}>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid cards-2">
            <article className="card">
              <div className="card-head">
                <h2>7일 예측</h2>
                <span className="card-badge">Forecast</span>
              </div>
              <p className="section-note">
                유가 예측 추세와 뉴스·공시 감성을 반영한 예측을 함께 표시합니다. 뉴스 점수: {forecastInfo?.newsSentimentScore ?? '-'}
              </p>
              {forecast.length === 0 ? (
                <p className="muted">예측 데이터가 없습니다.</p>
              ) : (
                <>
                  <ForecastChart rows={forecast} formatNumber={formatNumber} />
                  <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>구간</th>
                        <th>유가 예측 추세</th>
                        <th>뉴스 공시 포함 예측</th>
                        <th>보정</th>
                        <th>하한</th>
                        <th>상한</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.map((row) => (
                        <tr key={`${row.target_date}-${row.horizon_days}`}>
                          <td>{row.target_date}</td>
                          <td>D+{row.horizon_days}</td>
                          <td>{formatNumber(row.baseline_predicted_price ?? row.predicted_price)}</td>
                          <td>{formatNumber(row.news_adjusted_predicted_price ?? row.predicted_price)}</td>
                          <td>{formatNumber(row.news_adjustment ?? 0)}</td>
                          <td>{formatNumber(row.lower_bound)}</td>
                          <td>{formatNumber(row.upper_bound)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  <p className="muted compact-note">{forecastInfo?.newsAdjustmentMethod}</p>
                </>
              )}
            </article>

            <article className="card briefing-card">
              <div className="card-head">
                <h2>AI 시장 브리핑</h2>
                <span className="card-badge">Insight</span>
              </div>
              <div className={`sentiment ${sentimentClass}`}>
                {sentimentLabel[briefing?.sentiment] || sentimentLabel.neutral}
              </div>
              <p className="briefing-title">{briefing?.title || '브리핑 없음'}</p>
              <p className="briefing-summary">{briefing?.summary || '-'}</p>
              <p className="muted">
                감성 점수: {briefing?.score ?? '-'} · 기준일: {briefing?.based_on_date ?? '-'}
              </p>
            </article>
          </section>
          <section className="grid cards-1">
            <article className="card guide-card">
              <div className="card-head">
                <h2>구매 점수 설명</h2>
                <span className="card-badge">Action</span>
              </div>
              <p className="briefing-summary">{purchaseScore?.reason || '점수 계산 데이터가 부족합니다.'}</p>
              <div className="factor-list">
                {decisionMetrics.xaiFactors.map((factor) => (
                  <div className="factor-row" key={factor.label}>
                    <div className="factor-meta">
                      <strong>{factor.label}</strong>
                      <span className={`factor-chip ${factor.tone}`}>{factor.summary}</span>
                    </div>
                    <div className="factor-track">
                      <span
                        className={`factor-fill ${factor.tone}`}
                        style={{ width: `${factor.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="guide-points">
                <div className="guide-point">
                  <strong>현재가</strong>
                  <span>{formatNumber(purchaseScore?.current_price)} 원/L</span>
                </div>
                <div className="guide-point">
                  <strong>D+1 예측</strong>
                  <span>{formatNumber(purchaseScore?.predicted_tomorrow)} 원/L</span>
                </div>
                <div className="guide-point">
                  <strong>D+3 예측</strong>
                  <span>{formatNumber(purchaseScore?.predicted_3d)} 원/L</span>
                </div>
              </div>
            </article>
          </section>
          <section className="grid cards-2">
            <article className="card alert-form-card">
              <div className="card-head">
                <h2>알림 규칙 등록</h2>
                <span className="card-badge">Alert</span>
              </div>
              <p className="section-note">
                예측가와 현재가 차이가 임계치를 넘으면 알림 이력에 기록됩니다.
              </p>
              <div className="alert-form">
                <label className="field">
                  <span>규칙 이름</span>
                  <input
                    placeholder="예: 휘발유 10원 상승 알림"
                    value={newRule.name}
                    onChange={(e) => {
                      setAlertFormMessage('')
                      setNewRule((prev) => ({ ...prev, name: e.target.value }))
                    }}
                  />
                </label>
                <div className="alert-form-grid">
                  <label className="field">
                    <span>알림 유형</span>
                    <select
                      value={newRule.rule_type}
                      onChange={(e) => setNewRule((prev) => ({ ...prev, rule_type: e.target.value }))}
                    >
                      <option value="rise">상승 알림</option>
                      <option value="drop">하락 알림</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>임계치 (원/L)</span>
                    <input
                      placeholder="예: 10"
                      type="number"
                      min="1"
                      value={newRule.threshold}
                      onChange={(e) => {
                        setAlertFormMessage('')
                        setNewRule((prev) => ({ ...prev, threshold: e.target.value }))
                      }}
                    />
                  </label>
                </div>
                <div className="alert-form-actions">
                  <button type="button" className="submit-btn" onClick={createAlertRule}>
                    등록
                  </button>
                </div>
                {alertFormMessage && (
                  <p className={`form-message ${isSuccessMessage(alertFormMessage) ? 'success' : 'error'}`}>
                    {alertFormMessage}
                  </p>
                )}
              </div>
            </article>
            <article className="card">
              <div className="card-head">
                <h2>등록된 알림 규칙</h2>
                <button
                  type="button"
                  className="evaluate-btn"
                  onClick={evaluateAlerts}
                  disabled={evaluatingAlerts}
                >
                  {evaluatingAlerts ? '평가 중' : '즉시 평가'}
                </button>
              </div>
              <p className="section-note">
                등록된 규칙 {alertRules.length}건 중 {alertRules.filter((rule) => rule.enabled).length}건이 활성 상태입니다.
              </p>
              {alertRules.length === 0 ? (
                <p className="muted">등록된 규칙이 없습니다.</p>
              ) : (
                <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>유형</th>
                      <th>임계치</th>
                      <th>활성</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertRules.map((rule) => (
                      <tr key={rule.id}>
                        <td>{rule.name}</td>
                        <td>{rule.rule_type === 'rise' ? '상승' : '하락'}</td>
                        <td>{rule.threshold}</td>
                        <td>
                          <button
                            type="button"
                            className={`toggle-btn ${rule.enabled ? 'on' : 'off'}`}
                            onClick={() => toggleAlertRule(rule)}
                            aria-pressed={rule.enabled}
                          >
                            {rule.enabled ? '활성' : '비활성'}
                          </button>
                        </td>
                        <td className="table-actions">
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => deleteAlertRule(rule.id)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </article>
          </section>
          <section className="grid cards-1">
            <article className="card">
              <div className="card-head">
                <h2>최근 알림 이력</h2>
                <span className="card-badge">{alertHistory.length}건</span>
              </div>
              {alertHistory.length === 0 ? (
                <p className="muted">최근 기록된 알림이 없습니다.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>발생 시각</th>
                        <th>규칙</th>
                        <th>현재가</th>
                        <th>예측가</th>
                        <th>내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertHistory.map((history) => (
                        <tr key={history.id}>
                          <td>{new Date(history.triggered_at).toLocaleString('ko-KR')}</td>
                          <td>{history.rule_name}</td>
                          <td>{formatNumber(history.current_price)} 원/L</td>
                          <td>{formatNumber(history.predicted_price)} 원/L</td>
                          <td>{history.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
          <footer className="app-footer">Oil Predict · 유가 예측 의사결정 지원 대시보드</footer>
        </>
      )}
    </div>
  )
}

export default App
