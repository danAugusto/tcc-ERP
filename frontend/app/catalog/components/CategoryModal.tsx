"use client"

import { useState } from "react"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import { mutate } from "swr"
import api from "../../../services/api"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Tags, Plus, X } from "lucide-react"

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (newCategory: { id: number; nome: string }) => void
}

export function CategoryModal({ isOpen, onClose, onCreated }: CategoryModalProps) {
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    setLoading(true)
    setErrorMsg("")

    try {
      const res = await api.post("/catalog/categorias/", {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        status: true,
      })

      mutate("/catalog/categorias/")
      if (onCreated) {
        onCreated(res.data)
      }
      setNome("")
      setDescricao("")
      onClose()
    } catch (err: any) {
      console.error("Erro ao criar categoria:", err)
      setErrorMsg(apiErrorMessage(err, "Não foi possível criar a categoria. O nome pode já estar em uso."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog label="Nova categoria" onClose={onClose} zIndex={60}>
      <div className="w-full max-w-md rounded-3xl bg-surface border border-line p-6 shadow-2xl   duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-ink font-bold text-lg">
            <span className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Tags className="h-5 w-5" />
            </span>
            <span>Novo Tipo / Categoria</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 rounded-lg text-soft hover:text-ink hover:bg-raised transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-danger/10 p-3 text-xs text-danger border border-danger/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="f-appcatalogcomponentsCategoryModal-1" className="mb-1.5 block text-sm font-semibold text-ink">
              Nome do Tipo / Categoria <span className="text-danger">*</span>
            </label>
            <Input id="f-appcatalogcomponentsCategoryModal-1"
              required
              autoFocus
              placeholder="Ex: Pasteis, Lanches Especiais, Sucos..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-canvas border-line"
            />
          </div>

          <div>
            <label htmlFor="f-appcatalogcomponentsCategoryModal-2" className="mb-1.5 block text-sm font-semibold text-ink">
              Descrição (Opcional)
            </label>
            <Input id="f-appcatalogcomponentsCategoryModal-2"
              placeholder="Ex: Fritos na hora com massa crocante..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="bg-canvas border-line"
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
            <Button type="submit" disabled={loading || !nome.trim()}>
              <Plus className="h-4 w-4 mr-1.5" />
              {loading ? "Cadastrando..." : "Cadastrar categoria"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  )
}
