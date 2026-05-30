# 시스템 아키텍처 초안

## 전체 구성

- Frontend (React/Next.js)
- Backend API (Django + DRF)
- Data Collector (주기 수집 배치)
- Prediction Service (시계열 모델 추론)
- AI Briefing Service (LLM 기반 정성 분석)
- PostgreSQL (+ TimescaleDB 옵션)
- Cache/Queue (Redis)

## 데이터 흐름

1. 수집기에서 오피넷/금융/뉴스 데이터 수집
2. 표준화 후 DB 적재
3. 예측 서비스가 최신 데이터로 추론 수행
4. AI 브리핑 서비스가 뉴스 + 수치 데이터를 요약
5. 프론트엔드에서 대시보드/API 조회

## 핵심 엔티티

- `raw_market_data`: 원천 시계열 데이터
- `daily_feature_snapshot`: 모델 입력 피처 스냅샷
- `price_forecast`: 일자별 예측 결과
- `news_sentiment`: 뉴스 감성 분석 결과
- `market_briefing`: AI 브리핑 결과
- `alert_rule`, `alert_history`: 사용자 알림 규칙/이력

## API 예시

- `GET /api/v1/dashboard/realtime`
- `GET /api/v1/forecast?horizon=7d`
- `GET /api/v1/briefings/latest`
- `POST /api/v1/alerts/rules`

## 비기능 요구사항

- 가용성: 외부 API 장애 시 fallback 값 제공
- 신뢰성: 데이터 누락 감지 및 재수집
- 확장성: 수집 소스 추가가 쉬운 모듈 구조
- 보안: API 키 분리 보관, 사용자 인증/권한 분리

## 테스트 전략

- Unit: 계산/변환/스코어 산식 검증
- Integration: 수집 -> 저장 -> 조회 파이프라인 검증
- Performance: 대시보드 쿼리 응답 시간 기준선 관리
- AI Validation: 환각 방지를 위한 규칙 기반 검사
