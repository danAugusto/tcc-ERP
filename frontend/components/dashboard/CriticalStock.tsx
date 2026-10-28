"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, Package, AlertTriangle, RefreshCw } from "lucide-react";
import { fetcher } from "@/services/api";
import { StatusBadge } from "./StatusBadge";

interface Insumo {
  id: number
  nome: string
  unidade_medida: string
  quantidade_atual: number | string
  estoque_minimo: number | string
}

export function CriticalStock() {
  const { data: insumos, isLoading } = useSWR<Insumo[]>("/inventory/insumos/", fetcher);

  const criticalItems = (Array.isArray(insumos) ? insumos : []).filter(
    (i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo)
  );

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 className="text-3xl text-ink">Estoque crítico</h2>
        <Link
          href="/inventory"
          className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent"
        >
          Ver estoque
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 flex-1 px-5 pb-5">
        {isLoading ? (
          <div className="py-8 text-center text-muted text-xs">
            <RefreshCw className="inline-block h-4 w-4 animate-spin text-accent mr-2" />
            Verificando estoque...
          </div>
        ) : criticalItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center text-muted text-xs">
            <Package className="h-8 w-8 text-faint mb-2 opacity-50" />
            <p className="font-semibold text-soft">Nenhum item em nível crítico</p>
            <p className="text-xs text-muted mt-0.5">O estoque de insumos está operando normalmente.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {criticalItems.map((item) => {
              const current = Number(item.quantidade_atual);
              const min = Number(item.estoque_minimo);
              const isVeryLow = current <= min * 0.5;

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-line/60 bg-canvas/50 px-4 py-3 transition-colors hover:border-line"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                    <AlertTriangle className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {item.nome}
                    </p>
                    <p className="text-xs text-muted">
                      Atual: <span className="font-bold text-danger">{current} {item.unidade_medida}</span> (Mínimo: {min} {item.unidade_medida})
                    </p>
                  </div>
                  <StatusBadge
                    label={isVeryLow ? "Crítico" : "Atenção"}
                    tone={isVeryLow ? "red" : "yellow"}
                    solid
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}