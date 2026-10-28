"use client";

import { notify, askConfirm } from "@/components/ui/feedback";
import { brl, formatDuration } from "@/lib/format"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import React, { useState, useRef } from "react";
import useSWR, { mutate } from "swr";
import { api, fetcher } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Home,
  Clock,
  Wallet,
  User,
  Search,
  MapPin,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Shield,
  Phone,
  Power,
  RefreshCw,
  Plus,
  X,
  Camera,
  ChevronRight,
  Package,
  DollarSign,
  Bike,
} from "lucide-react";

interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface ItemPedido {
  id: number;
  produto_nome?: string;
  quantidade: number;
  preco_unitario: string | number;
  subtotal: string | number;
}

interface PedidoEntrega {
  id: number;
  status: string;
  tipo_atendimento: string;
  cliente?: number | null;
  itens: ItemPedido[];
  endereco?: Endereco | null;
  total: string | number;
  payment_method: string;
  valor_recebido?: string | number;
  troco?: string | number;
  codigo_pin_entrega?: string;
  comprovante_entrega_url?: string;
  motivo_falha_entrega?: string;
  created_at: string;
}

interface TurnoResponse {
  ativo: boolean;
  turno: {
    id: number;
    inicio: string;
    duracao_minutos: number;
    saldo_dinheiro: string | number;
    acerto_confirmado: boolean;
  } | null;
}

interface DisponibilidadeResponse {
  is_online: boolean;
  role: string;
}

export default function EntregadorApp() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"home" | "orders" | "cart" | "profile">("home");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modais de Ação
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<PedidoEntrega | null>(null);
  const [selectedOrderForFailure, setSelectedOrderForFailure] = useState<PedidoEntrega | null>(null);
  const [failureReason, setFailureReason] = useState("Cliente ausente");
  const [otherReasonText, setOtherReasonText] = useState("");
  const [validationMethod, setValidationMethod] = useState<"pin" | "assinatura" | "foto">("pin");
  const [pinInput, setPinInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Canvas Assinatura
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Data Fetching
  const { data: entregas, mutate: mutateEntregas } = useSWR<PedidoEntrega[]>(
    "/orders/minhas-entregas/",
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: allOrders } = useSWR<PedidoEntrega[]>(
    "/orders/",
    fetcher,
    { refreshInterval: 10000 }
  );

  const { data: turnoData, mutate: mutateTurno } = useSWR<TurnoResponse>(
    "/core/turnos/ativo/",
    fetcher,
    { refreshInterval: 10000 }
  );

  const { data: dispData, mutate: mutateDisp } = useSWR<DisponibilidadeResponse>(
    "/users/disponibilidade/",
    fetcher,
    { refreshInterval: 10000 }
  );

  // Filtros de Pedidos
  const activeOrders = (Array.isArray(entregas) ? entregas : []).filter(
    (p) => ["confirmado", "em_preparo", "pronto", "retornando_base"].includes(p.status)
  );

  const completedOrders = (Array.isArray(allOrders) ? allOrders : []).filter(
    (p) => ["entregue", "finalizado"].includes(p.status) && p.tipo_atendimento === "delivery"
  );

  const filteredActiveOrders = activeOrders.filter((p) => {
    const matchStatus = filterStatus === null || p.status === filterStatus;
    const matchSearch =
      p.id.toString().includes(search) ||
      (p.endereco?.logradouro && p.endereco.logradouro.toLowerCase().includes(search.toLowerCase())) ||
      (p.endereco?.bairro && p.endereco.bairro.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  // Ações de Turno e Disponibilidade
  const handleToggleDisponibilidade = async () => {
    try {
      await api.post("/users/disponibilidade/", {
        is_online: !dispData?.is_online,
      });
      await mutateDisp();
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao alterar disponibilidade."));
    }
  };

  const handleCheckin = async () => {
    try {
      await api.post("/core/turnos/checkin/");
      await mutateTurno();
      await mutateDisp();
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao iniciar turno."));
    }
  };

  const handleCheckout = async () => {
    if (!(await askConfirm("Deseja encerrar seu turno e fechar o caixa de hoje?"))) return;
    try {
      await api.post("/core/turnos/checkout/");
      await mutateTurno();
      await mutateDisp();
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao encerrar turno."));
    }
  };

  // Navegação Waze / Maps
  const formatEndereco = (end?: Endereco | null) => {
    if (!end) return "";
    return `${end.logradouro}, ${end.numero} - ${end.bairro}, ${end.cidade} - ${end.uf}`;
  };

  const handleOpenWaze = (end?: Endereco | null) => {
    const q = encodeURIComponent(formatEndereco(end));
    window.open(`https://waze.com/ul?q=${q}&navigate=yes`, "_blank");
  };

  const handleOpenGoogleMaps = (end?: Endereco | null) => {
    const q = encodeURIComponent(formatEndereco(end));
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  // Prova de Entrega (POD)
  const handleConfirmarEntrega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForDelivery) return;

    setActionLoading(true);
    try {
      let comprovanteUrl = "";
      if (validationMethod === "assinatura") {
        if (!hasSignature) {
          notify("Por favor, peça ao cliente para assinar na tela.");
          setActionLoading(false);
          return;
        }
        comprovanteUrl = canvasRef.current ? canvasRef.current.toDataURL("image/png") : "assinatura_ok";
      } else if (validationMethod === "foto") {
        comprovanteUrl = "https://storage.empresa.com/comprovante_foto.jpg";
      }

      await api.post(`/orders/${selectedOrderForDelivery.id}/confirmar-entrega/`, {
        metodo_validacao: validationMethod,
        pin: pinInput,
        comprovante_url: comprovanteUrl,
      });

      await mutateEntregas();
      await mutateTurno();
      setSelectedOrderForDelivery(null);
      setPinInput("");
      setHasSignature(false);
      notify("Entrega confirmada com sucesso!");
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao confirmar entrega."));
    } finally {
      setActionLoading(false);
    }
  };

  // Falha na Entrega
  const handleReportarFalha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForFailure) return;

    setActionLoading(true);
    try {
      const motivoFinal = failureReason === "Outro" ? otherReasonText : failureReason;
      await api.post(`/orders/${selectedOrderForFailure.id}/falha-entrega/`, {
        motivo: motivoFinal,
      });

      await mutateEntregas();
      setSelectedOrderForFailure(null);
      setOtherReasonText("");
      notify("Falha registrada. O pedido agora consta como 'Retornando à base'!");
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao reportar falha."));
    } finally {
      setActionLoading(false);
    }
  };

  // Canvas Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--c-accent").trim() || "#eab308";
    ctx.lineWidth = 2.5;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Carteira
  const pedidosDinheiro = (Array.isArray(entregas) ? entregas : []).filter((p) => p.payment_method === "dinheiro");
  const totalEmDinheiro = pedidosDinheiro.reduce((sum, p) => sum + Number(p.total), 0);

  return (
    <div className="flex h-full w-full justify-center bg-canvas">
      <div className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-canvas sm:border-x sm:border-line">
        {/* Dynamic App Content */}
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))", paddingTop: "env(safe-area-inset-top)" }}>

          {/* TAB 1: HOME (ENTREGAS ATIVAS) */}
          {activeTab === "home" && (
            <div className="space-y-4 px-4 pt-2">
              
              {/* Cabeçalho */}
              <header className="mt-2 flex items-center justify-between border-b border-dashed border-line pb-4">
                <div>
                  <h1 className="text-4xl text-ink">Entregas</h1>
                  <p className="text-sm text-muted">{turnoData?.ativo ? "Você está em turno" : "Fora de turno"}</p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleDisponibilidade}
                  aria-pressed={!!dispData?.is_online}
                  className={`flex h-10 items-center gap-2 rounded-lg border-2 px-3.5 text-sm font-bold ${
                    dispData?.is_online ? "border-success text-success" : "border-line-strong text-muted"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-[2px] ${dispData?.is_online ? "bg-success" : "bg-line-strong"}`} aria-hidden />
                  {dispData?.is_online ? "Disponível" : "Indisponível"}
                </button>
              </header>

              {/* Banner de Turno / Ponto */}
              {!turnoData?.ativo ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-accent/10 p-4">
                  <span className="text-sm leading-snug text-soft">Inicie o turno para receber entregas e ficar disponível.</span>
                  <button
                    type="button"
                    onClick={handleCheckin}
                    className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink hover:bg-accent-hover"
                  >
                    Bater ponto
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between border-b border-line pb-3 text-sm">
                  <span className="flex items-center gap-2 text-soft">
                    <span className="h-2.5 w-2.5 rounded-[2px] bg-success" aria-hidden />
                    Turno há <strong className="text-ink">{formatDuration(turnoData.turno?.duracao_minutos || 0)}</strong>
                  </span>
                  <button type="button" onClick={handleCheckout} className="font-semibold text-danger hover:underline">
                    Encerrar ponto
                  </button>
                </div>
              )}

              {/* Barra de Busca */}
              <div className="relative mt-4">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder="Buscar entrega, rua ou pedido"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar entrega" className="h-12 w-full rounded-lg border border-line-strong bg-canvas pl-10 pr-4 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                />
              </div>

              <div role="tablist" aria-label="Filtrar entregas" className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto border-b border-line px-4">
                {[
                  { id: null as string | null, label: `Todas (${activeOrders.length})` },
                  { id: "pronto", label: "Prontas" },
                  { id: "em_preparo", label: "Na cozinha" },
                  { id: "retornando_base", label: "Retorno" },
                ].map((f) => (
                  <button
                    key={f.id ?? "todas"}
                    type="button"
                    role="tab"
                    aria-selected={filterStatus === f.id}
                    onClick={() => setFilterStatus(f.id)}
                    className={`-mb-px shrink-0 border-b-4 px-3.5 py-2.5 text-base font-semibold ${
                      filterStatus === f.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Lista de Entregas Designadas */}
              <div className="mt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-3xl text-ink">
                    Ativas <span className="font-display text-accent">{activeOrders.length}</span>
                  </h2>
                  <span className="text-sm text-muted">máximo de 4 por vez</span>
                </div>

                {activeOrders.length === 0 ? (
                  <div className="flex h-56 flex-col items-center justify-center border-2 border-dashed border-line p-6 text-center text-muted">
                    <Bike className="h-12 w-12 text-faint mb-4 opacity-60" />
                    <p className="font-bold text-[15px] text-soft">Nenhuma entrega atribuída no momento</p>
                    <p className="text-xs text-muted mt-2 max-w-55 leading-relaxed">
                      Fique disponível para a loja despachar pedidos para você.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredActiveOrders.map((pedido) => {
                      const isRetornando = pedido.status === "retornando_base";
                      const statusLabel: Record<string, string> = {
                        confirmado: "Confirmado",
                        em_preparo: "Em preparo",
                        pronto: "Pronto para sair",
                        retornando_base: "Voltando à loja",
                        entregue: "Entregue",
                      };
                      return (
                        <article key={pedido.id} className="ticket px-4 pb-4 pt-7">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-paper-muted">Pedido</p>
                              <p className="font-display text-5xl">{pedido.id}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${isRetornando ? "text-paper-danger" : ""}`}>
                                {statusLabel[pedido.status] ?? pedido.status}
                              </p>
                              <p className="font-display text-3xl">{brl(pedido.total)}</p>
                            </div>
                          </div>

                          <div className="my-3 border-t-2 border-dashed border-paper-line" aria-hidden />

                          <div className="flex items-start gap-2">
                            <MapPin className="mt-1 h-5 w-5 shrink-0" aria-hidden />
                            <div className="leading-snug">
                              <p className="text-xl font-bold">
                                {pedido.endereco?.logradouro}, {pedido.endereco?.numero}
                              </p>
                              <p className="text-paper-muted">
                                {pedido.endereco?.bairro} · {pedido.endereco?.cidade}/{pedido.endereco?.uf}
                              </p>
                              {pedido.endereco?.complemento && (
                                <p className="text-sm text-paper-muted">Complemento: {pedido.endereco?.complemento}</p>
                              )}
                            </div>
                          </div>

                          {pedido.payment_method === "dinheiro" && (
                            <div className="mt-3 flex items-center justify-between border-2 border-paper-ink p-2.5">
                              <span className="flex items-center gap-1.5 font-bold">
                                <DollarSign className="h-4 w-4" aria-hidden /> Cobrar em dinheiro
                              </span>
                              <span className="font-semibold">
                                {Number(pedido.troco) > 0 ? `Troco ${brl(pedido.troco)}` : "Sem troco"}
                              </span>
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenWaze(pedido.endereco)}
                              className="flex h-11 items-center justify-center gap-2 rounded-md border-2 border-paper-line font-semibold hover:border-paper-ink"
                            >
                              <Navigation className="h-4 w-4" />
                              Waze
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenGoogleMaps(pedido.endereco)}
                              className="flex h-11 items-center justify-center gap-2 rounded-md border-2 border-paper-line font-semibold hover:border-paper-ink"
                            >
                              <MapPin className="h-4 w-4" />
                              Maps
                            </button>
                          </div>

                          <div className="mt-2 flex gap-2">
                            {!isRetornando && (
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForFailure(pedido)}
                                className="h-12 flex-1 rounded-md border-2 border-paper-danger font-bold text-paper-danger hover:bg-paper-danger/10"
                              >
                                Não entreguei
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForDelivery(pedido)}
                              className="h-12 flex-[1.4] rounded-md bg-paper-ink font-bold text-paper hover:opacity-90"
                            >
                              {isRetornando ? "Devolver na loja" : "Concluir entrega"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PEDIDOS (HISTÓRICO CONCLUÍDO) */}
          {activeTab === "orders" && (
            <div className="px-4 pt-2 space-y-3">
              <h3 className="text-sm font-bold text-ink">Histórico de entregas</h3>
              {completedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted text-xs">
                  <Clock className="h-10 w-10 text-faint opacity-40 mb-2" />
                  <p>Nenhuma entrega finalizada ainda.</p>
                </div>
              ) : (
                completedOrders.slice(0, 10).map((ord) => (
                  <div key={ord.id} className="rounded-2xl border border-line bg-surface p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-accent">Pedido #{ord.id}</span>
                      <span className="rounded-md bg-success/20 px-2.5 py-0.5 text-xs font-bold text-success capitalize">
                        • {ord.status}
                      </span>
                    </div>
                    <p className="text-soft truncate text-xs">
                      {ord.endereco?.logradouro}, {ord.endereco?.numero} - {ord.endereco?.bairro}
                    </p>
                    <div className="flex justify-between text-soft pt-1 border-t border-line/60">
                      <span>Total:</span>
                      <span className="font-bold text-ink">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(ord.total))}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CARTEIRA / RESUMO DE CAIXA */}
          {activeTab === "cart" && (
            <div className="px-4 pt-2 space-y-4">
              <h3 className="text-sm font-bold text-ink">Resumo de Caixa do Turno</h3>

              <div className="rounded-2xl border border-line bg-surface p-5  space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="text-xs font-bold   text-soft flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-accent" />
                    Saldo a Repassar
                  </span>
                  <span className="text-xs text-success">
                    {turnoData?.ativo ? "Turno Ativo" : "Fechado"}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-soft">Total em Dinheiro Retido:</span>
                  <div className="text-3xl font-black text-accent">
                    {brl(turnoData?.turno?.saldo_dinheiro || totalEmDinheiro)}
                  </div>
                  <p className="text-xs text-muted">
                    Calculado a partir de {pedidosDinheiro.length} pedido(s) pagos em espécie.
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-canvas p-3 text-xs space-y-2 text-soft">
                  <div className="flex justify-between">
                    <span>Tempo de Turno:</span>
                    <span className="font-semibold">{formatDuration(turnoData?.turno?.duracao_minutos || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Acerto com a Gerência:</span>
                    <span className="font-semibold text-accent">
                      {turnoData?.turno?.acerto_confirmado ? "Confirmado" : "Pendente"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={!turnoData?.ativo}
                  className="w-full rounded-2xl bg-accent py-3.5 text-center text-xs font-black text-accent-ink  disabled:opacity-40"
                >
                  Solicitar Acerto &amp; Fechar Caixa
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CONTA / PERFIL */}
          {activeTab === "profile" && (
            <div className="px-4 pt-2 space-y-4 text-xs">
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-black text-accent-ink">
                  <Bike className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">Entregador</p>
                  <p className="text-xs text-soft">
                    {dispData?.is_online ? "Status: Online (Disponível)" : "Status: Pausa (Invisível)"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface divide-y divide-line">
                <div
                  onClick={turnoData?.ativo ? handleCheckout : handleCheckin}
                  className="p-3.5 flex justify-between items-center text-ink cursor-pointer hover:bg-raised/50"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Power className="h-4 w-4 text-accent" />
                    {turnoData?.ativo ? "Encerrar Ponto / Turno" : "Bater Ponto / Iniciar"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>

                <div
                  onClick={handleToggleDisponibilidade}
                  className="p-3.5 flex justify-between items-center text-ink cursor-pointer hover:bg-raised/50"
                >
                  <span>Alternar disponibilidade</span>
                  <span className={`text-xs font-bold ${dispData?.is_online ? "text-success" : "text-muted"}`}>
                    {dispData?.is_online ? "Online" : "Pausa"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="w-full rounded-2xl border border-danger/30 bg-danger/10 py-3 text-xs font-bold text-danger hover:bg-danger/20"
              >
                Sair da Conta
              </button>
            </div>
          )}

        </div>

        {/* BOTTOM NAVIGATION BAR (Exatamente igual ao App do Cliente) */}
        <nav aria-label="Navegação do aplicativo" className="absolute bottom-0 left-0 right-0 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch justify-around border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)]">
          {[
            { id: "home", label: "Entregas", icon: Package },
            { id: "orders", label: "Histórico", icon: Clock },
            { id: "cart", label: "Carteira", icon: Wallet, badge: pedidosDinheiro.length },
            { id: "profile", label: "Conta", icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 border-t-4 text-sm ${
                  isActive ? "border-accent font-bold text-ink" : "border-transparent text-muted hover:text-soft"
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute right-[calc(50%-2rem)] top-1.5 flex h-5 min-w-5 items-center justify-center rounded bg-accent px-1 text-xs font-bold text-accent-ink">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* MODAL PROVA DE ENTREGA (POD) */}
        {selectedOrderForDelivery && (
          <Dialog placement="sheet" label="Confirmar entrega" onClose={() => setSelectedOrderForDelivery(null)}>
            <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-4xl sm:rounded-3xl border border-line bg-surface p-5 shadow-2xl   duration-300">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Shield className="h-4 w-4 text-accent" />
                  Prova de Entrega (Pedido #{selectedOrderForDelivery.id})
                </h3>
                <button
                  onClick={() => setSelectedOrderForDelivery(null)}
                  className="rounded-lg p-1 text-muted hover:text-soft"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Seletor de Método de Comprovação */}
              <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border border-line bg-canvas p-1">
                <button
                  type="button"
                  onClick={() => setValidationMethod("pin")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    validationMethod === "pin" ? "bg-accent text-accent-ink" : "text-soft"
                  }`}
                >
                  Código PIN
                </button>
                <button
                  type="button"
                  onClick={() => setValidationMethod("assinatura")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    validationMethod === "assinatura" ? "bg-accent text-accent-ink" : "text-soft"
                  }`}
                >
                  Assinatura
                </button>
                <button
                  type="button"
                  onClick={() => setValidationMethod("foto")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    validationMethod === "foto" ? "bg-accent text-accent-ink" : "text-soft"
                  }`}
                >
                  Foto
                </button>
              </div>

              <form onSubmit={handleConfirmarEntrega} className="mt-4 space-y-4">
                {validationMethod === "pin" && (
                  <div className="space-y-2">
                    <label htmlFor="f-appentregadorpage-1" className="block text-xs font-medium text-soft">
                      Digite o PIN de 4 dígitos informado pelo cliente:
                    </label>
                    <input id="f-appentregadorpage-1"
                      type="text"
                      maxLength={4}
                      required
                      placeholder="Ex: 1234"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      className="w-full text-center text-2xl font-extrabold  font-mono rounded-xl border border-line bg-raised px-4 py-2.5 text-accent focus:border-accent focus:outline-none"
                    />
                    <p className="text-xs text-muted text-center">
                      Código exibido na tela do cliente para segurança.
                    </p>
                  </div>
                )}

                {validationMethod === "assinatura" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-soft">
                        Assinatura na tela do aparelho:
                      </label>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        Limpar
                      </button>
                    </div>

                    <div className="rounded-xl border border-line bg-canvas p-1">
                      <canvas
                        ref={canvasRef}
                        width={300}
                        height={120}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full touch-none cursor-crosshair rounded-lg bg-canvas"
                      />
                    </div>
                  </div>
                )}

                {validationMethod === "foto" && (
                  <div className="space-y-2 text-center">
                    <label className="block text-xs font-medium text-soft">
                      Foto do pacote na porta ou entregue:
                    </label>
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-canvas/60 p-6">
                      <Camera className="h-8 w-8 text-accent mb-2" />
                      <span className="text-xs text-soft font-semibold">Tirar Foto com a Câmera</span>
                      <span className="text-xs text-muted mt-1">(Simulação ativa para o teste)</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full rounded-2xl bg-accent py-3 text-xs font-black text-accent-ink  hover:bg-accent-hover"
                >
                  {actionLoading ? "Validando..." : "Confirmar e Finalizar"}
                </button>
              </form>
            </div>
          </Dialog>
        )}

        {/* MODAL FALHA NA ENTREGA */}
        {selectedOrderForFailure && (
          <Dialog placement="sheet" label="Registrar falha na entrega" onClose={() => setSelectedOrderForFailure(null)}>
            <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-line bg-surface p-5 shadow-2xl   duration-300">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="text-sm font-bold text-danger flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Falha na Entrega (Pedido #{selectedOrderForFailure.id})
                </h3>
                <button
                  onClick={() => setSelectedOrderForFailure(null)}
                  className="rounded-lg p-1 text-muted hover:text-soft"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleReportarFalha} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="f-appentregadorpage-2" className="block text-xs font-medium text-soft mb-1.5">
                    Selecione o motivo:
                  </label>
                  <select id="f-appentregadorpage-2"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    className="w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="Cliente ausente">Cliente ausente / Não atende</option>
                    <option value="Endereço incorreto">Endereço incorreto / Não localizado</option>
                    <option value="Recusado pelo cliente">Recusado pelo cliente</option>
                    <option value="Problema mecânico com a moto">Problema mecânico / veículo</option>
                    <option value="Outro">Outro motivo</option>
                  </select>
                </div>

                {failureReason === "Outro" && (
                  <div>
                    <label htmlFor="f-appentregadorpage-3" className="block text-xs font-medium text-soft mb-1">
                      Descreva o ocorrido:
                    </label>
                    <textarea id="f-appentregadorpage-3"
                      required
                      rows={3}
                      value={otherReasonText}
                      onChange={(e) => setOtherReasonText(e.target.value)}
                      className="w-full rounded-xl border border-line bg-raised px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
                      placeholder="Ex: interfone estragado e portão trancado..."
                    />
                  </div>
                )}

                <p className="text-xs text-muted">
                  O pedido entrará no status <strong>Retornando à base</strong> e alertará a loja.
                </p>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full rounded-2xl bg-danger py-3 text-xs font-extrabold   text-white hover:bg-danger "
                >
                  {actionLoading ? "Enviando..." : "Confirmar Falha & Retornar à Base"}
                </button>
              </form>
            </div>
          </Dialog>
        )}

      </div>
    </div>
  );
}
