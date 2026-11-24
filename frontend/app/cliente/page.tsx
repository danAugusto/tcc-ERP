"use client"

import { notify, askConfirm } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog"
import { useState } from "react"
import useSWR, { mutate } from "swr"
import api, { fetcher, mediaUrl } from "../../services/api"
import { useBranding } from "../../hooks/useBranding"
import { StatusTag } from "../../components/ui/blocks"
import { BrandMark } from "../../components/BrandMark"
import { ThemeToggle } from "../../components/ThemeToggle"
import { homeFor } from "../../lib/roles"
import { useAuth } from "../../hooks/useAuth"
import { 
  Search, 
  ShoppingBag, 
  Home, 
  Clock, 
  User, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  ArrowLeft, 
  Sparkles,
  MapPin,
  ChevronRight,
  Flame,
  Check,
  RefreshCw,
  Utensils
} from "lucide-react"

interface Produto {
  id: number
  nome: string
  descricao?: string
  preco: number | string
  categoria: number
  categoria_nome?: string
  disponibilidade: boolean
  imagem_url?: string | null
}

interface Categoria {
  id: number
  nome: string
}

export default function ConsumerApp() {
  const { isAuthenticated, login, user, logout } = useAuth()
  const { nome: brandName, data: loja } = useBranding()
  const [activeTab, setActiveTab] = useState<"home" | "orders" | "cart" | "profile">("home")
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  
  // API Fetching
  const { data: produtos, isLoading: loadingProdutos } = useSWR<Produto[]>("/catalog/produtos/", fetcher)
  const { data: categorias } = useSWR<Categoria[]>("/catalog/categorias/", fetcher)
  // Histórico de pedidos apenas se o cliente estiver logado (evita 401 para visitante anônimo)
  const { data: userOrders } = useSWR<any[]>(isAuthenticated ? "/orders/" : null, fetcher)

  // Modal de Detalhes do Produto
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null)
  const [productQty, setProductQty] = useState(1)
  const [observacao, setObservacao] = useState("")
  
  // Carrinho e Checkout
  const [cartItems, setCartItems] = useState<any[]>([])
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "delivery" | "payment" | "success">("cart")
  const [deliveryType, setDeliveryType] = useState<"entrega" | "retirada">("entrega")
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao_credito" | "cartao_debito" | "dinheiro">("pix")
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null)
  const [loadingCheckout, setLoadingCheckout] = useState(false)

  // Autenticação & Cadastro
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [loginUsername, setLoginUsername] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loadingLogin, setLoadingLogin] = useState(false)

  const [regName, setRegName] = useState("")
  const [regUsername, setRegUsername] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regError, setRegError] = useState("")
  const [loadingRegister, setLoadingRegister] = useState(false)

  const handleLoginSubmit = async () => {
    setLoadingLogin(true)
    setLoginError("")
    const res = await login(loginUsername, loginPassword)
    if (!res.success) {
      setLoginError(res.error || "Usuário ou senha incorretos.")
    } else if (res.user && res.user.role !== "cliente") {
      // Equipe/entregador que entrou pelo app público: segue para o seu próprio ambiente
      window.location.assign(homeFor(res.user.role))
      return
    }
    setLoadingLogin(false)
  }

  const handleRegisterSubmit = async () => {
    if (!regUsername || !regPassword) {
      setRegError("Preencha usuário e senha.")
      return
    }
    if (regPassword.length < 8) {
      setRegError("A senha deve ter no mínimo 8 caracteres.")
      return
    }
    setLoadingRegister(true)
    setRegError("")
    try {
      await api.post("/users/register/", {
        username: regUsername,
        password: regPassword,
        email: regEmail || `${regUsername}@cliente.local`,
        first_name: regName,
      })
      const res = await login(regUsername, regPassword)
      if (!res.success) {
        setRegError("Conta criada com sucesso! Faça login com suas credenciais.")
        setLoginUsername(regUsername)
        setAuthMode("login")
      }
    } catch (err: any) {
      const data = err.response?.data
      if (data?.username) {
        setRegError(`Usuário: ${data.username[0]}`)
      } else if (data?.password) {
        setRegError(`Senha: ${data.password[0]}`)
      } else if (data?.email) {
        setRegError(`E-mail: ${data.email[0]}`)
      } else {
        setRegError("Erro ao criar conta. Escolha outro nome de usuário.")
      }
    } finally {
      setLoadingRegister(false)
    }
  }

  // Endereço de entrega
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
        console.warn("Falha ViaCEP", err)
      } finally {
        setLoadingCep(false)
      }
    }
  }

  // Produtos disponíveis filtrados
  const availableProducts = (Array.isArray(produtos) ? produtos : []).filter((p) => p.disponibilidade)

  const filteredProducts = availableProducts.filter((p) => {
    const matchCat = selectedCatId === null || p.categoria === selectedCatId
    const matchSearch =
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.descricao && p.descricao.toLowerCase().includes(search.toLowerCase())) ||
      (p.categoria_nome && p.categoria_nome.toLowerCase().includes(search.toLowerCase()))
    return matchCat && matchSearch
  })

  const openProductModal = (product: Produto) => {
    setSelectedProduct(product)
    setProductQty(1)
    setObservacao("")
  }

  const handleAddToCart = () => {
    if (!selectedProduct) return

    const priceNum = Number(selectedProduct.preco)

    const cartEntry = {
      cartId: `${selectedProduct.id}-${Date.now()}`,
      product: selectedProduct,
      quantity: productQty,
      unitPrice: priceNum,
      observacao,
      total: priceNum * productQty,
    }

    setCartItems([...cartItems, cartEntry])
    setSelectedProduct(null)
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0)
  // Regras da loja (Configurações): taxa, pedido mínimo e se aceita pedidos pelo app
  const taxaEntrega = Number(loja?.taxa_entrega || 0)
  const deliveryFee = deliveryType === "entrega" ? taxaEntrega : 0
  const finalTotal = subtotal + deliveryFee
  const pedidoMinimo = Number(loja?.pedido_minimo || 0)
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
  const bloqueioCheckout =
    loja && !loja.aceita_pedidos_online
      ? "A loja não está recebendo pedidos pelo aplicativo agora. Tente mais tarde."
      : pedidoMinimo > 0 && subtotal < pedidoMinimo
      ? `O pedido mínimo é de ${brl(pedidoMinimo)}. Faltam ${brl(pedidoMinimo - subtotal)}.`
      : null

  // Finalizar compra real no Django
  const handleFinalizeOrder = async () => {
    if (cartItems.length === 0) return

    if (deliveryType === "entrega") {
      if (!cep || !logradouro || !numero || !bairro || !cidade) {
        notify("Preencha todos os campos obrigatórios do endereço.")
        return
      }
    }

    if (bloqueioCheckout) {
      notify(bloqueioCheckout)
      return
    }

    setLoadingCheckout(true)
    try {
      const payload: any = {
        status: "criado",
        tipo_atendimento: deliveryType === "entrega" ? "delivery" : "retirada",
        numero_mesa: deliveryType === "entrega" ? "Delivery" : "Retirada",
        payment_method: paymentMethod,
        itens: cartItems.map((item) => ({
          produto: item.product.id,
          quantidade: item.quantity,
        })),
      }

      if (deliveryType === "entrega") {
        payload.endereco = { cep, logradouro, numero, complemento, bairro, cidade, uf }
      }

      const res = await api.post("/orders/", payload)
      const orderCreated = res.data
      setConfirmedOrder(orderCreated)

      mutate("/orders/")
      mutate("/inventory/insumos/")
      setCheckoutStep("success")
      setCartItems([])
    } catch (err: any) {
      notify("Erro ao enviar pedido. Verifique os dados.")
    } finally {
      setLoadingCheckout(false)
    }
  }

  const renderAuthBox = (title: string, subtitle: string, buttonLoginLabel: string = "Entrar") => (
    <div className="rounded-2xl border border-line bg-surface p-5 space-y-4 max-w-md mx-auto w-full">
      <div className="text-center">
        <User className="mx-auto h-8 w-8 text-accent mb-2" />
        <h4 className="text-sm font-bold text-ink">
          {authMode === "login" ? title : "Crie sua Conta"}
        </h4>
        <p className="text-xs text-soft mt-1">
          {authMode === "login"
            ? subtitle
            : "Rápido e fácil. Seus dados ficam salvos para seus próximos pedidos."}
        </p>
      </div>

      <div className="flex rounded-xl bg-canvas p-1 border border-line text-xs">
        <button
          type="button"
          onClick={() => {
            setAuthMode("login");
            setLoginError("");
            setRegError("");
          }}
          className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
            authMode === "login"
              ? "bg-raised text-accent shadow"
              : "text-soft hover:text-ink"
          }`}
        >
          Já tenho conta
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode("register");
            setLoginError("");
            setRegError("");
          }}
          className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
            authMode === "register"
              ? "bg-raised text-accent shadow"
              : "text-soft hover:text-ink"
          }`}
        >
          Criar Conta
        </button>
      </div>

      {authMode === "login" ? (
        <div className="space-y-3">
          {loginError && (
            <div className="rounded-xl bg-danger/10 p-2.5 text-xs text-danger text-center border border-danger/20">
              {loginError}
            </div>
          )}
          <input
            placeholder="Usuário ou Email"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            className="h-11 w-full rounded-lg bg-canvas border border-line-strong px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            placeholder="Senha"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="h-11 w-full rounded-lg bg-canvas border border-line-strong px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <button
            onClick={handleLoginSubmit}
            disabled={loadingLogin || !loginUsername || !loginPassword}
            className="w-full rounded-xl bg-accent py-3 text-xs font-bold text-accent-ink disabled:opacity-50 flex justify-center items-center h-10  hover:bg-accent-hover transition-colors"
          >
            {loadingLogin ? <RefreshCw className="h-4 w-4 animate-spin" /> : buttonLoginLabel}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {regError && (
            <div className="rounded-xl bg-danger/10 p-2.5 text-xs text-danger text-center border border-danger/20">
              {regError}
            </div>
          )}
          <input
            placeholder="Seu Nome Completo"
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            className="h-11 w-full rounded-lg bg-canvas border border-line-strong px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <input
            placeholder="Nome de Usuário (login)"
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            className="h-11 w-full rounded-lg bg-canvas border border-line-strong px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <input
            type="email"
            placeholder="E-mail (opcional)"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            className="h-11 w-full rounded-lg bg-canvas border border-line-strong px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            placeholder="Crie uma Senha (mínimo 8 caracteres)"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            className="h-11 w-full rounded-lg bg-canvas border border-line-strong px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <button
            onClick={handleRegisterSubmit}
            disabled={loadingRegister || !regUsername || !regPassword}
            className="w-full rounded-xl bg-accent py-3 text-xs font-bold text-accent-ink disabled:opacity-50 flex justify-center items-center h-10  hover:bg-accent-hover transition-colors"
          >
            {loadingRegister ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Criar Conta e Entrar"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh w-full bg-canvas text-ink flex flex-col">
      <div
        className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 pt-3 sm:px-6 sm:pt-6"
        // espaço para a barra inferior + barra do carrinho + área do indicador do iPhone
        style={{ paddingBottom: "calc(9rem + env(safe-area-inset-bottom))", paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        {/* Dynamic App Content */}
        <div className="flex-1">
          
          {/* TAB 1: HOME */}
          {activeTab === "home" && (
            <div className="px-4 pt-2">
              <header className="flex items-center justify-between gap-3 border-b border-dashed border-line pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandMark size={48} />
                  <div className="min-w-0">
                    <h1 className="font-display truncate text-3xl text-ink">{brandName}</h1>
                    <p className="flex items-center text-sm text-muted">
                      <MapPin className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Balcão e delivery
                    </p>
                  </div>
                </div>
                <ThemeToggle />
              </header>

              <div className="mt-4 space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" aria-hidden />
                  <input
                    type="text"
                    placeholder="Buscar no cardápio"
                    aria-label="Buscar no cardápio"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-12 w-full rounded-lg border border-line-strong bg-canvas pl-10 pr-4 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </div>

                {categorias && categorias.length > 0 && (
                  <div role="tablist" aria-label="Categorias" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4">
                    {[{ id: null as number | null, nome: "Tudo" }, ...(Array.isArray(categorias) ? categorias : [])].map((cat) => {
                      const active = selectedCatId === cat.id
                      return (
                        <button
                          key={cat.id ?? "todas"}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setSelectedCatId(cat.id)}
                          className={`-mb-px shrink-0 border-b-4 px-4 py-3 text-base font-semibold ${
                            active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                          }`}
                        >
                          {cat.nome}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-4xl text-ink">Cardápio</h2>
                    <span className="text-sm text-muted">{filteredProducts.length} {filteredProducts.length === 1 ? "item" : "itens"}</span>
                  </div>

                  {loadingProdutos ? (
                    <div className="flex h-48 items-center justify-center gap-2 text-muted">
                      <RefreshCw className="h-5 w-5 animate-spin text-accent" />
                      Carregando o cardápio...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="border border-dashed border-line p-8 text-center text-muted">
                      <p className="font-semibold text-soft">Nada por aqui ainda.</p>
                      <p className="mt-1 text-sm">Tente outra categoria ou outra busca.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredProducts.map((product) => {
                        const img = mediaUrl(product.imagem_url)
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => openProductModal(product)}
                            className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-left transition-[transform,border-color] duration-150 ease-out hover:border-accent active:scale-[0.98]"
                          >
                            <span className="relative block aspect-[4/3] w-full bg-raised">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                              ) : (
                                <span className="font-display flex h-full w-full items-center justify-center text-8xl text-line-strong" aria-hidden>
                                  {product.nome.charAt(0)}
                                </span>
                              )}
                              <span className="font-display absolute bottom-0 left-0 bg-accent px-3.5 py-1.5 text-4xl text-accent-ink">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(product.preco))}
                              </span>
                            </span>
                            <span className="flex flex-1 flex-col p-4">
                              <span className="text-xl font-semibold leading-snug text-ink">{product.nome}</span>
                              {product.descricao && <span className="mt-1 line-clamp-2 text-sm text-soft">{product.descricao}</span>}
                              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-accent">
                                <Plus className="h-4 w-4" aria-hidden /> Adicionar
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CARRINHO & CHECKOUT */}
          {activeTab === "cart" && (
            <div className="px-4 pt-2">
              <div className="mb-4 flex items-center justify-between">
                {checkoutStep !== "success" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (checkoutStep === "payment") setCheckoutStep("delivery")
                      else if (checkoutStep === "delivery") setCheckoutStep("cart")
                      else setActiveTab("home")
                    }}
                    className="flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-soft hover:bg-raised hover:text-ink"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                ) : (
                  <span />
                )}
                <h1 className="text-3xl text-ink">
                  {checkoutStep === "cart" && "Carrinho"}
                  {checkoutStep === "delivery" && "Entrega"}
                  {checkoutStep === "payment" && "Pagamento"}
                  {checkoutStep === "success" && "Pedido enviado"}
                </h1>
                {checkoutStep !== "success" ? (
                  <span className="text-sm text-muted">
                    {checkoutStep === "cart" ? 1 : checkoutStep === "delivery" ? 2 : 3} de 3
                  </span>
                ) : (
                  <span />
                )}
              </div>

              {/* ETAPA 1: ITENS DO CARRINHO */}
              {checkoutStep === "cart" && (
                <div className="space-y-4">
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
                      <ShoppingBag className="h-14 w-14 text-faint opacity-40 mb-3" />
                      <p className="text-sm font-semibold text-soft">Seu carrinho está vazio</p>
                      <p className="text-xs text-muted mt-1">Adicione itens deliciosos do cardápio!</p>
                      <button
                        onClick={() => setActiveTab("home")}
                        className="mt-5 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-ink "
                      >
                        Ver Cardápio
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="border-y border-line py-1">
                        <ul className="divide-y divide-dashed divide-line">
                          {cartItems.map((item, idx) => (
                            <li key={item.cartId || idx} className="flex items-start gap-3 py-3">
                              <span className="font-display w-10 shrink-0 text-3xl">{item.quantity}×</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-base font-semibold leading-tight">{item.product.nome}</p>
                                {item.observacao && <p className="text-sm text-muted">Obs.: {item.observacao}</p>}
                              </div>
                              <p className="font-display text-2xl">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.total)}</p>
                              <button
                                type="button"
                                onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))}
                                aria-label={`Remover ${item.product.nome}`}
                                className="p-1 text-muted hover:text-danger"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <dl className="mt-2 space-y-1.5 border-t border-dashed border-line pt-3 text-base">
                          <div className="flex justify-between">
                            <dt className="text-muted">Subtotal</dt>
                            <dd>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subtotal)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted">Taxa de entrega</dt>
                            <dd>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deliveryFee)}</dd>
                          </div>
                          <div className="flex items-baseline justify-between pt-1">
                            <dt className="text-lg font-bold">Total</dt>
                            <dd className="font-display text-5xl">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(finalTotal)}</dd>
                          </div>
                        </dl>
                      </div>

                      {bloqueioCheckout && (
                        <p role="status" className="rounded-lg bg-warn/10 p-3 text-sm font-medium text-warn">
                          {bloqueioCheckout}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setCheckoutStep("delivery")}
                        disabled={!!bloqueioCheckout}
                        className="flex h-14 w-full items-center justify-center rounded-lg bg-accent text-lg font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-40"
                      >
                        Continuar para a entrega
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ETAPA 2: FORMA DE ENTREGA */}
              {checkoutStep === "delivery" && (
                <div className="space-y-5">
                  <div role="radiogroup" aria-label="Como você quer receber" className="grid grid-cols-2 gap-3">
                    {[
                      { id: "entrega" as const, label: "Entrega", icon: MapPin, detail: [taxaEntrega > 0 ? brl(taxaEntrega) : "Grátis", loja?.tempo_entrega].filter(Boolean).join(" · ") },
                      { id: "retirada" as const, label: "Retirar no balcão", icon: Home, detail: ["Grátis", loja?.tempo_retirada].filter(Boolean).join(" · ") },
                    ].map((op) => {
                      const active = deliveryType === op.id
                      const Icon = op.icon
                      return (
                        <button
                          key={op.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setDeliveryType(op.id)}
                          className={`flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-colors ${
                            active ? "border-accent bg-accent/10" : "border-line-strong hover:bg-raised"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${active ? "text-accent" : "text-muted"}`} />
                          <span className="text-base font-semibold text-ink">{op.label}</span>
                          <span className="text-sm text-muted">{op.detail}</span>
                        </button>
                      )
                    })}
                  </div>

                  {deliveryType === "entrega" && (
                    <fieldset className="space-y-3">
                      <legend className="mb-1 flex w-full items-center justify-between text-base font-semibold text-ink">
                        Endereço de entrega
                        {loadingCep && (
                          <span className="flex items-center gap-1 text-sm font-normal text-muted">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Buscando CEP
                          </span>
                        )}
                      </legend>
                      <input aria-label="CEP" inputMode="numeric" autoComplete="postal-code" placeholder="CEP" value={cep} onChange={(e) => handleBuscarCep(e.target.value)} className="h-12 w-full rounded-lg border border-line-strong bg-canvas px-3.5 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
                      <div className="grid grid-cols-3 gap-2">
                        <input aria-label="Rua" autoComplete="address-line1" placeholder="Rua" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} className="col-span-2 h-12 w-full rounded-lg border border-line-strong bg-canvas px-3.5 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
                        <input aria-label="Número" inputMode="numeric" placeholder="Nº" value={numero} onChange={(e) => setNumero(e.target.value)} className="h-12 w-full rounded-lg border border-line-strong bg-canvas px-3.5 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input aria-label="Bairro" placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} className="h-12 w-full rounded-lg border border-line-strong bg-canvas px-3.5 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
                        <input aria-label="Complemento" autoComplete="address-line2" placeholder="Complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} className="h-12 w-full rounded-lg border border-line-strong bg-canvas px-3.5 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none" />
                      </div>
                      {cidade && <p className="text-sm text-muted">{cidade}{uf ? `/${uf}` : ""}</p>}
                    </fieldset>
                  )}

                  <button
                    type="button"
                    onClick={() => setCheckoutStep("payment")}
                    className="flex h-14 w-full items-center justify-center rounded-lg bg-accent text-lg font-bold text-accent-ink hover:bg-accent-hover"
                  >
                    Continuar para o pagamento
                  </button>
                </div>
              )}

              {/* ETAPA 3: IDENTIFICAÇÃO */}
              {checkoutStep === "payment" && !isAuthenticated && (
                <div className="space-y-4 py-2">
                  {renderAuthBox(
                    "Entre para concluir o pedido",
                    "Use sua conta ou crie uma agora; leva menos de um minuto.",
                    "Entrar e continuar"
                  )}
                </div>
              )}

              {/* ETAPA 3: PAGAMENTO (feito na entrega ou na retirada) */}
              {checkoutStep === "payment" && isAuthenticated && (
                <div className="space-y-5">
                  <p className="text-sm text-muted">Você paga ao receber o pedido. Escolha como:</p>
                  <div role="radiogroup" aria-label="Forma de pagamento" className="divide-y divide-line border-y border-line">
                    {[
                      { id: "pix" as const, label: "Pix", desc: "QR Code na hora da entrega ou da retirada" },
                      { id: "cartao_credito" as const, label: "Cartão de crédito", desc: "Na maquininha" },
                      { id: "cartao_debito" as const, label: "Cartão de débito", desc: "Na maquininha" },
                      { id: "dinheiro" as const, label: "Dinheiro", desc: "Se precisar de troco, avise o entregador" },
                    ].map((m) => {
                      const active = paymentMethod === m.id
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setPaymentMethod(m.id)}
                          className="flex w-full items-center justify-between gap-3 py-4 text-left"
                        >
                          <span>
                            <span className="block text-base font-semibold text-ink">{m.label}</span>
                            <span className="block text-sm text-muted">{m.desc}</span>
                          </span>
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                              active ? "border-accent bg-accent" : "border-line-strong"
                            }`}
                            aria-hidden
                          >
                            {active && <span className="h-2.5 w-2.5 rounded-full bg-accent-ink" />}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-ink">Total</span>
                    <span className="font-display text-5xl text-ink">{brl(finalTotal)}</span>
                  </div>

                  {bloqueioCheckout && (
                    <p role="status" className="rounded-lg bg-warn/10 p-3 text-sm font-medium text-warn">
                      {bloqueioCheckout}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleFinalizeOrder}
                    disabled={loadingCheckout || !!bloqueioCheckout}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-accent text-lg font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-40"
                  >
                    {loadingCheckout ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Enviando pedido...
                      </>
                    ) : (
                      "Enviar pedido"
                    )}
                  </button>
                </div>
              )}

              {/* ETAPA 4: PEDIDO ENVIADO */}
              {checkoutStep === "success" && (
                <div className="space-y-5 py-4">
                  <div>
                    <p className="text-sm text-muted">Pedido</p>
                    <p className="font-display text-7xl text-ink">{confirmedOrder?.id}</p>
                    <p className="mt-1 text-base text-soft">Recebemos seu pedido. Acompanhe o andamento em Pedidos.</p>
                  </div>

                  {confirmedOrder?.codigo_pin_entrega && (
                    <div className="border-y-2 border-accent py-4">
                      <p className="text-sm font-semibold text-ink">Código de entrega</p>
                      <p className="font-display text-6xl tracking-[0.15em] text-accent">{confirmedOrder.codigo_pin_entrega}</p>
                      <p className="mt-1 text-sm text-muted">Diga este código ao entregador quando ele chegar. Não envie por mensagem.</p>
                    </div>
                  )}

                  <dl className="space-y-2 text-base">
                    <div className="flex justify-between">
                      <dt className="text-muted">Pagamento</dt>
                      <dd className="font-semibold text-ink">
                        {({ pix: "Pix", cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito", dinheiro: "Dinheiro" } as Record<string, string>)[confirmedOrder?.payment_method || paymentMethod]} na {deliveryType === "entrega" ? "entrega" : "retirada"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Total</dt>
                      <dd className="font-display text-3xl text-ink">{brl(Number(confirmedOrder?.total || finalTotal))}</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutStep("cart")
                      setActiveTab("home")
                    }}
                    className="flex h-14 w-full items-center justify-center rounded-lg border-2 border-line-strong text-lg font-semibold text-ink hover:bg-raised"
                  >
                    Voltar ao cardápio
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PEDIDOS DO CLIENTE */}
          {activeTab === "orders" && (
            <div className="px-4 pt-2">
              <h1 className="border-b border-dashed border-line pb-3 text-4xl text-ink">Meus pedidos</h1>
              {!isAuthenticated ? (
                <p className="py-10 text-center text-base text-muted">Entre na sua conta para ver seus pedidos.</p>
              ) : !Array.isArray(userOrders) || userOrders.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-base font-semibold text-soft">Você ainda não fez pedidos.</p>
                  <button type="button" onClick={() => setActiveTab("home")} className="mt-3 text-base font-semibold text-accent hover:underline">
                    Ver o cardápio
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {userOrders.slice(0, 15).map((ord) => {
                    const st: Record<string, { tone: "neutral" | "info" | "warn" | "accent" | "success" | "danger"; label: string }> = {
                      criado: { tone: "info", label: "Recebido" },
                      confirmado: { tone: "warn", label: "Confirmado" },
                      em_preparo: { tone: "accent", label: "Em preparo" },
                      pronto: { tone: "success", label: "Pronto" },
                      entregue: { tone: "success", label: "Entregue" },
                      finalizado: { tone: "neutral", label: "Concluído" },
                      arquivado: { tone: "neutral", label: "Concluído" },
                      retornando_base: { tone: "danger", label: "Entrega não concluída" },
                      cancelado: { tone: "danger", label: "Cancelado" },
                    }
                    const info = st[ord.status] ?? { tone: "neutral" as const, label: ord.status }
                    return (
                      <li key={ord.id} className="flex items-center justify-between gap-3 py-4">
                        <div>
                          <p className="text-base font-semibold text-ink">Pedido {ord.id}</p>
                          <StatusTag tone={info.tone}>{info.label}</StatusTag>
                          {ord.codigo_pin_entrega && ["confirmado", "em_preparo", "pronto"].includes(ord.status) && (
                            <p className="mt-1 text-sm text-muted">Código de entrega: <strong className="text-ink">{ord.codigo_pin_entrega}</strong></p>
                          )}
                        </div>
                        <span className="font-display text-3xl text-ink">{brl(Number(ord.total))}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* TAB 4: CONTA */}
          {activeTab === "profile" && (
            <div className="space-y-5 px-4 pt-2 text-sm">
              <div className="flex items-center gap-3 border-b border-dashed border-line pb-4">
                <span className="font-display flex h-12 w-12 items-center justify-center rounded-md bg-raised text-3xl text-ink" aria-hidden>
                  {isAuthenticated ? (user?.first_name?.[0] || user?.username?.[0] || "C").toUpperCase() : "?"}
                </span>
                <div>
                  <h1 className="text-3xl text-ink">
                    {isAuthenticated ? (user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username) : "Sua conta"}
                  </h1>
                  <p className="text-sm text-muted">
                    {isAuthenticated ? "Conta de cliente" : "Entre para acompanhar seus pedidos"}
                  </p>
                </div>
              </div>

              {isAuthenticated ? (
                <>
                  {(loja?.telefone || loja?.endereco) && (
                    <div className="border-y border-line py-3 text-base">
                      <p className="font-semibold text-ink">Fale com a loja</p>
                      {loja?.telefone && (
                        <a href={`tel:${loja.telefone.replace(/\D/g, "")}`} className="mt-1 block font-semibold text-accent underline-offset-4 hover:underline">
                          {loja.telefone}
                        </a>
                      )}
                      {loja?.endereco && <p className="mt-1 text-muted">{loja.endereco}</p>}
                    </div>
                  )}
                  
                  <button 
                    onClick={logout}
                    className="w-full rounded-2xl border border-danger/30 bg-danger/10 py-3 text-xs font-bold text-danger hover:bg-danger/20"
                  >
                    Sair da Conta
                  </button>
                </>
              ) : (
                <div className="space-y-4   py-2">
                  {renderAuthBox(
                    "Acesse sua Conta",
                    "Acesse seus pedidos e informações salvas.",
                    "Fazer Login"
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra do carrinho: aparece no cardápio quando há itens */}
        {activeTab === "home" && cartItems.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("cart")}
            style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
            className="fixed inset-x-3 z-30 mx-auto flex h-14 max-w-5xl items-center justify-between rounded-lg bg-accent px-5 text-accent-ink hover:bg-accent-hover sm:inset-x-6"
          >
            <span className="text-base font-bold">
              Ver carrinho · {cartItems.length} {cartItems.length === 1 ? "item" : "itens"}
            </span>
            <span className="font-display text-3xl">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(subtotal)}</span>
          </button>
        )}

        {/* BOTTOM NAVIGATION BAR */}
        <nav aria-label="Navegação do aplicativo" className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-canvas" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex h-16 max-w-5xl items-stretch justify-around">
            {[
              { id: "home", label: "Cardápio", icon: Home },
              { id: "orders", label: "Pedidos", icon: Clock },
              { id: "cart", label: "Carrinho", icon: ShoppingBag, badge: cartItems.length },
              { id: "profile", label: "Conta", icon: User },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
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
              )
            })}
          </div>
        </nav>

        {/* MODAL DE PRODUTO SELECIONADO */}
        {selectedProduct && (
          <Dialog placement="sheet" label={selectedProduct.nome} onClose={() => setSelectedProduct(null)}>
            <div role="dialog" aria-modal="true" aria-label={selectedProduct.nome} className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-2xl sm:rounded-xl">
              {mediaUrl(selectedProduct.imagem_url) && (
                <img
                  src={mediaUrl(selectedProduct.imagem_url)!}
                  alt={selectedProduct.nome}
                  className="h-48 w-full object-cover"
                />
              )}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-3xl text-ink">{selectedProduct.nome}</h3>
                    {selectedProduct.categoria_nome && (
                      <span className="text-xs font-medium text-accent">{selectedProduct.categoria_nome}</span>
                    )}
                  </div>
                  <span className="font-display text-4xl text-accent">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(selectedProduct.preco))}
                  </span>
                </div>
                {selectedProduct.descricao && (
                  <p className="text-base text-soft">{selectedProduct.descricao}</p>
                )}

                <div>
                  <label htmlFor="f-appclientepage-1" className="mb-1 block text-xs font-semibold text-soft">
                    Observações do Pedido (Opcional)
                  </label>
                  <textarea id="f-appclientepage-1"
                    rows={2}
                    placeholder="Ex: Sem cebola, caprichar no queijo..."
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className="w-full rounded-xl border border-line bg-canvas p-2.5 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Sticky Bottom: Seletor de Quantidade + Botão Adicionar */}
              <div className="flex items-center gap-3 border-t border-line/80 bg-canvas p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                <div className="flex items-center rounded-xl border border-line bg-surface p-1">
                  <button
                    onClick={() => setProductQty(Math.max(1, productQty - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-soft hover:bg-raised hover:text-ink active:scale-90"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-ink">
                    {productQty}
                  </span>
                  <button
                    onClick={() => setProductQty(productQty + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-soft hover:bg-raised hover:text-ink active:scale-90"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="h-12 flex-1 rounded-lg bg-accent text-center text-base font-bold text-accent-ink hover:bg-accent-hover"
                >
                  Adicionar ao Carrinho •{" "}
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    Number(selectedProduct.preco) * productQty
                  )}
                </button>
              </div>

            </div>
          </Dialog>
        )}

      </div>
    </div>
  )
}
