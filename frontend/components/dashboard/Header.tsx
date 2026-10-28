"use client";

import { notify, askConfirm } from "@/components/ui/feedback";
import { formatDuration } from "@/lib/format"
import { apiErrorMessage } from "@/lib/errors"
import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { 
  CalendarDays, 
  Bell, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  X 
} from "lucide-react";
import { fetcher } from "@/services/api";
import { useBranding } from "@/hooks/useBranding";

interface Insumo {
  id: number;
  nome: string;
  unidade_medida: string;
  quantidade_atual: number | string;
  estoque_minimo: number | string;
}

interface Order {
  id: number;
  status: string;
  total: string | number;
  created_at: string;
}

interface TurnoResponse {
  ativo: boolean;
  turno: {
    id: number;
    inicio: string;
    duracao_minutos: number;
    saldo_dinheiro: string | number;
  } | null;
}

export function Header() {
  const { nome: brandName } = useBranding();
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingTurno, setLoadingTurno] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sincroniza a data do sistema
  useEffect(() => {
    const today = new Date();
    const formatted = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(today);
    setCurrentDateStr(formatted);
  }, []);

  // Busca dados reais para notificações e turno ativo
  const { data: insumos } = useSWR<Insumo[]>("/inventory/insumos/", fetcher);
  const { data: orders } = useSWR<Order[]>("/orders/", fetcher);
  const { data: turnoData, mutate: mutateTurno } = useSWR<TurnoResponse>(
    "/core/turnos/ativo/",
    fetcher,
    { refreshInterval: 15000 }
  );

  const handleCheckin = async () => {
    try {
      setLoadingTurno(true);
      const { api } = await import("@/services/api");
      await api.post("/core/turnos/checkin/");
      await mutateTurno();
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao iniciar turno."));
    } finally {
      setLoadingTurno(false);
    }
  };

  const handleCheckout = async () => {
    if (!(await askConfirm("Deseja realmente encerrar o seu turno agora?"))) return;
    try {
      setLoadingTurno(true);
      const { api } = await import("@/services/api");
      await api.post("/core/turnos/checkout/");
      await mutateTurno();
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao encerrar turno."));
    } finally {
      setLoadingTurno(false);
    }
  };

  // Filtra notificações reais
  const criticalStockItems = (Array.isArray(insumos) ? insumos : []).filter(
    (i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo)
  );

  const pendingOrders = (Array.isArray(orders) ? orders : []).filter(
    (o) => o.status === "criado" || o.status === "confirmado" || o.status === "em_preparo"
  );

  const totalNotifications = criticalStockItems.length + pendingOrders.length;

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="mx-6 flex flex-wrap items-end justify-between gap-4 border-b border-dashed border-line py-6 lg:mx-8">
      <div>
        <h1 className="text-5xl text-ink">Painel</h1>
        <p className="mt-1 text-sm text-muted">
          {brandName}
          {currentDateStr ? ` · ${currentDateStr}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-3 relative">
        {/* Controle de Ponto / Turno de Trabalho */}
        {turnoData?.ativo ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-success/60 px-3 py-2 text-sm font-semibold text-success ">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
              </span>
              <span>Em turno há {formatDuration(turnoData.turno?.duracao_minutos || 0)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={loadingTurno}
              className="rounded-lg border border-danger/60 px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
            >
              {loadingTurno ? "Saindo..." : "Encerrar ponto"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCheckin}
            disabled={loadingTurno}
            className="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-bold text-accent-ink hover:bg-accent-hover"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{loadingTurno ? "Iniciando..." : "Bater ponto"}</span>
          </button>
        )}

        {/* Botão de Notificações com Dropdown Interativo Real */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notificações"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong text-soft hover:bg-raised hover:text-ink"
          >
            <Bell className="h-[18px] w-[18px]" />
            {totalNotifications > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-ink ">
                {totalNotifications}
              </span>
            )}
          </button>

          {/* Modal / Dropdown de Notificações Reais */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-line bg-surface/95 p-4 shadow-2xl backdrop-blur-md z-50  fade-in-50  duration-200">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">Avisos</h3>
                  {totalNotifications > 0 && (
                    <span className="rounded-md bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                      {totalNotifications} pendente{totalNotifications > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="rounded-lg p-1 text-muted hover:bg-raised hover:text-soft"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 max-h-80 overflow-y-auto space-y-2.5">
                {totalNotifications === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-muted text-xs">
                    <CheckCircle2 className="h-8 w-8 text-success mb-2 opacity-80" />
                    <p className="font-semibold text-soft">Tudo em ordem!</p>
                    <p className="text-xs text-muted mt-0.5">Nenhum estoque crítico ou pedido pendente no momento.</p>
                  </div>
                ) : (
                  <>
                    {/* Alertas de Estoque Crítico */}
                    {criticalStockItems.map((item) => (
                      <Link
                        key={`stock-${item.id}`}
                        href="/inventory"
                        onClick={() => setShowNotifications(false)}
                        className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs transition-colors hover:border-danger/40"
                      >
                        <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-ink">Estoque Crítico: {item.nome}</p>
                          <p className="text-xs text-soft mt-0.5">
                            Restam apenas <span className="text-danger font-bold">{item.quantidade_atual} {item.unidade_medida}</span> (Mínimo: {item.estoque_minimo} {item.unidade_medida}).
                          </p>
                        </div>
                      </Link>
                    ))}

                    {/* Alertas de Pedidos na Cozinha */}
                    {pendingOrders.map((order) => (
                      <Link
                        key={`order-${order.id}`}
                        href="/orders"
                        onClick={() => setShowNotifications(false)}
                        className="flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/10 p-3 text-xs transition-colors hover:border-accent/40"
                      >
                        <Clock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-ink">Pedido #{order.id} em Preparo</p>
                          <p className="text-xs text-soft mt-0.5">
                            Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(order.total))} • Status: {order.status}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}