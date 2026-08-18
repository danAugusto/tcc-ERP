import { CalendarDays, Bell } from "lucide-react";

export function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          Olá, Administrador!{" "}
          <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Bem-vindo ao painel de automação da Lanchonete &amp; Pastelaria
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-300">
          <CalendarDays className="h-4 w-4 text-yellow-400" />
          <span>12/05/2025</span>
        </div>

        <button
          type="button"
          aria-label="Notificações"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1 text-[10px] font-bold text-zinc-950 shadow-lg shadow-yellow-400/30">
            2
          </span>
        </button>

        <div
          aria-hidden="true"
          className="flex h-10 w-10 select-none items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-xs font-bold text-zinc-950 ring-2 ring-zinc-800"
        >
          AD
        </div>
      </div>
    </header>
  );
}