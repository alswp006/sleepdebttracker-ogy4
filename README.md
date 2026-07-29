🇺🇸 [한국어](./README.ko.md)

# SleepDebtTracker — Sleep Health Management for Toss App

A Toss mini-app that tracks daily sleep, calculates cumulative sleep debt, and provides data-driven weekend recovery plans. Users record their sleep patterns to understand their sleep rhythm and receive personalized recovery strategies to restore healthy sleep habits.

## Features

- 📊 **Sleep Debt Dashboard** — Real-time cumulative debt calculation with 7-day trend visualization via sparklines
- 📝 **Daily Sleep Logging** — Quick bedtime/wake time input with automatic calculation of sleep hours and daily debt
- 📈 **Weekly Sleep Report** — Bar chart breakdown of 7-day sleep patterns with summary metrics (total debt, average sleep, most-deficit day)
- 🛏️ **Weekend Recovery Plan** — Rule-based recovery sleep schedule for Saturday/Sunday with "sleep binge ceiling" (max +2 hours) to prevent oversleep
- 🔄 **Streak Tracking** — Daily check-in streak counter to encourage consistent logging
- 🧠 **Chronotype Assessment** — 5-question sleep type diagnostic (morning/evening/intermediate types)
- ⚙️ **Settings** — Customizable target sleep hours (4–12 hours, default 8)
- 📲 **Reward Ads** — Unlock detailed reports and recovery plans via optional 30-second video ads

## Tech Stack

- **Framework**: React 18 + React Router v7.5 (client-side routing)
- **Build**: Vite 6.3
- **Language**: TypeScript 5.8 (strict mode)
- **UI**: Toss Design System (`@toss/tds-mobile`), Emotion CSS-in-JS
- **Platform**: App-in-Toss WebView (`@apps-in-toss/web-framework`)
- **Data Storage**: browser `localStorage` (no backend/database)
- **Analytics**: Toss Analytics SDK
- **Testing**: Vitest + React Testing Library (unit), Playwright (visual)

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
pnpm install --ignore-workspace
```

### Development Server

```bash
pnpm dev
```

Starts Vite dev server at `http://localhost:5173`. The app runs entirely in the browser with no backend.

### Build

```bash
pnpm build
```

Outputs static HTML/JS/CSS to `dist/` for Toss CDN deployment.

### Testing

```bash
# Unit & integration tests
pnpm test

# Visual regression tests
pnpm test:visual

# Update visual snapshots
pnpm test:visual:update

# Watch mode
pnpm test:watch

# Type checking
pnpm typecheck
```

## Environment Variables

| Variable | Description | Required | Example |
|---|---|---|---|
| `VITE_TOSS_AD_GROUP_ID` | Toss Ad banner slot ID (앱인토스 콘솔) | No | `"ad-group-123"` |
| `VITE_TOSS_AD_SLOT_ID` | Toss reward ad slot ID for reports/plans | No | `"reward-ad-456"` |

Create `.env.local` for local development (not committed to git).

## Project Structure

```
src/
├── pages/               # React Router pages (one file = one route)
│   ├── HomePage.tsx     # Dashboard with debt hero & 7-day trend
│   ├── RecordPage.tsx   # Daily sleep input form
│   ├── ReportPage.tsx   # Weekly report (reward-ad gated)
│   ├── PlanPage.tsx     # Weekend recovery plan (reward-ad gated)
│   ├── ChronotypePage.tsx         # Sleep type questionnaire
│   ├── ChronotypeResultPage.tsx   # Type diagnosis result
│   ├── SettingsPage.tsx # User preferences (target sleep hours)
│   └── OnboardingPage.tsx         # First-use intro flow
├── components/          # Reusable UI components
│   ├── ScreenScaffold.tsx  # Page frame with top nav
│   ├── SummaryHero.tsx     # Large metric display (debt hours)
│   ├── Sparkline.tsx       # Mini 7-day trend chart
│   ├── MiniBar.tsx         # Individual day bar
│   ├── StateView.tsx       # Empty/loading states
│   ├── FloatingTabBar.tsx  # Bottom navigation (5 tabs)
│   ├── TossRewardAd.tsx    # Reward ad wrapper
│   ├── AdSlot.tsx          # Banner ad container
│   └── ...
├── lib/
│   ├── storage.ts      # localStorage CRUD (records, settings, streak, chronotype)
│   ├── calc.ts         # Core math: sleep/debt/payoff calculations
│   ├── derive.ts       # Derived data (weekday labels, payoff estimates)
│   ├── types.ts        # TypeScript interfaces (SleepRecord, UserSettings, etc)
│   ├── utils.ts        # Helpers (time formatting, validation)
│   ├── records.ts      # Record upsert logic with streak update
│   └── adConfig.ts     # Ad slot environment config singleton
└── __tests__/          # Vitest unit/integration tests
```

## Core Data Models

### SleepRecord
```typescript
interface SleepRecord {
  id: string;           // "${date}" (YYYY-MM-DD, 1 per day)
  date: string;         // "2026-07-30"
  bedTime: string;      // "23:30" (HH:mm, 24h)
  wakeTime: string;     // "06:00" (HH:mm, 24h)
  sleepMinutes: number; // Auto-calculated (handles midnight-crossing)
  debtMinutes: number;  // target - sleepMinutes
  createdAt: number;    // epoch ms
}
```

### UserSettings
```typescript
interface UserSettings {
  targetMinutes: number; // Goal sleep (minutes), default 480 (8h), range 240–720
  onboarded: boolean;    // First-use flow completed
  aiNoticeAck: boolean;  // (Reserved) AI disclosure acknowledgment
}
```

### Streak
```typescript
interface Streak {
  current: number;       // Days checked in consecutively
  best: number;         // Best streak ever
  lastCheckDate: string; // Last record date (YYYY-MM-DD)
}
```

## API & Calculation Rules

All computation is rule-based; no AI/ML. Key functions in `src/lib/calc.ts`:

- `calcSleep(bedTime, wakeTime, targetMinutes)` — calculates daily sleep & debt
- `getCumulativeDebt(records)` — rolling 14-day debt sum
- `estimatePayoffDays(debt, avgExcessCapacity)` — days to zero debt
- `getDayofWeek(date)` — for report/plan labels

Midnight-crossing sleep (e.g., 23:30 → 6:00) is auto-corrected: wakeTime < bedTime triggers +1440min adjustment.

## Features in Detail

### 📊 Home Dashboard (HomePage)
- Displays cumulative debt (14-day rolling) as hero metric (SummaryHero with CountUp animation)
- Shows "Days to payoff" estimate if debt > 0
- Streak badge showing current & best consecutive days
- 7-day debt trend as sparkline chart
- "Record today" CTA if no entry for current date
- Empty state if no records exist

### 📝 Record Page (RecordPage)
- Time picker inputs for bedtime and wake time (numeric keyboard on mobile)
- Real-time sleep/debt preview as you type
- Save button disabled until both times entered & valid
- Same-day upsert: replaces existing entry for the date
- On success: updates streak, shows toast, navigates home

### 📈 Weekly Report (ReportPage)
- Requires watching a 30-second reward ad to unlock full report
- Shows 7-day bar chart (MiniBar × 7) with deficit days highlighted
- Summary card: weekly total debt, average sleep, most-deficit weekday
- Empty state if <3 days of records in past 7 days
- Loading skeleton during data fetch

### 🛏️ Recovery Plan (PlanPage)
- Also reward-ad gated
- Calculates Saturday/Sunday extra sleep needed to clear debt
- Applies ceiling: extra sleep capped at +2 hours (prevents 14-hour sleep binges)
- Shows target bedtime/wake time for each day
- Empty state if debt = 0 ("recovery not needed")

### 🧠 Chronotype (ChronotypePage)
- 5-question Likert scale (1–5 points per question)
- Scoring: 5–25 points total
- Types: 5–9 = Evening, 10–15 = Intermediate, 16–25 = Morning
- Result cached; retake button to re-assess

### ⚙️ Settings (SettingsPage)
- Target sleep hours slider (4–12 hours)
- Saved to localStorage instantly
- Used in all debt calculations

## Monetization

- **Banner ads** — placed below dashboard cards (doesn't overlap content)
- **Reward ads** — gate detailed reports (weekly, 30s video, high CPM)
- **No subscription/IAP** — all features free

## Deployment

Deploy to Toss CDN via App-in-Toss console:

```bash
npx ait deploy --api-key $APPS_IN_TOSS_API_KEY
```

Build output (`dist/`) must be < 100MB. Supports Android 7+, iOS 16+.

## Browser & Offline Support

- Runs fully offline (no external API calls)
- Works in modern browsers & Toss WebView
- Data persists in localStorage (mobile native persistence via SDK `Storage` is optional)

## Code Quality

- **TypeScript strict** — all `any` types replaced with `unknown`
- **No external API calls** — all calc/storage local
- **Test-driven** — TDD red/green/refactor for all features
- **Accessibility** — semantic HTML, aria-labels on icon buttons, 44px touch targets (TDS defaults)
- **Dark mode** — full support via CSS vars (no hardcoded hex colors)

## Development Workflow

1. **Feature branch** → write tests (`.test.ts`) → implement code → run `pnpm test` + `pnpm typecheck` → commit
2. **Visual review** → `pnpm test:visual` → inspect `.playwright/test-results/` snapshots → merge if clean
3. **Deploy** → `pnpm build` → verify `dist/` exists → push to Toss CDN

## Known Limitations

- localStorage quota (~5–10MB depending on device) — app uses ~60KB for 1 year of daily data
- No sync across devices — data is device-local only
- No cloud backup — lost if user clears app data

## License

MIT
