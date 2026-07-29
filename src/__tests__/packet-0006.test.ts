import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * Packet 0006: 온보딩 페이지 /onboarding
 *
 * Tests for:
 * - OnboardingPage (default export): ScreenScaffold + Chip(6/7/8/9시간) 선택 + SubmitFooter 완료
 * - validateTargetMinutes(minutes) (named export): 240..720 범위 검증 pure function
 *
 * Requirements:
 * AC-1: 8시간 선택·완료 시 targetMinutes 480·onboarded true 저장 후 홈 replace 이동
 * AC-2: 미선택 시 완료 버튼 disabled
 * AC-3: 범위 밖 거부 + Chip ≥44px
 */

mockAll();

// mockAll() already mocks react-router-dom's useNavigate -> mockNavigate.
// Import it after the mock module is set up so we can assert navigation calls.
import { mockNavigate } from "@/__tests__/__helpers__/mocks";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { getSettings } from "@/lib/storage";

// NOTE: src/pages/OnboardingPage.tsx does not exist yet (TDD red phase).
// A static `import` would fail tsc with TS2307 before the Coder creates the file,
// so — matching this project's established red-phase convention (see packet-0004.test.ts) —
// it's loaded via require() inside each test instead (require()'s signature is
// `(id: string) => any`, so tsc doesn't try to resolve/typecheck the module path).

describe("OnboardingPage /onboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("AC-1[P0]: selecting 8시간 and clicking 완료 saves targetMinutes 480, onboarded true, and navigates home with replace", () => {
    const OnboardingPage = require("@/pages/OnboardingPage").default;
    renderWithRouter(React.createElement(OnboardingPage));

    // Act: select 8시간 chip
    fireEvent.click(screen.getByRole("button", { name: "8시간" }));

    // Chip 선택 시 tickWeak 햅틱
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });

    // Act: complete
    fireEvent.click(screen.getByRole("button", { name: /완료/ }));

    // Assert: persisted settings
    const settings = getSettings();
    expect(settings.targetMinutes).toBe(480);
    expect(settings.onboarded).toBe(true);

    // Assert: navigation
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("AC-1[P0]: selecting 6시간 saves targetMinutes 360", () => {
    const OnboardingPage = require("@/pages/OnboardingPage").default;
    renderWithRouter(React.createElement(OnboardingPage));

    fireEvent.click(screen.getByRole("button", { name: "6시간" }));
    fireEvent.click(screen.getByRole("button", { name: /완료/ }));

    const settings = getSettings();
    expect(settings.targetMinutes).toBe(360);
    expect(settings.onboarded).toBe(true);
  });

  it("AC-2[P0]: 완료 button is disabled when no chip is selected", () => {
    const OnboardingPage = require("@/pages/OnboardingPage").default;
    renderWithRouter(React.createElement(OnboardingPage));

    const submitButton = screen.getByRole("button", { name: /완료/ });
    expect(submitButton).toBeDisabled();

    // clicking a disabled button must not save or navigate
    fireEvent.click(submitButton);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getSettings().onboarded).toBe(false);
  });

  it("AC-2[P0]: 완료 button becomes enabled after a chip is selected", () => {
    const OnboardingPage = require("@/pages/OnboardingPage").default;
    renderWithRouter(React.createElement(OnboardingPage));

    const submitButton = screen.getByRole("button", { name: /완료/ });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "9시간" }));

    expect(submitButton).not.toBeDisabled();
  });

  it("AC-3[P0]: renders 6/7/8/9시간 chips each with a ≥44px touch target", () => {
    const OnboardingPage = require("@/pages/OnboardingPage").default;
    renderWithRouter(React.createElement(OnboardingPage));

    const chips = screen.getAllByTestId("target-chip");
    expect(chips).toHaveLength(4);

    for (const chip of chips) {
      const minHeight = parseInt(chip.style.minHeight || "0", 10);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    }

    expect(screen.getByRole("button", { name: "6시간" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7시간" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8시간" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9시간" })).toBeInTheDocument();
  });
});

describe("validateTargetMinutes", () => {
  it("AC-3[P0]: rejects values below 240 minutes with the exact error message", () => {
    const { validateTargetMinutes } = require("@/pages/OnboardingPage");
    const result = validateTargetMinutes(180);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("목표는 4~12시간 사이로 설정해주세요");
    }
  });

  it("AC-3[P0]: rejects values above 720 minutes with the exact error message", () => {
    const { validateTargetMinutes } = require("@/pages/OnboardingPage");
    const result = validateTargetMinutes(721);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("목표는 4~12시간 사이로 설정해주세요");
    }
  });

  it("AC-3: accepts boundary and typical in-range values", () => {
    const { validateTargetMinutes } = require("@/pages/OnboardingPage");
    expect(validateTargetMinutes(240)).toEqual({ ok: true });
    expect(validateTargetMinutes(720)).toEqual({ ok: true });
    expect(validateTargetMinutes(480)).toEqual({ ok: true });
  });
});
