# SPEC — SleepDebtTracker

## Common Principles

- **플랫폼**: 앱인토스 (Vite + React + TypeScript + TDS `@toss/tds-mobile`), React Router(`react-router-dom`) 클라이언트 라우팅, 데이터는 전부 `localStorage`.
- **인증**: 토스 세션 자동 제공. 별도 로그인 함수 호출 없음. 사용자 식별 필요 시 `getIsTossLoginIntegratedService()`로 상태 확인만.
- **UI**: 모든 화면은 모바일 최적화. TDS 핵심 컴포넌트(ListRow, Button, TextField, Paragraph.Text, Chip, Switch, AlertDialog, BottomSheet, Toast, Top, Tab)만 사용. 하단 탭은 템플릿 제공 `src/components/FloatingTabBar` 사용. 모든 터치 타깃 ≥ 44px.
- **여백/간격**: TDS 내장 padding 유지, 간격은 TDS `Spacing`(size prop 필수)만 사용. 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트만 — HEX 하드코딩 금지(다크모드 필수).
- **수익화**: 배너 광고 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`, 보상형 광고 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{children}</TossRewardAd>`. 광고는 콘텐츠와 겹치지 않게 섹션 사이/결과 뒤에만 배치.
- **알고리즘 규칙 기반**: 부채 계산·회복 플랜·유형 진단은 전부 결정론적 규칙 기반(생성형 AI 미사용). 따라서 생성형 AI 고지 의무 대상 아님 (Assumptions 참고).
- **외부 통신 없음**: 외부 API·외부 로깅(GA/Amplitude 등)·외부 도메인 이탈 없음. 전 기능 오프라인 동작.
- **금지어 검증**: 프로덕션 빌드에서 `console.error` 0개, CORS 에러 0개.

---

## Data Models

### SleepRecord — 하루 수면 기록
```typescript
interface SleepRecord {
  id: string;             // `${date}` (YYYY-MM-DD, 하루 1건, upsert)
  date: string;           // "2026-07-30" (기상일 기준)
  bedTime: string;        // "23:30" (HH:mm, 24h)
  wakeTime: string;       // "06:00" (HH:mm, 24h)
  sleepMinutes: number;   // 계산값, 0~1440 (자정 넘김 보정 포함)
  debtMinutes: number;    // targetMinutes - sleepMinutes (음수면 초과수면=상환)
  createdAt: number;      // epoch ms
}
```
- 제약: `bedTime`/`wakeTime`은 `^([01]\d|2[0-3]):([0-5]\d)$` 형식. `sleepMinutes` = wake가 bed보다 이르면 +1440 보정.

### UserSettings — 목표/설정
```typescript
interface UserSettings {
  targetMinutes: number;      // 목표 수면(분), 기본 480 (8시간), 범위 240~720
  aiNoticeAck: boolean;       // (예약) 고지 확인 플래그, 기본 false
  onboarded: boolean;         // 온보딩 완료, 기본 false
}
```

### Streak — 연속 체크인
```typescript
interface Streak {
  current: number;        // 현재 연속일, 기본 0
  best: number;           // 최고 기록, 기본 0
  lastCheckDate: string;  // 마지막 기록일 "YYYY-MM-DD", 기본 ""
}
```

### ChronotypeResult — 수면 유형 진단 결과
```typescript
type ChronotypeType = 'MORNING' | 'EVENING' | 'INTERMEDIATE';
interface ChronotypeResult {
  type: ChronotypeType;   // 아침형/저녁형/중간형
  score: number;          // 5~25 (5문항 × 1~5점)
  answeredAt: number;     // epoch ms
}
```

### localStorage 키 & 크기 추정
| 키 | 데이터 형태 | 추정 크기 |
|---|---|---|
| `sdt.records` | `SleepRecord[]` | 1건 ≈ 160B, 365건 ≈ 58KB |
| `sdt.settings` | `UserSettings` | ≈ 80B |
| `sdt.streak` | `Streak` | ≈ 70B |
| `sdt.chronotype` | `ChronotypeResult` | ≈ 90B |
| **합계(1년)** | | **≈ 59KB (< 5MB)** |

- 저장 실패(용량 초과 등) 시 `QuotaExceededError`를 catch하여 에러 토스트 표시, 앱 크래시 금지.

---

## Feature List

### F1. 데이터 저장 레이어 & 부채 계산 엔진
- **Description**: 수면 기록 CRUD, 설정, 스트릭, 진단 결과를 localStorage로 영속화하는 순수 함수 모듈과 부채 계산 엔진을 제공한다. UI 없이 모든 화면이 의존하는 계산·저장 기반이며, 자정 넘김 보정과 누적 부채(최근 14일 롤링) 계산을 담당한다.
- **Data**: SleepRecord, UserSettings, Streak, ChronotypeResult
- **API**: 없음 (전부 로컬)
- **Requirements**:
- AC-1 [U][P0]: The system shall `getRecords()` 호출 시 `sdt.records`를 파싱해 `date` 오름차순 `SleepRecord[]`를 반환한다.
- AC-2 [E][P0]: Scenario: 자정 넘김 수면시간 계산
  Given 목표 480분 설정 유저
  When `calcSleep({ bedTime: "23:30", wakeTime: "06:00" })` 호출
  Then `sleepMinutes = 390`, `debtMinutes = 90` 반환
- AC-3 [E][P0]: Scenario: 같은 날짜 upsert
  Given `sdt.records`에 date "2026-07-30" 기록이 이미 1건 존재
  When 동일 date로 `saveRecord()` 호출
  Then 배열 길이는 그대로이고 해당 항목만 갱신됨
- AC-4 [U][P0]: The system shall `getCumulativeDebt()` 호출 시 최근 14일 `debtMinutes` 합을 반환하며, 합이 음수면 0으로 클램프한다(상환 완료).
- AC-5 [W][P1]: Scenario: 손상된 localStorage 복구
  Given `sdt.records` 값이 `"{invalid"` (파싱 불가)
  When `getRecords()` 호출
  Then 빈 배열 `[]`을 반환하고 `console.error` 없이 정상 동작
- AC-6 [W][P1]: Scenario: 저장 용량 초과
  Given `localStorage.setItem`이 `QuotaExceededError` throw
  When `saveRecord()` 호출
  Then `{ ok: false, reason: "QUOTA" }` 반환(throw 안 함)
- AC-7 [W][P1]: Scenario: 잘못된 시간 형식 거부
  Given `bedTime: "25:70"`
  When `calcSleep()` 호출
  Then `{ ok: false, reason: "INVALID_TIME" }` 반환

### F2. 일일 수면 입력
- **Description**: 사용자가 취침·기상 시간을 입력하면 수면시간과 당일 부채를 즉시 계산해 저장한다. 하루 1건 upsert이며 저장 성공 시 스트릭이 갱신되고 홈으로 복귀한다.
- **Data**: SleepRecord, Streak, UserSettings
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 수면 기록 저장 성공
  Given 목표 480분 유저가 `/record`에서
  When `{ bedTime: "23:00", wakeTime: "07:00" }` 입력 후 TDS Button "저장" 탭
  Then `sleepMinutes 480, debtMinutes 0` 저장, 성공 Toast "기록이 저장됐어요" 표시, `navigate('/')`
- AC-2 [E][P0]: Scenario: 부채 발생 케이스
  When `{ bedTime: "01:00", wakeTime: "06:00" }` 입력·저장
  Then `sleepMinutes 300, debtMinutes 180` 저장
- AC-3 [S][P1]: While 기상시간이 비어 있을 때, the system shall "저장" 버튼을 `disabled` 처리한다.
- AC-4 [W][P1]: Scenario: 동일 시간 입력 거부
  When `{ bedTime: "07:00", wakeTime: "07:00" }` 입력·저장
  Then 에러 메시지 "취침·기상 시간이 같아요" 표시, 저장 안 됨
- AC-5 [E][P1]: Scenario: 기존 기록 수정
  Given date "2026-07-30" 기록이 이미 존재
  When 같은 날짜 폼 진입 시 기존 값이 프리필됨, 수정 후 저장
  Then 기록 1건이 갱신되고 Toast 표시
- AC-6 [U][P1]: The system shall 시간 입력 시 TDS TextField에 `inputMode="numeric"`를 지정해 숫자 키패드를 노출하고, 키보드가 저장 버튼을 가리지 않도록 SubmitFooter를 키보드 위에 고정한다.
- AC-7 [W][P1]: Scenario: 저장 용량 초과 처리
  Given F1이 `{ ok:false, reason:"QUOTA" }` 반환
  When 저장 시도
  Then 에러 Toast "저장 공간이 부족해요" 표시, 크래시 없음

### F3. 수면 부채 대시보드 (홈)
- **Description**: 누적 수면 부채(시간)와 오늘 기록 여부, 상환 예상일을 한눈에 보여주는 홈 화면이다. 부채 규모를 CountUp 히어로로 강조하고 최근 7일 추이를 Sparkline으로 시각화한다.
- **Data**: SleepRecord, UserSettings, Streak
- **API**: 없음
- **Requirements**:
- AC-1 [U][P0]: The system shall 홈 진입 시 `getCumulativeDebt()` 값을 "N시간 M분" 형식으로 `data-testid="debt-hero"` SummaryHero에 표시한다.
- AC-2 [E][P0]: Scenario: 상환 예상일 계산
  Given 누적 부채 600분, 일평균 초과수면 잠재량 60분/일 가정(목표-평균수면의 절댓값, 최소 30분)
  When 홈 진입
  Then `data-testid="payoff-card"` Card에 "약 10일 후 상환 완료" 표시
- AC-3 [S][P1]: While 오늘(`currentDate`) 기록이 없을 때, the system shall 홈 상단에 TDS Button "오늘 수면 기록하기"(display="block")를 노출한다.
- AC-4 [S][P1]: While 저장된 기록이 0건일 때, the system shall Asset.ContentIcon 빈 상태와 "첫 수면을 기록해보세요" 문구를 표시한다(차트/히어로 숨김).
- AC-5 [U][P1]: The system shall 홈 로딩 중 데이터 파싱 완료 전까지 스켈레톤(TDS Skeleton) 히어로를 표시한다.
- AC-6 [U][P0]: Scenario: 대시보드 레이아웃 계약
  Given 기록 3건 이상 존재
  Then 홈은 ScreenScaffold로 감싸이고 `data-testid="debt-hero"` SummaryHero(강조 타이포 t2) 1개와 `data-testid="trend-sparkline"` Sparkline(최근 7일 debt) 1개를 가진다
- AC-7 [E][P2]: When 부채가 0분이면, the system shall 히어로에 "수면 부채 없음 🎉" 배지(TDS Chip)를 표시한다.
- AC-8 [O][P1]: Where 배너 광고가 활성일 때, the system shall `<AdSlot>`을 대시보드 카드 섹션 하단(콘텐츠와 겹치지 않게)에 1개 배치한다.

### F4. 주간 수면 부채 리포트 (리워드 게이팅)
- **Description**: 최근 7일 수면시간·부채를 막대 차트로 시각화한 주간 리포트를 제공한다. 리포트 열람 전 보상형 광고를 시청해야 결과가 공개되며(주 1회 고CPM), 주간 총 부채/평균 수면/최다 부족 요일을 요약한다.
- **Data**: SleepRecord, UserSettings
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 리포트 열람 전 보상형 광고
  Given 유저가 `/report`에서 "리포트 보기" 탭
  When `<TossRewardAd>` 광고 시청 완료
  Then 주간 리포트 결과 카드가 표시됨
- AC-2 [U][P0]: The system shall 리포트에 최근 7일 일별 `sleepMinutes`를 `data-testid="week-bars"` MiniBar 7개로 표시하고, 목표선(480분)을 기준으로 부족일은 강조 색(`var(--tds-color-*)`)으로 구분한다.
- AC-3 [U][P0]: Scenario: 리포트 요약 레이아웃 계약
  Given 최근 7일 기록 존재
  Then 리포트는 `data-testid="week-summary-card"` Card에 "주간 총 부채"(강조 타이포 t3), "평균 수면", "최다 부족 요일" 3개 지표를 포함한다
- AC-4 [S][P1]: While 최근 7일 기록이 3건 미만일 때, the system shall "기록이 부족해요. 최소 3일 기록해주세요" 안내와 함께 광고/차트를 표시하지 않는다.
- AC-5 [S][P1]: While 기록이 0건일 때, the system shall Asset.ContentIcon 빈 상태 "이번 주 기록이 없어요"를 표시한다.
- AC-6 [W][P1]: Scenario: 광고 로드 실패
  Given `<TossRewardAd>` 광고 로드 실패
  When "리포트 보기" 탭
  Then 에러 Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요" 표시, 결과 미공개
- AC-7 [U][P1]: The system shall 리포트 계산 중 TDS Skeleton 차트 자리표시자를 표시한다.

### F5. 주말 회복 수면 플랜
- **Description**: 누적 부채와 목표 수면을 바탕으로 토요일·일요일 권장 취침/기상 시간과 추가 수면량(규칙 기반)을 계산해 회복 플랜을 제시한다. 플랜 공개 전 보상형 광고를 시청하며, "몰아자기 상한(주말 +2시간 이내)" 규칙으로 과수면을 방지한다.
- **Data**: SleepRecord, UserSettings
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 회복 플랜 공개 전 보상형 광고
  Given 유저가 `/plan`에서 "회복 플랜 보기" 탭
  When `<TossRewardAd>` 광고 시청 완료
  Then 주말 회복 플랜 카드가 표시됨
- AC-2 [E][P0]: Scenario: 몰아자기 상한 규칙
  Given 목표 480분, 누적 부채 720분
  When 플랜 계산
  Then 토·일 각각 권장 수면 = 목표(480) + min(부채/2, 120) = 600분(10시간)으로 상한 적용, `data-testid="plan-card"` Card 2개(토/일)로 표시
- AC-3 [U][P0]: The system shall 각 플랜 카드에 권장 취침·기상 시간과 "추가 +N분"을 강조 타이포(t3)로 표시한다.
- AC-4 [S][P1]: While 누적 부채가 0분일 때, the system shall "회복이 필요 없어요. 지금 리듬을 유지하세요" 안내를 표시하고 플랜 카드를 숨긴다.
- AC-5 [S][P1]: While 기록이 0건일 때, the system shall Asset.ContentIcon 빈 상태 "먼저 수면을 기록해주세요"와 `/record` 이동 버튼을 표시한다.
- AC-6 [W][P1]: Scenario: 광고 실패 시 플랜 미공개
  Given 광고 시청이 중도 종료됨
  When 플랜 보기 시도
  Then 에러 Toast "광고 시청을 완료해야 플랜을 볼 수 있어요" 표시, 미공개
- AC-7 [U][P1]: The system shall 플랜 계산 중 TDS Skeleton 카드를 표시한다.

### F6. 연속 기록 스트릭
- **Description**: 하루 1회 수면 기록 시 연속 기록일(스트릭)을 갱신해 체크인 동기를 부여한다. 어제 기록이 있으면 +1, 하루라도 건너뛰면 1로 리셋하며 최고 기록을 함께 보여준다.
- **Data**: Streak, SleepRecord
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 연속 기록 증가
  Given `streak = { current: 3, best: 5, lastCheckDate: "2026-07-29" }`, 오늘 "2026-07-30"
  When 오늘 첫 기록 저장
  Then `current 4, best 5, lastCheckDate "2026-07-30"`으로 갱신
- AC-2 [E][P0]: Scenario: 하루 건너뛰면 리셋
  Given `lastCheckDate: "2026-07-27"`, 오늘 "2026-07-30"
  When 기록 저장
  Then `current 1`로 리셋, `best`는 유지
- AC-3 [S][P0]: While `lastCheckDate`가 오늘과 같을 때, the system shall 재저장 시 스트릭을 증가시키지 않는다(중복 방지).
- AC-4 [U][P1]: The system shall 홈 스트릭 배지에 `data-testid="streak-chip"` TDS Chip으로 "🔥 N일 연속"을 표시한다.
- AC-5 [S][P1]: While `current`가 0일 때, the system shall "오늘부터 시작해보세요" 문구를 표시한다.
- AC-6 [W][P1]: Scenario: 스트릭 데이터 손상
  Given `sdt.streak`가 파싱 불가
  When 홈 진입
  Then 기본값 `{ current:0, best:0, lastCheckDate:"" }`으로 복구, `console.error` 없음

### F7. 수면 유형 진단 (아침형/저녁형)
- **Description**: 5문항 5점 척도 설문으로 사용자의 크로노타입(아침형/중간형/저녁형)을 규칙 기반으로 진단한다. 결과는 유형별 특징과 권장 취침시간대를 카드로 제시하고 localStorage에 저장한다.
- **Data**: ChronotypeResult
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 진단 결과 계산
  Given 5문항 응답 합계 `score = 21`
  When "결과 보기" 탭
  Then `score ≥ 20 → type "EVENING"` (12~19 "INTERMEDIATE", ≤11 "MORNING")로 판정·저장, `/chronotype/result`로 이동
- AC-2 [U][P0]: The system shall 결과 화면을 ScreenScaffold로 감싸고 `data-testid="chronotype-card"` Card에 유형명(강조 타이포 t2)·특징·권장 취침시간대를 표시한다.
- AC-3 [S][P1]: While 5문항 중 미응답이 1개 이상일 때, the system shall "결과 보기" 버튼을 `disabled` 처리한다.
- AC-4 [E][P1]: Scenario: 재진단
  Given 이미 `sdt.chronotype` 결과 존재
  When 진단 재실행·저장
  Then 기존 결과를 덮어쓰고 `answeredAt` 갱신
- AC-5 [S][P1]: While 저장된 진단 결과가 없을 때, the system shall `/chronotype/result` 직접 진입 시 "진단을 먼저 완료해주세요" 안내와 `/chronotype` 이동 버튼을 표시한다.
- AC-6 [W][P1]: Scenario: 잘못된 응답 방어
  Given 응답 배열에 범위 밖 값(6) 포함
  When 결과 계산
  Then 해당 값을 1~5로 클램프하여 계산, 크래시 없음

### F8. 온보딩 & 목표 설정
- **Description**: 최초 실행 시 목표 수면시간을 설정하는 1회성 온보딩과, 이후 설정 화면에서 목표를 변경하는 기능을 제공한다. 목표값은 전 화면의 부채 계산 기준이 된다.
- **Data**: UserSettings
- **API**: 없음
- **Requirements**:
- AC-1 [E][P0]: Scenario: 온보딩 목표 저장
  Given `settings.onboarded === false`
  When 앱 첫 진입 후 목표 "8시간" 선택·완료
  Then `targetMinutes 480, onboarded true` 저장, `navigate('/')`
- AC-2 [S][P0]: While `onboarded === false`일 때, the system shall 어떤 경로 진입이든 `/onboarding`으로 리다이렉트한다.
- AC-3 [E][P1]: Scenario: 설정에서 목표 변경
  Given `/settings`에서 목표를 "7시간"으로 변경·저장
  When 저장
  Then `targetMinutes 420` 저장, Toast "목표가 변경됐어요" 표시
- AC-4 [W][P1]: Scenario: 목표 범위 밖 거부
  When 목표를 3시간(<240분)으로 저장 시도
  Then 에러 메시지 "목표는 4~12시간 사이로 설정해주세요" 표시, 저장 안 됨
- AC-5 [U][P1]: The system shall 목표 선택 UI를 TDS Chip 목록(6/7/8/9시간 등)으로 제공해 44px 이상 터치 타깃을 보장한다.
- AC-6 [S][P1]: While 설정 로딩 중일 때, the system shall 현재 목표값 프리필 전 TDS Skeleton을 표시한다.

---

## Toss 검수 통과 ACs (전 기능 공통)

- G-1 [W][P0]: If 코드가 `window.location.href`/`window.open`으로 외부 URL 이동을 시도하면, the system shall 해당 호출을 포함하지 않는다(외부 도메인 이탈 금지).
- G-2 [U][P0]: The system shall 프로덕션 빌드에서 `console.error` 출력이 0개다.
- G-3 [U][P0]: The system shall 외부 API 호출이 없어 CORS 에러가 0개다.
- G-4 [U][P0]: The system shall Android 7+/iOS 16+ 호환 API만 사용한다(최신 전용 API 금지).
- G-5 [W][P0]: If 어떤 화면이든 "앱 설치"/"다운로드" 유도 문구·배너·링크를 포함하면, the system shall 이를 렌더링하지 않는다.
- G-6 [W][P0]: If 서비스 본질과 무관한 외부 웹/앱 이동이 요청되면, the system shall 차단한다(법률·공공기관 링크 외 금지).
- G-7 [W][P0]: If GA/Amplitude 등 외부 분석 솔루션 호출이 있으면, the system shall 이를 포함하지 않는다.
- G-8 [W][P0]: If HEX 색상(`#FFFFFF`, `#333` 등)이 하드코딩되면, the system shall `var(--tds-color-*)` 또는 TDS 컴포넌트로 대체한다(다크모드 지원).

> 프로모션 리워드(`grantPromotionReward`)는 본 MVP 범위 외(수익모델=광고). 추후 도입 시 `amount ≤ 5000` 검증 필수.

---

## Screen Definitions

### S1. 온보딩 — `/onboarding`
- **TDS 컴포넌트**: Top(타이틀), Paragraph.Text, Chip(목표 시간 선택), Button(완료, display="block"), Spacing
- **레이아웃 계약**: ScreenScaffold로 감싸고, 완료 버튼은 SubmitFooter(하단 고정)
- **상태**: Loading 없음(로컬 즉시). Empty 없음. Error: 목표 미선택 시 완료 버튼 disabled
- **터치**: Chip·Button ≥ 44px
- **Navigation 계약**:
  - Incoming: `location.state = undefined`
  - Outgoing: 완료 → `navigate('/', { replace: true })`

### S2. 홈 대시보드 — `/`
- **TDS 컴포넌트**: Top, SummaryHero(`data-testid="debt-hero"`), Card(payoff-card), Sparkline(trend-sparkline), Chip(streak-chip), Button("오늘 수면 기록하기", display="block"), Asset.ContentIcon(빈 상태), Skeleton(로딩), AdSlot
- **레이아웃 계약**: ScreenScaffold + FloatingTabBar. 히어로(t2 강조) → payoff Card → Sparkline → 배너 순
- **상태**: Loading=Skeleton 히어로 / Empty=기록 0건 안내 / Error=파싱 실패 시 기본값 복구
- **터치**: 기록 버튼 ≥ 44px
- **Navigation 계약**:
  - Incoming: `location.state = undefined`
  - Outgoing: "오늘 수면 기록하기" → `navigate('/record', { state: { date: string /* "YYYY-MM-DD" */ } })`; 탭 → `/report`, `/plan`, `/chronotype`, `/settings`

### S3. 수면 입력 — `/record`
- **TDS 컴포넌트**: Top, TextField(취침·기상, `inputMode="numeric"`), Paragraph.Text(계산된 수면시간 미리보기), Button(저장), Toast, Spacing
- **레이아웃 계약**: ScreenScaffold, 저장 버튼은 SubmitFooter(키보드 위 고정)
- **상태**: Loading 없음 / Empty: 신규 입력 시 빈 폼, 기존 기록 있으면 프리필 / Error: 동일·잘못된 시간 시 TextField 하단 에러 텍스트
- **키보드**: 숫자 키패드, 포커스 시 SubmitFooter가 가려지지 않음
- **터치**: TextField·Button ≥ 44px
- **Navigation 계약**:
  - Incoming: `location.state = { date: string }` (없으면 `currentDate` 사용)
  - Outgoing: 저장 성공 → `navigate('/')`

### S4. 주간 리포트 — `/report`
- **TDS 컴포넌트**: Top, TossRewardAd(게이트), MiniBar×7(`data-testid="week-bars"`), Card(`data-testid="week-summary-card"`), Paragraph.Text, Asset.ContentIcon(빈 상태), Skeleton, Toast
- **레이아웃 계약**: ScreenScaffold + FloatingTabBar. 광고 시청 후 요약 Card(t3 강조) → MiniBar 차트
- **상태**: Loading=Skeleton 차트 / Empty=기록 0건 또는 <3건 안내 / Error=광고 실패 Toast
- **터치**: "리포트 보기" 버튼 ≥ 44px
- **Navigation 계약**:
  - Incoming: `location.state = undefined`
  - Outgoing: 탭 이동만 (`/`, `/plan`, `/chronotype`, `/settings`)

### S5. 회복 플랜 — `/plan`
- **TDS 컴포넌트**: Top, TossRewardAd(게이트), Card×2(`data-testid="plan-card"`, 토/일), Paragraph.Text, Button(빈 상태 시 `/record` 이동), Asset.ContentIcon, Skeleton, Toast
- **레이아웃 계약**: ScreenScaffold + FloatingTabBar. 광고 후 플랜 Card 2개(추가 +N분 t3 강조)
- **상태**: Loading=Skeleton / Empty=부채 0 또는 기록 0건 안내 / Error=광고 실패 Toast
- **터치**: 버튼 ≥ 44px
- **Navigation 계약**:
  - Incoming: `location.state = undefined`
  - Outgoing: "먼저 기록하기" → `navigate('/record', { state: { date: string } })`

### S6. 수면 유형 진단 — `/chronotype`
- **TDS 컴포넌트**: Top, ListRow(문항)×5, Chip 또는 Segmented 5점 척도, Button(결과 보기), Spacing
- **레이아웃 계약**: ScreenScaffold, 결과 보기 버튼은 SubmitFooter
- **상태**: Loading 없음 / Empty 없음 / Error: 미응답 시 버튼 disabled
- **스크롤**: 5문항 세로 스크롤(가상 스크롤 불필요, 항목 수 고정)
- **터치**: 척도 선택지·버튼 ≥ 44px
- **Navigation 계약**:
  - Incoming: `location.state = undefined`
  - Outgoing: 결과 보기 → `navigate('/chronotype/result', { state: { result: ChronotypeResult } })`

### S7. 진단 결과 — `/chronotype/result`
- **TDS 컴포넌트**: Top, Card(`data-testid="chronotype-card"`), Paragraph.Text, Chip(유형 배지), Button("다시 진단"), AdSlot
- **레이아웃 계약**: ScreenScaffold, 유형명 t2 강조, 특징·권장 취침시간대 Card
- **상태**: Loading 없음 / Empty=결과 없음 시 안내+진단 이동 버튼 / Error 없음
- **터치**: 버튼 ≥ 44px
- **Navigation 계약**:
  - Incoming: `location.state = { result: ChronotypeResult } | undefined` (undefined면 `sdt.chronotype`에서 로드, 없으면 안내)
  - Outgoing: "다시 진단" → `navigate('/chronotype')`

### S8. 설정 — `/settings`
- **TDS 컴포넌트**: Top, ListRow(목표 수면), Chip(시간 선택), Switch(예약: 다크모드 자동), Button(저장), Toast, Skeleton
- **레이아웃 계약**: ScreenScaffold + FloatingTabBar, ListRow 나열
- **상태**: Loading=Skeleton / Empty 없음 / Error=범위 밖 값 거부 메시지
- **터치**: ListRow·Chip ≥ 44px
- **Navigation 계약**:
  - Incoming: `location.state = undefined`
  - Outgoing: 저장 → 현재 화면 유지 + Toast

---

## Data Storage 요약

| 모델 | 키 | 형태 | 크기 |
|---|---|---|---|
| SleepRecord | `sdt.records` | `SleepRecord[]` | 365건 ≈ 58KB |
| UserSettings | `sdt.settings` | `UserSettings` | ≈ 80B |
| Streak | `sdt.streak` | `Streak` | ≈ 70B |
| ChronotypeResult | `sdt.chronotype` | `ChronotypeResult` | ≈ 90B |

- 총 사용량 1년 ≈ 59KB (5MB 제한 대비 1.2% 미만).
- 모든 read는 try/catch로 파싱 실패 시 기본값 복구, 모든 write는 `QuotaExceededError` 처리.

---

## API Contract

**해당 없음.** 본 앱은 외부 API 호출이 없다(전 기능 로컬 계산·localStorage). 외부 도메인 통신·서버·외부 로깅 없음 → CORS/외부 이탈 검수 리스크 0.

> 향후 다기기 동기화가 필요하면 별도 Railway 서버(`{ error: string }` 통일 에러 형태)로 확장. MVP 범위 외.

---

## Assumptions

1. **생성형 AI 미사용**: 회복 플랜·유형 진단·부채 계산은 결정론적 규칙 기반이므로 생성형 AI 고지 의무(첫 이용 고지·결과물 라벨) 대상이 아니다. (`UserSettings.aiNoticeAck`는 향후 AI 도입 대비 예약 필드로만 유지)
2. **부채 롤링 윈도우**: 누적 부채는 최근 14일 기준. 그 이전 기록은 상환·소멸된 것으로 간주.
3. **상환 잠재량**: 상환 예상일 계산 시 일평균 상환 가능량은 `max(30분, |목표-최근평균수면|)`으로 가정.
4. **몰아자기 상한**: 주말 회복은 목표 + `min(부채/2, 120분)`으로 상한(과수면 방지).
5. **날짜 기준**: `SleepRecord.date`는 기상일 기준. `currentDate`(2026-07-30)를 오늘 기준으로 사용.
6. **하루 1건**: 낮잠·분할 수면은 MVP 미지원(취침~기상 1구간).
7. **크로노타입 컷오프**: score ≤11 아침형, 12~19 중간형, ≥20 저녁형 (5문항×1~5점).

## Open Questions

1. 주간 리포트를 매번 광고 게이팅할지, 주 1회만 게이팅하고 이후 무료 공개할지? (현재: 매 열람 게이팅으로 설계)
2. 목표 수면시간을 요일별(평일/주말)로 다르게 설정할 필요가 있는가? (현재: 단일 목표)
3. 낮잠/분할 수면 입력을 포스트-MVP에 추가할 것인가?
4. 스트릭 유지 실패 시 "복구권"(광고 시청으로 스트릭 유지) 기능이 리텐션에 필요한가?
5. 크로노타입 진단 문항을 표준 검증 척도(MEQ 축약형)로 대체할지, 자체 5문항을 유지할지?