import { StatusTag, type Tone } from "@/components/ui/blocks";

export type BadgeTone = "green" | "yellow" | "red" | "blue";

const toneMap: Record<BadgeTone, Tone> = {
  green: "success",
  yellow: "accent",
  red: "danger",
  blue: "info",
};

/** Mantido por compatibilidade: agora desenha o quadrado colorido + texto do StatusTag. */
export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone; solid?: boolean }) {
  return <StatusTag tone={toneMap[tone]}>{label}</StatusTag>;
}
