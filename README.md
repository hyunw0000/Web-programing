# 유가 예측 의사결정 지원 플랫폼

개인 주유소를 위한 데이터 기반 유류 구매 타이밍 의사결정 지원 서비스입니다.

## 프로젝트 목표

- 직관/경험 중심 구매를 데이터 기반 의사결정으로 전환
- 유가, 환율, 뉴스, 현물가를 통합한 원스톱 대시보드 제공
- AI 브리핑 및 구매 점수로 운영 리스크 감소

## 핵심 기능 (MVP)

- 실시간 지표 대시보드 (국제유가, 환율, 국내 평균가)
- 단기 가격 예측 (D+1, D+3, D+7)
- AI 시장 브리핑 (상승/하락 요인 요약)
- Smart Purchase Score (오늘/내일/관망)

## 권장 기술 스택

- 백엔드: Python, Django, Django REST Framework
- 데이터 수집: requests, APScheduler (초기), Celery (확장)
- 데이터 저장: PostgreSQL (확장 시 TimescaleDB)
- 프론트엔드: React 또는 Next.js
- AI 분석: Gemini/ChatGPT API
- 테스트: pytest, pytest-django

## 문서

- 제안서: `docs/project-proposal.md`
- 개발 로드맵: `docs/development-roadmap.md`
- 시스템 아키텍처: `docs/system-architecture.md`

## 빠른 시작 (개발 준비)

1. Python 3.11 이상 설치
2. PostgreSQL 설치 및 DB 생성
3. API 키 발급
   - 오피넷 (`OPINET_API_KEY`)
   - 네이버 뉴스 (`NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`) — 선택, 뉴스 감성용
   - **Gemini (`GEMINI_API_KEY`)** — AI 브리핑·뉴스 감성 분석
   - **OpenAI (`OPENAI_API_KEY`)** — AI 채팅 Gemini 실패 시 fallback
4. `.env.example`을 복사해 `.env` 작성

### Gemini AI 연동

`.env`에 아래만 설정하면 AI 브리핑과 뉴스 감성 분석이 자동으로 Gemini를 사용합니다.

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
```

- 브리핑 생성: `briefing/services/generator.py` → `market_data/services/gemini_client.py`
- 뉴스 감성: `market_data/services/collectors.py` → Gemini 우선, 실패 시 키워드 fallback
- AI 채팅: Gemini 우선, Gemini 미설정/실패 시 OpenAI fallback
- API 키가 없으면 기존 규칙 기반 로직으로 동작

데이터 생성:

```bash
python manage.py collect_market_data
python manage.py generate_forecast
python manage.py generate_briefing
```

## 실행 방법 (로컬)

### 백엔드

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 프론트엔드

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## 실행 방법 (Docker Compose)

```bash
docker compose up --build
```

- 백엔드: `http://localhost:8000`
- 프론트: `http://localhost:5173`
- DB(PostgreSQL): `localhost:5432`

환경변수(API 키)는 `docker compose` 실행 전에 shell 환경으로 주입하거나 `.env` 파일로 관리함.
