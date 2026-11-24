"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, RefreshCw } from "lucide-react";
import { fetcher } from "@/services/api";
import { StatusBadge, type BadgeTone } from "./StatusBadge";

interface Insumo {
  id: number
  nome: string
  unidade_medida: string
  quantidade_atual: number | string
  estoque_minimo: number | string
}

export function InventoryControl() {
  const { data: insumos, isLoading } = useSWR<Insumo[]>("/inventory/insumos/", fetcher);

  const displayItems = (Array.isArray(insumos) ? insumos : []).slice(0, 5);

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 className="text-3xl text-ink">
          Controle de Estoque
        </h2>
        <Link
          href="/inventory"
          className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent"
        >
          Ver todos
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto px-1">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th className="px-4 py-3 font-medium">Insumo</th>
              <th className="px-4 py-3 font-medium">Atual</th>
              <th className="px-4 py-3 font-medium">Mínimo</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-xs">
                  <RefreshCw className="inline-block h-4 w-4 animate-spin text-accent mr-2" />
                  Carregando estoque...
                </td>
              </tr>
            ) : displayItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-xs">
                  Nenhum insumo cadastrado no estoque ainda.
                </td>
              </tr>
            ) : (
              displayItems.map((item) => {
                const current = Number(item.quantidade_atual);
                const min = Number(item.estoque_minimo);
                
                let label = "Normal";
                let tone: BadgeTone = "green";

                if (current <= min && current > min * 0.5) {
                  label = "Baixo";
                  tone = "yellow";
                } else if (current <= min * 0.5) {
                  label = "Crítico";
                  tone = "red";
                }

                return (
                  <tr
                    key={item.id}
                    className="border-b border-line/60 transition-colors last:border-0 hover:bg-raised/40"
                  >
                    <td className="px-4 py-3 text-ink font-medium">{item.nome}</td>
                    <td className="px-4 py-3 text-ink font-bold">{current} {item.unidade_medida}</td>
                    <td className="px-4 py-3 text-muted">{min} {item.unidade_medida}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={label} tone={tone} />
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