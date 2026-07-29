# Packet 0001: Types & Storage Keys — Implementation Guide

## Summary
This packet defines all TypeScript interfaces, union types, and constants for the SleepDebtTracker app. **NO runtime code** — pure type definitions exported from `src/lib/types.ts`.

## What the Tests Expect

### AC-1: Type Definitions (5 interfaces + 1 union)
The coder must export these interfaces from `src/lib/types.ts`:

1. **SleepRecord**
   ```typescript
   interface SleepRecord {
     id: string;                // e.g., "2026-07-30" (date-based ID for upsert)
     date: string;              // YYYY-MM-DD format (wake date)
     bedTime: string;           // HH:mm 24h format (e.g., "23:30")
     wakeTime: string;          // HH:mm 24h format (e.g., "06:00")
     sleepMinutes: number;      // calculated (0~1440, +1440 if crosses midnight)
     debtMinutes: number;       // targetMinutes - sleepMinutes
     createdAt: number;         // epoch milliseconds
   }
   ```

2. **UserSettings**
   ```typescript
   interface UserSettings {
     targetMinutes: number;     // 240~720 (must enforce this range)
     aiNoticeAck: boolean;      // default: false (reserved for future AI notices)
     onboarded: boolean;        // default: false (first-run flag)
   }
   ```

3. **Streak**
   ```typescript
   interface Streak {
     current: number;           // default: 0
     best: number;              // default: 0
     lastCheckDate: string;     // YYYY-MM-DD or "" (default: "")
   }
   ```

4. **ChronotypeType (Union)**
   ```typescript
   type ChronotypeType = 'MORNING' | 'EVENING' | 'INTERMEDIATE';
   ```

5. **ChronotypeResult**
   ```typescript
   interface ChronotypeResult {
     type: ChronotypeType;      // diagnosis result
     score: number;             // 5~25 (5 questions x 1~5 points)
     answeredAt: number;        // epoch milliseconds
   }
   ```

### AC-2: RouteState Type
Define a TypeScript type for React Router location.state across all routes:

```typescript
type RouteState = 
  | undefined                                    // /onboarding, /, /report, /plan, /settings, /chronotype
  | { date?: string }                            // /record
  | { result?: ChronotypeResult };               // /chronotype/result
```

Navigation contracts (from SPEC.md S1-S8):
- `/onboarding` → state: undefined
- `/` → state: undefined
- `/record` → state: { date?: string }
- `/report` → state: undefined
- `/plan` → state: undefined
- `/chronotype` → state: undefined
- `/chronotype/result` → state: { result?: ChronotypeResult }
- `/settings` → state: undefined

### AC-3: Constants (4 STORAGE_KEYS + 4 numeric constants)
Export as const (not enum):

```typescript
const STORAGE_KEYS = {
  records: 'sdt.records',
  settings: 'sdt.settings',
  streak: 'sdt.streak',
  chronotype: 'sdt.chronotype',
};

const DEFAULT_TARGET_MINUTES = 480;  // 8 hours
const TARGET_MIN = 240;              // 4 hours
const TARGET_MAX = 720;              // 12 hours
const ROLLING_WINDOW_DAYS = 14;      // cumulative debt window
```

## What Tests Verify

1. **All 5 interfaces have correct field names and types** (compile-time check via runtime mock)
2. **RouteState supports all 8 navigation paths** with correct state shapes
3. **Constants are exported and have correct numeric values**
4. **Time format validates HH:mm** (regex: ^([01]\d|2[0-3]):([0-5]\d)$)
5. **Date format validates YYYY-MM-DD** (regex: ^\d{4}-\d{2}-\d{2}$)
6. **Default values work** (targetMinutes=480, streak={current:0, best:0, lastCheckDate:""})
7. **Realistic workflows** (record + debt, streak + chronotype) compose correctly

## Test File Location
`src/__tests__/packet-0001.test.ts` — 20 tests, all passing

## Notes
- **No imports needed** in types.ts (pure declarations)
- **NEVER use any** in actual types (only in test mocks for runtime simulation)
- Types are **independent** — no circular dependencies
- SPEC.md is ground truth for field constraints (e.g., 240~720 for targetMinutes)
