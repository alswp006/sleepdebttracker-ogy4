import { useNavigate, useLocation } from "react-router-dom";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

export function ZzDebugTab({ items }: { items: { label: string; path: string }[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav>
      {items.map((item) => {
        const active = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => {
              if (active) return;
              try {
                Promise.resolve(generateHapticFeedback({ type: "tickWeak" })).catch(() => {});
              } catch {
                /* noop */
              }
              navigate(item.path);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
