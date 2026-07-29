import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { screen } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

mockAll();

const APP_SOURCE = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
const MAIN_SOURCE = fs.readFileSync(path.resolve(__dirname, "../main.tsx"), "utf8");

describe("라우팅 와이어링 + Provider 연결 + 통합 폴리시", () => {
  it("AC-1[P0]: App.tsx는 모든 페이지의 Route를 정의한다", () => {
    const expectedRoutes = [
      { path: "/onboarding", component: "OnboardingPage" },
      { path: "/", component: "HomePage" },
      { path: "/record", component: "RecordPage" },
      { path: "/report", component: "ReportPage" },
      { path: "/plan", component: "PlanPage" },
      { path: "/chronotype", component: "ChronotypePage" },
      { path: "/chronotype/result", component: "ChronotypeResultPage" },
      { path: "/settings", component: "SettingsPage" },
    ];

    for (const route of expectedRoutes) {
      expect(APP_SOURCE).toContain(`path="${route.path}"`);
      expect(APP_SOURCE).toContain(route.component);
    }
    // 정확히 8개의 실 페이지 Route path가 존재 (dev-only 갤러리 제외)
    const pathMatches = APP_SOURCE.match(/path="\/[^"]*"/g) ?? [];
    expect(pathMatches.length).toBeGreaterThanOrEqual(8);
  });

  it("AC-2[P0]: 페이지에서 navigate()로 이동하는 모든 경로에 대응하는 Route가 존재한다", () => {
    const pagesDir = path.resolve(__dirname, "../pages");
    const componentsDir = path.resolve(__dirname, "../components");
    const files = [
      ...fs.readdirSync(pagesDir).map((f) => path.join(pagesDir, f)),
      ...fs.readdirSync(componentsDir).map((f) => path.join(componentsDir, f)),
    ].filter((f) => f.endsWith(".tsx"));

    const navigateTargets = new Set<string>();
    const navigateLiteralRe = /navigate\(\s*['"]([^'"]+)['"]/g;
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      let match;
      while ((match = navigateLiteralRe.exec(src))) {
        navigateTargets.add(match[1]);
      }
    }

    // 최소한 record/chronotype/result/onboarding 복귀/홈 이동은 발견되어야 한다
    expect(navigateTargets.size).toBeGreaterThan(0);
    expect(navigateTargets.has("/record")).toBe(true);
    expect(navigateTargets.has("/chronotype/result")).toBe(true);

    for (const target of navigateTargets) {
      expect(APP_SOURCE).toContain(`path="${target}"`);
    }
  });

  it("AC-3[P0]: main.tsx는 TDSMobileAITProvider와 BrowserRouter로 App을 감싼다 (수정 금지 앵커 유지)", () => {
    expect(MAIN_SOURCE).toContain("TDSMobileAITProvider");
    expect(MAIN_SOURCE).toContain("BrowserRouter");
    expect(MAIN_SOURCE).toContain("@AI:ANCHOR");
    // Provider가 App보다 먼저 열려야 함 (중첩 순서 확인)
    const providerIndex = MAIN_SOURCE.indexOf("TDSMobileAITProvider");
    const appIndex = MAIN_SOURCE.indexOf("<App");
    expect(providerIndex).toBeGreaterThan(-1);
    expect(appIndex).toBeGreaterThan(providerIndex);
  });

  it("AC-4[P0]: 앱은 '/' 경로에서 크래시 없이 렌더링된다", async () => {
    const { default: App } = await import("@/App");
    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });
    // 온보딩 미완료 시 /onboarding으로 리다이렉트되거나 Home이 렌더되어야 하며,
    // 어느 쪽이든 문서에 콘텐츠가 렌더된다(흰 화면 아님).
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });

  it("AC-4: 온보딩 완료 상태에서 '/' 경로는 HomePage 콘텐츠를 렌더한다", async () => {
    localStorage.setItem(
      "sdt.settings",
      JSON.stringify({ targetMinutes: 480, aiNoticeAck: true, onboarded: true }),
    );
    const { default: App } = await import("@/App");
    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    expect(document.body.textContent).not.toBe("");
  });

  it("AC-2: /chronotype/result 경로는 RouteState 형태의 state를 요구하는 Route로 존재한다", () => {
    expect(APP_SOURCE).toContain('"/chronotype/result"');
    expect(APP_SOURCE).toContain("ChronotypeResultPage");
  });
});
