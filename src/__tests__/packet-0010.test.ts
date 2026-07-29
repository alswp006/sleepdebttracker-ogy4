import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { SleepRecord, UserSettings } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

/**
 * Packet 0010: 회복 플랜 페이지 /plan
 *
 * Tests for:
 * - PlanPage (default export): ScreenScaffold + FloatingTabBar, TossRewardAd 게이팅 회복 플랜
 *
 * Requirements:
 * AC-1: 목표480·부채720 -> 권장 600(토·일 카드 2개, plan-card); 부채0 -> 안내 문구 + 플랜 숨김
 * AC-2: 0건 -> 안내 + /record 이동; 광고 완료 후에만 플랜 공개
 * AC-3: 광고 중도종료/실패 Toast; 로딩 Skeleton
 */

// NOTE: mockAll()'s mockTossRewardAd() auto-unlocks children on mount regardless of ad outcome,
// which would make the AC-2/AC-3 gating (locked until reward, toast on dismiss) untestable.
// This packet drives the real ad flow via the mocked SDK functions directly (see packet-0009.test.ts).
mockTds();
mockAppsInToss();
mockRouter();

import { showFullScreenAd } from "@apps-in-toss/web-framework";

// NOTE: src/pages/PlanPage.tsx does not exist yet (TDD red phase). Loaded via require()
// inside each test to match this project's established red-phase convention.

const TODAY = "2026-01-15"; // Thursday
const NOW = new Date("2026-01-15T09:00:00");

const WATCH_BUTTON_NAME = "회복 플랜 보기";
const RECORD_CTA_NAME = "수면 기록하러 가기";
const AD_INCOMPLETE_TOAST = "광고 시청을 완료해야 플랜을 볼 수 있어요";
const NO_DEBT_MESSAGE = "회복이 필요 없어요. 지금 리듬을 유지하세요";
const EMPTY_TITLE = "먼저 수면을 기록해주세요";

const SETTINGS: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };

function seedDebtRecords(): SleepRecord[] {
  // 부채 합계 720 (14일 롤링 윈도우 내부, TODAY 기준 diff 0/1)
  const records: SleepRecord[] = [
    {
      id: "2026-01-14",
      date: "2026-01-14",
      bedTime: "01:00",
      wakeTime: "03:00",
      sleepMinutes: 120,
      debtMinutes: 360,
      createdAt: 1,
    },
    {
      id: "2026-01-15",
      date: "2026-01-15",
      bedTime: "01:00",
      wakeTime: "03:00",
      sleepMinutes: 120,
      debtMinutes: 360,
      createdAt: 2,
    },
  ];
  seedLocalStorage({ [STORAGE_KEYS.records]: records, [STORAGE_KEYS.settings]: SETTINGS });
  return records;
}

function seedZeroDebtRecord(): SleepRecord[] {
  const records: SleepRecord[] = [
    {
      id: "2026-01-15",
      date: "2026-01-15",
      bedTime: "22:00",
      wakeTime: "06:00",
      sleepMinutes: 480,
      debtMinutes: 0,
      createdAt: 1,
    },
  ];
  seedLocalStorage({ [STORAGE_KEYS.records]: records, [STORAGE_KEYS.settings]: SETTINGS });
  return records;
}

describe("PlanPage /plan", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-3[P0]: shows a loading skeleton, then replaces it with the plan content", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    seedDebtRecords();
    const PlanPage = require("@/pages/PlanPage").default;
    renderWithRouter(React.createElement(PlanPage));

    expect(screen.getByTestId("plan-loading")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: WATCH_BUTTON_NAME })).not.toBeInTheDocument();

    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.queryByTestId("plan-loading")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: WATCH_BUTTON_NAME })).toBeInTheDocument();
  });

  it("AC-2[P0]: with 0 records shows '먼저 수면을 기록해주세요' and navigates to /record with today's date on CTA click", async () => {
    seedLocalStorage({ [STORAGE_KEYS.settings]: SETTINGS });
    const PlanPage = require("@/pages/PlanPage").default;
    renderWithRouter(React.createElement(PlanPage));

    expect(await screen.findByText(EMPTY_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: WATCH_BUTTON_NAME })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("plan-card")).toHaveLength(0);

    const cta = screen.getByRole("button", { name: RECORD_CTA_NAME });
    fireEvent.click(cta);

    expect(mockNavigate).toHaveBeenCalledWith("/record", { state: { date: TODAY } });
  });

  it("AC-1[P0]: with 0 cumulative debt shows '회복이 필요 없어요. 지금 리듬을 유지하세요' and hides the ad button and plan cards", async () => {
    seedZeroDebtRecord();
    const PlanPage = require("@/pages/PlanPage").default;
    renderWithRouter(React.createElement(PlanPage));

    expect(await screen.findByText(NO_DEBT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: WATCH_BUTTON_NAME })).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("plan-card")).toHaveLength(0);
  });

  it("AC-2[P0]: with debt > 0, the plan cards stay hidden behind the reward ad until watched", async () => {
    seedDebtRecords();
    const PlanPage = require("@/pages/PlanPage").default;
    renderWithRouter(React.createElement(PlanPage));

    const watchButton = await screen.findByRole("button", { name: WATCH_BUTTON_NAME });
    expect(watchButton).toBeInTheDocument();
    expect(screen.queryAllByTestId("plan-card")).toHaveLength(0);
    expect(screen.queryByText(NO_DEBT_MESSAGE)).not.toBeInTheDocument();
  });

  it("AC-1[P0]: watching the reward ad reveals 2 plan-card (토/일) with recommended sleep and '추가 +120분'", async () => {
    seedDebtRecords();
    const PlanPage = require("@/pages/PlanPage").default;
    renderWithRouter(React.createElement(PlanPage));

    const watchButton = await screen.findByRole("button", { name: WATCH_BUTTON_NAME });
    await waitFor(() => expect(watchButton).not.toBeDisabled());
    fireEvent.click(watchButton);

    const cards = await screen.findAllByTestId("plan-card");
    expect(cards).toHaveLength(2);
    // 목표 480 + 추가 120(=min(round(720/2), 120)) = 600분 -> "10시간"
    expect(cards[0].textContent).toContain("토요일");
    expect(cards[1].textContent).toContain("일요일");
    for (const card of cards) {
      expect(card.textContent).toContain("10시간");
      expect(card.textContent).toContain("추가 +120분");
    }
  });

  it("AC-3[P0]: dismissing the reward ad without completing it shows a toast and keeps the plan locked", async () => {
    seedDebtRecords();
    vi.mocked(showFullScreenAd).mockImplementationOnce(((opts: { onEvent?: (e: { type: string }) => void }) => {
      setTimeout(() => opts.onEvent?.({ type: "dismissed" }), 0);
      return () => {};
    }) as unknown as typeof showFullScreenAd);

    const PlanPage = require("@/pages/PlanPage").default;
    renderWithRouter(React.createElement(PlanPage));

    const watchButton = await screen.findByRole("button", { name: WATCH_BUTTON_NAME });
    await waitFor(() => expect(watchButton).not.toBeDisabled());
    fireEvent.click(watchButton);

    expect(await screen.findByText(AD_INCOMPLETE_TOAST)).toBeInTheDocument();
    expect(screen.queryAllByTestId("plan-card")).toHaveLength(0);
    // page did not crash — the ad trigger is still present so the user can retry
    expect(screen.getByRole("button", { name: WATCH_BUTTON_NAME })).toBeInTheDocument();
  });
});
