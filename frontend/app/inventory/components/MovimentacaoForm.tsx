"use client"

import { useState } from "react"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import { mutate } from "swr"
import api from "@/services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Insumo {
  id: number
  nome: string
  unidade_medida: string
  quantidade_atual: number | string
}

interface MovimentacaoFormProps {
  onClose: () => void
  insumos: Insumo[]
}

export function MovimentacaoForm({ onClose, insumos }: MovimentacaoFormProps) {
  const [insumoId, setInsumoId] = useState(insumos.length > 0 ? String(insumos[0].id) : "")
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("ENTRADA")
  const [quantidade, setQuantidade] = useState("1")
  const [motivo, setMotivo] = useState("COMPRA")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const selectedInsumo = insumos.find((i) => String(i.id) === insumoId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setLoading(true)

    try {
      await api.post("/inventory/movimentacoes/", {
        insumo: parseInt(insumoId),
        tipo,
        quantidade: parseFloat(quantidade) || 0,
        motivo,
      })

      mutate("/inventory/insumos/")
      mutate("/inventory/movimentacoes/")
      onClose()
    } catch (err: any) {
      console.error("Erro ao registrar movimentação:", err)
      const message = apiErrorMessage(err, "Não foi possível registrar a movimentação.")
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog label="Movimentar estoque" onClose={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-surface border border-line p-6 shadow-2xl   duration-200">
        <h2 className="text-3xl text-ink">Movimentar estoque</h2>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-danger/10 p-3 text-xs text-danger border border-danger/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="f-appinventorycomponentsMovimentacaoForm-1" className="mb-1.5 block text-sm font-semibold text-ink">
              Insumo
            </label>
            <select id="f-appinventorycomponentsMovimentacaoForm-1"
              className="flex h-10 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink  focus-visible:outline-none focus-visible:border-accent"
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value)}
              required
            >
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome} (Atual: {i.quantidade_atual} {i.unidade_medida})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">
              Tipo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`py-2.5 text-xs font-bold rounded-xl border transition-colors ${
                  tipo === "ENTRADA"
                    ? "bg-success/20 border-success text-success "
                    : "border-line bg-canvas text-soft hover:bg-raised"
                }`}
                onClick={() => {
                  setTipo("ENTRADA")
                  if (motivo === "BAIXA" || motivo === "PERDA") setMotivo("COMPRA")
                }}
              >
                + Entrada
              </button>
              <button
                type="button"
                className={`py-2.5 text-xs font-bold rounded-xl border transition-colors ${
                  tipo === "SAIDA"
                    ? "bg-danger/20 border-danger text-danger "
                    : "border-line bg-canvas text-soft hover:bg-raised"
                }`}
                onClick={() => {
                  setTipo("SAIDA")
                  if (motivo === "COMPRA") setMotivo("BAIXA")
                }}
              >
                - Saída
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="f-appinventorycomponentsMovimentacaoForm-2" className="mb-1.5 block text-sm font-semibold text-ink">
              Motivo da Movimentação
            </label>
            <select id="f-appinventorycomponentsMovimentacaoForm-2"
              className="flex h-10 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink  focus-visible:outline-none focus-visible:border-accent"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
            >
              {tipo === "ENTRADA" ? (
                <>
                  <option value="COMPRA">Compra / Reposição de Fornecedor</option>
                  <option value="DEVOLUCAO">Devolução</option>
                  <option value="AJUSTE">Ajuste de Balanço / Inventário</option>
                </>
              ) : (
                <>
                  <option value="BAIXA">Baixa por Consumo / Pedido</option>
                  <option value="PERDA">Perda / Descarte / Validade</option>
                  <option value="AJUSTE">Ajuste de Balanço / Inventário</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="f-appinventorycomponentsMovimentacaoForm-3" className="mb-1.5 block text-sm font-semibold text-ink">
              Quantidade ({selectedInsumo?.unidade_medida || "UN"})
            </label>
            <Input id="f-appinventorycomponentsMovimentacaoForm-3"
              required
              type="number"
              step="0.001"
              min="0.001"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-3 border-t border-line">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="border-line text-soft hover:text-ink"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Confirmar movimentação"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  )
}
