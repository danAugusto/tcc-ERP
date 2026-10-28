# Sistema de design — "balcão de lanchonete"

Identidade: quadro de preços de balcão (preto + amarelo-letreiro) e comanda de papel. O tema claro troca o preto por
branco e o amarelo por **azul escuro** (tinta de carbono). Aprovado em 22/10/2026.

## Regras
- **Só tokens semânticos** (`canvas`, `surface`, `raised`, `line`, `ink`, `soft`, `muted`, `faint`, `accent`, `accent-ink`,
  `danger`, `success`, `warn`, `info`, `paper*`). Nunca `zinc-*`/`yellow-*`: é isso que permite trocar de tema e, no futuro,
  deixar cada empresa escolher as cores (ver backlog).
- **Amarelo (`accent`) é sinal**: ação principal, item ativo, preço. Nunca decoração; sem brilho/sombra colorida.
- **Tipografia**: Archivo (eixo de largura). `font-display` e `h1–h3` usam a versão extracondensada (letreiro) para
  títulos, senhas de comanda, preços e totais. Texto corrido em largura normal. Sem caixa alta em rótulos.
- **Comanda (`.ticket`)**: papel claro com picote, **somente** onde existe uma comanda de verdade: cozinha, comanda e
  confirmação do PDV, cartão de entrega do motoboy (e o cupom impresso). É o único elemento ousado; o resto é quieto.
- **Estrutura**: painéis planos, linha tracejada sob o cabeçalho da página, título de seção com filete grosso
  (`border-b-2 border-ink`), situação como quadrado colorido + texto (`StatusTag`), abas com sublinhado (`TabBar`),
  totais como rodapé de comanda (`StatStrip`: rótulo · pontilhado · valor; cor só para perigo/bom resultado). Sem pilhas de cartões idênticos.
- **Raios**: escala curta (3–8 px).
- **Movimento**: só o que responde a uma ação ou sinaliza urgência (pedido atrasado). Botões e cartões tocáveis encolhem para 97–98% ao toque (150 ms, ease-out); modais entram em 200 ms a partir de 97% de escala; nada de `transition-all` nem pulso contínuo em telas de uso frequente. Com "reduzir movimento", ficam só esmaecimentos.
- **Avisos**: bloco com fundo tingido (`bg-danger/10` etc.), sem faixa colorida lateral.
- **Botões**: sempre `Button`/`buttonClass()` (primary, outline, ghost, danger; sm, md, lg, icon).
- **Diálogos**: sempre `Dialog` (foco preso, Esc, foco devolvido).
- **Texto**: frases normais (sem Maiúsculas Em Tudo), moeda com `brl()`, durações com `formatDuration()`.
- **Acessibilidade**: pares de cor verificados (WCAG AA) nos dois temas; foco visível; controles com rótulo.

## Onde está
`frontend/app/globals.css` (tokens e utilitários), `frontend/components/ui/blocks.tsx` (PageHeader, StatusTag, StatStrip,
TabBar), `frontend/components/BrandMark.tsx` (quadrado da marca com a logo), `frontend/components/ThemeToggle.tsx`.

## Temas
O tema inicial segue o do aparelho (`prefers-color-scheme`); a escolha feita no botão sol/lua é lembrada. No tema claro, uma logo enviada fica sobre quadrado **branco com borda** (variante `light:`).

## Logo e identidade por empresa
Configurações → Estabelecimento: nome (banco) e logo (PNG/JPG/WebP até 2 MB). O backend gera logo 256 px, favicon 64 px e
ícones 192/512 px do PWA e uma versão **1 bit (preto e branco, pontilhada, 384 px)** que sai no topo do cupom do cliente; `/manifest.webmanifest` é dinâmico.

## Backlog
- Escolher as cores (destaque e tema) por empresa em Configurações (white-label).
- Service worker (PWA offline).
