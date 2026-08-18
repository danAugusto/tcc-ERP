import { ArrowRight } from "lucide-react";
import { inventoryControl } from "@/lib/mock-data";
import { StatusBadge, type BadgeTone } from "./StatusBadge";

const inventoryStatusTone: Record<string, BadgeTone> = {
  Normal: "green",
  Baixo: "yellow",
  Crítico: "red",
};

export function InventoryControl() {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-base font-semibold text-zinc-100">
          Controle de Estoque
        </h2>
        <a
          href="#"
          className="flex items-center gap-1 text-xs font-medium text-yellow-400 transition-colors hover:text-yellow-300"
        >
          Ver todos
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3 font-medium">Produto</th>
              <th className="px-5 py-3 font-medium">Atual</th>
              <th className="px-5 py-3 font-medium">Mínimo</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {inventoryControl.map((item) => (
              <tr
                key={item.product}
                className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/40"
              >
                <td className="px-5 py-3 text-zinc-100">{item.product}</td>
                <td className="px-5 py-3 text-zinc-300">{item.current}</td>
                <td className="px-5 py-3 text-zinc-500">{item.min}</td>
                <td className="px-5 py-3">
                  <StatusBadge
                    label={item.status}
                    tone={inventoryStatusTone[item.status]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}