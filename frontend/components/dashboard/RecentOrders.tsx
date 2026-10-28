"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, RefreshCw } from "lucide-react";
import { fetcher } from "@/services/api";
import { StatusBadge, type BadgeTone } from "./StatusBadge";

interface OrderItem {
  id: number
  produto: number
  quantidade: number
  preco_unitario: string | number
  subtotal: string | number
}

interface Order {
  id: number
  status: string
  total: string | number
  payment_method: string
  created_at: string
  cliente?: number | null
  itens?: OrderItem[]
}

const orderStatusTone: Record<string, BadgeTone> = {
  "em_preparo": "yellow",
  "confirmado": "yellow",
  "criado": "yellow",
  "pronto": "blue",
  "entregue": "green",
  "cancelado": "red",
};

const statusLabels: Record<string, string> = {
  "criado": "Criado",
  "confirmado": "Confirmado",
  "em_preparo": "Em preparo",
  "pronto": "Pronto",
  "entregue": "Concluído",
  "cancelado": "Cancelado",
};

export function RecentOrders() {
  const { data: orders, isLoading } = useSWR<Order[]>("/orders/", fetcher);

  const displayOrders = (Array.isArray(orders) ? orders : []).slice(0, 6);

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 className="text-3xl text-ink">
          Pedidos Recentes
        </h2>
        <Link
          href="/orders"
          className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent"
        >
          Ver todos
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th className="px-3 py-2.5 font-semibold">ID</th>
              <th className="px-3 py-2.5 font-semibold">Horário / Data</th>
              <th className="px-3 py-2.5 font-semibold">Forma de pagamento</th>
              <th className="px-3 py-2.5 font-semibold">Qtd. Itens</th>
              <th className="px-3 py-2.5 font-semibold">Total</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted text-xs">
                  <RefreshCw className="inline-block h-4 w-4 animate-spin text-accent mr-2" />
                  Carregando pedidos...
                </td>
              </tr>
            ) : displayOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted text-xs">
                  Nenhum pedido registrado no sistema ainda.
                </td>
              </tr>
            ) : (
              displayOrders.map((order) => {
                const dateStr = order.created_at
                  ? new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  : "--:--";

                return (
                  <tr
                    key={order.id}
                    className="border-b border-line/60 transition-colors last:border-0 hover:bg-raised/40"
                  >
                    <td className="px-3 py-3 font-display text-xl text-ink">
                      #{order.id}
                    </td>
                    <td className="px-3 py-3 text-soft">{dateStr}</td>
                    <td className="px-3 py-3 text-soft capitalize">{order.payment_method || "Outros"}</td>
                    <td className="px-3 py-3 text-soft">
                      {order.itens?.reduce((sum, i) => sum + i.quantidade, 0) || 1} itens
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(order.total))}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        label={statusLabels[order.status] || order.status}
                        tone={orderStatusTone[order.status] || "yellow"}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}