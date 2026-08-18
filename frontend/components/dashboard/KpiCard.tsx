import type { KpiCardData } from "@/lib/kpi-data";

export function KpiCard({
  title,
  value,
  icon: Icon,
  iconClassName,
  footer,
}: KpiCardData) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900 p-5 transition-colors hover:border-zinc-700">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-950/80">
          <Icon className={`h-6 w-6 ${iconClassName}`} />
        </span>
        <p className="text-sm font-medium text-zinc-400">{title}</p>
      </div>

      <p className="mt-4 text-3xl font-bold tracking-tight text-zinc-50">
        {value}
      </p>

      {footer.href ? (
        <a
          href={footer.href}
          className={`mt-1 block text-xs font-medium ${footer.className}`}
        >
          {footer.text}
        </a>
      ) : (
        <p className={`mt-1 text-xs font-medium ${footer.className}`}>
          {footer.text}
        </p>
      )}
    </div>
  );
}