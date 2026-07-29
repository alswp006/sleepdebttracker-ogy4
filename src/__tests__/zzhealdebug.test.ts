import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();

import App from "@/App";

describe("debug", () => {
  it("click flow", async () => {
    render(React.createElement(MemoryRouter, { initialEntries: ["/onboarding"] }, React.createElement(App)));
    const btn8 = screen.getByRole("button", { name: "8시간" });
    console.log("btn8 aria-pressed before", btn8.getAttribute("aria-pressed"));
    fireEvent.click(btn8);
    console.log("btn8 aria-pressed after", btn8.getAttribute("aria-pressed"));
    const completeBtn = screen.getByRole("button", { name: /완료/ });
    console.log("complete disabled?", (completeBtn as HTMLButtonElement).disabled);
    fireEvent.click(completeBtn);
    console.log("after complete (sync), body:", document.body.innerHTML.slice(0, 300));
    await waitFor(() => {
      console.log("waitFor tick, body:", document.body.innerHTML.slice(0, 300));
      expect(document.body.innerHTML).toContain("수면 부채");
    });
  });
});
