"use client"

import { notify, askConfirm } from "@/components/ui/feedback";
import { useState } from "react"
import useSWR, { mutate } from "swr"
import api, { fetcher } from "../../services/api"
import { Button, buttonClass } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../../components/ui/table"
import { Plus, Search, AlertTriangle, ArrowRightLeft, RefreshCw, AlertCircle, Edit2, Trash2, Package, Download } from "lucide-react"
import { InsumoForm } from "./components/InsumoForm"
import { MovimentacaoForm } from "./components/MovimentacaoForm"
import { Can } from "../../components/Can"
import { PageHeader, StatusTag } from "../../components/ui/blocks"
import { downloadCsv, csvDate } from "../../lib/csv"

interface Insumo {
  id: number
  nome: string
  unidade_medida: string
  quantidade_atual: number | string
  estoque_minimo: number | string
  updated_at?: string
}

export default function Inventory() {
  const [showInsumoForm, setShowInsumoForm] = useState(false)
  const [showMovForm, setShowMovForm] = useState(false)
  const [insumoToEdit, setInsumoToEdit] = useState<Insumo | null>(null)
  const [search, setSearch] = useState("")

  const { data: insumos, error, isLoading, isValidating } = useSWR<Insumo[]>(
    "/inventory/insumos/",
    fetcher
  )

  const handleDelete = async (id: number, nome: string) => {
    if (!(await askConfirm(`Deseja realmente remover o insumo "${nome}"?`))) {
      return
    }

    try {
      await api.delete(`/inventory/insumos/${id}/`)
      mutate("/inventory/insumos/")
    } catch (err: any) {
      notify("Erro ao excluir insumo. Verifique se ele está vinculado a receitas.")
    }
  }

  const filteredInsumos = Array.isArray(insumos)
    ? insumos.filter((item) =>
        item.nome.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const exportCsv = () => {
    const rows: unknown[][] = [
      ["Código", "Insumo", "Unidade", "Estoque Atual", "Estoque Mínimo", "Status (Normal / Crítico)", "Última Atualização"],
    ]
    filteredInsumos.forEach((i) => {
      const atual = Number(i.quantidade_atual)
      const min = Number(i.estoque_minimo)
      rows.push([
        i.id,
        i.nome,
        i.unidade_medida,
        atual.toFixed(3).replace(".", ","),
        min.toFixed(3).replace(".", ","),
        atual <= min ? "Crítico" : "Normal",
        csvDate(i.updated_at),
      ])
    })
    downloadCsv(`inventario-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <div className="flex flex-col space-y-6 p-6 bg-canvas text-ink min-h-full">
      <PageHeader
        title="Estoque"
        description="Acompanhe os insumos, os mínimos e as entradas e saídas."
        actions={
          <>
            <button
              type="button"
              onClick={() => mutate("/inventory/insumos/")}
              title="Atualizar estoque"
              aria-label="Atualizar estoque"
              disabled={isValidating}
              className={buttonClass("outline", "icon")}
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin text-accent" : ""}`} />
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredInsumos.length === 0}
              className={buttonClass("outline")}
            >
              <Download className="h-4 w-4" />
              Exportar inventário (CSV)
            </button>
            <Can do="EDITAR_ESTOQUE">
              <button
                type="button"
                onClick={() => setShowMovForm(true)}
                disabled={!insumos || insumos.length === 0}
                className={buttonClass("outline")}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Movimentar
              </button>
              <button
                type="button"
                onClick={() => {
                  setInsumoToEdit(null)
                  setShowInsumoForm(true)
                }}
                className={buttonClass("primary")}
              >
                <Plus className="h-4 w-4" />
                Novo insumo
              </button>
            </Can>
          </>
        }
      />

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
          <Input
            placeholder="Buscar insumo"
            aria-label="Buscar insumo"
            className="h-10 pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 flex items-center space-x-3 text-danger">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-xs">Falha na conexão com a API de Estoque.</p>
            <p className="text-xs text-danger/80">Verifique se o backend está rodando em http://localhost:8000</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead>Estoque atual</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Status da Matéria-Prima</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted">
                  <div className="flex items-center justify-center space-x-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-accent" />
                    <span className="text-xs">Carregando insumos do estoque...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredInsumos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted text-xs">
                  Nenhum insumo cadastrado no estoque ainda. Clique em "Novo insumo".
                </TableCell>
              </TableRow>
            ) : (
              filteredInsumos.map((item) => {
                const current = Number(item.quantidade_atual)
                const min = Number(item.estoque_minimo)
                const percent = min > 0 ? Math.min((current / min) * 100, 100) : 100
                
                let statusColor = "bg-success"
                let statusTone: "success" | "accent" | "danger" = "success"
                let statusText = "Normal"

                if (current <= min && current > min * 0.5) {
                  statusColor = "bg-accent"
                  statusTone = "accent"
                  statusText = "Atenção: perto do mínimo"
                } else if (current <= min * 0.5) {
                  statusColor = "bg-danger"
                  statusTone = "danger"
                  statusText = "Crítico: repor"
                }

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-semibold text-ink">{item.nome}</TableCell>
                    <TableCell>
                      <div className="flex flex-col space-y-1.5 w-full max-w-[160px]">
                        <span className="font-display text-2xl text-ink">
                          {current.toFixed(2)} <span className="text-base text-muted">{item.unidade_medida}</span>
                        </span>
                        <div className="h-1.5 w-full bg-raised">
                          <div
                            className={`h-full ${statusColor}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-soft">
                      {min.toFixed(2)} {item.unidade_medida}
                    </TableCell>
                    <TableCell>
                      <StatusTag tone={statusTone}>{statusText}</StatusTag>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Can do="EDITAR_ESTOQUE">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-soft hover:text-accent hover:bg-accent/10"
                          onClick={() => {
                            setInsumoToEdit(item)
                            setShowInsumoForm(true)
                          }}
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-soft hover:text-danger hover:bg-danger/10"
                          onClick={() => handleDelete(item.id, item.nome)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {showInsumoForm && (
        <InsumoForm
          insumoToEdit={insumoToEdit}
          onClose={() => {
            setShowInsumoForm(false)
            setInsumoToEdit(null)
          }}
        />
      )}

      {showMovForm && insumos && (
        <MovimentacaoForm
          insumos={insumos}
          onClose={() => setShowMovForm(false)}
        />
      )}
    </div>
  )
}
