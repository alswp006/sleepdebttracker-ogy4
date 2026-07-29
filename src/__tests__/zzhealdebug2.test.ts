import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";

function A() {
  const navigate = useNavigate();
  return React.createElement("button", { onClick: () => navigate("/b") }, "goToB");
}
function B() {
  return React.createElement("div", null, "PageB");
}

describe("minimal router debug", () => {
  it("navigates on click", () => {
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/a"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/a", element: React.createElement(A) }),
          React.createElement(Route, { path: "/b", element: React.createElement(B) }),
        ),
      ),
    );
    fireEvent.click(screen.getByText("goToB"));
    console.log("body after click:", document.body.innerHTML);
    expect(screen.getByText("PageB")).toBeInTheDocument();
  });
});
