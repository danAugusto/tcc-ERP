import { ArrowRight } from "lucide-react";
import { recentEntries } from "@/lib/mock-data";

export function RecentEntries() {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-base font-semibold text-zinc-100">
          Entradas Recentes
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
        <table className="w-full min-w-[380px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3 font-medium">Produto</th>
              <th className="px-5 py-3 font-medium">Fornecedor</th>
              <th className="px-5 py-3 font-medium">Qtd.</th>
              <th className="px-5 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {recentEntries.map((entry) => (
              <tr
                key={`${entry.product}-${entry.date}`}
                className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/40"
              >
                <td className="px-5 py-3 text-zinc-100">{entry.product}</td>
                <td className="px-5 py-3 text-zinc-400">{entry.supplier}</td>
                <td className="px-5 py-3 text-zinc-300">{entry.quantity}</td>
                <td className="px-5 py-3 text-zinc-500">{entry.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}