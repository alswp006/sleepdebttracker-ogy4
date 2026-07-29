import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

import { FloatingTabBar } from "@/components/FloatingTabBar";

function PageA() {
  return React.createElement(
    "div",
    null,
    "PageAContent",
    React.createElement(FloatingTabBar, { items: [{ label: "A", path: "/a" }, { label: "B", path: "/b" }] }),
  );
}
function PageB() {
  return React.createElement(
    "div",
    null,
    "PageBContent",
    React.createElement(FloatingTabBar, { items: [{ label: "A", path: "/a" }, { label: "B", path: "/b" }] }),
  );
}

describe("floatingtabbar debug tsx", () => {
  it("navigates on tab click", () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/a"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/a", element: React.createElement(PageA) }),
          React.createElement(Route, { path: "/b", element: React.createElement(PageB) }),
        ),
      ),
    );
    expect(screen.getByText("PageAContent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    console.log("body after click:", document.body.innerHTML.slice(0, 400));
    expect(screen.getByText("PageBContent")).toBeInTheDocument();
  });
});
