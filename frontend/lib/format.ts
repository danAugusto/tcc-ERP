/** Formatação no padrão brasileiro, usada em todas as telas. */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function brl(value: number | string | null | undefined): string {
  return BRL.format(Number(value) || 0)
}

/** Duração legível: "agora", "12 min", "1 h 05 min", "2 d 3 h". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return "agora"
  const m = Math.floor(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h < 24) return rest ? `${h} h ${String(rest).padStart(2, "0")} min` : `${h} h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d} d ${rh} h` : `${d} d`
}
