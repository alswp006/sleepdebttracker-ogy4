import { useNavigate } from "react-router-dom";

export function ZzDebugNav({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)}>go</button>
  );
}
