"use client"

import { notify, askConfirm } from "@/components/ui/feedback";
import { brl } from "@/lib/format"
import { buttonClass } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import React, { useState } from "react"
import useSWR, { mutate } from "swr"
import { api, fetcher } from "@/services/api"
import { PageHeader, StatusTag, StatStrip, TabBar } from "@/components/ui/blocks"
import {
  Search,
  RefreshCw,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Banknote,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Flame,
  ArrowRight,
  Archive,
  Eye,
  Edit,
  XCircle,
  X,
  CreditCard,
  QrCode,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Bike,
  Printer,
} from "lucide-react"
import { PaymentModal } from "@/components/orders/PaymentModal"
import { ReceiptPrintModal } from "@/components/orders/ReceiptPrintModal"
import { Can } from "@/components/Can"

interface Endereco {
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
}

interface ItemPedido {
  id: number
  produto: number
  produto_nome?: string
  quantidade: number
  preco_unitario: string | number
  subtotal: string | number
}

interface Pedido {
  id: number
  status: string
  tipo_atendimento: string
  numero_mesa: string
  numero_comanda: string
  cliente?: number | null
  entregador?: number | null
  entregador_nome?: string | null
  codigo_pin_entrega?: string
  comprovante_entrega_url?: string
  motivo_falha_entrega?: string
  itens: ItemPedido[]
  endereco?: Endereco | null
  total: string | number
  payment_method: string
  valor_recebido?: string | number
  troco?: string | number
  created_at: string
  confirmed_at?: string | null
}

interface Produto {
  id: number
  nome: string
  preco: string | number
  disponibilidade: boolean
  categoria_nome?: string
}

export default function GestaoBalcaoPage() {
  const [search, setSearch] = useState("")
  const [filterTab, setFilterTab] = useState<"ativos" | "abertos" | "prontos" | "finalizados" | "todos">("ativos")

  // Modals state
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Pedido | null>(null)
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Pedido | null>(null)
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Pedido | null>(null)
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Pedido | null>(null)
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<Pedido | null>(null)
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState<Pedido | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [returnSupplies, setReturnSupplies] = useState(false)
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [actionSuccessMessage, setActionSuccessMessage] = useState("")

  // SWR data fetching
  const { data: entregadoresDisp, mutate: mutateEntregadores } = useSWR<any[]>(
    "/orders/entregadores-disponiveis/",
    fetcher
  )

  // SWR data fetching
  const { data: pedidos, error, isLoading, isValidating } = useSWR<Pedido[]>(
    "/orders/",
    fetcher,
    { refreshInterval: 5000 }
  )

  const { data: produtos } = useSWR<Produto[]>("/catalog/produtos/", fetcher)

  const allOrders = Array.isArray(pedidos) ? pedidos : []

  // Filter orders by tab
  const filteredOrders = allOrders.filter((order) => {
    // Search filter (mesa, comanda, id)
    const matchesSearch =
      search.trim() === "" ||
      order.numero_comanda?.toLowerCase().includes(search.toLowerCase()) ||
      order.numero_mesa?.toLowerCase().includes(search.toLowerCase()) ||
      order.id.toString().includes(search)

    if (!matchesSearch) return false

    // Tab filter
    if (filterTab === "ativos") {
      return ["criado", "confirmado", "em_preparo", "pronto"].includes(order.status)
    }
    if (filterTab === "abertos") {
      return ["criado", "confirmado", "em_preparo"].includes(order.status)
    }
    if (filterTab === "prontos") {
      return order.status === "pronto"
    }
    if (filterTab === "finalizados") {
      return ["finalizado", "entregue"].includes(order.status)
    }
    return true // 'todos'
  })

  // KPI Calculations
  const activeOrdersCount = allOrders.filter((o) =>
    ["criado", "confirmado", "em_preparo", "pronto"].includes(o.status)
  ).length

  const inPrepCount = allOrders.filter((o) =>
    ["confirmado", "em_preparo"].includes(o.status)
  ).length

  const readyCount = allOrders.filter((o) => o.status === "pronto").length

  const todayRevenue = allOrders
    .filter((o) => ["finalizado", "entregue"].includes(o.status))
    .reduce((acc, o) => acc + Number(o.total || 0), 0)

  // Actions
  const handleCancelOrder = async () => {
    if (!selectedOrderForCancel) return
    setLoadingAction(true)
    try {
      await api.patch(`/orders/${selectedOrderForCancel.id}/`, {
        status: "cancelado",
        cancellation_reason: cancelReason || "Cancelado pelo operador no balcão",
        // Antes do preparo o estoque volta sozinho; depois, só se o operador marcar
        ...(["em_preparo", "pronto", "entregue", "retornando_base"].includes(selectedOrderForCancel.status)
          ? { devolver_insumos: returnSupplies }
          : {}),
      })
      mutate("/orders/")
      setSelectedOrderForCancel(null)
      setCancelReason("")
      setReturnSupplies(false)
      showFeedback("Pedido cancelado com sucesso.")
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao cancelar pedido."))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleResendDelivery = async (orderId: number) => {
    setLoadingAction(true)
    try {
      await api.patch(`/orders/${orderId}/`, { status: "pronto" })
      mutate("/orders/")
      showFeedback(`Pedido #${orderId} liberado: atribua um novo entregador.`)
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao reenviar pedido para entrega."))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleAddItemToOrder = async (produtoId: number) => {
    if (!selectedOrderForEdit) return
    setLoadingAction(true)
    try {
      const res = await api.post(`/orders/${selectedOrderForEdit.id}/add-item/`, {
        produto: produtoId,
        quantidade: 1,
      })
      setSelectedOrderForEdit(res.data)
      mutate("/orders/")
      showFeedback("Item adicionado ao pedido!")
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao adicionar item."))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleRemoveItemFromOrder = async (itemId: number) => {
    if (!selectedOrderForEdit) return
    setLoadingAction(true)
    try {
      const res = await api.post(`/orders/${selectedOrderForEdit.id}/remove-item/`, {
        item_id: itemId,
      })
      setSelectedOrderForEdit(res.data)
      mutate("/orders/")
      showFeedback("Item removido do pedido.")
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao remover item."))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCloseShift = async () => {
    setLoadingAction(true)
    try {
      const res = await api.post("/orders/close-shift/")
      mutate("/orders/")
      setIsCloseShiftOpen(false)
      showFeedback(res.data.message || "Expediente encerrado e pedidos arquivados.")
    } catch (err: any) {
      notify(apiErrorMessage(err, "Erro ao encerrar expediente."))
    } finally {
      setLoadingAction(false)
    }
  }

  const showFeedback = (msg: string) => {
    setActionSuccessMessage(msg)
    setTimeout(() => setActionSuccessMessage(""), 4000)
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { tone: "neutral" | "info" | "warn" | "accent" | "success" | "danger"; label: string; pulse?: boolean }> = {
      criado: { tone: "info", label: "Aberto" },
      confirmado: { tone: "warn", label: "Confirmado" },
      em_preparo: { tone: "accent", label: "Em preparo" },
      pronto: { tone: "success", label: "Pronto para entrega" },
      entregue: { tone: "success", label: "Entregue" },
      finalizado: { tone: "neutral", label: "Pago" },
      cancelado: { tone: "danger", label: "Cancelado" },
      retornando_base: { tone: "danger", label: "Retornando à base", pulse: true },
      arquivado: { tone: "neutral", label: "Arquivado" },
    }
    const m = map[status] ?? { tone: "neutral" as const, label: status }
    return (
      <StatusTag tone={m.tone} pulse={m.pulse}>
        {m.label}
      </StatusTag>
    )
  }

  return (
    <div className="flex flex-col h-full bg-canvas text-ink p-6 space-y-6 overflow-y-auto">
      {/* Toast Feedback */}
      {actionSuccessMessage && (
        <div className="fixed top-6 right-6 z-50 rounded-2xl bg-success text-accent-ink font-bold px-4 py-3 shadow-2xl flex items-center gap-2   duration-300">
          <CheckCircle2 className="h-5 w-5" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Alerta Visual de Falha de Entrega (Issue #82) */}
      {allOrders.filter((o) => o.status === "retornando_base").length > 0 && (
        <div className="rounded-lg border border-danger/50 bg-danger/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-danger shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-danger">
                Atenção: {allOrders.filter((o) => o.status === "retornando_base").length} pedido(s) retornando à base por falha na entrega!
              </h3>
              <div className="mt-2 space-y-1.5">
                {allOrders.filter((o) => o.status === "retornando_base").map((ped) => (
                  <div key={ped.id} className="flex flex-wrap items-center justify-between text-xs text-danger bg-danger/30 rounded-xl px-3 py-2 border border-danger/30">
                    <div>
                      <strong>Pedido #{ped.id}</strong> ({ped.endereco?.logradouro}, {ped.endereco?.numero}) — Motivo: <span className="font-semibold text-white">{ped.motivo_falha_entrega || "Não informado"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-danger">Entregador: {ped.entregador_nome || `#${ped.entregador}`}</span>
                      <button
                        type="button"
                        onClick={() => handleResendDelivery(ped.id)}
                        disabled={loadingAction}
                        className="rounded-lg border border-accent/60 bg-accent/10 px-2 py-1 text-xs font-bold text-accent hover:bg-accent hover:text-accent-ink disabled:opacity-50"
                      >
                        Reenviar entrega
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <PageHeader
        title="Pedidos do balcão"
        description="Acompanhe as comandas, receba os pagamentos e feche o expediente."
        actions={
          <>
            <button
              type="button"
              onClick={() => mutate("/orders/")}
              disabled={isValidating}
              className={buttonClass("outline")}
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin text-accent" : ""}`} />
              Atualizar
            </button>
            <Can do="FECHAR_CAIXA">
              <button
                type="button"
                onClick={() => setIsCloseShiftOpen(true)}
                className={buttonClass("danger")}
              >
                <Archive className="h-4 w-4" />
                Encerrar expediente
              </button>
            </Can>
          </>
        }
      />

      <StatStrip
        items={[
          { label: "Pedidos ativos", value: activeOrdersCount, hint: "Mesas e balcões abertos" },
          { label: "Na cozinha", value: inPrepCount, hint: "Em preparação agora", tone: "warn" },
          { label: "Prontos", value: readyCount, hint: "Aguardando entrega ou retirada", tone: "success" },
          {
            label: "Faturamento do turno",
            value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(todayRevenue),
            hint: "Pedidos pagos e entregues",
            tone: "accent",
          },
        ]}
      />

      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-end">
        <div className="relative w-full md:w-96">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted" aria-hidden />
          <input
            type="text"
            placeholder="Buscar por mesa ou comanda"
            aria-label="Buscar por mesa ou comanda"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-line-strong bg-canvas pl-10 pr-4 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        <TabBar
          label="Filtrar pedidos"
          value={filterTab}
          onChange={setFilterTab}
          tabs={[
            { value: "ativos", label: "Ativos", count: activeOrdersCount },
            { value: "abertos", label: "Em aberto", count: inPrepCount },
            { value: "prontos", label: "Prontos", count: readyCount },
            { value: "finalizados", label: "Finalizados" },
            { value: "todos", label: "Todos", count: allOrders.length },
          ]}
        />
      </div>

      {/* Orders Desktop Table */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3 text-muted">
            <RefreshCw className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm font-semibold">Carregando pedidos...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center space-y-3 text-muted">
            <Receipt className="h-12 w-12 text-faint" />
            <p className="text-base font-bold text-soft">Nenhum pedido encontrado</p>
            <p className="text-xs text-muted max-w-sm">
              Não há pedidos correspondentes ao filtro selecionado. Novos pedidos abertos no PDV aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b-2 border-ink text-sm font-bold text-ink">
                <tr>
                  <th className="py-3 px-3">Comanda</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Itens</th>
                  <th className="py-3 px-3">Total</th>
                  <th className="py-3 px-3">Pagamento</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredOrders.map((order) => {
                  const canPay = !["finalizado", "arquivado", "cancelado"].includes(order.status)
                  const canEdit = !["finalizado", "arquivado", "cancelado"].includes(order.status)
                  const canCancel = !["finalizado", "arquivado", "cancelado"].includes(order.status)

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-raised/30 transition-colors group"
                    >
                      {/* Comanda & Mesa */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-display w-14 text-4xl text-ink">{order.numero_comanda || order.id}</span>
                          <span className="text-xs text-muted">Pedido {order.id}</span>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-ink">
                          {order.tipo_atendimento === "mesa"
                            ? `Mesa ${order.numero_mesa}`.trim()
                            : ({ balcao: "Balcão", delivery: "Delivery", retirada: "Retirada" } as Record<string, string>)[order.tipo_atendimento] ?? order.tipo_atendimento}
                        </span>
                        {order.tipo_atendimento === "delivery" && order.endereco && (
                          <div className="flex flex-col gap-0.5 mt-1">
                            <div className="flex items-center gap-1 text-xs text-warn" title={`${order.endereco.logradouro}, ${order.endereco.numero}`}>
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[120px]">{order.endereco.bairro}</span>
                            </div>
                            {order.entregador_nome ? (
                              <span className="text-xs text-success font-semibold">Moto: {order.entregador_nome}</span>
                            ) : ["confirmado", "em_preparo", "pronto", "retornando_base"].includes(order.status) ? (
                              <button
                                onClick={() => setSelectedOrderForAssign(order)}
                                className="w-fit rounded border border-accent px-1.5 py-0.5 text-xs font-bold text-accent hover:bg-accent hover:text-accent-ink"
                              >
                                + Atribuir Moto
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">{getStatusBadge(order.status)}</td>

                      {/* Itens */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-ink">
                          {order.itens?.length || 0} item(ns)
                        </span>
                        <p className="text-xs text-muted truncate max-w-[120px]">
                          {order.itens?.map((i) => `${i.quantidade}x ${i.produto_nome || i.produto}`).join(", ")}
                        </p>
                      </td>

                      {/* Total */}
                      <td className="font-display py-3 px-3 text-2xl text-ink">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(Number(order.total || 0))}
                      </td>

                      {/* Pagamento */}
                      <td className="py-3 px-3">
                        <span className="capitalize font-medium text-soft block">
                          {order.payment_method?.replace("_", " ")}
                        </span>
                        {order.status === "finalizado" && order.troco && Number(order.troco) > 0 && (
                          <span className="text-xs text-success font-bold">
                            Troco: {brl(order.troco)}
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Ver Detalhes */}
                          <button
                            onClick={() => setSelectedOrderForDetails(order)}
                            title="Ver Detalhes"
                            className="rounded-lg border border-line p-1.5 text-soft hover:bg-raised hover:text-ink"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Imprimir Cupom */}
                          <button
                            onClick={() => setSelectedOrderForPrint(order)}
                            title="Imprimir Cupom"
                            className="rounded-lg border border-line p-1.5 text-soft hover:bg-raised hover:text-ink"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          {/* Editar Itens */}
                          {canEdit && (
                            <button
                              onClick={() => setSelectedOrderForEdit(order)}
                              title="Adicionar / Remover Itens"
                              className="rounded-lg border border-line p-1.5 text-soft hover:bg-raised hover:text-ink"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}

                          {/* Cancelar */}
                          {canCancel && (
                            <Can do="CANCELAR_PEDIDO">
                              <button
                                onClick={() => setSelectedOrderForCancel(order)}
                                title="Cancelar Pedido"
                                className="rounded-lg border border-line p-1.5 text-danger hover:bg-danger/10"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </Can>
                          )}

                          {/* Cobrar / Pagar */}
                          {canPay && (
                            <button
                              onClick={() => setSelectedOrderForPayment(order)}
                              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-accent-ink hover:bg-accent-hover"
                            >
                              <Banknote className="h-3.5 w-3.5" />
                              <span>Cobrar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedOrderForPayment && (
        <PaymentModal
          order={selectedOrderForPayment}
          onClose={() => setSelectedOrderForPayment(null)}
          onSuccess={() => {
            mutate("/orders/")
            showFeedback("Pagamento concluído e lançado no fluxo de caixa!")
          }}
        />
      )}

      {/* Details Modal */}
      {selectedOrderForDetails && (
        <Dialog label={`Detalhes do pedido ${selectedOrderForDetails.id}`} onClose={() => setSelectedOrderForDetails(null)}>
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-line p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <div>
                <h3 className="text-3xl text-ink">
                  Detalhes do Pedido #{selectedOrderForDetails.id}
                </h3>
                <p className="text-xs text-soft">
                  Comanda #{selectedOrderForDetails.numero_comanda || "S/N"} • {selectedOrderForDetails.numero_mesa}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForDetails(null)}
                className="p-2 text-soft hover:text-ink rounded-full hover:bg-raised"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Delivery address if exists */}
            {selectedOrderForDetails.endereco && (
              <div className="mb-4 p-3 rounded-2xl bg-canvas border border-line text-xs text-soft">
                <span className="font-bold text-accent block mb-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Endereço de Entrega (Delivery):
                </span>
                <p>{selectedOrderForDetails.endereco.logradouro}, {selectedOrderForDetails.endereco.numero} {selectedOrderForDetails.endereco.complemento ? `- ${selectedOrderForDetails.endereco.complemento}` : ""}</p>
                <p className="text-soft">{selectedOrderForDetails.endereco.bairro} • {selectedOrderForDetails.endereco.cidade}/{selectedOrderForDetails.endereco.uf} (CEP: {selectedOrderForDetails.endereco.cep})</p>
              </div>
            )}

            {/* Itens List */}
            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
              {selectedOrderForDetails.itens?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-canvas/60 border border-line text-xs"
                >
                  <span className="font-bold text-ink">
                    {item.quantidade}x {item.produto_nome || `Item #${item.produto}`}
                  </span>
                  <span className="font-black text-accent">
                    {brl(item.subtotal || 0)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="p-3.5 rounded-2xl bg-canvas border border-line text-xs space-y-1.5">
              <div className="flex justify-between text-soft">
                <span>Status:</span>
                <span>{getStatusBadge(selectedOrderForDetails.status)}</span>
              </div>
              <div className="flex justify-between text-soft">
                <span>Forma de Pagamento:</span>
                <span className="capitalize font-semibold text-ink">{selectedOrderForDetails.payment_method?.replace("_", " ")}</span>
              </div>
              {selectedOrderForDetails.valor_recebido && Number(selectedOrderForDetails.valor_recebido) > 0 && (
                <div className="flex justify-between text-soft">
                  <span>Valor Recebido:</span>
                  <span className="text-ink">{brl(selectedOrderForDetails.valor_recebido)}</span>
                </div>
              )}
              {selectedOrderForDetails.troco && Number(selectedOrderForDetails.troco) > 0 && (
                <div className="flex justify-between text-success font-bold">
                  <span>Troco:</span>
                  <span>{brl(selectedOrderForDetails.troco)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-accent pt-2 border-t border-line">
                <span>Total:</span>
                <span>{brl(selectedOrderForDetails.total || 0)}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrderForPrint(selectedOrderForDetails)}
              className="w-full mt-4 h-11 rounded-2xl border border-accent/60 bg-accent/10 hover:bg-accent hover:text-accent-ink text-accent font-bold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Cupom
            </button>

            <button
              onClick={() => setSelectedOrderForDetails(null)}
              className="w-full mt-2 h-11 rounded-2xl bg-raised hover:bg-line-strong text-ink font-bold text-xs transition-colors"
            >
              Fechar
            </button>
          </div>
        </Dialog>
      )}

      {selectedOrderForPrint && (
        <ReceiptPrintModal order={selectedOrderForPrint} onClose={() => setSelectedOrderForPrint(null)} />
      )}

      {/* Edit Items Modal */}
      {selectedOrderForEdit && (
        <Dialog label={`Editar itens do pedido ${selectedOrderForEdit.id}`} onClose={() => setSelectedOrderForEdit(null)}>
          <div className="w-full max-w-xl rounded-3xl bg-surface border border-line p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <div>
                <h3 className="text-3xl text-ink">
                  Editar Itens do Pedido #{selectedOrderForEdit.id}
                </h3>
                <p className="text-xs text-soft">
                  Comanda #{selectedOrderForEdit.numero_comanda || "S/N"} • {selectedOrderForEdit.numero_mesa}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForEdit(null)}
                className="p-2 text-soft hover:text-ink rounded-full hover:bg-raised"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Items */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              <span className="text-xs font-bold   text-soft block mb-1">
                Itens Atuais no Pedido:
              </span>
              {selectedOrderForEdit.itens?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-canvas border border-line"
                >
                  <div>
                    <span className="text-xs font-bold text-ink block">
                      {item.quantidade}x {item.produto_nome || `Produto #${item.produto}`}
                    </span>
                    <span className="text-xs text-soft">
                      {brl(item.preco_unitario)} un. • Subtotal: {brl(item.subtotal)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveItemFromOrder(item.id)}
                    disabled={loadingAction}
                    title="Remover este item"
                    className="p-2 rounded-xl text-danger hover:bg-danger/20 hover:text-danger transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Products Quick List */}
            <div className="border-t border-line pt-3">
              <span className="text-xs font-bold   text-accent block mb-2">
                + Adicionar Produto ao Pedido:
              </span>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                {(Array.isArray(produtos) ? produtos : []).filter((p) => p.disponibilidade).map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => handleAddItemToOrder(prod.id)}
                    disabled={loadingAction}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-canvas border border-line hover:border-accent/50 hover:bg-raised/40 text-left transition-colors"
                  >
                    <div className="min-w-0 pr-1">
                      <p className="text-xs font-bold text-ink truncate">{prod.nome}</p>
                      <p className="text-xs text-accent font-bold">{brl(prod.preco)}</p>
                    </div>
                    <Plus className="h-4 w-4 text-accent shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedOrderForEdit(null)}
              className="w-full mt-4 h-11 rounded-2xl bg-accent text-accent-ink font-bold text-xs hover:bg-accent-hover transition-colors "
            >
              Concluir Edição
            </button>
          </div>
        </Dialog>
      )}

      {/* Cancel Confirmation Modal */}
      {selectedOrderForCancel && (
        <Dialog label={`Cancelar pedido ${selectedOrderForCancel.id}`} onClose={() => { setSelectedOrderForCancel(null); setReturnSupplies(false) }}>
          <div className="w-full max-w-md rounded-3xl bg-surface border border-line p-6 shadow-2xl relative text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/20 text-danger ring-8 ring-danger/10 mb-3">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black text-ink">
              Cancelar Pedido #{selectedOrderForCancel.id}?
            </h3>
            <p className="text-xs text-soft mt-1">
              Esta ação cancelará a comanda #{selectedOrderForCancel.numero_comanda} ({selectedOrderForCancel.numero_mesa}).
            </p>

            <div className="mt-4 text-left">
              <label htmlFor="f-appgestaopage-1" className="text-xs font-bold   text-soft mb-1 block">
                Motivo do cancelamento:
              </label>
              <input id="f-appgestaopage-1"
                type="text"
                placeholder="Ex: Cliente desistiu, erro na digitação..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl bg-canvas border border-line text-ink placeholder:text-faint focus:outline-none focus:border-danger"
              />
            </div>

            {["em_preparo", "pronto", "entregue", "retornando_base"].includes(selectedOrderForCancel.status) && (
              <label className="mt-3 flex items-start gap-2 text-left text-xs text-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={returnSupplies}
                  onChange={(e) => setReturnSupplies(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-accent"
                />
                <span>
                  Devolver insumos ao estoque (ingredientes não utilizados). Se desmarcado, o consumo é mantido como perda.
                </span>
              </label>
            )}

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => { setSelectedOrderForCancel(null); setReturnSupplies(false) }}
                className="flex-1 h-11 rounded-2xl bg-raised hover:bg-line-strong text-ink font-bold text-xs transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={loadingAction}
                className="flex-1 h-11 rounded-2xl bg-danger hover:bg-danger text-white font-black text-xs transition-colors "
              >
                {loadingAction ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Close Shift Modal */}
      {isCloseShiftOpen && (
        <Dialog label="Encerrar expediente" onClose={() => setIsCloseShiftOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-surface border border-line p-6 shadow-2xl relative text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warn/20 text-warn ring-8 ring-warn/10 mb-3">
              <Archive className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black text-ink">
              Encerrar Expediente do Balcão?
            </h3>
            <p className="text-xs text-soft mt-1">
              Todos os pedidos finalizados e cancelados serão arquivados, limpando a tela para o próximo turno.
            </p>

            <div className="p-3.5 my-4 rounded-2xl bg-canvas border border-line text-left text-xs space-y-1">
              <div className="flex justify-between text-soft">
                <span>Faturamento a ser fechado:</span>
                <span className="font-bold text-accent">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(todayRevenue)}
                </span>
              </div>
              <div className="flex justify-between text-soft">
                <span>Pedidos a serem arquivados:</span>
                <span className="font-bold text-ink">
                  {allOrders.filter((o) => ["finalizado", "cancelado"].includes(o.status)).length} pedidos
                </span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => setIsCloseShiftOpen(false)}
                className="flex-1 h-11 rounded-2xl bg-raised hover:bg-line-strong text-ink font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseShift}
                disabled={loadingAction}
                className="flex-1 h-11 rounded-2xl bg-danger hover:bg-danger text-white font-black text-xs transition-colors "
              >
                {loadingAction ? "Arquivando..." : "Sim, Encerrar"}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal Atribuir Entregador (Issues #75 e #78) */}
      {selectedOrderForAssign && (
        <Dialog label={`Atribuir entregador ao pedido ${selectedOrderForAssign.id}`} onClose={() => setSelectedOrderForAssign(null)}>
          <div className="w-full max-w-md rounded-3xl bg-surface border border-line p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Bike className="h-5 w-5 text-accent" />
                <h3 className="text-base font-bold text-ink">
                  Despachar Pedido #{selectedOrderForAssign.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrderForAssign(null)}
                className="rounded-lg p-1 text-muted hover:text-soft"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-soft mb-3">
              Selecione um entregador próprio disponível (online e dentro do limite simultâneo):
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(!Array.isArray(entregadoresDisp) || entregadoresDisp.length === 0) ? (
                <div className="p-4 text-center text-xs text-muted border border-dashed border-line rounded-2xl">
                  Nenhum entregador cadastrado no sistema.
                </div>
              ) : (
                entregadoresDisp.map((ent: any) => (
                  <div
                    key={ent.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                      ent.disponivel_para_atribuir
                        ? "border-line bg-canvas/60 hover:border-accent/50"
                        : "border-line-strong bg-canvas/20 opacity-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{ent.nome}</span>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            ent.is_online ? "bg-success" : "bg-line-strong"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-soft">
                        {ent.is_online ? "Online" : "Offline / Em Pausa"} • {ent.entregas_ativas}/{ent.limite_maximo} ativas
                      </p>
                    </div>

                    <button
                      disabled={!ent.disponivel_para_atribuir || loadingAction}
                      onClick={async () => {
                        setLoadingAction(true);
                        try {
                          await api.post(`/orders/${selectedOrderForAssign.id}/atribuir-entregador/`, {
                            entregador_id: ent.id,
                          });
                          await mutate("/orders/");
                          await mutateEntregadores();
                          setSelectedOrderForAssign(null);
                          showFeedback(`Pedido atribuído ao entregador ${ent.nome} com sucesso!`);
                        } catch (err: any) {
                          notify(apiErrorMessage(err, "Erro ao atribuir entregador."));
                        } finally {
                          setLoadingAction(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-accent text-accent-ink font-bold text-xs hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed "
                    >
                      {loadingAction ? "Atribuindo..." : "Selecionar"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedOrderForAssign(null)}
                className="px-4 py-2 rounded-xl border border-line text-soft text-xs font-semibold hover:bg-raised"
              >
                Fechar
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
