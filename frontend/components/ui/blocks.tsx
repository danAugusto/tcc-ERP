import * as React from "react"

export type Tone = "neutral" | "info" | "warn" | "accent" | "success" | "danger"

const toneText: Record<Tone, string> = {
  neutral: "text-ink",
  info: "text-info",
  warn: "text-warn",
  accent: "text-accent",
  success: "text-success",
  danger: "text-danger",
}
const toneBg: Record<Tone, string> = {
  neutral: "bg-line-strong",
  info: "bg-info",
  warn: "bg-warn",
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
}

/** Cabeçalho de página: título em letra de letreiro, descrição curta e ações à direita, fechado por uma linha tracejada. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-dashed border-line pb-4">
      <div className="min-w-0">
        <h1 className="text-5xl text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Situação de um registro: quadrado colorido + texto. A cor sozinha nunca carrega o significado. */
export function StatusTag({
  tone = "neutral",
  pulse = false,
  children,
}: {
  tone?: Tone
  pulse?: boolean
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-ink">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-[2px] ${toneBg[tone]} ${pulse ? "animate-pulse" : ""}`} aria-hidden />
      {children}
    </span>
  )
}

/**
 * Totais como no rodapé de uma comanda: rótulo, linha pontilhada e valor.
 * Cor só quando o número pede atenção (perigo ou bom resultado); o destaque amarelo fica para ações.
 */
export function StatStrip({
  items,
}: {
  items: { label: string; value: React.ReactNode; hint?: string; tone?: Tone }[]
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-10 border-y border-line py-1 sm:grid-cols-2">
      {items.map((it) => {
        const tone = it.tone === "danger" || it.tone === "success" ? toneText[it.tone] : "text-ink"
        return (
          <div key={it.label} className="flex min-w-0 items-baseline gap-2 py-2.5" title={it.hint}>
            <dt className="shrink-0 text-base text-soft">{it.label}</dt>
            <span aria-hidden className="mb-1.5 min-w-4 flex-1 border-b-2 border-dotted border-line-strong" />
            <dd className={`font-display shrink-0 text-3xl ${tone}`}>
              {it.value}
              {it.hint && <span className="sr-only"> ({it.hint})</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Abas com sublinhado: a aba ativa leva uma barra grossa na cor de destaque. */
export function TabBar<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T
  onChange: (v: T) => void
  tabs: { value: T; label: string; count?: number }[]
  label?: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`-mb-px whitespace-nowrap border-b-4 px-4 py-2.5 text-sm font-semibold ${
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="font-display ml-2 text-lg text-muted">{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
