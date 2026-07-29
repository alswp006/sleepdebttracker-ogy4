import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { getSettings } from "@/lib/storage";

mockTds();
mockAppsInToss();
mockTossRewardAd();

import { useNavigate } from "react-router-dom";
import App from "@/App";

describe("debug", () => {
  it("debug click", () => {
    console.log("PRE __mockNavigate:", (globalThis as any).__mockNavigate);
    console.log("useNavigate mock?", (useNavigate as any).mock ? "MOCK" : "real");
    render(React.createElement(MemoryRouter, { initialEntries: ["/onboarding"] }, React.createElement(App)));
    fireEvent.click(screen.getByRole("button", { name: "8시간" }));
    fireEvent.click(screen.getByRole("button", { name: /완료/ }));
    console.log("SETTINGS", getSettings());
    console.log(document.body.innerHTML);
  });
});
