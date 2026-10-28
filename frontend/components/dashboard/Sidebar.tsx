"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Package,
  Smartphone,
  Bot,
  Settings,
  ChefHat,
  Zap,
  LogOut,
  Receipt,
  Users,
  Bike,
  ShieldCheck,
  DollarSign,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";
import { useAuth, Role } from "@/hooks/useAuth";
import { Can } from "@/components/Can";
import { useRBAC } from "@/hooks/useRBAC";
import api from "@/services/api";
import { useRpaStatus, formatRun } from "@/hooks/useRpaStatus";
import { useBranding } from "@/hooks/useBranding";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  label: string;
  href: string;
  icon: any;
  highlight?: boolean;
  roles?: Role[];
}

// Agrupado pelo que a pessoa vai fazer; nomes sem siglas (PDV, KDS, RBAC)
const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { label: "Novo pedido", href: "/orders", icon: ClipboardList, roles: ["administrador", "atendente"] },
      { label: "Pedidos do balcão", href: "/gestao", icon: Receipt, roles: ["administrador", "atendente"] },
      { label: "Cozinha", href: "/cozinha", icon: ChefHat, roles: ["administrador", "cozinheiro"] },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Painel", href: "/", icon: LayoutDashboard, roles: ["administrador"] },
      { label: "Financeiro", href: "/finance", icon: DollarSign, roles: ["administrador"] },
      { label: "Cardápio", href: "/catalog", icon: UtensilsCrossed, roles: ["administrador"] },
      { label: "Estoque", href: "/inventory", icon: Package, roles: ["administrador", "cozinheiro"] },
      { label: "Equipe", href: "/equipe", icon: Users, roles: ["administrador"] },
    ],
  },
  {
    title: "Aplicativos",
    items: [
      { label: "Cardápio do cliente", href: "/cliente", icon: Smartphone, highlight: true, roles: ["administrador"] },
      { label: "Entregador", href: "/entregador", icon: Bike, highlight: true, roles: ["administrador", "entregador"] },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Automações", href: "/rpa", icon: Bot, roles: ["administrador"] },
      { label: "Permissões", href: "/permissoes", icon: ShieldCheck, roles: ["administrador"] },
      { label: "Configurações", href: "/settings", icon: Settings, roles: ["administrador"] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { hasRole } = useRBAC();
  const { nome: brandName } = useBranding();
  const [rpaRunning, setRpaRunning] = useState(false);
  const [rpaMsg, setRpaMsg] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  // Abaixo de 1024px o menu vira gaveta, aberta pela barra superior
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    drawerRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const isAdmin = user?.role === "administrador" || user?.role === "superadmin";
  const rpa = useRpaStatus(isAdmin);

  // Esconder sidebar no login, no app do cliente (/cliente) e para os perfis mobile (cliente e entregador)
  if (
    pathname === "/login" ||
    pathname.startsWith("/cliente") ||
    pathname.startsWith("/unauthorized") ||
    user?.role === "cliente" ||
    user?.role === "entregador"
  ) {
    return null;
  }

  const runAllRobots = async () => {
    setRpaRunning(true);
    setRpaMsg("");
    try {
      let alertas = 0;
      for (const id of ["rpa-01", "rpa-02", "rpa-03"]) {
        const res = await api.post("/core/rpa/execute/", { task_id: id });
        alertas += res.data.alertas ?? 0;
      }
      setRpaMsg(`3 robôs executados, ${alertas} alerta(s).`);
      rpa.refresh();
    } catch {
      setRpaMsg("Falha ao executar os robôs.");
    } finally {
      setRpaRunning(false);
    }
  };

  const panel = (mode: "desktop" | "drawer") => (
    <>
      <div className="border-b border-line px-4 py-5">
        <div className={`flex items-center gap-3`}>
          <BrandMark size={40} />
          <div className="min-w-0 flex-1">
            <p className="font-display line-clamp-2 text-[1.35rem] text-ink" title={brandName}>
              {brandName}
            </p>
            <p className="mt-1 text-xs text-muted">Gestão e automação</p>
          </div>
          {mode === "desktop" ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Ocultar menu lateral"
              title="Ocultar menu"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-soft transition-colors hover:bg-raised hover:text-ink"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Fechar menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-soft hover:bg-raised hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {user?.role === "superadmin" && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-purple-500/40 bg-purple-500/15 px-2 py-1 text-xs font-semibold text-purple-300">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" aria-hidden />
            Modo desenvolvedor
          </span>
        )}
      </div>

      <nav aria-label="Menu principal" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
        {navGroups.map((group) => {
          const visible = group.items.filter((it) => !it.roles || hasRole(it.roles));
          if (visible.length === 0) return null;
          return (
            <div key={group.title} className="pb-2">
              <p className="px-3 pb-1 pt-3 text-xs font-semibold text-muted">{group.title}</p>
              {visible.map(({ label, href, icon: Icon, highlight }) => {
          const isActive = pathname === href;
          const content = (
            <Link
              key={label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`group flex items-center justify-between rounded-lg px-3 ${mode === "drawer" ? "py-3 text-base" : "py-2.5 text-sm"} transition-colors ${isActive
                  ? "bg-accent font-bold text-accent-ink"
                  : "font-medium text-soft hover:bg-raised hover:text-ink"
                }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? "text-accent-ink" : "text-muted group-hover:text-soft"}`}
                />
                <span className="whitespace-nowrap">{label}</span>
              </div>
              {highlight && (
                <span className={`ml-2 shrink-0 rounded border px-1.5 py-px text-[11px] font-semibold ${isActive ? "border-accent-ink/40 text-accent-ink" : "border-line-strong text-muted"}`}>
                  app
                </span>
              )}
            </Link>
          );

          return content;
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-line">
        <Can roles={["administrador", "superadmin"]}>
          <div className="border-b border-dashed border-line px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-soft">
                <Zap className="h-3.5 w-3.5 text-accent" aria-hidden />
                Robôs de automação
              </p>
              <button
                type="button"
                onClick={runAllRobots}
                disabled={rpaRunning}
                className="rounded-md border border-line-strong px-2 py-1 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {rpaRunning ? "Executando..." : "Executar agora"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Última execução: {formatRun(rpa.lastRun)} · hoje: {rpa.runsToday}
            </p>
            {rpaMsg && <p className="mt-1 text-xs text-soft">{rpaMsg}</p>}
          </div>
        </Can>

        <div className="flex items-center gap-2 px-4 py-3">
          {user && (
            <>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-raised text-xs font-bold text-ink">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold text-ink">{user.username}</p>
                <p className="truncate text-xs capitalize text-muted">{user.role}</p>
              </div>
            </>
          )}
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            aria-label="Sair da conta"
            title="Sair da conta"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-soft hover:border-danger/50 hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superior: só abaixo de 1024px, onde o menu lateral vira gaveta */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas px-3 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-raised"
        >
          <Menu className="h-5 w-5" />
        </button>
        <BrandMark size={32} />
        <p className="font-display min-w-0 flex-1 truncate text-xl text-ink">{brandName}</p>
        <ThemeToggle />
      </header>

      {collapsed ? (
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Mostrar menu lateral"
        title="Mostrar menu"
        className="fixed left-0 top-1/2 z-40 hidden h-14 w-5 -translate-y-1/2 items-center lg:flex justify-center rounded-r-lg border border-l-0 border-line bg-surface text-soft  transition-[transform,background-color,border-color,color,opacity] hover:w-7 hover:bg-accent hover:text-accent-ink"
      >
        <PanelLeftOpen className="h-3.5 w-3.5" />
      </button>
      ) : (
        <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-line bg-canvas lg:flex">{panel("desktop")}</aside>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar menu" tabIndex={-1} onClick={closeDrawer} className="absolute inset-0 bg-black/60" />
          <div
            ref={drawerRef}
            className="relative flex h-full w-[min(20rem,86vw)] flex-col border-r border-line bg-canvas"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {panel("drawer")}
          </div>
        </div>
      )}
    </>
  );
}
