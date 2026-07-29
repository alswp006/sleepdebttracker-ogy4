import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockRouter } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { getSettings } from "@/lib/storage";
import type { UserSettings } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";

/**
 * Packet 0013: 설정 페이지 /settings
 *
 * Tests for:
 * - SettingsPage (default export): ScreenScaffold + FloatingTabBar, 목표 수면 Chip(4~12시간)
 *   선택 후 "저장" 버튼으로 저장. 로딩 중 Skeleton -> getSettings() 프리필.
 * - validateTargetMinutes(minutes) (named export): 240..720 범위 검증 pure function
 *   (탭-루트 화면이라 Chip은 유효 범위 4~12시간만 노출하므로, 범위 밖 거부는 이 pure
 *   function으로 직접 검증한다 — OnboardingPage.tsx의 동일 패턴 참조.)
 *
 * Requirements:
 * AC-1: 7시간 선택 후 저장 -> targetMinutes 420 저장, success 햅틱, Toast "목표를 저장했어요"
 * AC-2: 3시간(180분) 저장 시도 -> 거부 메시지, 저장 안 됨
 * AC-3: 로딩 중 Skeleton 표시 -> getSettings() 값으로 프리필; Chip ≥44px 터치 타깃
 */

mockTds();
mockAppsInToss();
mockRouter();

import { generateHapticFeedback } from "@apps-in-toss/web-framework";

// NOTE: src/pages/SettingsPage.tsx does not exist yet (TDD red phase). Loaded via require()
// inside each test to match this project's established red-phase convention.

const NOW = new Date("2026-07-30T09:00:00");
const SAVE_BUTTON_NAME = "저장";
const SAVED_TOAST = "목표를 저장했어요";

const EXISTING_SETTINGS: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };

function seedSettings(overrides: Partial<UserSettings> = {}) {
  const settings: UserSettings = { ...EXISTING_SETTINGS, ...overrides };
  seedLocalStorage({ [STORAGE_KEYS.settings]: settings });
  return settings;
}

async function flushLoading() {
  await act(async () => {
    vi.runAllTimers();
  });
}

describe("SettingsPage /settings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-3[P0]: shows a loading skeleton before settings load, then prefills the chip matching the stored targetMinutes", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    seedSettings({ targetMinutes: 480 }); // 8시간

    const SettingsPage = require("@/pages/SettingsPage").default;
    renderWithRouter(React.createElement(SettingsPage));

    expect(screen.getByTestId("settings-loading")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "8시간" })).not.toBeInTheDocument();

    await flushLoading();

    expect(screen.queryByTestId("settings-loading")).not.toBeInTheDocument();
    const preselected = screen.getByRole("button", { name: "8시간" });
    expect(preselected).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "5시간" })).toHaveAttribute("aria-pressed", "false");
  });

  it("AC-3[P0]: prefills from a non-default stored targetMinutes (5시간), not the 480 default", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    seedSettings({ targetMinutes: 300 }); // 5시간

    const SettingsPage = require("@/pages/SettingsPage").default;
    renderWithRouter(React.createElement(SettingsPage));

    await flushLoading();

    expect(screen.getByRole("button", { name: "5시간" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "8시간" })).toHaveAttribute("aria-pressed", "false");
  });

  it("AC-3[P0]: renders 9 target chips (4~12시간) each with a >=44px touch target", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    seedSettings();
    const SettingsPage = require("@/pages/SettingsPage").default;
    renderWithRouter(React.createElement(SettingsPage));

    await flushLoading();

    const chips = screen.getAllByTestId("settings-chip");
    expect(chips).toHaveLength(9);

    for (const chip of chips) {
      const minHeight = parseInt(chip.style.minHeight || "0", 10);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it("AC-1[P0]: selecting 7시간 and clicking 저장 saves targetMinutes 420, fires success haptic, and shows the saved toast", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    seedSettings({ targetMinutes: 480 });
    const SettingsPage = require("@/pages/SettingsPage").default;
    renderWithRouter(React.createElement(SettingsPage));

    await flushLoading();

    fireEvent.click(screen.getByRole("button", { name: "7시간" }));
    fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });

    const saved = getSettings();
    expect(saved.targetMinutes).toBe(420);
    expect(saved.onboarded).toBe(true);

    expect(screen.getByText(SAVED_TOAST)).toBeInTheDocument();
  });

  it("AC-1[P0]: saving without changing the selection keeps the existing targetMinutes and still shows the toast", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    seedSettings({ targetMinutes: 480 });
    const SettingsPage = require("@/pages/SettingsPage").default;
    renderWithRouter(React.createElement(SettingsPage));

    await flushLoading();

    fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

    expect(getSettings().targetMinutes).toBe(480);
    expect(screen.getByText(SAVED_TOAST)).toBeInTheDocument();
  });
});

describe("validateTargetMinutes", () => {
  it("AC-2[P0]: rejects 3시간(180분, below 240) with the exact rejection message and does not save", () => {
    const { validateTargetMinutes } = require("@/pages/SettingsPage");
    const result = validateTargetMinutes(180);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("목표는 4~12시간 사이로 설정해주세요");
    }
  });

  it("AC-2[P0]: rejects values above 720분 (>12시간) and accepts values inside 240..720", () => {
    const { validateTargetMinutes } = require("@/pages/SettingsPage");

    const tooHigh = validateTargetMinutes(780);
    expect(tooHigh.ok).toBe(false);
    if (!tooHigh.ok) {
      expect(tooHigh.message).toBe("목표는 4~12시간 사이로 설정해주세요");
    }

    const valid = validateTargetMinutes(420);
    expect(valid.ok).toBe(true);
  });
});
