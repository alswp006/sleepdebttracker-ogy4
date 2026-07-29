import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/types";

mockTds();
mockAppsInToss();
mockTossRewardAd();

import App from "@/App";

describe("zzdiag", () => {
  it("debug nav", async () => {
    seedLocalStorage({ [STORAGE_KEYS.settings]: { targetMinutes: 480, aiNoticeAck: true, onboarded: true } });
    render(React.createElement(MemoryRouter, { initialEntries: ["/report"] }, React.createElement(App)));
    console.log("BEFORE CLICK:", screen.getByRole("navigation").textContent);
    const btn = screen.getByRole("tab", { name: "플랜" });
    console.log("BTN aria-selected:", btn.getAttribute("aria-selected"));
    btn.onclick = ((orig) => function (this: any, ...args: any[]) { console.log("NATIVE ONCLICK FIRED"); return orig?.apply(this, args); })(btn.onclick as any);
    fireEvent.click(btn);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    console.log("AFTER CLICK:", screen.getByRole("navigation").textContent);
    expect(true).toBe(true);
  });
});
