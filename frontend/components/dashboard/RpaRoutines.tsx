"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Play, RefreshCw } from "lucide-react";

interface Routine {
  id: string;
  name: string;
  lastRun: string;
  status: "Sucesso" | "Executando" | "Pendente";
}

export function RpaRoutines() {
  const [routines, setRoutines] = useState<Routine[]>([
    { id: "1", name: "Sincronizar pedidos do PDV", lastRun: "Hoje às 10:15", status: "Sucesso" },
    { id: "2", name: "Atualizar estoque e baixa de insumos", lastRun: "Hoje às 10:20", status: "Sucesso" },
    { id: "3", name: "Emitir relatório e fechamento diário", lastRun: "Hoje às 10:30", status: "Sucesso" },
    { id: "4", name: "Conciliação bancária de pagamentos", lastRun: "Hoje às 10:40", status: "Sucesso" },
  ]);

  const [selectedRoutine, setSelectedRoutine] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleExecute = () => {
    if (!selectedRoutine) return;
    setIsRunning(true);
    setMessage(null);

    setTimeout(() => {
      const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setRoutines((prev) =>
        prev.map((r) =>
          r.name === selectedRoutine
            ? { ...r, lastRun: `Hoje às ${nowTime}`, status: "Sucesso" }
            : r
        )
      );
      setIsRunning(false);
      setMessage(`Rotina "${selectedRoutine}" executada com sucesso!`);
      setTimeout(() => setMessage(null), 4000);
    }, 1200);
  };

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 className="text-3xl text-ink">
          Automação (RPA) - Rotinas
        </h2>
        <Link
          href="/rpa"
          className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent"
        >
          Ver central RPA
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="mt-4 space-y-2 px-5">
        {routines.map((routine) => (
          <li
            key={routine.id}
            className="flex items-center gap-3 rounded-xl border border-line/60 bg-canvas/50 px-4 py-3 transition-colors hover:border-line"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {routine.name}
              </p>
              <p className="text-xs text-muted">{routine.lastRun}</p>
            </div>
            <span className="text-xs font-semibold text-success">
              {routine.status}
            </span>
          </li>
        ))}
      </ul>

      {message && (
        <div className="mx-5 mt-3 rounded-xl border border-success/20 bg-success/10 p-2.5 text-center text-xs font-medium text-success   duration-200">
          {message}
        </div>
      )}

      <div className="mt-auto border-t border-line/60 p-5">
        <p className="text-xs font-semibold   text-soft">
          Execução Manual de Rotinas
        </p>
        <div className="mt-3 flex gap-2">
          <select
            aria-label="Selecionar rotina"
            value={selectedRoutine}
            onChange={(e) => setSelectedRoutine(e.target.value)}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-soft outline-none transition-colors focus:border-accent"
          >
            <option value="" disabled>
              Selecionar rotina...
            </option>
            {routines.map((routine) => (
              <option key={routine.id} value={routine.name}>
                {routine.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedRoutine || isRunning}
            onClick={handleExecute}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-accent/70 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink hover: hover: disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Executar
          </button>
        </div>
      </div>
    </section>
  );
}