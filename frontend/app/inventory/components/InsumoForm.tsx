"use client"

import { useState } from "react"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import { mutate } from "swr"
import api from "@/services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface InsumoFormProps {
  onClose: () => void
  insumoToEdit?: {
    id: number
    nome: string
    unidade_medida: string
    quantidade_atual: number | string
    estoque_minimo: number | string
  } | null
}

export function InsumoForm({ onClose, insumoToEdit }: InsumoFormProps) {
  const [nome, setNome] = useState(insumoToEdit?.nome || "")
  const [unidadeMedida, setUnidadeMedida] = useState(insumoToEdit?.unidade_medida?.toUpperCase() || "KG")
  const [quantidadeAtual, setQuantidadeAtual] = useState(
    insumoToEdit?.quantidade_atual !== undefined ? String(insumoToEdit.quantidade_atual) : "0"
  )
  const [estoqueMinimo, setEstoqueMinimo] = useState(
    insumoToEdit?.estoque_minimo !== undefined ? String(insumoToEdit.estoque_minimo) : "5"
  )
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setLoading(true)

    try {
      const payload = {
        nome: nome.trim(),
        unidade_medida: unidadeMedida.toUpperCase(),
        quantidade_atual: parseFloat(quantidadeAtual) || 0,
        estoque_minimo: parseFloat(estoqueMinimo) || 0,
      }

      if (insumoToEdit?.id) {
        await api.put(`/inventory/insumos/${insumoToEdit.id}/`, payload)
      } else {
        await api.post("/inventory/insumos/", payload)
      }

      mutate("/inventory/insumos/")
      onClose()
    } catch (err: any) {
      console.error("Erro ao salvar insumo:", err)
      const message = apiErrorMessage(err, "Não foi possível salvar o insumo. Confira os valores.")
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog label={insumoToEdit ? "Editar insumo" : "Novo insumo"} onClose={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-surface border border-line p-6 shadow-2xl   duration-200">
        <h2 className="text-3xl text-ink">
          {insumoToEdit ? "Editar insumo" : "Novo Insumo / Matéria-Prima"}
        </h2>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-danger/10 p-3 text-xs text-danger border border-danger/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="f-appinventorycomponentsInsumoForm-2" className="mb-1.5 block text-sm font-semibold text-ink">
              Nome do Insumo
            </label>
            <Input id="f-appinventorycomponentsInsumoForm-2"
              required
              placeholder="Ex: Queijo Mussarela Fatiado"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="f-appinventorycomponentsInsumoForm-1" className="mb-1.5 block text-sm font-semibold text-ink">
                Unidade de Medida
              </label>
              <select id="f-appinventorycomponentsInsumoForm-1"
                className="flex h-10 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink  focus-visible:outline-none focus-visible:border-accent"
                value={unidadeMedida}
                onChange={(e) => setUnidadeMedida(e.target.value.toUpperCase())}
              >
                <option value="KG">Quilograma (KG)</option>
                <option value="G">Grama (G)</option>
                <option value="L">Litro (L)</option>
                <option value="ML">Mililitro (ML)</option>
                <option value="UN">Unidade (UN)</option>
              </select>
            </div>

            <div>
              <label htmlFor="f-appinventorycomponentsInsumoForm-3" className="mb-1.5 block text-sm font-semibold text-ink">
                Estoque Mínimo Ideal
              </label>
              <Input id="f-appinventorycomponentsInsumoForm-3"
                required
                type="number"
                step="0.01"
                min="0"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="f-appinventorycomponentsInsumoForm-4" className="mb-1.5 block text-sm font-semibold text-ink">
              Quantidade Inicial em Estoque
            </label>
            <Input id="f-appinventorycomponentsInsumoForm-4"
              required
              type="number"
              step="0.01"
              min="0"
              value={quantidadeAtual}
              onChange={(e) => setQuantidadeAtual(e.target.value)}
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
              {loading ? "Salvando..." : insumoToEdit ? "Salvar alterações" : "Cadastrar insumo"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  )
}
