"use client"

import { useEffect, useMemo, useState } from "react"
import { apiErrorMessage } from "@/lib/errors"
import { Dialog } from "@/components/ui/dialog"
import useSWR, { mutate } from "swr"
import api, { fetcher, mediaUrl } from "../../services/api"
import { Button, buttonClass } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  QrCode, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronUp,
} from "lucide-react"

interface Produto {
  id: number
  nome: string
  descricao?: string
  preco: number | string
  categoria_nome?: string
  disponibilidade: boolean
  imagem_url?: string | null
}

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
}

export default function OrdersPOS() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "cartao_debito" | "cartao_credito" | "pix">("dinheiro")
  const [tipoAtendimento, setTipoAtendimento] = useState<"mesa" | "balcao" | "delivery" | "retirada">("mesa")
  const [numeroMesa, setNumeroMesa] = useState("")
  const [valorRecebido, setValorRecebido] = useState<string>("")
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [successOrder, setSuccessOrder] = useState<any | null>(null)
  // Abaixo de 1024px (tablet em pé, celular) a comanda abre por cima dos produtos
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    if (!cartOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [cartOpen])
  const [errorMessage, setErrorMessage] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)

  // Delivery address state
  const [cep, setCep] = useState("")
  const [logradouro, setLogradouro] = useState("")
  const [numero, setNumero] = useState("")
  const [complemento, setComplemento] = useState("")
  const [bairro, setBairro] = useState("")
  const [cidade, setCidade] = useState("")
  const [uf, setUf] = useState("")
  const [loadingCep, setLoadingCep] = useState(false)

  const handleBuscarCep = async (cepInput: string) => {
    const raw = cepInput.replace(/\D/g, "")
    setCep(cepInput)
    if (raw.length === 8) {
      setLoadingCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setLogradouro(data.logradouro || "")
          setBairro(data.bairro || "")
          setCidade(data.localidade || "")
          setUf(data.uf || "")
        }
      } catch (err) {
        console.warn("Falha ao consultar ViaCEP:", err)
      } finally {
        setLoadingCep(false)
      }
    }
  }

  const { data: produtos, error, isLoading, isValidating } = useSWR<Produto[]>(
    "/catalog/produtos/",
    fetcher
  )

  const availableProducts = (Array.isArray(produtos) ? produtos : []).filter((p) => p.disponibilidade)

  const categorias = useMemo(
    () => Array.from(new Set(availableProducts.map((p) => p.categoria_nome).filter(Boolean))) as string[],
    [availableProducts]
  )

  const filteredProducts = availableProducts.filter(
    (p) =>
      (!categoriaFiltro || p.categoria_nome === categoriaFiltro) &&
      (p.nome.toLowerCase().includes(search.toLowerCase()) ||
        (p.categoria_nome && p.categoria_nome.toLowerCase().includes(search.toLowerCase())))
  )

  const addToCart = (product: Produto) => {
    const priceNum = Number(product.preco)
    // Atualização funcional: toques rápidos em sequência não perdem itens
    setCart((prev) =>
      prev.some((item) => item.id === product.id)
        ? prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...prev, { id: product.id, name: product.nome, price: priceNum, quantity: 1 }]
    )
  }

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    )
  }

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
  const qtyInCart = (id: number) => cart.find((i) => i.id === id)?.quantity ?? 0

  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const numValorRecebido = parseFloat(valorRecebido.replace(",", ".")) || 0
  const trocoCalculado = paymentMethod === "dinheiro" ? Math.max(0, numValorRecebido - total) : 0

  const resetAfterOrder = () => {
    setSuccessOrder(null)
    setNumeroMesa("")
    setCep("")
    setLogradouro("")
    setNumero("")
    setComplemento("")
    setBairro("")
    setCidade("")
    setUf("")
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return

    if (tipoAtendimento === "mesa" && !numeroMesa.trim()) {
      setErrorMessage("Por favor, informe o número da mesa para continuar.")
      return
    }

    if (tipoAtendimento === "delivery") {
      if (!cep.trim() || !logradouro.trim() || !numero.trim() || !bairro.trim() || !cidade.trim() || !uf.trim()) {
        setErrorMessage("Por favor, preencha os campos obrigatórios do endereço de entrega.")
        return
      }
    }

    if (paymentMethod === "dinheiro" && valorRecebido && numValorRecebido < total) {
      setErrorMessage(`Valor recebido (${brl(numValorRecebido)}) é menor que o total (${brl(total)}).`)
      return
    }

    setLoadingCheckout(true)
    setErrorMessage("")

    try {
      const payload: any = {
        status: "criado",
        tipo_atendimento: tipoAtendimento,
        numero_mesa: tipoAtendimento === "mesa" ? numeroMesa.trim() : (tipoAtendimento === "balcao" ? "Balcão" : tipoAtendimento.charAt(0).toUpperCase() + tipoAtendimento.slice(1)),
        payment_method: paymentMethod,
        valor_recebido: paymentMethod === "dinheiro" ? (numValorRecebido || total) : total,
        troco: paymentMethod === "dinheiro" ? trocoCalculado : 0,
        itens: cart.map((item) => ({
          produto: item.id,
          quantidade: item.quantity,
        })),
      }

      if (tipoAtendimento === "delivery") {
        payload.endereco = {
          cep,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          uf,
        }
      }

      const res = await api.post("/orders/", payload)
      const pedidoCriado = res.data

      try {
        const confirmRes = await api.patch(`/orders/${pedidoCriado.id}/`, {
          status: "confirmado",
        })
        setSuccessOrder(confirmRes.data || pedidoCriado)
      } catch (confirmErr: any) {
        console.warn("Pedido criado:", confirmErr)
        setSuccessOrder(pedidoCriado)
      }

      mutate("/inventory/insumos/")
      mutate("/catalog/produtos/")
      setCart([])
      setCartOpen(false)
      setValorRecebido("")
    } catch (err: any) {
      console.error("Erro ao finalizar pedido:", err)
      setErrorMessage(apiErrorMessage(err, "Não foi possível enviar o pedido. Confira os itens e tente de novo."))
    } finally {
      setLoadingCheckout(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 bg-canvas p-6 text-ink lg:flex-row">
      {/* Cardápio */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-20 lg:pb-0" aria-label="Cardápio">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-line pb-4">
          <div>
            <h1 className="text-5xl text-ink">Novo pedido</h1>
            <p className="mt-1 text-sm text-muted">Toque no produto para adicionar à comanda.</p>
          </div>
          <button
            type="button"
            onClick={() => mutate("/catalog/produtos/")}
            disabled={isValidating}
            title="Atualizar cardápio"
            aria-label="Atualizar cardápio"
            className={buttonClass("outline", "icon")}
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin text-accent" : ""}`} />
          </button>
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted" aria-hidden />
            <Input
              placeholder="Buscar produto ou categoria"
              aria-label="Buscar produto ou categoria"
              className="h-10 pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {categorias.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoria">
              {[null, ...categorias].map((c) => (
                <button
                  key={c ?? "todas"}
                  type="button"
                  onClick={() => setCategoriaFiltro(c)}
                  aria-pressed={categoriaFiltro === c}
                  className={`h-10 rounded-lg border px-3.5 text-sm font-semibold ${
                    categoriaFiltro === c
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line-strong text-soft hover:bg-raised hover:text-ink"
                  }`}
                >
                  {c ?? "Todos"}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="mt-4 flex items-center gap-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            <AlertCircle className="h-5 w-5 shrink-0" />
            Não foi possível carregar o cardápio. Confira a conexão com o servidor.
          </div>
        )}

        <div className="mt-4 flex-1 overflow-y-auto pb-6 pr-1">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center gap-2 text-muted">
              <RefreshCw className="h-5 w-5 animate-spin text-accent" />
              Carregando cardápio...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="border border-dashed border-line p-10 text-center text-muted">
              <p className="font-semibold text-soft">Nenhum produto encontrado.</p>
              <p className="mt-1 text-sm">Cadastre ou ative produtos em Cardápio / Catálogo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const img = mediaUrl(product.imagem_url)
                const qty = qtyInCart(product.id)
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    aria-label={`Adicionar ${product.nome}, ${brl(Number(product.preco))}`}
                    className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-left transition-[transform,border-color] duration-150 ease-out hover:border-accent active:scale-[0.98]"
                  >
                    <span className="relative block aspect-[4/3] w-full bg-raised">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display flex h-full w-full items-center justify-center text-7xl text-line-strong" aria-hidden>
                          {product.nome.charAt(0)}
                        </span>
                      )}
                      <span className="font-display absolute bottom-0 left-0 bg-accent px-3 py-1.5 text-3xl text-accent-ink">
                        {brl(Number(product.preco))}
                      </span>
                      {qty > 0 && (
                        <span className="font-display absolute right-2 top-2 flex h-9 min-w-9 items-center justify-center rounded-md bg-canvas px-2 text-2xl text-accent ring-2 ring-accent">
                          {qty}
                        </span>
                      )}
                    </span>
                    <span className="block p-3">
                      <span className="line-clamp-2 block text-base font-semibold leading-snug text-ink">{product.nome}</span>
                      {product.categoria_nome && <span className="mt-0.5 block text-xs text-muted">{product.categoria_nome}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Comanda */}
      <aside
        className={`${
          cartOpen ? "fixed inset-0 z-40 flex bg-canvas p-4" : "hidden"
        } h-full w-full shrink-0 flex-col overflow-hidden border-line lg:static lg:z-auto lg:flex lg:w-[400px] lg:border-l lg:bg-transparent lg:p-0 lg:pl-6`}
        style={cartOpen ? { paddingBottom: "max(1rem, env(safe-area-inset-bottom))" } : undefined}
        aria-label="Comanda atual"
      >
        <button
          type="button"
          onClick={() => setCartOpen(false)}
          className="mb-3 inline-flex h-11 items-center gap-2 self-start rounded-lg border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-raised lg:hidden"
        >
          <X className="h-4 w-4" />
          Voltar aos produtos
        </button>
        <h2 className="flex items-baseline justify-between border-b-2 border-ink pb-2 text-3xl text-ink">
          Comanda
          <span className="text-base font-semibold text-muted">{itemCount} {itemCount === 1 ? "item" : "itens"}</span>
        </h2>

        <div className="flex-1 overflow-y-auto py-4 pr-1">
          <div className="ticket px-4 pb-4 pt-6">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-paper-muted">A comanda está vazia.<br />Toque em um produto para começar.</p>
            ) : (
              <ul className="divide-y divide-dashed divide-paper-line">
                {cart.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-tight">{item.name}</p>
                      <p className="text-xs text-paper-muted">{brl(item.price)} cada</p>
                    </div>
                    <div className="flex items-center rounded border border-paper-line">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        aria-label={`Diminuir ${item.name}`}
                        className="flex h-9 w-9 items-center justify-center text-paper-ink hover:bg-paper-line/40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-display w-7 text-center text-2xl">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        aria-label={`Aumentar ${item.name}`}
                        className="flex h-9 w-9 items-center justify-center text-paper-ink hover:bg-paper-line/40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="font-display w-20 text-right text-2xl">{brl(item.price * item.quantity)}</p>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Remover ${item.name}`}
                      className="p-1 text-paper-muted hover:text-paper-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-baseline justify-between border-t-2 border-dashed border-paper-line pt-3">
              <span className="text-lg font-bold">Total</span>
              <span className="font-display text-5xl">{brl(total)}</span>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {errorMessage && (
              <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
                {errorMessage}
              </p>
            )}

            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-soft">Atendimento</legend>
              <Segmented
                value={tipoAtendimento}
                onChange={(v) => {
                  setTipoAtendimento(v)
                  if (v !== "mesa") setNumeroMesa("")
                }}
                options={[
                  { value: "mesa", label: "Mesa" },
                  { value: "balcao", label: "Balcão" },
                  { value: "delivery", label: "Delivery" },
                  { value: "retirada", label: "Retirada" },
                ]}
              />

              {tipoAtendimento === "mesa" && (
                <Input
                  required
                  aria-label="Número da mesa"
                  placeholder="Número da mesa (ex.: 04)"
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  className="mt-2"
                />
              )}

              {tipoAtendimento === "delivery" && (
                <div className="mt-3 space-y-2 border-l border-line-strong pl-3">
                  <p className="flex items-center justify-between text-sm font-semibold text-ink">
                    Endereço de entrega
                    {loadingCep && (
                      <span className="flex items-center gap-1 text-xs font-normal text-muted">
                        <RefreshCw className="h-3 w-3 animate-spin text-accent" /> Buscando CEP
                      </span>
                    )}
                  </p>
                  <Input aria-label="CEP" placeholder="CEP (ex.: 13083-852)" value={cep} onChange={(e) => handleBuscarCep(e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <Input aria-label="Rua" className="col-span-2" placeholder="Rua / logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
                    <Input aria-label="Número" placeholder="Nº" value={numero} onChange={(e) => setNumero(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input aria-label="Complemento" placeholder="Complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                    <Input aria-label="Bairro" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input aria-label="Cidade" className="col-span-2" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                    <Input aria-label="UF" placeholder="UF" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-soft">Pagamento</legend>
              <Segmented
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
                  { value: "pix", label: "Pix", icon: QrCode },
                  { value: "cartao_debito", label: "Débito", icon: CreditCard },
                  { value: "cartao_credito", label: "Crédito", icon: CreditCard },
                ]}
              />

              {paymentMethod === "dinheiro" && (
                <div className="mt-3 space-y-2 border-l border-line-strong pl-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="valor-recebido" className="text-sm font-semibold text-ink">
                      Valor recebido
                    </label>
                    <button type="button" onClick={() => setValorRecebido(total.toFixed(2))} className="text-sm font-semibold text-accent hover:underline">
                      Valor exato
                    </button>
                  </div>
                  <Input
                    id="valor-recebido"
                    type="number"
                    step="0.50"
                    min="0"
                    placeholder={`Total: ${brl(total)}`}
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    className="font-bold"
                  />
                  <p className="flex items-baseline justify-between text-sm">
                    <span className="text-muted">Troco</span>
                    <span
                      className={`font-display text-3xl ${
                        numValorRecebido > 0 && numValorRecebido < total ? "text-danger" : "text-success"
                      }`}
                    >
                      {numValorRecebido > 0 && numValorRecebido < total ? "Insuficiente" : brl(trocoCalculado)}
                    </span>
                  </p>
                </div>
              )}
            </fieldset>
          </div>
        </div>

        <button
          type="button"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-accent text-lg font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-40"
          disabled={cart.length === 0 || loadingCheckout}
          onClick={handleCheckout}
        >
          {loadingCheckout ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              Enviando pedido...
            </>
          ) : (
            <>
              <ShoppingCart className="h-5 w-5" />
              Finalizar pedido
            </>
          )}
        </button>
      </aside>

      {/* Barra da comanda (abaixo de 1024px): resume e abre a comanda */}
      {!cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 z-30 flex h-14 items-center justify-between rounded-lg bg-accent px-5 text-accent-ink hover:bg-accent-hover lg:hidden"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <span className="flex items-center gap-2 text-base font-bold">
            <ChevronUp className="h-5 w-5" />
            Comanda · {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
          <span className="font-display text-3xl">{brl(total)}</span>
        </button>
      )}

      {/* Pedido enviado: confirmação em forma de comanda */}
      {successOrder && (
        <Dialog label="Pedido enviado" onClose={resetAfterOrder}>
          <div className="w-full max-w-sm">
            <div className="ticket px-6 pb-6 pt-8 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-paper-ink" aria-hidden />
              <h3 className="mt-2 text-3xl">Pedido enviado</h3>
              <p className="font-display mt-3 text-[5rem]">{successOrder.numero_comanda || "0000"}</p>
              <p className="text-lg font-bold">{successOrder.numero_mesa || "Balcão"}</p>
              <p className="text-sm text-paper-muted">Pedido {successOrder.id}</p>

              {successOrder.endereco && (
                <div className="mt-4 border-l border-paper-line pl-3 text-left text-sm">
                  <p className="font-bold">
                    {successOrder.endereco.logradouro}, {successOrder.endereco.numero}
                    {successOrder.endereco.complemento ? ` - ${successOrder.endereco.complemento}` : ""}
                  </p>
                  <p className="text-paper-muted">
                    {successOrder.endereco.bairro}, {successOrder.endereco.cidade}/{successOrder.endereco.uf} · CEP {successOrder.endereco.cep}
                  </p>
                </div>
              )}

              <dl className="mt-4 space-y-1.5 border-t-2 border-dashed border-paper-line pt-4 text-left text-base">
                <div className="flex justify-between">
                  <dt>Total</dt>
                  <dd className="font-display text-3xl">{brl(Number(successOrder.total || total))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-paper-muted">Pagamento</dt>
                  <dd className="font-semibold capitalize">{successOrder.payment_method?.replace("_", " ") || paymentMethod}</dd>
                </div>
                {successOrder.payment_method === "dinheiro" && Number(successOrder.troco) > 0 && (
                  <div className="flex justify-between font-bold">
                    <dt>Troco a devolver</dt>
                    <dd>{brl(Number(successOrder.troco))}</dd>
                  </div>
                )}
              </dl>

              <button
                type="button"
                className="mt-6 h-12 w-full rounded-md bg-paper-ink text-base font-bold text-paper hover:opacity-90"
                onClick={resetAfterOrder}
              >
                Novo pedido
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[]
}) {
  return (
    <div
      role="radiogroup"
      className="grid gap-px overflow-hidden rounded-lg border border-line-strong bg-line-strong"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex h-11 items-center justify-center gap-1.5 text-sm font-semibold ${
            value === v ? "bg-accent text-accent-ink" : "bg-canvas text-soft hover:bg-raised hover:text-ink"
          }`}
        >
          {Icon && <Icon className="h-4 w-4" />}
          {label}
        </button>
      ))}
    </div>
  )
}
