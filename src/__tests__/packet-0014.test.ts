import { describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/types";
import type { UserSettings } from "@/lib/types";

/**
 * Packet 0014: 라우터 배선 + 온보딩 가드
 *
 * NOTE: react-router-dom is intentionally NOT mocked here (no mockRouter()/mockAll()) —
 * these are full-App integration tests that need real MemoryRouter navigation/redirects
 * to verify the onboarding guard and tab wiring actually work end-to-end.
 *
 * Requirements:
 * AC-1: onboarded===false 시 모든 경로 → /onboarding 리다이렉트
 * AC-2: onboarded===true 시 정상 라우팅; FloatingTabBar 탭 이동 동작
 * AC-3: 모든 Route path에 대응 페이지가 존재하고 크래시 없이 렌더된다 (컴파일·앱 구동)
 */

mockTds();
mockAppsInToss();
mockTossRewardAd();

import App from "@/App";

const ONBOARDED_TRUE: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };
const ONBOARDED_FALSE: UserSettings = { targetMinutes: 480, aiNoticeAck: false, onboarded: false };

const ONBOARDING_MARKER = "목표 수면 설정";

function renderAppAt(path: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)),
  );
}

describe("라우터 배선 + 온보딩 가드", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("AC-1[P0]: onboarded=false면 /(홈)에 접근해도 /onboarding으로 리다이렉트된다", () => {
    seedLocalStorage({ [STORAGE_KEYS.settings]: ONBOARDED_FALSE });
    renderAppAt("/");

    expect(screen.getByText(ONBOARDING_MARKER)).toBeInTheDocument();
    expect(screen.queryByText("수면 부채")).not.toBeInTheDocument();
  });

  it("AC-1[P0]: onboarded=false면 /report, /plan, /settings 등 임의 경로도 모두 /onboarding으로 리다이렉트된다", () => {
    for (const path of ["/report", "/plan", "/settings", "/chronotype", "/record"]) {
      localStorage.clear();
      seedLocalStorage({ [STORAGE_KEYS.settings]: ONBOARDED_FALSE });
      const { unmount } = renderAppAt(path);
      expect(screen.getByText(ONBOARDING_MARKER)).toBeInTheDocument();
      unmount();
    }
  });

  it("AC-1: 설정이 저장되지 않은 최초 진입(getSettings 기본값 onboarded:false)도 /onboarding으로 리다이렉트된다", () => {
    // no seeding -> getSettings() returns the default { onboarded: false }
    renderAppAt("/plan");
    expect(screen.getByText(ONBOARDING_MARKER)).toBeInTheDocument();
  });

  it("AC-2[P0]: onboarded=true면 /onboarding 리다이렉트 없이 각 경로가 해당 페이지를 정상 렌더한다", () => {
    const cases: Array<[string, string]> = [
      ["/", "수면 부채"],
      ["/report", "주간 리포트"],
      ["/plan", "주말 회복 플랜"],
      ["/chronotype", "수면 유형 진단"],
      ["/settings", "설정"],
      ["/record", "오늘 수면 기록"],
    ];

    for (const [path, marker] of cases) {
      localStorage.clear();
      seedLocalStorage({ [STORAGE_KEYS.settings]: ONBOARDED_TRUE });
      const { unmount } = renderAppAt(path);
      expect(screen.getByText(marker)).toBeInTheDocument();
      expect(screen.queryByText(ONBOARDING_MARKER)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("AC-2[P0]: FloatingTabBar 탭 클릭 시 실제로 해당 경로로 이동한다", () => {
    seedLocalStorage({ [STORAGE_KEYS.settings]: ONBOARDED_TRUE });
    renderAppAt("/report");
    expect(screen.getByText("주간 리포트")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "플랜" }));
    expect(screen.getByText("주말 회복 플랜")).toBeInTheDocument();
    expect(screen.queryByText("주간 리포트")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "설정" }));
    expect(screen.getByText("설정")).toBeInTheDocument();
  });

  it("AC-3: App의 모든 Route path가 대응 페이지 컴포넌트를 크래시 없이 렌더한다", () => {
    const paths = [
      "/onboarding",
      "/",
      "/record",
      "/report",
      "/plan",
      "/chronotype",
      "/chronotype/result",
      "/settings",
    ];

    for (const path of paths) {
      localStorage.clear();
      seedLocalStorage({ [STORAGE_KEYS.settings]: ONBOARDED_TRUE });
      const { unmount, container } = renderAppAt(path);
      expect(container.querySelector("nav[role='navigation']")).not.toBeNull();
      expect(container.textContent).not.toBe("");
      unmount();
    }
  });
});
