import { ArrowRight, CheckCircle2, Play } from "lucide-react";
import { rpaRoutines } from "@/lib/mock-data";

export function RpaRoutines() {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-base font-semibold text-zinc-100">
          Automação (RPA) - Rotinas
        </h2>
        <a
          href="#"
          className="flex items-center gap-1 text-xs font-medium text-yellow-400 transition-colors hover:text-yellow-300"
        >
          Ver logs
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <ul className="mt-4 space-y-2 px-5">
        {rpaRoutines.map((routine) => (
          <li
            key={routine.name}
            className="flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-950/50 px-4 py-3 transition-colors hover:border-zinc-700"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">
                {routine.name}
              </p>
              <p className="text-xs text-zinc-500">{routine.time}</p>
            </div>
            <span className="text-xs font-semibold text-green-400">
              Sucesso
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-zinc-800/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Execução Manual de Rotinas
        </p>
        <div className="mt-3 flex gap-2">
          <select
            aria-label="Selecionar rotina"
            defaultValue=""
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 outline-none transition-colors focus:border-yellow-400"
          >
            <option value="" disabled>
              Selecionar rotina...
            </option>
            {rpaRoutines.map((routine) => (
              <option key={routine.name} value={routine.name}>
                {routine.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-yellow-400/70 px-4 py-2 text-sm font-semibold text-yellow-400 transition-all hover:bg-yellow-400/10 hover:shadow-lg hover:shadow-yellow-400/10"
          >
            <Play className="h-4 w-4" />
            Executar
          </button>
        </div>
      </div>
    </section>
  );
}