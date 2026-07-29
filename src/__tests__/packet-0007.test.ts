import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { SleepRecord, UserSettings, Streak } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

/**
 * Packet 0007: 홈 대시보드 /
 *
 * Tests for:
 * - HomePage (default export): ScreenScaffold + FloatingTabBar 대시보드
 *
 * Requirements:
 * AC-1: 기록 3건↑ 시 debt-hero/trend-sparkline/payoff-card 렌더; 0건 시 빈 상태·차트 숨김
 * AC-2: 오늘 미기록 시 기록 버튼 노출; 부채0 시 배지; 스트릭 배지
 * AC-3: AdSlot 카드 하단 1개; 로딩 시 Skeleton
 */

mockAll();

// mockAll() already mocks react-router-dom's useNavigate -> mockNavigate.
import { mockNavigate } from "@/__tests__/__helpers__/mocks";

// NOTE: src/pages/HomePage.tsx does not exist yet (TDD red phase).
// A static `import` would fail tsc with TS2307 before the Coder creates the file,
// so — matching this project's established red-phase convention (see packet-0006.test.ts) —
// it's loaded via require() inside each test instead.

const TODAY = "2026-01-15";
const NOW = new Date("2026-01-15T09:00:00");

function seedThreePlusRecords() {
  const records: SleepRecord[] = [
    {
      id: "2026-01-10",
      date: "2026-01-10",
      bedTime: "23:00",
      wakeTime: "06:30",
      sleepMinutes: 450,
      debtMinutes: 90,
      createdAt: 1,
    },
    {
      id: "2026-01-11",
      date: "2026-01-11",
      bedTime: "00:00",
      wakeTime: "06:45",
      sleepMinutes: 415,
      debtMinutes: 65,
      createdAt: 2,
    },
    {
      id: "2026-01-12",
      date: "2026-01-12",
      bedTime: "23:30",
      wakeTime: "06:50",
      sleepMinutes: 440,
      debtMinutes: 40,
      createdAt: 3,
    },
  ];
  const settings: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };
  const streak: Streak = { current: 5, best: 5, lastCheckDate: TODAY };
  seedLocalStorage({
    [STORAGE_KEYS.records]: records,
    [STORAGE_KEYS.settings]: settings,
    [STORAGE_KEYS.streak]: streak,
  });
  return { records, settings, streak };
}

describe("HomePage /", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-1[P0]: with 3+ records renders debt-hero (formatted), trend-sparkline, and payoff-card", async () => {
    seedThreePlusRecords();
    const HomePage = require("@/pages/HomePage").default;
    renderWithRouter(React.createElement(HomePage));

    // 195min cumulative debt (90+65+40) -> "3시간 15분"; payoff avg=65, ceil(195/65)=3일
    const hero = await screen.findByTestId("debt-hero");
    expect(hero.textContent).toContain("3시간 15분");

    const sparkline = screen.getByTestId("trend-sparkline");
    expect(sparkline).toBeInTheDocument();

    const payoffCard = screen.getByTestId("payoff-card");
    expect(payoffCard.textContent).toContain("3일");
  });

  it("AC-1[P0]: with 0 records shows empty state and hides hero/sparkline/payoff-card", async () => {
    const settings: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };
    seedLocalStorage({ [STORAGE_KEYS.settings]: settings });
    const HomePage = require("@/pages/HomePage").default;
    renderWithRouter(React.createElement(HomePage));

    expect(await screen.findByText(/첫 수면을 기록해보세요/)).toBeInTheDocument();
    expect(screen.queryByTestId("debt-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trend-sparkline")).not.toBeInTheDocument();
    expect(screen.queryByTestId("payoff-card")).not.toBeInTheDocument();
  });

  it("AC-2[P0]: shows '오늘 수면 기록하기' button when today has no record, and it navigates to /record with today's date", async () => {
    seedThreePlusRecords(); // records only through 2026-01-12, today (2026-01-15) not recorded
    const HomePage = require("@/pages/HomePage").default;
    renderWithRouter(React.createElement(HomePage));

    const recordButton = await screen.findByRole("button", { name: "오늘 수면 기록하기" });
    fireEvent.click(recordButton);

    expect(mockNavigate).toHaveBeenCalledWith("/record", { state: { date: TODAY } });
  });

  it("AC-2[P0]: hides the record button when today already has a record", async () => {
    const { records, settings, streak } = seedThreePlusRecords();
    const todayRecord: SleepRecord = {
      id: TODAY,
      date: TODAY,
      bedTime: "23:00",
      wakeTime: "07:00",
      sleepMinutes: 480,
      debtMinutes: 0,
      createdAt: 4,
    };
    seedLocalStorage({
      [STORAGE_KEYS.records]: [...records, todayRecord],
      [STORAGE_KEYS.settings]: settings,
      [STORAGE_KEYS.streak]: streak,
    });
    const HomePage = require("@/pages/HomePage").default;
    renderWithRouter(React.createElement(HomePage));

    await screen.findByTestId("debt-hero");
    expect(screen.queryByRole("button", { name: "오늘 수면 기록하기" })).not.toBeInTheDocument();
  });

  it("AC-2: shows '수면 부채 없음' chip when cumulative debt is 0", async () => {
    const zeroDebtRecord: SleepRecord = {
      id: TODAY,
      date: TODAY,
      bedTime: "23:00",
      wakeTime: "07:00",
      sleepMinutes: 480,
      debtMinutes: 0,
      createdAt: 1,
    };
    const settings: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };
    seedLocalStorage({
      [STORAGE_KEYS.records]: [zeroDebtRecord],
      [STORAGE_KEYS.settings]: settings,
    });
    const HomePage = require("@/pages/HomePage").default;
    renderWithRouter(React.createElement(HomePage));

    const hero = await screen.findByTestId("debt-hero");
    expect(hero.textContent).toContain("0분");
    expect(screen.getByText(/수면 부채 없음/)).toBeInTheDocument();
  });

  it("AC-2: streak-chip shows '🔥 N일 연속' when streak.current > 0, and a start-over message when 0", async () => {
    const { records, settings } = seedThreePlusRecords();
    seedLocalStorage({
      [STORAGE_KEYS.records]: records,
      [STORAGE_KEYS.settings]: settings,
      [STORAGE_KEYS.streak]: { current: 5, best: 5, lastCheckDate: TODAY } as Streak,
    });
    const HomePage = require("@/pages/HomePage").default;
    const { unmount } = renderWithRouter(React.createElement(HomePage));

    await screen.findByTestId("debt-hero");
    expect(screen.getByTestId("streak-chip").textContent).toContain("🔥 5일 연속");
    unmount();

    localStorage.clear();
    seedLocalStorage({
      [STORAGE_KEYS.records]: records,
      [STORAGE_KEYS.settings]: settings,
      [STORAGE_KEYS.streak]: { current: 0, best: 0, lastCheckDate: "" } as Streak,
    });
    const HomePage2 = require("@/pages/HomePage").default;
    renderWithRouter(React.createElement(HomePage2));
    await screen.findByTestId("debt-hero");
    expect(screen.getByTestId("streak-chip").textContent).toContain("오늘부터 시작해보세요");
  });

  it("AC-3[P0]: renders exactly one AdSlot below the info cards", async () => {
    seedThreePlusRecords();
    const HomePage = require("@/pages/HomePage").default;
    const { container } = renderWithRouter(React.createElement(HomePage));

    await screen.findByTestId("debt-hero");
    const adSlots = container.querySelectorAll("[data-ad-group-id]");
    expect(adSlots.length).toBe(1);
  });

  it("AC-3[P0]: shows a skeleton while loading, then replaces it with the dashboard content", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    seedThreePlusRecords();
    const HomePage = require("@/pages/HomePage").default;
    renderWithRouter(React.createElement(HomePage));

    expect(screen.getByTestId("home-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("debt-hero")).not.toBeInTheDocument();

    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.queryByTestId("home-loading")).not.toBeInTheDocument();
    expect(screen.getByTestId("debt-hero")).toBeInTheDocument();
  });
});
