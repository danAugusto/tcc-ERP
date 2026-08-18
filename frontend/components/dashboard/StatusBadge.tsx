export type BadgeTone = "green" | "yellow" | "red" | "blue";

const tones: Record<BadgeTone, string> = {
  green: "bg-green-400/10 text-green-400",
  yellow: "bg-yellow-400/10 text-yellow-400",
  red: "bg-red-400/10 text-red-400",
  blue: "bg-blue-400/10 text-blue-400",
};

export function StatusBadge({
  label,
  tone,
  solid = false,
}: {
  label: string;
  tone: BadgeTone;
  solid?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        solid
          ? tone === "red"
            ? "bg-red-500 text-white"
            : "bg-yellow-400 text-zinc-950"
          : tones[tone]
      }`}
    >
      {label}
    </span>
  );
}