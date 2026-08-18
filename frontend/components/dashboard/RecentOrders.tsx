import { ArrowRight } from "lucide-react";
import { recentOrders } from "@/lib/mock-data";
import { StatusBadge, type BadgeTone } from "./StatusBadge";

const orderStatusTone: Record<string, BadgeTone> = {
  "Em preparo": "yellow",
  "Saiu para entrega": "blue",
  "Concluído": "green",
};

export function RecentOrders() {
  return (
    <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-base font-semibold text-zinc-100">
          Pedidos Recentes
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
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-3 font-medium">ID</th>
              <th className="px-5 py-3 font-medium">Horário</th>
              <th className="px-5 py-3 font-medium">Tipo</th>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Itens</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-zinc-800/60 transition-colors last:border-0 hover:bg-zinc-800/40"
              >
                <td className="px-5 py-3.5 font-medium text-yellow-400">
                  {order.id}
                </td>
                <td className="px-5 py-3.5 text-zinc-300">{order.time}</td>
                <td className="px-5 py-3.5 text-zinc-300">{order.type}</td>
                <td className="px-5 py-3.5 text-zinc-100">{order.customer}</td>
                <td className="px-5 py-3.5 text-zinc-400">{order.items}</td>
                <td className="px-5 py-3.5 font-semibold text-zinc-100">
                  {order.total}
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge
                    label={order.status}
                    tone={orderStatusTone[order.status]}
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