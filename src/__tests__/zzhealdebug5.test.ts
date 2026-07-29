import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

function Tab({ items }: { items: { label: string; path: string }[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  return React.createElement(
    "nav",
    null,
    items.map((item) =>
      React.createElement(
        "button",
        {
          key: item.path,
          onClick: () => {
            if (location.pathname === item.path) return;
            navigate(item.path);
          },
        },
        item.label,
      ),
    ),
  );
}

function PageA() {
  return React.createElement(
    "div",
    null,
    "PageAContent",
    React.createElement(Tab, { items: [{ label: "A", path: "/a" }, { label: "B", path: "/b" }] }),
  );
}
function PageB() {
  return React.createElement(
    "div",
    null,
    "PageBContent",
    React.createElement(Tab, { items: [{ label: "A", path: "/a" }, { label: "B", path: "/b" }] }),
  );
}

describe("tab with location debug", () => {
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
    fireEvent.click(screen.getByText("B"));
    console.log("body after click:", document.body.innerHTML.slice(0, 300));
    expect(screen.getByText("PageBContent")).toBeInTheDocument();
  });
});
