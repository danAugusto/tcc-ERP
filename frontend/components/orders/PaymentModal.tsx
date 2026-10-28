"use client"

import React, { useState } from "react"
import { brl } from "@/lib/format"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import {
  X,
  Banknote,
  QrCode,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Receipt,
  Calculator,
  Printer,
} from "lucide-react"
import { api } from "@/services/api"
import { ReceiptPrintModal } from "./ReceiptPrintModal"

interface PaymentModalProps {
  order: {
    id: number
    numero_comanda?: string
    numero_mesa?: string
    tipo_atendimento?: string
    total: number | string
    payment_method?: string
    itens?: Array<{
      produto_nome?: string
      quantidade: number
      preco_unitario: string | number
      subtotal?: string | number
    }>
  }
  onClose: () => void
  onSuccess: (updatedOrder: any) => void
}

export function PaymentModal({ order, onClose, onSuccess }: PaymentModalProps) {
  const orderTotal = Number(order.total) || 0
  const [paymentMethod, setPaymentMethod] = useState<string>(
    order.payment_method && order.payment_method !== "outros"
      ? order.payment_method
      : "dinheiro"
  )
  const [valorRecebido, setValorRecebido] = useState<string>(
    orderTotal.toFixed(2)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successData, setSuccessData] = useState<any>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  const numValorRecebido = parseFloat(valorRecebido.replace(",", ".")) || 0
  const troco = paymentMethod === "dinheiro" ? Math.max(0, numValorRecebido - orderTotal) : 0
  const valorInsuficiente = paymentMethod === "dinheiro" && numValorRecebido < orderTotal

  const handlePreset = (valor: number) => {
    setValorRecebido(valor.toFixed(2))
  }

  const handleConfirmPayment = async () => {
    if (valorInsuficiente) {
      setError(`Valor recebido é inferior ao total de ${brl(orderTotal)}`)
      return
    }

    setLoading(true)
    setError("")

    try {
      const payload = {
        payment_method: paymentMethod,
        valor_recebido: paymentMethod === "dinheiro" ? numValorRecebido : orderTotal,
        troco: paymentMethod === "dinheiro" ? troco : 0,
      }

      const res = await api.post(`/orders/${order.id}/pay/`, payload)
      setSuccessData(res.data)
      onSuccess(res.data)
    } catch (err: any) {
      console.error("Erro ao registrar pagamento:", err)
      setError(apiErrorMessage(err, "Não foi possível registrar o pagamento. Tente de novo."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog label="Fechar conta" onClose={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-surface border border-line p-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/80 pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div>
              <h2 className="text-3xl text-ink">Fechar conta</h2>
              <p className="text-sm text-muted">
                Pedido {order.id} · comanda {order.numero_comanda || "sem número"} · {order.numero_mesa || "Balcão"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-2 text-soft hover:bg-raised hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3.5 flex items-center space-x-2.5 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successData ? (
          <div className="py-6 text-center space-y-4   duration-200">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
            <div>
              <h3 className="text-4xl text-ink">Pagamento registrado</h3>
              <p className="mt-1 text-sm text-muted">O pedido foi finalizado e a receita entrou no caixa.</p>
            </div>

            <div className="space-y-2 border-y border-dashed border-line-strong py-4 text-left text-base">
              <div className="flex justify-between text-soft">
                <span>Total Pago:</span>
                <span className="font-bold text-ink">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(orderTotal)}
                </span>
              </div>
              <div className="flex justify-between text-soft">
                <span>Forma de Pagamento:</span>
                <span className="font-semibold capitalize text-accent">
                  {successData.payment_method?.replace("_", " ")}
                </span>
              </div>
              {successData.payment_method === "dinheiro" && (
                <>
                  <div className="flex justify-between text-soft">
                    <span>Valor Recebido:</span>
                    <span className="text-ink">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(Number(successData.valor_recebido || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-success font-bold border-t border-line/80 pt-2">
                    <span>Troco Entregue:</span>
                    <span>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(Number(successData.troco || 0))}
                    </span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowReceipt(true)}
              className="w-full h-12 rounded-lg border border-line-strong text-ink font-semibold text-base hover:bg-raised flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Cupom do Cliente
            </button>

            <button
              onClick={onClose}
              className="w-full h-12 rounded-lg bg-accent text-accent-ink font-bold text-base hover:bg-accent-hover"
            >
              Concluir e Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Total Display */}
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
              <span className="text-lg font-bold text-ink">Total da conta</span>
              <span className="font-display text-5xl text-ink">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(orderTotal)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-ink">
                Método de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("dinheiro")}
                  className={`flex items-center justify-center p-3 rounded-lg text-xs font-bold border transition-colors ${
                    paymentMethod === "dinheiro"
                      ? "bg-accent text-accent-ink border-accent "
                      : "bg-canvas border-line text-soft hover:bg-raised/50"
                  }`}
                >
                  <Banknote className="mr-2 h-4 w-4" /> Dinheiro
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex items-center justify-center p-3 rounded-lg text-xs font-bold border transition-colors ${
                    paymentMethod === "pix"
                      ? "bg-accent text-accent-ink border-accent "
                      : "bg-canvas border-line text-soft hover:bg-raised/50"
                  }`}
                >
                  <QrCode className="mr-2 h-4 w-4" /> Pix
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("cartao_debito")}
                  className={`flex items-center justify-center p-3 rounded-lg text-xs font-bold border transition-colors ${
                    paymentMethod === "cartao_debito"
                      ? "bg-accent text-accent-ink border-accent "
                      : "bg-canvas border-line text-soft hover:bg-raised/50"
                  }`}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Cartão Débito
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("cartao_credito")}
                  className={`flex items-center justify-center p-3 rounded-lg text-xs font-bold border transition-colors ${
                    paymentMethod === "cartao_credito"
                      ? "bg-accent text-accent-ink border-accent "
                      : "bg-canvas border-line text-soft hover:bg-raised/50"
                  }`}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Cartão Crédito
                </button>
              </div>
            </div>

            {/* Dinheiro specifics: Valor Recebido & Troco */}
            {paymentMethod === "dinheiro" && (
              <div className="rounded-lg bg-canvas/70 border border-line/80 p-4 space-y-3   duration-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-soft flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-accent" />
                    Valor Recebido em Dinheiro (R$)
                  </label>
                </div>

                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                  className="w-full h-11 rounded-xl bg-surface border border-line px-3.5 text-base font-bold text-ink placeholder:text-faint focus:outline-none focus:border-accent"
                  placeholder="0,00"
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePreset(orderTotal)}
                    className="px-2.5 py-1 rounded-lg bg-raised/80 text-xs font-semibold text-soft hover:bg-line-strong transition-colors"
                  >
                    Exato ({brl(orderTotal)})
                  </button>
                  {orderTotal <= 20 && (
                    <button
                      type="button"
                      onClick={() => handlePreset(20)}
                      className="px-2.5 py-1 rounded-lg bg-raised/80 text-xs font-semibold text-soft hover:bg-line-strong transition-colors"
                    >
                      R$ 20,00
                    </button>
                  )}
                  {orderTotal <= 50 && (
                    <button
                      type="button"
                      onClick={() => handlePreset(50)}
                      className="px-2.5 py-1 rounded-lg bg-raised/80 text-xs font-semibold text-soft hover:bg-line-strong transition-colors"
                    >
                      R$ 50,00
                    </button>
                  )}
                  {orderTotal <= 100 && (
                    <button
                      type="button"
                      onClick={() => handlePreset(100)}
                      className="px-2.5 py-1 rounded-lg bg-raised/80 text-xs font-semibold text-soft hover:bg-line-strong transition-colors"
                    >
                      R$ 100,00
                    </button>
                  )}
                </div>

                {/* Troco Result */}
                <div className="flex items-center justify-between rounded-xl bg-surface border border-line/80 p-3 mt-2">
                  <span className="text-xs font-semibold text-soft">
                    Troco a Devolver:
                  </span>
                  <span
                    className={`text-base font-black ${
                      valorInsuficiente
                        ? "text-danger"
                        : troco > 0
                        ? "text-success"
                        : "text-soft"
                    }`}
                  >
                    {valorInsuficiente
                      ? "Valor Insuficiente"
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(troco)}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 h-12 rounded-lg border border-line bg-canvas font-bold text-xs text-soft hover:bg-raised hover:text-ink transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={loading || valorInsuficiente}
                className="flex-[2] h-12 rounded-lg bg-accent text-accent-ink font-black text-xs hover:bg-accent-hover active:scale-[0.98] transition-[transform,background-color,border-color,color,opacity] flex items-center justify-center space-x-2  disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirmar pagamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {showReceipt && successData && (
        <ReceiptPrintModal
          order={{ ...order, ...successData, itens: successData.itens ?? order.itens }}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </Dialog>
  )
}
