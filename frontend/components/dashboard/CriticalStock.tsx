import { ArrowRight, Beef, Milk, ShoppingBag, Egg } from "lucide-react";
import { criticalStock } from "@/lib/mock-data";
import { StatusBadge } from "./StatusBadge";

const productIcon = (name: string) => {
  if (name.toLowerCase().includes("ovo")) return Egg;
  if (name.toLowerCase().includes("batata")) return ShoppingBag;
  return name.toLowerCase().includes("queijo") ? Milk : Beef;
};

export function CriticalStock() {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-base font-semibold text-zinc-100">Estoque Crítico</h2>
        <a
          href="#"
          className="flex items-center gap-1 text-xs font-medium text-yellow-400 transition-colors hover:text-yellow-300"
        >
          Ver estoque
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <ul className="mt-4 flex-1 space-y-2 px-5 pb-5">
        {criticalStock.map((item) => {
          const Icon = productIcon(item.name);
          return (
            <li
              key={item.name}
              className="flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-950/50 px-4 py-3 transition-colors hover:border-zinc-700"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-400/10">
                <Icon className="h-[18px] w-[18px] text-red-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {item.name}
                </p>
                <p className="text-xs text-zinc-500">{item.quantity}</p>
              </div>
              <StatusBadge
                label={item.level}
                tone={item.level === "Crítico" ? "red" : "yellow"}
                solid
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}