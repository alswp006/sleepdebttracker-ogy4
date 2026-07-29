# Shared Context (auto-generated — do NOT modify)


## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// Domain types — add your app-specific types here

export interface SleepRecord {
  id: string;
  date: string; // YYYY-MM-DD
  bedTime: string; // HH:mm
  wakeTime: string; // HH:mm
  sleepMinutes: number;
  debtMinutes: number;
  createdAt: number;
}

export interface UserSettings {
  targetMinutes: number; // TARGET_MIN..TARGET_MAX
  aiNoticeAck: boolean;
  onboarded: boolean;
}

export interface Streak {
  current: number;
  best: number;
  lastCheckDate: string; // YYYY-MM-DD or ""
}

export type ChronotypeType = "MORNING" | "EVENING" | "INTERMEDIATE";

export interface ChronotypeResult {
  type: ChronotypeType;
  score: number;
  answeredAt: number;
}

export type CalcInput = {
  bedTime: string;
  wakeTime: string;
  targetMinutes: number;
};

export type CalcSleepResult = {
  sleepMinutes: number;
  debtMinutes: number;
};

export type SaveResult =
  | { ok: true; record: SleepRecord }
  | { ok: false; reason: "QUOTA" | "INVALID_TIME" };

export type RouteState = {
  "/": undefined;
  "/onboarding": undefined;
  "/record": { date?: string } | undefined;
  "/report": undefined;
  "/plan": undefined;
  "/settings": undefined;
  "/chronotype": undefined;
  "/chronotype/result": { result: ChronotypeResult } | undefined;
};

export const STORAGE_KEYS = {
  records: "sdt.records",
  settings: "sdt.settings",
  streak: "sdt.streak",
  chronotype: "sdt.chronotype",
} as const;

export const DEFAULT_TARGET_MINUTES = 480;
export const TARGET_MIN = 240;
export const TARGET_MAX = 720;
export const ROLLING_WINDOW_DAYS = 14;

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
    ZzDebugNav.tsx
    ZzDebugTab.tsx
    ZzDebugTab2.tsx
  hooks/
  lib/
    adConfig.ts
    calc.ts
    derive.ts
    records.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    ChronotypePage.tsx
    ChronotypeResultPage.tsx
    Home.tsx
    HomePage.tsx
    OnboardingPage.tsx
    PlanPage.tsx
    RecordPage.tsx
    ReportPage.tsx
    SettingsPage.tsx
    __TdsGallery.tsx
    onboarding/
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- adConfig.ts: export function setAdConfig(config:; export function getAdGroupId(): string | undefined; export function getAdSlotId(): string | undefined
- calc.ts: export type CalcSleepOk =; export type CalcSleepFail =; export type CalcSleepOutcome = CalcSleepOk | CalcSleepFail; export function calcSleep(; export function getCumulativeDebt(records: SleepRecord[], currentDate: string): number; export function estimatePayoffDays( cumDebt: number, records: SleepRecord[], settings: Pick<UserSettings, "targetMinutes; export function formatMinutes(totalMinutes: number): string
- derive.ts: export type WeekReport =; export type RecoveryPlan =; export function getWeekReport(records: SleepRecord[], currentDate: string): WeekReport; export function getRecoveryPlan(cumDebt: number, targetMinutes: number): RecoveryPlan | null; export function diagnoseChronotype(answers: number[]): ChronotypeResult
- records.ts: export function updateStreak(today: string): Streak; export function saveRecord(input: CalcInput, date: string, currentDate: string): SaveResult
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void; export function getRecords(): SleepRecord[]; export function writeRecords(records: SleepRecord[]): WriteResult; export function getSettings(): UserSettings; export function writeSettings(settings: UserSettings): WriteResult; export function getStreak(): Streak
- types.ts: export interface SleepRecord; export interface UserSettings; export interface Streak; export type ChronotypeType = "MORNING" | "EVENING" | "INTERMEDIATE"; export interface ChronotypeResult; export type CalcInput =; export type CalcSleepResult =; export type SaveResult = |
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
- ZzDebugNav.tsx: ZzDebugNav
- ZzDebugTab.tsx: ZzDebugTab
- ZzDebugTab2.tsx: ZzDebugTab2

### Module Dependencies (import graph)
  lib/calc.ts → imports: lib/types
  lib/derive.ts → imports: lib/types
  lib/records.ts → imports: lib/types
  pages/ChronotypePage.tsx → imports: components/ScreenScaffold, components/BottomCTA, lib/derive, lib/storage, lib/types
  pages/ChronotypeResultPage.tsx → imports: components/ScreenScaffold, components/SummaryHero, components/Card, components/StateView, lib/storage, lib/types
  pages/HomePage.tsx → imports: components/ScreenScaffold, components/SummaryHero, components/Card, components/Sparkline, components/StateView, components/AdSlot, components/FloatingTabBar, lib/storage, lib/calc, lib/types
  pages/PlanPage.tsx → imports: components/ScreenScaffold, components/FloatingTabBar, components/Card, components/StateView, lib/storage, lib/calc, lib/derive, lib/types
  pages/ReportPage.tsx → imports: components/ScreenScaffold, components/FloatingTabBar, components/Card, components/MiniBar, components/StateView, lib/storage, lib/derive, lib/calc, lib/types
  pages/SettingsPage.tsx → imports: components/ScreenScaffold, components/FloatingTabBar, components/StateView, lib/storage, lib/types, lib/types
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 전 엔티티 타입 + RouteState 정의 (files: src/lib/types.ts)
- 0002: localStorage CRUD 헬퍼 (files: src/lib/storage.ts)
- 0003: 부채 계산 엔진 (순수 함수) (files: src/lib/calc.ts)
- 0004: 기록 upsert + 스트릭 갱신 로직 (files: src/lib/records.ts)
- 0005: 리포트/플랜/크로노타입 파생 계산 (files: src/lib/derive.ts)
- 0007: 홈 대시보드 / (files: src/pages/HomePage.tsx)
- 0008: 수면 입력 페이지 /record (files: src/pages/RecordPage.tsx)
- 0009: 주간 리포트 페이지 /report (files: src/pages/ReportPage.tsx)
- 0010: 회복 플랜 페이지 /plan (files: src/pages/PlanPage.tsx)
- 0011: 수면 유형 진단 페이지 /chronotype (files: src/pages/ChronotypePage.tsx)
- 0012: 진단 결과 페이지 /chronotype/result (files: src/pages/ChronotypeResultPage.tsx)
- 0013: 설정 페이지 /settings (files: src/pages/SettingsPage.tsx)
- 0015: 검수 통과 최종 점검 (금지 패턴 제거) (files: src/App.tsx)
- 0006: 온보딩 페이지 /onboarding (files: src/pages/OnboardingPage.tsx)