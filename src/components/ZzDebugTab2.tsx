import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

export type TabItem = {
  label: string;
  icon?: ReactNode;
  path: string;
};

export function ZzDebugTab2({ items }: { items: TabItem[] }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      role="tablist"
      aria-label="메인 네비게이션"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "stretch",
        padding: "6px 8px calc(var(--toss-safe-area-bottom) + 6px)",
        backgroundColor: "var(--adaptiveBackground)",
        borderTop: "1px solid var(--adaptiveGrey200)",
      }}
    >
      {items.map((item) => {
        const active = location.pathname === item.path;
        return (
          <button
            key={item.path}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={item.label}
            onClick={() => {
              if (active) return;
              try {
                Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
              } catch {
                /* WebView 밖에서는 throw — 무시 */
              }
              navigate(item.path);
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              padding: "4px 0",
              minHeight: 44,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: active ? "var(--adaptiveBlue500)" : "var(--adaptiveGrey700)",
              fontSize: 11,
              fontWeight: active ? 700 : 500,
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
