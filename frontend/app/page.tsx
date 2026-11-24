"use client";

import React, { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { fetcher } from "@/services/api";
import { Header } from "@/components/dashboard/Header";
import { StatStrip, TabBar } from "@/components/ui/blocks";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { CriticalStock } from "@/components/dashboard/CriticalStock";
import { InventoryControl } from "@/components/dashboard/InventoryControl";
import { RecentEntries } from "@/components/dashboard/RecentEntries";
import { RpaRoutines } from "@/components/dashboard/RpaRoutines";

interface MetricasData {
  periodo: string;
  total_faturamento: number;
  total_pedidos: number;
  ticket_medio: number;
  meta_faturamento: number;
  faturamento_mes_atual: number;
  progresso_meta_percentual: number;
  vendas_por_canal: { tipo_atendimento: string; quantidade: number; total: string | number }[];
  vendas_por_pagamento: { payment_method: string; quantidade: number; total: string | number }[];
  serie_temporal: { data: string; total: number; pedidos: number }[];
}

interface Insumo {
  id: number;
  nome: string;
  quantidade_atual: number | string;
  estoque_minimo: number | string;
}

const CANAL_LABEL: Record<string, string> = { mesa: "Mesa", balcao: "Balcão", delivery: "Delivery", retirada: "Retirada" };
const brl = (v: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<"hoje" | "7dias" | "mes_atual" | "mes_passado">("mes_atual");

  const { data: metricas, isLoading } = useSWR<MetricasData>(
    `/core/metricas/?periodo=${periodo}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const { data: insumos } = useSWR<Insumo[]>("/inventory/insumos/", fetcher);

  const criticalStockCount = (Array.isArray(insumos) ? insumos : []).filter(
    (i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo)
  ).length;

  const totalRevenue = metricas?.total_faturamento || 0;
  const totalOrdersCount = metricas?.total_pedidos || 0;
  const avgTicket = metricas?.ticket_medio || 0;
  const metaFaturamento = metricas?.meta_faturamento || 10000;
  const faturamentoMesAtual = metricas?.faturamento_mes_atual || 0;
  const progressoMeta = metricas?.progresso_meta_percentual || 0;

  const periodoLabel: Record<string, string> = {
    hoje: "hoje",
    "7dias": "nos últimos 7 dias",
    mes_atual: "neste mês",
    mes_passado: "no mês passado",
  };

  const canais = Array.isArray(metricas?.vendas_por_canal) ? metricas.vendas_por_canal : [];
  const maxCanal = Math.max(1, ...canais.map((c) => Number(c.quantidade) || 0));
  const meta = Math.min(progressoMeta, 100);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header />

      <main className="space-y-8 p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <TabBar
            label="Período"
            value={periodo}
            onChange={setPeriodo}
            tabs={[
              { value: "hoje", label: "Hoje" },
              { value: "7dias", label: "7 dias" },
              { value: "mes_atual", label: "Este mês" },
              { value: "mes_passado", label: "Mês passado" },
            ]}
          />
          {isLoading && <p className="text-sm text-muted">Atualizando números...</p>}
        </div>

        <StatStrip
          items={[
            { label: "Vendas", value: brl(totalRevenue), hint: `Faturado ${periodoLabel[periodo]}`, tone: "accent" },
            { label: "Pedidos", value: totalOrdersCount, hint: `Fechados ${periodoLabel[periodo]}` },
            { label: "Ticket médio", value: brl(avgTicket), hint: "Valor médio por pedido" },
            {
              label: "Estoque crítico",
              value: criticalStockCount,
              hint: criticalStockCount > 0 ? "Insumos no mínimo ou abaixo: repor" : "Todos os insumos acima do mínimo",
              tone: criticalStockCount > 0 ? "danger" : "success",
            },
          ]}
        />

        <section aria-label="Meta de faturamento do mês">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-3xl text-ink">Meta do mês</h2>
            <p className="text-sm text-muted">
              <span className="font-display mr-2 text-4xl text-ink">{brl(faturamentoMesAtual)}</span>
              de {brl(metaFaturamento)}
            </p>
          </div>
          <div
            className="relative mt-3 h-4 w-full bg-raised"
            role="progressbar"
            aria-valuenow={meta}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da meta mensal"
          >
            <div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${meta}%` }} />
            {[25, 50, 75].map((m) => (
              <span key={m} className="absolute top-0 h-full w-px bg-canvas" style={{ left: `${m}%` }} aria-hidden />
            ))}
          </div>
          <p className="mt-1.5 text-sm text-muted">{progressoMeta}% da meta atingida</p>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2" aria-label="Faturamento por dia">
            <h2 className="border-b-2 border-ink pb-2 text-3xl text-ink">Faturamento por dia</h2>
            <div className="mt-4 h-64 w-full">
              {Array.isArray(metricas?.serie_temporal) && metricas.serie_temporal.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metricas.serie_temporal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--c-line)" vertical={false} />
                    <XAxis dataKey="data" stroke="var(--c-muted)" fontSize={12} tickLine={false} />
                    <YAxis stroke="var(--c-muted)" fontSize={12} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      cursor={{ fill: "var(--c-raised)" }}
                      contentStyle={{ backgroundColor: "var(--c-surface)", border: "1px solid var(--c-line-strong)", borderRadius: "4px", color: "var(--c-ink)" }}
                      formatter={(val: any) => [brl(val), "Faturamento"]}
                    />
                    <Bar dataKey="total" fill="var(--c-accent)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-muted">Sem vendas no período.</p>
              )}
            </div>
          </section>

          <section aria-label="Vendas por canal">
            <h2 className="border-b-2 border-ink pb-2 text-3xl text-ink">Por canal</h2>
            {canais.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Sem vendas por canal no período.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {canais.map((c) => (
                  <li key={c.tipo_atendimento}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-semibold text-ink">{CANAL_LABEL[c.tipo_atendimento] ?? c.tipo_atendimento}</span>
                      <span className="text-sm text-muted">
                        <span className="font-display mr-1 text-2xl text-ink">{c.quantidade}</span>
                        {Number(c.quantidade) === 1 ? "pedido" : "pedidos"} · {brl(c.total)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 bg-raised" aria-hidden>
                      <div className="h-full bg-accent" style={{ width: `${(Number(c.quantidade) / maxCanal) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <RecentOrders />
          <CriticalStock />
        </div>

        <InventoryControl />
        <RecentEntries />
        <RpaRoutines />
      </main>
    </div>
  );
}
