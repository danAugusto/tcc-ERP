import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Package,
  Truck,
  PackagePlus,
  PackageMinus,
  BarChart3,
  Bot,
  Settings,
  ChefHat,
  Zap,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Pedidos", icon: ClipboardList, active: false },
  { label: "Cardápio", icon: UtensilsCrossed, active: false },
  { label: "Estoque", icon: Package, active: false },
  { label: "Fornecedores", icon: Truck, active: false },
  { label: "Entradas", icon: PackagePlus, active: false },
  { label: "Saídas", icon: PackageMinus, active: false },
  { label: "Relatórios", icon: BarChart3, active: false },
  { label: "Automação (RPA)", icon: Bot, active: false },
  { label: "Configurações", icon: Settings, active: false },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-800/60 bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-zinc-800/60 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-zinc-950 shadow-lg shadow-yellow-400/20">
          <ChefHat className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-yellow-400">
            Lanchonete
          </p>
          <p className="text-xs font-medium text-zinc-400">& Pastelaria</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ label, icon: Icon, active }) => (
          <a
            key={label}
            href="#"
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-l-2 border-yellow-400 bg-zinc-950/80 text-yellow-400"
                : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-950/60 hover:text-zinc-100"
            }`}
          >
            <Icon
              className={`h-[18px] w-[18px] shrink-0 ${
                active
                  ? "text-yellow-400"
                  : "text-zinc-500 transition-colors group-hover:text-zinc-300"
              }`}
            />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="border-t border-zinc-800/60 p-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Status do RPA
            </p>
            <Zap className="h-4 w-4 text-yellow-400" />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
            <span className="text-sm font-semibold text-green-400">Ativo</span>
          </div>

          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Última execução</dt>
              <dd className="text-zinc-300">12/05/2025 10:15</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Próxima execução</dt>
              <dd className="text-zinc-300">12/05/2025 10:45</dd>
            </div>
          </dl>

          <button
            type="button"
            className="mt-4 w-full rounded-lg border border-yellow-400/70 px-3 py-2 text-xs font-semibold text-yellow-400 transition-all hover:bg-yellow-400/10 hover:shadow-lg hover:shadow-yellow-400/10"
          >
            Executar agora
          </button>
        </div>
      </div>
    </aside>
  );
}