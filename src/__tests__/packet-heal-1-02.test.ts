import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { getSettings } from "@/lib/storage";
import { STORAGE_KEYS } from "@/lib/types";
import type { UserSettings } from "@/lib/types";

/**
 * Packet heal-1-02: 온보딩 페이지(0006) 라우트 연결·완료 처리
 *
 * NOTE: react-router-dom is intentionally NOT mocked (no mockRouter()/mockAll()) —
 * these are full-App integration tests exercising real navigation/redirects, matching
 * the established convention in packet-0014.test.ts.
 *
 * NOTE on file location: OnboardingPage already exists (and is already wired into
 * App.tsx) at src/pages/OnboardingPage.tsx — NOT src/pages/onboarding/OnboardingPage.tsx.
 * Per CLAUDE.md rule "check for duplicates — ensure you didn't recreate something that
 * already exists", these tests target the real, already-wired module rather than a new
 * subfolder that would duplicate it.
 *
 * Requirements:
 * AC-1: 목표 수면 설정 후 완료 시 onboarded=true 영속 + / 이동
 * AC-2: 온보딩 완료 후 재진입 시 가드가 /onboarding을 다시 강제하지 않는다
 * AC-3: 저장 실패(QUOTA) 시 토스트만 뜨고 크래시·이동 없음
 * AC-4: TDS 컴포넌트만 사용, HEX 하드코딩 0개
 */

mockTds();
mockAppsInToss();
mockTossRewardAd();

import App from "@/App";

const ONBOARDING_MARKER = "목표 수면 설정";
const HOME_MARKER = "수면 부채";

const ONBOARDED_TRUE: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };

function renderAppAt(path: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)),
  );
}

describe("온보딩 페이지(0006) 라우트 연결·완료 처리", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("AC-1[P0]: 목표 수면(8시간) 설정 후 완료 시 onboarded=true·targetMinutes=480이 영속되고 홈으로 이동한다", () => {
    renderAppAt("/onboarding");
    expect(screen.getByText(ONBOARDING_MARKER)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "8시간" }));
    fireEvent.click(screen.getByRole("button", { name: /완료/ }));

    const settings = getSettings();
    expect(settings.onboarded).toBe(true);
    expect(settings.targetMinutes).toBe(480);

    expect(screen.getByText(HOME_MARKER)).toBeInTheDocument();
    expect(screen.queryByText(ONBOARDING_MARKER)).not.toBeInTheDocument();
  });

  it("AC-2[P0]: 온보딩 완료 상태(onboarded=true)로 진입하면 /, /settings 모두 /onboarding으로 강제되지 않고 정상 렌더된다", () => {
    const cases: Array<[string, string]> = [
      ["/", HOME_MARKER],
      ["/settings", "설정"],
    ];

    for (const [targetPath, marker] of cases) {
      localStorage.clear();
      seedLocalStorage({ [STORAGE_KEYS.settings]: ONBOARDED_TRUE });
      const { unmount } = renderAppAt(targetPath);
      expect(screen.getByText(marker)).toBeInTheDocument();
      expect(screen.queryByText(ONBOARDING_MARKER)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("AC-2[P0]: 온보딩 완료 직후 앱을 새로 마운트해 재진입해도(/plan) /onboarding이 다시 뜨지 않는다", () => {
    const { unmount } = renderAppAt("/onboarding");
    fireEvent.click(screen.getByRole("button", { name: "7시간" }));
    fireEvent.click(screen.getByRole("button", { name: /완료/ }));
    expect(getSettings().onboarded).toBe(true);
    unmount();

    // simulate re-opening the app (fresh mount) reading the settings persisted above
    renderAppAt("/plan");
    expect(screen.getByText("주말 회복 플랜")).toBeInTheDocument();
    expect(screen.queryByText(ONBOARDING_MARKER)).not.toBeInTheDocument();
  });

  it("AC-3[P0]: 저장 실패(QUOTA) 시 '저장 공간이 부족해요' 토스트만 뜨고 크래시·홈 이동 없이 온보딩 화면이 유지된다", () => {
    // localStorage.setItem cannot be reassigned directly in jsdom (legacy platform object) —
    // spy on Storage.prototype so writeSettings()'s try/catch actually observes the throw.
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    try {
      renderAppAt("/onboarding");
      fireEvent.click(screen.getByRole("button", { name: "9시간" }));
      fireEvent.click(screen.getByRole("button", { name: /완료/ }));

      expect(screen.getByText("저장 공간이 부족해요")).toBeInTheDocument();
      // did not crash — the 완료 button (and onboarding screen) is still present
      expect(screen.getByRole("button", { name: /완료/ })).toBeInTheDocument();
      // did not navigate away on failure
      expect(screen.queryByText(HOME_MARKER)).not.toBeInTheDocument();
      // settings were not corrupted with a half-written onboarded:true
      expect(getSettings().onboarded).toBe(false);
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("AC-4: OnboardingPage 소스는 TDS 컴포넌트(@toss/tds-mobile)만 사용하고 하드코딩 HEX 색상이 없다", () => {
    const filePath = path.resolve(__dirname, "../pages/OnboardingPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toMatch(/from ['"]@toss\/tds-mobile['"]/);
    expect(content).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
