# Frontend — estado atual e plano de qualidade

Levantamento feito em 21/10/2026 sobre `frontend/` (Next.js 15, React 19, Tailwind 4), por leitura de código e métricas de busca. Não foi feita revisão visual com o sistema rodando e dados reais; os itens visuais abaixo precisam ser confirmados nos prints.

## 1. Retrato do código
- 31 componentes `"use client"`, ~11,8 mil linhas de TSX. Typecheck e `next build` passam.
- Páginas muito grandes: `gestao` (1.103 linhas), `cliente` (1.078), `finance` (996), `entregador` (941), `orders` (712). A página `cliente` concentra 35 `useState`.
- Biblioteca de UI mínima: só `button`, `card`, `input` e `table` em `components/ui`. Modais, badges, selects, campos de formulário e estados vazios são reescritos em cada tela.
- Tokens declarados em `globals.css` (`--color-primary`, `surface`, `border-subtle`) quase não são usados; as telas usam classes `zinc-*` e `amber/yellow-*` direto (53 ocorrências de `amber-`, além de `yellow-400`).
- Tipagem frouxa: 62 usos de `any`.
- Só tema escuro. Fonte Inter declarada mas **não carregada** (sem `next/font`), então cai em Segoe UI/sistema e muda de máquina para máquina.
- Estados de carregamento existem em parte das telas (39 ocorrências de `isLoading`/skeleton); tratamento de erro de SWR é raro (5).

## 2. Problemas por prioridade
| # | Problema | Impacto | Situação |
|---|---|---|---|
| 1 | 37 chamadas a `alert()`/`confirm()` nativos | Interrompem o fluxo, estilo do navegador, ruins em celular e no KDS | **Corrigido** (ver §3) |
| 2 | Texto de 9–11px em 139 pontos | Ilegível em balcão/cozinha e no celular | **Corrigido**: mínimo 12px (`text-xs`) |
| 3 | Sem foco visível global e sem respeito a `prefers-reduced-motion` | Navegação por teclado e acessibilidade | **Corrigido** em `globals.css` |
| 4 | 56 `<label>` e só 1 `htmlFor`; ~6 `aria-*` em 157 botões | Leitores de tela não associam campos; botões só com ícone sem nome | Aberto |
| 5 | Fonte não carregada | Aparência inconsistente entre máquinas | Aberto |
| 6 | Páginas de 700–1.100 linhas, modais duplicados | Manutenção e risco de regressão | Aberto |
| 7 | `any` em 62 pontos | Erros só aparecem em execução | Aberto |
| 8 | Cores hardcoded em vez de tokens | Mudar a identidade exige editar dezenas de arquivos | Aberto |
| 9 | Falta de tratamento de erro/estado vazio uniforme nas listas | Tela em branco quando a API falha | Aberto |
| 10 | Guarda de rota usa cookie editável | Só a casca aparece; dados seguem protegidos pela API | Aceito (documentado) |

## 3. O que foi alterado nesta rodada
- `components/ui/feedback.tsx`: `notify()` (aviso não bloqueante, `aria-live`, some em 6 s) e `askConfirm()` (diálogo de confirmação com foco, Esc e botões "Cancelar/Confirmar"). Montado uma vez em `app/layout.tsx`.
- Todos os `alert()` viraram `notify()`, e os 7 `confirm()` viraram `await askConfirm()`. Mensagens com "sucesso/registrada/confirmada" saem como sucesso; as demais como erro.
- Texto mínimo de 12px em todo o app.
- `globals.css`: `color-scheme: dark`, `:focus-visible` com contorno âmbar e `prefers-reduced-motion`.
- Acessibilidade de formulários: 35 pares `label`/campo associados em login, equipe, configurações, entregador, estoque, catálogo e financeiro; `aria-label` nos botões de fechar e de adicionar ao pedido.
- Verificação: `tsc --noEmit` e `next build` sem erros.

## 4. Direção visual (skill `frontend-design`)
**Assunto:** painel operacional da PL Lanchonete & Pastelaria. Usuários: atendente no balcão, cozinha olhando de longe, gestor no fim do dia, entregador e cliente no celular. A tarefa principal é ler status rápido e agir com poucos toques.

**Estado atual:** fundo quase preto com acento âmbar e cartões arredondados iguais. É coerente e legível, mas é o kit padrão de painel escuro; nada nele fala de lanchonete.

**Proposta (para depois da entrega, não antes):**
- Paleta: grafite `#16130F` (fundo), papel `#F3EBDD` (texto/superfícies claras do cliente e cupom), brasa `#E4572E` (ação e alerta), mostarda `#E8B931` (destaque de status), verde-folha `#3F8F5B` (pronto/pago).
- Tipografia: uma família com personalidade para títulos (ex.: Bricolage Grotesque) e Inter ou Source Sans para dados; tamanhos de tabela 14px, nunca abaixo de 12px.
- Layout: KDS com colunas por status e cartões de tamanho proporcional ao tempo de espera; `cliente` com tema claro e fotos de produto como protagonistas.
- Risco: trocar identidade a poucos dias da entrega pode introduzir regressões e quebrar os prints do Cap. 5. Recomendo aplicar só os itens da §2 antes do documento e deixar a nova identidade como trabalho futuro.

## 5. Próximos passos sugeridos (ordem)
1. Revisar à mão os labels restantes (PDV em `orders`, `PaymentModal`, tipo de movimentação do financeiro).
2. Carregar a fonte com `next/font` (ou empacotar localmente) para o resultado ser igual em todas as máquinas.
3. Criar `Modal`, `Field`, `Badge` e `EmptyState` em `components/ui` e migrar `gestao`, `finance` e `cliente`.
4. Trocar `any` por tipos da API (começar por `services/api.ts`).
5. Estado de erro padrão para listas SWR (mensagem + "Tentar novamente").
6. Capturar os prints finais depois dessas correções.
