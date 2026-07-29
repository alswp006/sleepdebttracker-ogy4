import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockRouter } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { SleepRecord, UserSettings } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

/**
 * Packet 0009: 주간 리포트 페이지 /report
 *
 * Tests for:
 * - ReportPage (default export): ScreenScaffold + FloatingTabBar, TossRewardAd 게이팅 주간 리포트
 *
 * Requirements:
 * AC-1: 광고 시청 완료 후에만 요약 Card(week-summary-card)·MiniBar7(week-bars) 노출
 * AC-2: <3건/0건 안내·광고 숨김
 * AC-3: 광고 실패 Toast·미공개; 로딩 Skeleton
 */

// NOTE: mockAll()'s mockTossRewardAd() bypasses the reward-ad gate entirely (auto-unlocks
// children on mount), which would make AC-1/AC-3's gating behavior untestable. This packet
// needs the *real* TossRewardAd/ad-gate flow driven by the mocked SDK functions instead, so
// only mockTds/mockAppsInToss/mockRouter are used (no mockTossRewardAd, no mockAll).
mockTds();
mockAppsInToss();
mockRouter();

import { showFullScreenAd } from "@apps-in-toss/web-framework";

// NOTE: src/pages/ReportPage.tsx does not exist yet (TDD red phase).
// A static `import` would fail tsc with TS2307 before the Coder creates the file,
// so — matching this project's established red-phase convention (see packet-0006.test.ts) —
// it's loaded via require() inside each test instead.

const TODAY = "2026-01-15"; // Thursday
const NOW = new Date("2026-01-15T09:00:00");

const WATCH_BUTTON_NAME = "리포트 보기";

const SETTINGS: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };

function seedThreePlusRecords() {
  const records: SleepRecord[] = [
    {
      id: "2026-01-12",
      date: "2026-01-12", // Monday
      bedTime: "23:00",
      wakeTime: "06:00",
      sleepMinutes: 420,
      debtMinutes: 60,
      createdAt: 1,
    },
    {
      id: "2026-01-13",
      date: "2026-01-13", // Tuesday — worst day (highest debt)
      bedTime: "00:30",
      wakeTime: "06:30",
      sleepMinutes: 360,
      debtMinutes: 120,
      createdAt: 2,
    },
    {
      id: "2026-01-15",
      date: "2026-01-15", // Thursday (today)
      bedTime: "23:30",
      wakeTime: "07:00",
      sleepMinutes: 450,
      debtMinutes: 30,
      createdAt: 3,
    },
  ];
  seedLocalStorage({ [STORAGE_KEYS.records]: records, [STORAGE_KEYS.settings]: SETTINGS });
  return records;
}

function seedTwoRecords() {
  const records: SleepRecord[] = [
    {
      id: "2026-01-12",
      date: "2026-01-12",
      bedTime: "23:00",
      wakeTime: "06:00",
      sleepMinutes: 420,
      debtMinutes: 60,
      createdAt: 1,
    },
    {
      id: "2026-01-13",
      date: "2026-01-13",
      bedTime: "00:30",
      wakeTime: "06:30",
      sleepMinutes: 360,
      debtMinutes: 120,
      createdAt: 2,
    },
  ];
  seedLocalStorage({ [STORAGE_KEYS.records]: records, [STORAGE_KEYS.settings]: SETTINGS });
  return records;
}

describe("ReportPage /report", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-3[P0]: shows a chart skeleton while loading, then replaces it with the report content", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    seedThreePlusRecords();
    const ReportPage = require("@/pages/ReportPage").default;
    renderWithRouter(React.createElement(ReportPage));

    expect(screen.getByTestId("report-loading")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: WATCH_BUTTON_NAME })).not.toBeInTheDocument();

    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.queryByTestId("report-loading")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: WATCH_BUTTON_NAME })).toBeInTheDocument();
  });

  it("AC-2[P0]: with 0 records shows '이번 주 기록이 없어요' empty state and hides the ad button and chart", async () => {
    seedLocalStorage({ [STORAGE_KEYS.settings]: SETTINGS });
    const ReportPage = require("@/pages/ReportPage").default;
    renderWithRouter(React.createElement(ReportPage));

    expect(await screen.findByText("이번 주 기록이 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: WATCH_BUTTON_NAME })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("week-bars")).toHaveLength(0);
  });

  it("AC-2[P0]: with 2 records (<3) shows '기록이 부족해요. 최소 3일 기록해주세요' and hides the ad button and chart", async () => {
    seedTwoRecords();
    const ReportPage = require("@/pages/ReportPage").default;
    renderWithRouter(React.createElement(ReportPage));

    expect(await screen.findByText("기록이 부족해요. 최소 3일 기록해주세요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: WATCH_BUTTON_NAME })).not.toBeInTheDocument();
    expect(screen.queryByTestId("week-summary-card")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("week-bars")).toHaveLength(0);
  });

  it("AC-1[P0]: with 3+ records, the summary card and MiniBar chart stay hidden until the reward ad is watched", async () => {
    seedThreePlusRecords();
    const ReportPage = require("@/pages/ReportPage").default;
    renderWithRouter(React.createElement(ReportPage));

    const watchButton = await screen.findByRole("button", { name: WATCH_BUTTON_NAME });
    expect(watchButton).toBeInTheDocument();
    expect(screen.queryByTestId("week-summary-card")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("week-bars")).toHaveLength(0);
  });

  it("AC-1[P0]: watching the reward ad reveals week-summary-card (총부채/평균수면/최다부족요일) and 7 MiniBars", async () => {
    seedThreePlusRecords();
    const ReportPage = require("@/pages/ReportPage").default;
    renderWithRouter(React.createElement(ReportPage));

    const watchButton = await screen.findByRole("button", { name: WATCH_BUTTON_NAME });
    await waitFor(() => expect(watchButton).not.toBeDisabled());
    fireEvent.click(watchButton);

    const card = await screen.findByTestId("week-summary-card");
    // 총부채 210분 -> "3시간 30분", 평균수면 410분 -> "6시간 50분", 최다부족요일 = 2026-01-13(화)
    expect(card.textContent).toContain("3시간 30분");
    expect(card.textContent).toContain("6시간 50분");
    expect(card.textContent).toContain("화요일");

    const bars = screen.getAllByTestId("week-bars");
    expect(bars).toHaveLength(7);
    // index 3 = 2026-01-12 (420/480 -> 88%), index 6 = 2026-01-15 today (450/480 -> 94%)
    expect(Number(bars[3].getAttribute("aria-valuenow"))).toBe(88);
    expect(Number(bars[6].getAttribute("aria-valuenow"))).toBe(94);
  });

  it("AC-3[P0]: shows an ad-failure toast, keeps the report locked, and does not crash when the reward ad fails", async () => {
    seedThreePlusRecords();
    vi.mocked(showFullScreenAd).mockImplementationOnce(((opts: { onError?: (e: Error) => void }) => {
      setTimeout(() => opts.onError?.(new Error("ad failed")), 0);
      return () => {};
    }) as unknown as typeof showFullScreenAd);

    const ReportPage = require("@/pages/ReportPage").default;
    renderWithRouter(React.createElement(ReportPage));

    const watchButton = await screen.findByRole("button", { name: WATCH_BUTTON_NAME });
    await waitFor(() => expect(watchButton).not.toBeDisabled());
    fireEvent.click(watchButton);

    expect(
      await screen.findByText("광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("week-summary-card")).not.toBeInTheDocument();
    // page did not crash — the ad trigger is still present so the user can retry
    expect(screen.getByRole("button", { name: WATCH_BUTTON_NAME })).toBeInTheDocument();
  });
});
