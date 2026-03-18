import { useNavigate } from "react-router-dom";

export default function AppLink({ name }: { name: string }) {
  const navigate = useNavigate();
  return (
    <button
      className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      onClick={() => void navigate(`/applications?search=${encodeURIComponent(name)}`)}
    >
      {name}
    </button>
  );
}
