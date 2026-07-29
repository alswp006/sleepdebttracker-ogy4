The validation errors are caused by the field labels being bolded (`**DoD**:`) instead of matching the template's plain-label format (`- DoD:`). I've reformatted every task to use the exact template field markers.

# TASK — SleepDebtTracker

## Epic 1. Data Layer (Types)

> **Risk 평가** — Complexity: Low / Risk factors: RouteState 누락 시 페이지 간 `location.state` 타입 불일치로 런타임 데이터 깨짐 / Mitigation: 이 Epic을 최우선 실행해 모든 페이지·헬퍼가 단일 타입 소스에 의존하도록 강제.

### Task 1.1 전 엔티티 타입 + RouteState 정의
- Description: 모든 데이터 모델·함수 반환 타입·페이지 간 네비게이션 계약 타입을 순수 타입으로 선언한다(런타임 코드 없음). `SleepRecord`, `UserSettings`, `Streak`, `ChronotypeResult`, `ChronotypeType` 인터페이스(SPEC Data Models 그대로). 계산 입력 타입 `CalcInput = { bedTime: string; wakeTime: string }`, `CalcSleepResult = { ok: true; sleepMinutes: number; debtMinutes: number } | { ok: false; reason: 'INVALID_TIME' }`. 저장 결과 유니온 `SaveResult = { ok: true; record: SleepRecord } | { ok: false; reason: 'QUOTA' | 'INVALID_TIME' }`. `RouteState` 타입(필수):
  ```typescript
  export type RouteState = {
    '/record': { date: string } | undefined;
    '/chronotype/result': { result: ChronotypeResult } | undefined;
    '/': undefined;
    '/report': undefined;
    '/plan': undefined;
    '/onboarding': undefined;
    '/chronotype': undefined;
    '/settings': undefined;
  };
  ```
  상수: `STORAGE_KEYS`(sdt.records/settings/streak/chronotype), `DEFAULT_TARGET_MINUTES=480`, `TARGET_MIN=240`, `TARGET_MAX=720`, `ROLLING_WINDOW_DAYS=14`.
- DoD: `tsc` 통과, 런타임 코드 0줄, `RouteState` export 존재, 모든 후속 페이지·헬퍼가 이 파일에서 import 가능.
- Covers: [타입 계약 정의 — 후속 태스크의 기반, 별도 AC 없음]
- Files: [src/lib/types.ts]
- Depends on: none

---

## Epic 2. Data Layer (Storage + Engine + State)

> **Risk 평가** — Complexity: Medium / Risk factors: (1) 손상된 JSON 파싱 시 앱 크래시·`console.error` 발생(검수 반려 G-2), (2) `QuotaExceededError` 미처리 crash, (3) 자정 넘김 보정 누락으로 음수 수면시간 / Mitigation: 모든 read를 try/catch 기본값 복구, 모든 write를 QUOTA catch로 감싸고, calc 엔진을 순수 함수로 분리해 페이지 구현 이전에 단위 검증 가능하게 함.

### Task 2.1 localStorage CRUD 헬퍼
- Description: 4개 키에 대한 안전한 read/write 순수 함수. 파싱 실패 시 기본값 반환(`console.error` 금지), write 시 `QuotaExceededError` catch. `getRecords(): SleepRecord[]`(date 오름차순 정렬 반환, 파싱 실패 시 `[]`), `writeRecords(records): { ok: boolean; reason?: 'QUOTA' }`(setItem QUOTA catch), `getSettings()/writeSettings()`(기본값 `{ targetMinutes:480, aiNoticeAck:false, onboarded:false }`), `getStreak()/writeStreak()`(기본값 `{ current:0, best:0, lastCheckDate:'' }`, 파싱 실패 복구), `getChronotype()/writeChronotype()`(없거나 파싱 실패 시 `null`).
- DoD: 손상 문자열(`"{invalid"`) 주입 시 기본값 반환·크래시 없음; QUOTA mock 시 `{ok:false,reason:'QUOTA'}`; 컴파일 통과.
- Covers: [F1-AC1, F1-AC5, F1-AC6, F6-AC6, G-2]
- Files: [src/lib/storage.ts]
- Depends on: Task 1.1

### Task 2.2 부채 계산 엔진 (순수 함수)
- Description: 시간·부채 계산 순수 함수 모듈. `calcSleep({bedTime,wakeTime}, targetMinutes)`(형식 정규식 `^([01]\d|2[0-3]):([0-5]\d)$` 검증, 실패 시 `{ok:false,reason:'INVALID_TIME'}`, wake<bed면 +1440 보정, `bed===wake`면 `{ok:false,reason:'INVALID_TIME'}`, 성공 시 `{ok:true, sleepMinutes, debtMinutes}`), `getCumulativeDebt(records, currentDate)`(최근 14일 `debtMinutes` 합, 음수면 0 클램프), `estimatePayoffDays(cumDebt, records, settings)`(일평균 상환량 `max(30, |목표-최근평균수면|)`으로 나눠 올림), `formatMinutes(min): "N시간 M분"`.
- DoD: `calcSleep({bedTime:"23:30",wakeTime:"06:00"},480)`→`sleepMinutes390,debtMinutes90`; `{01:00,06:00}`→`300,180`; `{07:00,07:00}`→INVALID_TIME; `{25:70,...}`→INVALID_TIME; 부채 합 -50→0; 600분/60→10일.
- Covers: [F1-AC2, F1-AC4, F1-AC7, F2-AC4, F3-AC2]
- Files: [src/lib/calc.ts]
- Depends on: Task 1.1

### Task 2.3 기록 upsert + 스트릭 갱신 상태 로직
- Description: 기록 저장 시 upsert·스트릭 갱신을 오케스트레이션하는 함수. `saveRecord(input, date, currentDate): SaveResult`(calc 실행, 동일 `date` 존재 시 해당 항목만 갱신하여 배열 길이 유지, 없으면 추가, writeRecords QUOTA 시 `{ok:false,reason:'QUOTA'}` 전파, 저장 성공 시 `updateStreak(currentDate)` 호출), `updateStreak(today)`(`lastCheckDate===today`면 변경 없음, 어제면 `current+1`, 그 외면 `current=1`, `best=max(best,current)`, lastCheckDate 갱신).
- DoD: 동일 date 재저장 시 length 불변·항목만 갱신; streak 3→4(어제 기록), 3일 건너뜀→1(best 유지), 오늘 재저장 시 불변; QUOTA 전파.
- Covers: [F1-AC3, F6-AC1, F6-AC2, F6-AC3]
- Files: [src/lib/records.ts]
- Depends on: Task 2.1, Task 2.2

### Task 2.4 리포트/플랜/크로노타입 계산 로직
- Description: 파생 지표 순수 함수. `getWeekReport(records, currentDate)`(최근 7일 일별 `sleepMinutes[7]`, 주간 총 부채, 평균 수면, 최다 부족 요일, 기록<3건 플래그), `getRecoveryPlan(cumDebt, targetMinutes)`(토·일 각 권장 수면 = `target + min(부채/2, 120)`, 추가 +N분, cumDebt 0이면 `null`), `diagnoseChronotype(answers: number[]): ChronotypeResult`(각 응답 1~5 클램프, 합계 score, `≤11 MORNING / 12~19 INTERMEDIATE / ≥20 EVENING`, `answeredAt` 스탬프).
- DoD: 목표480·부채720→권장600(상한120 적용); score21→EVENING; 응답값6→5 클램프 후 계산·크래시 없음; 7일 sleepMinutes 배열 반환.
- Covers: [F4-AC3, F5-AC2, F7-AC1, F7-AC6]
- Files: [src/lib/derive.ts]
- Depends on: Task 2.1, Task 2.2

---

## Epic 3. UI Pages (one page per task)

> **Risk 평가** — Complexity: Medium / Risk factors: (1) TDS 외 라이브러리·HEX 하드코딩·인라인 여백 남용 시 검수 반려, (2) `location.state` 미캐스팅으로 데이터 불일치, (3) 광고 게이트 실패 시 결과 노출 / Mitigation: 모든 페이지가 `RouteState`로 state 캐스팅, TDS 컴포넌트·Spacing만 사용, `TossRewardAd` 게이트 뒤에만 결과 렌더.

### Task 3.1 온보딩 페이지 `/onboarding`
- Description: ScreenScaffold + SubmitFooter. 목표 수면 Chip(6/7/8/9시간) 선택 후 완료. 미선택 시 완료 버튼 disabled. 범위 밖(<240/>720) 저장 시도 시 거부 메시지 "목표는 4~12시간 사이로 설정해주세요". 완료 시 `targetMinutes`·`onboarded true` 저장 후 `navigate('/',{replace:true})`. Chip·Button ≥ 44px.
- DoD: 8시간 선택·완료 시 `targetMinutes480,onboarded true` 저장 후 홈 replace 이동; 미선택 시 버튼 disabled; 범위 밖 거부; Chip ≥44px.
- Covers: [F8-AC1, F8-AC4, F8-AC5]
- Files: [src/pages/OnboardingPage.tsx]
- Depends on: Task 2.1

### Task 3.2 홈 대시보드 `/`
- Description: ScreenScaffold + FloatingTabBar. 로딩 시 Skeleton 히어로 → `getCumulativeDebt` "N시간 M분" `data-testid="debt-hero"` SummaryHero(t2) → payoff Card(`data-testid="payoff-card"`, 상환 예상일) → Sparkline(`data-testid="trend-sparkline"`, 최근 7일 debt) → 하단 AdSlot(카드 섹션 하단 1개). 오늘 기록 없으면 "오늘 수면 기록하기" Button(display="block" →`/record`, state `{date:currentDate}`). 기록 0건이면 Asset.ContentIcon 빈 상태 "첫 수면을 기록해보세요"(차트·히어로 숨김). 부채 0이면 "수면 부채 없음 🎉" Chip. 스트릭 `data-testid="streak-chip"` "🔥 N일 연속", current 0이면 "오늘부터 시작해보세요".
- DoD: 기록 3건↑ 시 debt-hero/trend-sparkline/payoff-card 렌더; 0건 시 빈 상태·차트 숨김; 오늘 미기록 시 기록 버튼 노출; 부채0 시 배지; AdSlot 카드 하단 1개; 로딩 시 Skeleton.
- Covers: [F3-AC1, F3-AC3, F3-AC4, F3-AC5, F3-AC6, F3-AC7, F3-AC8, F6-AC4, F6-AC5]
- Files: [src/pages/HomePage.tsx]
- Depends on: Task 2.1, Task 2.2, Task 2.3

### Task 3.3 수면 입력 페이지 `/record`
- Description: ScreenScaffold, SubmitFooter(키보드 위 고정). TextField 취침·기상 `inputMode="numeric"`. 계산된 수면시간 미리보기 Paragraph.Text. `location.state`(`RouteState['/record']`) date 캐스팅, 없으면 currentDate. 기존 기록 있으면 프리필. 기상 비면 저장 disabled. 동일시간 시 "취침·기상 시간이 같아요" TextField 하단 에러. 저장 성공 Toast "기록이 저장됐어요"→`navigate('/')`. QUOTA 시 Toast "저장 공간이 부족해요"(크래시 없음).
- DoD: `{23:00,07:00}`→`480,0` 저장·Toast·홈 이동; `{01:00,06:00}`→`300,180`; 기상 빈값 disabled; 동일시간 거부; 기존 date 프리필·갱신; QUOTA Toast·크래시 없음.
- Covers: [F2-AC1, F2-AC2, F2-AC3, F2-AC4, F2-AC5, F2-AC6, F2-AC7]
- Files: [src/pages/RecordPage.tsx]
- Depends on: Task 2.3

### Task 3.4 주간 리포트 페이지 `/report`
- Description: ScreenScaffold + FloatingTabBar. 기록 0건→Asset.ContentIcon "이번 주 기록이 없어요"; <3건→"기록이 부족해요. 최소 3일 기록해주세요"(광고·차트 숨김). 3건↑: "리포트 보기"→`<TossRewardAd>` 시청 완료 후 요약 Card(`data-testid="week-summary-card"`, 총 부채 t3 / 평균 수면 / 최다 부족 요일) + MiniBar 7개(`data-testid="week-bars"`, 목표선480 기준 부족일 강조색 `var(--tds-color-*)`). 로딩 시 Skeleton 차트. 광고 실패 Toast "광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"(결과 미공개).
- DoD: 광고 시청 완료 후에만 요약 Card·MiniBar7 노출; <3건/0건 안내·광고 숨김; 광고 실패 Toast·미공개; 로딩 Skeleton.
- Covers: [F4-AC1, F4-AC2, F4-AC3, F4-AC4, F4-AC5, F4-AC6, F4-AC7]
- Files: [src/pages/ReportPage.tsx]
- Depends on: Task 2.4

### Task 3.5 회복 플랜 페이지 `/plan`
- Description: ScreenScaffold + FloatingTabBar. 기록 0건→Asset.ContentIcon "먼저 수면을 기록해주세요" + `/record` 이동 버튼(state `{date:currentDate}`). 부채 0→"회복이 필요 없어요. 지금 리듬을 유지하세요"(플랜 숨김). 그 외: "회복 플랜 보기"→`<TossRewardAd>` 완료 후 토·일 Card 2개(`data-testid="plan-card"`, 권장 취침·기상 + "추가 +N분" t3 강조). 로딩 Skeleton. 광고 중도종료 Toast "광고 시청을 완료해야 플랜을 볼 수 있어요"(미공개).
- DoD: 목표480·부채720→권장600 카드 2개; 부채0 안내·숨김; 0건 안내+기록 이동; 광고 완료 후에만 공개; 광고 실패 Toast; Skeleton.
- Covers: [F5-AC1, F5-AC2, F5-AC3, F5-AC4, F5-AC5, F5-AC6, F5-AC7]
- Files: [src/pages/PlanPage.tsx]
- Depends on: Task 2.4

### Task 3.6 수면 유형 진단 페이지 `/chronotype`
- Description: ScreenScaffold, SubmitFooter. ListRow 5문항 + Chip/Segmented 5점 척도(≥44px). 미응답 1개↑ 시 "결과 보기" disabled. 응답 완료 시 `diagnoseChronotype`→`writeChronotype` 저장 후 `navigate('/chronotype/result',{state:{result}})`. 5문항 세로 스크롤.
- DoD: score21 입력→EVENING result로 이동; 미응답 시 버튼 disabled; 척도 ≥44px; 결과 저장(writeChronotype).
- Covers: [F7-AC1, F7-AC3, F7-AC4]
- Files: [src/pages/ChronotypePage.tsx]
- Depends on: Task 2.4

### Task 3.7 진단 결과 페이지 `/chronotype/result`
- Description: ScreenScaffold. `location.state`(`RouteState['/chronotype/result']`) 캐스팅, undefined면 `getChronotype()` 로드, 없으면 "진단을 먼저 완료해주세요" + `/chronotype` 이동 버튼. 결과 있으면 Card(`data-testid="chronotype-card"`) 유형명 t2 강조·특징·권장 취침시간대 + Chip 배지 + "다시 진단" Button(→`/chronotype`) + 하단 AdSlot.
- DoD: state/저장 결과로 chronotype-card 렌더(유형명 t2); 결과 없이 직접 진입 시 안내+이동 버튼; "다시 진단"→`/chronotype`.
- Covers: [F7-AC2, F7-AC5]
- Files: [src/pages/ChronotypeResultPage.tsx]
- Depends on: Task 2.1

### Task 3.8 설정 페이지 `/settings`
- Description: ScreenScaffold + FloatingTabBar. 로딩 Skeleton 후 현재 목표 프리필. ListRow(목표 수면) + Chip(6/7/8/9시간, ≥44px) + Switch(다크모드 예약). 저장 시 범위 밖(<240/>720) 거부 "목표는 4~12시간 사이로 설정해주세요", 성공 시 `targetMinutes` 저장·Toast "목표가 변경됐어요"(화면 유지).
- DoD: 7시간 저장→`targetMinutes420`·Toast; 3시간 저장→거부 메시지·저장 안 됨; 로딩 Skeleton→프리필; Chip ≥44px.
- Covers: [F8-AC3, F8-AC4, F8-AC5, F8-AC6]
- Files: [src/pages/SettingsPage.tsx]
- Depends on: Task 2.1

---

## Epic 4. Integration + Landing

> **Risk 평가** — Complexity: Medium / Risk factors: (1) `onboarded===false` 리다이렉트 누락 시 미설정 유저가 부채 계산 기준(목표) 없이 진입, (2) 외부 URL 이동/HEX/외부 분석 코드 잔존 시 검수 반려 / Mitigation: 라우팅 가드를 최종 단계에서 일괄 배선하고, 빌드 전 금지 패턴(window.open/href, HEX, GA/Amplitude, console.error) 정적 점검.

### Task 4.1 라우터 배선 + 온보딩 가드
- Description: `react-router-dom`으로 8개 라우트 등록(`/onboarding`, `/`, `/record`, `/report`, `/plan`, `/chronotype`, `/chronotype/result`, `/settings`). `onboarded===false`면 어떤 경로 진입이든 `/onboarding`으로 리다이렉트하는 가드. FloatingTabBar 대상 화면(`/`,`/report`,`/plan`,`/chronotype`,`/settings`) 탭 배선. currentDate 기준값 주입.
- DoD: `onboarded false` 시 모든 경로→`/onboarding` 리다이렉트; onboarded true 시 정상 라우팅; 탭 이동 동작; 컴파일·앱 구동.
- Covers: [F8-AC2]
- Files: [src/App.tsx, src/router.tsx]
- Depends on: Task 3.1, Task 3.2, Task 3.3, Task 3.4, Task 3.5, Task 3.6, Task 3.7, Task 3.8

### Task 4.2 검수 통과 최종 점검 (금지 패턴 제거)
- Description: 전 소스 정적 점검·수정. `window.location.href`/`window.open` 외부 이동 0, "앱 설치/다운로드" 유도 문구·배너 0, 서비스 무관 외부 링크 0, GA/Amplitude 등 외부 분석 호출 0, HEX 하드코딩→`var(--tds-color-*)`/TDS 대체, 프로덕션 빌드 `console.error` 0, Android7+/iOS16+ 호환 API만 사용. AdSlot이 콘텐츠와 겹치지 않는 섹션 하단에만 배치되었는지 확인.
- DoD: `grep`로 `window.open|window.location.href|#[0-9a-fA-F]{3,6}|amplitude|gtag|console.error` 매칭 0(정당 사유 제외); 프로덕션 빌드 성공·CORS 0.
- Covers: [G-1, G-2, G-3, G-4, G-5, G-6, G-7, G-8]
- Files: [src/App.tsx, src/router.tsx, src/pages/*, src/lib/*]
- Depends on: Task 4.1

---

## AC Coverage

- Total ACs in SPEC: 62 (F1:7, F2:7, F3:8, F4:7, F5:7, F6:6, F7:6, F8:6, G:8)
- Covered by tasks: 62
  - **F1**: AC1(2.1), AC2(2.2), AC3(2.3), AC4(2.2), AC5(2.1), AC6(2.1), AC7(2.2)
  - **F2**: AC1(3.3), AC2(3.3), AC3(3.3), AC4(2.2/3.3), AC5(3.3), AC6(3.3), AC7(3.3)
  - **F3**: AC1(3.2), AC2(2.2/3.2), AC3(3.2), AC4(3.2), AC5(3.2), AC6(3.2), AC7(3.2), AC8(3.2)
  - **F4**: AC1(3.4), AC2(3.4), AC3(2.4/3.4), AC4(3.4), AC5(3.4), AC6(3.4), AC7(3.4)
  - **F5**: AC1(3.5), AC2(2.4/3.5), AC3(3.5), AC4(3.5), AC5(3.5), AC6(3.5), AC7(3.5)
  - **F6**: AC1(2.3), AC2(2.3), AC3(2.3), AC4(3.2), AC5(3.2), AC6(2.1)
  - **F7**: AC1(2.4/3.6), AC2(3.7), AC3(3.6), AC4(3.6), AC5(3.7), AC6(2.4)
  - **F8**: AC1(3.1), AC2(4.1), AC3(3.8), AC4(3.1/3.8), AC5(3.1/3.8), AC6(3.8)
  - **G**: G1–G8(4.2)
- Uncovered: 0 ✅ (100% 커버리지)