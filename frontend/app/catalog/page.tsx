"use client"

import { notify, askConfirm } from "@/components/ui/feedback";
import { useState } from "react"
import useSWR, { mutate } from "swr"
import api, { fetcher, mediaUrl } from "../../services/api"
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
import { Plus, Search, Edit2, Trash2, RefreshCw, AlertCircle, UtensilsCrossed, Tags, ImageIcon } from "lucide-react"
import { PageHeader, StatusTag } from "../../components/ui/blocks"
import { ProductForm } from "./components/ProductForm"
import { CategoryModal } from "./components/CategoryModal"

interface Produto {
  id: number
  nome: string
  descricao: string
  preco: number | string
  categoria: number
  categoria_nome?: string
  disponibilidade: boolean
  imagem_url?: string | null
}

export default function Catalog() {
  const [showForm, setShowForm] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [productToEdit, setProductToEdit] = useState<Produto | null>(null)
  const [search, setSearch] = useState("")

  const { data: produtos, error, isLoading, isValidating } = useSWR<Produto[]>(
    "/catalog/produtos/",
    fetcher
  )

  const handleDelete = async (id: number, nome: string) => {
    if (!(await askConfirm(`Tem certeza que deseja remover o produto "${nome}"?`))) {
      return
    }

    try {
      await api.delete(`/catalog/produtos/${id}/`)
      mutate("/catalog/produtos/")
    } catch (err: any) {
      notify("Erro ao excluir produto. Ele pode estar vinculado a pedidos ou receitas.")
    }
  }

  const filteredProducts = Array.isArray(produtos)
    ? produtos.filter(
        (p) =>
          p.nome.toLowerCase().includes(search.toLowerCase()) ||
          (p.categoria_nome &&
            p.categoria_nome.toLowerCase().includes(search.toLowerCase()))
      )
    : []

  return (
    <div className="flex flex-col space-y-6 p-6 bg-canvas text-ink min-h-full">
      <PageHeader
        title="Cardápio"
        description="Produtos, categorias, preços e fotos que aparecem para o cliente e no PDV."
        actions={
          <>
            <button
              type="button"
              onClick={() => mutate("/catalog/produtos/")}
              title="Atualizar cardápio"
              aria-label="Atualizar cardápio"
              disabled={isValidating}
              className={buttonClass("outline", "icon")}
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin text-accent" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className={buttonClass("outline")}
            >
              <Tags className="h-4 w-4" />
              Nova categoria
            </button>
            <button
              type="button"
              onClick={() => {
                setProductToEdit(null)
                setShowForm(true)
              }}
              className={buttonClass("primary")}
            >
              <Plus className="h-4 w-4" />
              Novo produto
            </button>
          </>
        }
      />

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
          <Input
            placeholder="Buscar por nome ou categoria"
            aria-label="Buscar por nome ou categoria"
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
            <p className="font-semibold text-xs">Falha na conexão com a API do Django.</p>
            <p className="text-xs text-danger/80">Verifique se o backend está rodando em http://localhost:8000</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Disponibilidade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted">
                  <div className="flex items-center justify-center space-x-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-accent" />
                    <span className="text-xs">Carregando catálogo de produtos...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted text-xs">
                  Nenhum produto cadastrado ou encontrado com o filtro atual.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-semibold text-ink">
                    <div className="flex items-center gap-3">
                      {mediaUrl(product.imagem_url) ? (
                        <img
                          src={mediaUrl(product.imagem_url)!}
                          alt={product.nome}
                          className="h-11 w-11 shrink-0 rounded-xl object-cover border border-line"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-raised text-muted border border-line">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <div>{product.nome}</div>
                        {product.descricao && (
                          <div className="text-xs text-muted font-normal">{product.descricao}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-soft">{product.categoria_nome || `Categoria #${product.categoria}`}</span>
                  </TableCell>
                  <TableCell className="font-display text-2xl text-ink">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(product.preco))}
                  </TableCell>
                  <TableCell>
                    <StatusTag tone={product.disponibilidade ? "success" : "danger"}>
                      {product.disponibilidade ? "Disponível" : "Indisponível"}
                    </StatusTag>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-soft hover:text-accent hover:bg-accent/10"
                      onClick={() => {
                        setProductToEdit(product)
                        setShowForm(true)
                      }}
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-soft hover:text-danger hover:bg-danger/10"
                      onClick={() => handleDelete(product.id, product.nome)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showForm && (
        <ProductForm
          productToEdit={productToEdit}
          onClose={() => {
            setShowForm(false)
            setProductToEdit(null)
          }}
        />
      )}

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />
    </div>
  )
}
