🇰🇷 [English](./README.md)

# SleepDebtTracker — 토스에서 만나는 수면 건강 관리

일일 수면을 기록하고 누적 수면 부채를 계산하며, 데이터 기반의 주말 회복 계획을 제공하는 토스 미니앱입니다. 사용자는 수면 패턴을 기록함으로써 자신의 수면 리듬을 이해하고 건강한 수면 습관을 회복하기 위한 맞춤형 전략을 받을 수 있습니다.

## 기능

- 📊 **수면 부채 대시보드** — 실시간 누적 부채 계산 및 스파크라인을 통한 7일 추이 시각화
- 📝 **일일 수면 기록** — 빠른 취침/기상 시간 입력 및 수면 시간·일일 부채 자동 계산
- 📈 **주간 수면 보고서** — 7일 수면 패턴을 막대 차트로 표시, 총 부채·평균 수면·최대 부채일 요약
- 🛏️ **주말 회복 계획** — 토요일/일요일의 규칙 기반 회복 수면 일정 (최대 +2시간 상한선으로 과수면 방지)
- 🔄 **연속 기록 추적** — 일일 체크인 연속 일수 카운터로 꾸준한 기록 유도
- 🧠 **시간형 판정** — 5가지 질문 수면형 진단 (아침형·저녁형·중간형)
- ⚙️ **설정** — 목표 수면 시간 커스터마이징 (4–12시간, 기본값 8시간)
- 📲 **리워드 광고** — 선택 30초 동영상 광고를 통해 상세 보고서 및 회복 계획 잠금 해제

## 기술 스택

- **프레임워크**: React 18 + React Router v7.5 (클라이언트사이드 라우팅)
- **빌드**: Vite 6.3
- **언어**: TypeScript 5.8 (strict mode)
- **UI**: Toss Design System (`@toss/tds-mobile`), Emotion CSS-in-JS
- **플랫폼**: App-in-Toss WebView (`@apps-in-toss/web-framework`)
- **데이터 저장**: 브라우저 `localStorage` (백엔드/데이터베이스 없음)
- **분석**: Toss Analytics SDK
- **테스트**: Vitest + React Testing Library (단위 테스트), Playwright (시각 회귀)

## 시작하기

### 필수 요구사항
- Node.js 18+
- pnpm (권장) 또는 npm

### 설치

```bash
pnpm install --ignore-workspace
```

### 개발 서버

```bash
pnpm dev
```

`http://localhost:5173`에서 Vite 개발 서버를 시작합니다. 앱은 백엔드 없이 브라우저에서만 실행됩니다.

### 빌드

```bash
pnpm build
```

정적 HTML/JS/CSS을 `dist/`로 출력하여 Toss CDN 배포용으로 준비합니다.

### 테스트

```bash
# 단위 및 통합 테스트
pnpm test

# 시각 회귀 테스트
pnpm test:visual

# 시각 스냅샷 업데이트
pnpm test:visual:update

# 감시 모드
pnpm test:watch

# 타입 확인
pnpm typecheck
```

## 환경 변수

| 변수 | 설명 | 필수 | 예시 |
|---|---|---|---|
| `VITE_TOSS_AD_GROUP_ID` | Toss 광고 배너 슬롯 ID (앱인토스 콘솔) | 아니오 | `"ad-group-123"` |
| `VITE_TOSS_AD_SLOT_ID` | 보고서/계획용 Toss 리워드 광고 슬롯 ID | 아니오 | `"reward-ad-456"` |

로컬 개발을 위해 `.env.local`을 만들어주세요 (git에 커밋되지 않음).

## 프로젝트 구조

```
src/
├── pages/               # React Router 페이지 (파일 하나 = 라우트 하나)
│   ├── HomePage.tsx     # 부채 히어로 & 7일 추이를 포함한 대시보드
│   ├── RecordPage.tsx   # 일일 수면 입력 폼
│   ├── ReportPage.tsx   # 주간 보고서 (리워드 광고 게이트)
│   ├── PlanPage.tsx     # 주말 회복 계획 (리워드 광고 게이트)
│   ├── ChronotypePage.tsx         # 수면형 설문
│   ├── ChronotypeResultPage.tsx   # 수면형 진단 결과
│   ├── SettingsPage.tsx # 사용자 선택사항 (목표 수면 시간)
│   └── OnboardingPage.tsx         # 첫 사용 소개 플로우
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── ScreenScaffold.tsx  # 상단 네비를 포함한 페이지 틀
│   ├── SummaryHero.tsx     # 대형 지표 표시 (부채 시간)
│   ├── Sparkline.tsx       # 소형 7일 추이 차트
│   ├── MiniBar.tsx         # 개별 일일 막대
│   ├── StateView.tsx       # 빈 상태/로딩 상태
│   ├── FloatingTabBar.tsx  # 하단 네비게이션 (5개 탭)
│   ├── TossRewardAd.tsx    # 리워드 광고 래퍼
│   ├── AdSlot.tsx          # 배너 광고 컨테이너
│   └── ...
├── lib/
│   ├── storage.ts      # localStorage CRUD (기록, 설정, 연속, 수면형)
│   ├── calc.ts         # 핵심 수학: 수면/부채/회복 계산
│   ├── derive.ts       # 파생 데이터 (요일 레이블, 회복 예측)
│   ├── types.ts        # TypeScript 인터페이스 (SleepRecord, UserSettings, 등)
│   ├── utils.ts        # 헬퍼 (시간 포맷팅, 유효성 검사)
│   ├── records.ts      # 연속 업데이트를 포함한 기록 upsert 로직
│   └── adConfig.ts     # 광고 슬롯 환경 설정 싱글톤
└── __tests__/          # Vitest 단위/통합 테스트
```

## 핵심 데이터 모델

### SleepRecord
```typescript
interface SleepRecord {
  id: string;           // "${date}" (YYYY-MM-DD, 날짜당 1개)
  date: string;         // "2026-07-30"
  bedTime: string;      // "23:30" (HH:mm, 24시간 형식)
  wakeTime: string;     // "06:00" (HH:mm, 24시간 형식)
  sleepMinutes: number; // 자동 계산 (자정 넘김 처리)
  debtMinutes: number;  // 목표 - 수면시간
  createdAt: number;    // epoch ms
}
```

### UserSettings
```typescript
interface UserSettings {
  targetMinutes: number; // 목표 수면 (분), 기본값 480 (8시간), 범위 240–720
  onboarded: boolean;    // 첫 사용 플로우 완료
  aiNoticeAck: boolean;  // (예약됨) AI 공개 승인
}
```

### Streak
```typescript
interface Streak {
  current: number;       // 연속으로 체크인한 일수
  best: number;         // 최고 연속 기록
  lastCheckDate: string; // 마지막 기록 날짜 (YYYY-MM-DD)
}
```

## API 및 계산 규칙

모든 계산은 규칙 기반이며 AI/ML을 사용하지 않습니다. `src/lib/calc.ts`의 주요 함수:

- `calcSleep(bedTime, wakeTime, targetMinutes)` — 일일 수면 및 부채 계산
- `getCumulativeDebt(records)` — 14일 누적 부채 합
- `estimatePayoffDays(debt, avgExcessCapacity)` — 부채 0까지 걸리는 일수
- `getDayofWeek(date)` — 보고서/계획 라벨용

자정을 넘는 수면 (예: 23:30 → 6:00)은 자동 보정됩니다: wakeTime < bedTime이면 +1440분 조정이 발동됩니다.

## 기능 상세 설명

### 📊 홈 대시보드 (HomePage)
- 누적 부채 (14일 롤링)를 히어로 지표로 표시 (CountUp 애니메이션 포함 SummaryHero)
- 부채 > 0일 때 "회복까지 남은 일수" 예측 표시
- 현재 및 최고 연속 일수를 보여주는 연속 배지
- 7일 부채 추이를 스파크라인 차트로 표시
- 당일 기록이 없으면 "오늘 기록" CTA
- 기록이 없으면 빈 상태 표시

### 📝 기록 페이지 (RecordPage)
- 취침 및 기상 시간을 위한 시간 입력기 (모바일에서 숫자 키보드)
- 입력하면서 실시간 수면/부채 미리보기
- 두 시간이 모두 입력되고 유효할 때까지 저장 버튼 비활성화
- 같은 날 upsert: 해당 날짜의 기존 항목 대체
- 저장 성공 시: 연속 업데이트, 토스트 표시, 홈으로 이동

### 📈 주간 보고서 (ReportPage)
- 30초 리워드 광고 시청 필수로 전체 보고서 잠금 해제
- 7일 막대 차트 (MiniBar × 7) 표시 (부채일 강조)
- 요약 카드: 주간 총 부채, 평균 수면, 최대 부채 요일
- 지난 7일 기록이 3일 미만이면 빈 상태 표시
- 데이터 로드 중 스켈레톤 로딩

### 🛏️ 회복 계획 (PlanPage)
- 리워드 광고 게이트 적용
- 토요일/일요일에 부채 해소를 위해 필요한 추가 수면 계산
- 상한선 적용: 추가 수면은 최대 +2시간 (14시간 수면 방지)
- 각 날짜의 목표 취침/기상 시간 표시
- 부채 = 0이면 빈 상태 표시 ("회복 불필요")

### 🧠 시간형 진단 (ChronotypePage)
- 5가지 질문 Likert 척도 (질문당 1–5점)
- 점수 체계: 총 5–25점
- 유형: 5–9점 = 저녁형, 10–15점 = 중간형, 16–25점 = 아침형
- 결과 캐시됨; 재응답 버튼으로 재평가 가능

### ⚙️ 설정 (SettingsPage)
- 목표 수면 시간 슬라이더 (4–12시간)
- localStorage에 즉시 저장
- 모든 부채 계산에서 사용

## 수익화

- **배너 광고** — 대시보드 카드 아래 배치 (콘텐츠 겹침 없음)
- **리워드 광고** — 상세 보고서 게이트 (주간, 30초 동영상, 높은 CPM)
- **구독/인앱 결제 없음** — 모든 기능 무료

## 배포

App-in-Toss 콘솔을 통해 Toss CDN에 배포합니다:

```bash
npx ait deploy --api-key $APPS_IN_TOSS_API_KEY
```

빌드 결과물(`dist/`)은 100MB 미만이어야 합니다. Android 7+, iOS 16+를 지원합니다.

## 브라우저 및 오프라인 지원

- 완전 오프라인 실행 (외부 API 호출 없음)
- 최신 브라우저 및 Toss WebView에서 작동
- localStorage에 데이터 지속 (선택적으로 SDK `Storage`를 통한 모바일 네이티브 지속성)

## 코드 품질

- **TypeScript strict** — 모든 `any` 타입을 `unknown`으로 변경
- **외부 API 호출 없음** — 모든 계산/저장은 로컬
- **테스트 주도** — 모든 기능에 TDD red/green/refactor 적용
- **접근성** — 의미있는 HTML, 아이콘 버튼에 aria-label, 44px 터치 대상 (TDS 기본값)
- **다크 모드** — CSS 변수를 통한 완전 지원 (하드코딩 hex 색상 없음)

## 개발 워크플로우

1. **기능 브랜치** → 테스트 작성 (`.test.ts`) → 코드 구현 → `pnpm test` + `pnpm typecheck` 실행 → 커밋
2. **시각 리뷰** → `pnpm test:visual` → `.playwright/test-results/` 스냅샷 확인 → 깔끔하면 병합
3. **배포** → `pnpm build` → `dist/` 확인 → Toss CDN에 푸시

## 알려진 제한사항

- localStorage 쿼터 (기기에 따라 ~5–10MB) — 앱은 1년치 일일 데이터에 약 60KB 사용
- 디바이스 간 동기화 없음 — 데이터는 해당 기기 로컬만
- 클라우드 백업 없음 — 사용자가 앱 데이터를 삭제하면 손실

## 라이선스

MIT
