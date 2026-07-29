# Packet 0005: 리포트/플랜/크로노타입 파생 계산 — TDD Red Phase

## Overview
Packet 0005 tests are now in **RED phase** (all 22 tests failing). The tests define the contract for three pure derivation functions in `src/lib/derive.ts`.

## Test Summary: 22 Tests Across 3 Functions

### 1. getRecoveryPlan (4 tests)
**Purpose**: Weekend sleep recovery plan calculator.  
**Signature**: `(cumDebt: number, targetMinutes: number) => RecoveryPlan | null`

**Expected Return Type**:
```typescript
interface RecoveryPlan {
  recommendedSaturdayMinutes: number;
  recommendedSundayMinutes: number;
  additionalMinutesNeeded: number;
}
```

**Test Cases**:
- **AC-1[P0]**: cumDebt=720, target=480 → recommended=600, additional=120 (ceiling 120 applied)
- **AC-1 variant**: cumDebt=360 (debt/2=180) → capped at 120, result=600
- **Null case**: cumDebt=0 → return null
- **Small debt**: cumDebt=100 → additional=50, result=530

**Formula**:
```
additional = min(cumDebt / 2, 120)
recommendedMinutes = targetMinutes + additional
```

---

### 2. diagnoseChronotype (9 tests)
**Purpose**: Classify sleep chronotype from questionnaire answers.  
**Signature**: `(answers: number[]) => ChronotypeResult`

**Expected Return Type**:
```typescript
interface ChronotypeResult {
  type: "MORNING" | "INTERMEDIATE" | "EVENING";
  score: number;
  answeredAt: number; // timestamp
}
```

**Test Cases**:
- **AC-2[P0]**: answers=[5,5,5,5,1] → score=21, type=EVENING ✓ no crash
- **AC-2[P0]**: answers=[6,7,8,1,2] → clamp to [5,5,5,1,2] → score=18, type=INTERMEDIATE ✓ no crash
- **Boundaries**: 
  - score≤11 → MORNING (test with 5, 11)
  - score=12~19 → INTERMEDIATE (test with 12, 15)
  - score≥20 → EVENING (test with 20, 21)
- **Clamping**: negative answers ([-5, 0, ...]) → clamped to 1
- **Large array**: 20 answers × 3 = 60 points → EVENING ✓
- **Timestamp**: answeredAt is recent and reasonable

**Rules**:
- Clamp each answer to range [1, 5]
- Sum all answers
- Classification:
  - ≤11: MORNING
  - 12~19: INTERMEDIATE
  - ≥20: EVENING

---

### 3. getWeekReport (9 tests)
**Purpose**: Generate last-7-day sleep analytics report.  
**Signature**: `(records: SleepRecord[], currentDate: string) => WeekReport`

**Expected Return Type**:
```typescript
interface WeekReport {
  sleepMinutes: number[];        // [day0, day1, ..., day6] — 7 elements, oldest to newest
  totalDebtMinutes: number;      // sum of debtMinutes in window
  averageSleepMinutes: number;   // mean of sleepMinutes
  maxDebtDate: string;           // YYYY-MM-DD with highest debt
  maxDebtMinutes: number;        // max single-day debt
  insufficientData: boolean;     // true if records.length < 3
}
```

**Test Cases**:
- **AC-3[P0]**: 7 records → sleepMinutes array length 7, values match ✓
- **Window calculation**: 7 records in window, 1 record 8 days ago → ignored
- **Debt sum**: [30,0,60] → totalDebt=90
- **Average**: [420,480,360] → avg=420
- **Max debt day**: [60, 0, 120] → maxDebtDate=date_of_120, maxDebtMinutes=120
- **Insufficient data**: 2 records → insufficientData=true
- **Sufficient data**: 3+ records → insufficientData=false
- **Empty records**: [] → sleepMinutes=[0,0,0,0,0,0,0], insufficientData=true
- **Day order**: sleepMinutes[0] is oldest, [6] is newest in 7-day window

**Rules**:
- Include only records where `daysBetween(record.date, currentDate)` is in [0, 6]
- Sort by date: oldest index 0 → newest index 6
- If records < 3: insufficientData=true
- Handle empty records gracefully (return zeros, not crash)

---

## Files to Create
- **src/lib/derive.ts** — implementation of 3 functions
  - Import from `@/lib/types` and `@/lib/calc`
  - Pure functions (no side effects)

## Test File
- **src/__tests__/packet-0005.test.ts** — 22 tests (all RED ✓)

## Acceptance Criteria Mapping
| AC | Tests | Status |
|----|-------|--------|
| AC-1[P0] | 2+ (recovery plan) | RED |
| AC-2[P0] | 2+ (chronotype score + clamp) | RED |
| AC-3[P0] | 2+ (week report) | RED |

## Next Steps
1. Implement 3 functions in `src/lib/derive.ts` (as per test expectations)
2. Run `npx vitest run src/__tests__/packet-0005.test.ts` → GREEN phase
3. Run `npx tsc --noEmit` → typecheck
4. Run `npm run test:visual` (if UI involved) → not needed for pure logic

---

## Test Quality Validation (T12)
- ✅ Every AC has ≥1 test (P0 ACs have 2+)
- ✅ Each test has clear name ("AC-1[P0]: ...")
- ✅ Each test has 2+ expect() assertions with concrete values
- ✅ Tests use specific values (600, 21, 7-element array) not generic matchers
- ✅ Happy path + error cases covered
- ✅ Boundary conditions tested (≤11, 12~19, ≥20)
- ✅ 22 focused tests total (4 + 9 + 9)
