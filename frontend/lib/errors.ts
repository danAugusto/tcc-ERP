/**
 * Converte um erro de requisição em frase para o usuário: diz o que aconteceu e, quando possível,
 * como resolver. Nunca devolve JSON cru nem códigos técnicos.
 */
const FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  name: "Nome",
  preco: "Preço",
  categoria: "Categoria",
  descricao: "Descrição",
  imagem: "Imagem",
  itens: "Itens",
  produto: "Produto",
  quantidade: "Quantidade",
  quantidade_atual: "Estoque atual",
  estoque_minimo: "Estoque mínimo",
  unidade_medida: "Unidade",
  payment_method: "Forma de pagamento",
  valor_recebido: "Valor recebido",
  cancellation_reason: "Motivo do cancelamento",
  entregador_id: "Entregador",
  pin: "PIN",
  motivo: "Motivo",
  value: "Valor",
  date: "Data",
  category: "Categoria",
  username: "Usuário",
  password: "Senha",
  email: "E-mail",
  endereco: "Endereço",
  numero_mesa: "Mesa",
  logo: "Logo",
}

type Found = { text: string; labeled: boolean }

/** Primeira mensagem encontrada; o rótulo vem do campo mais próximo da mensagem (só um). */
function find(data: unknown): Found | null {
  if (data == null) return null
  if (typeof data === "string") return { text: data, labeled: false }
  if (Array.isArray(data)) {
    for (const item of data) {
      const f = find(item)
      if (f) return f
    }
    return null
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>
    if (typeof obj.detail === "string") return { text: obj.detail, labeled: true }
    for (const [key, value] of Object.entries(obj)) {
      const f = find(value)
      if (!f) continue
      if (f.labeled) return f
      const label = FIELD_LABELS[key]
      return label ? { text: `${label}: ${f.text}`, labeled: true } : { text: f.text, labeled: false }
    }
  }
  return null
}

function firstMessage(data: unknown): string | null {
  return find(data)?.text ?? null
}

export function apiErrorMessage(err: any, fallback: string): string {
  const res = err?.response
  if (!res) return "Sem conexão com o servidor. Confira a internet e tente de novo."
  switch (res.status) {
    case 401:
      return "Sua sessão expirou. Entre de novo para continuar."
    case 403:
      return firstMessage(res.data) ?? "Seu perfil não tem permissão para esta ação. Peça ao gerente para liberar."
    case 404:
      return "Este registro não existe mais. Atualize a tela."
    case 413:
      return "O arquivo é grande demais."
    case 429:
      return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."
  }
  if (res.status >= 500) return "O servidor teve um problema. Tente de novo em instantes."
  return firstMessage(res.data) ?? fallback
}
