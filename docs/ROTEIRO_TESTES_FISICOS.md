# Roteiro de Testes Físicos (aceitação manual)

Marque cada item: ✅ passou · ❌ falhou (anote o que viu) · ➖ não aplicável.
Ambiente: dev (`http://localhost:3000`) ou homologação (`http://IP-DA-VM`). Em dev, os usuários de demonstração são
`admin`, `atendente`, `cozinheiro`, `entregador`, `cliente` e `superadmin` (senha = nome do usuário).
Use **duas janelas/dispositivos** (ex.: PC = gestão/cozinha, celular = cliente/entregador).

## Pré-verificações automatizadas (já executadas em 19/10/2026)

| Verificação | Resultado |
|---|---|
| Suíte do backend (`manage.py test`) | ✅ 172 testes OK |
| `tsc --noEmit` (frontend) e `next build` na imagem de produção | ✅ |
| `makemigrations --check` | ✅ sem migrations pendentes |
| `check --deploy` com `DEBUG=False` + HTTPS | ✅ só avisa HSTS/SSL redirect (tratados pelo Caddy e por `HSTS_SECONDS`) |
| Subir sem `SECRET_KEY` com `DEBUG=False` | ✅ recusa iniciar |
| Stack de produção (Caddy + gunicorn + Postgres) em HTTP | ✅ login, upload, `/media`, `/admin`, estáticos, health |
| Limite de tentativas de login (atrás do proxy, 3 workers) | ✅ 429 a partir da 11ª |
| Matriz de permissões da API (5 perfis + anônimo × 13 endpoints) | ✅ nenhum acesso indevido |
| Cliente só enxerga os próprios pedidos; preço do item vem do servidor | ✅ |
| Fluxo por API: pedido → confirmar → KDS (iniciar/pronto/entregar) → pagar → auditoria | ✅ |
| CSV financeiro e de inventário (BOM, `;`, aspas, totais) | ✅ conteúdo conferido |
| KDS: campainha toca em pedido novo, não toca silenciado, preferência persiste | ✅ (áudio real não pôde ser ouvido) |
| Cupom do cliente (delivery) e via da cozinha (sem valores) | ✅ conteúdo conferido |
| Robôs RPA 01/02/03 pela tela e auditoria gerada | ✅ |
| Imagens do produto no `/catalog` e no `/cliente` | ✅ |

### Defeitos encontrados nessa rodada
| Defeito | Situação |
|---|---|
| Receita ficava com forma de pagamento "Outros" quando a cozinha marcava "Entregue" antes do pagamento (distorcia relatórios e o RPA-03) | **Corrigido** (teste adicionado). Lançamentos antigos continuam "Outros" |
| Tela financeira não mostrava categoria nem responsável (API não enviava os nomes) | **Corrigido** (teste adicionado) |
| Listagens paginadas apareciam vazias no frontend | **Corrigido** |
| Cozinha podia "Entregar" um delivery (sem entregador, sem PIN) | **Corrigido**: cozinha encerra em "Pronto"; card mostra "Aguardando entregador"; API recusa (400) |
| Receita era lançada em "Entregue" e atribuída ao cozinheiro | **Corrigido**: só nasce no pagamento (finalizado), com a forma de pagamento e o responsável do caixa |
| Menu lateral aparecia sobre `/cliente`; "Status do RPA" e botão do menu eram fixos/decorativos | **Corrigido**: menu oculto em `/cliente`; status e botão usam a auditoria e executam os 3 robôs de verdade; cartões de `/rpa` também reais |

### Pontos abertos (decidir antes do aval)
| Ponto | Detalhe |
|---|---|
| Guarda de rota do frontend confia no cookie `user_role` (editável) | Cookie forjado abre a casca da tela de admin; **os dados continuam protegidos pela API (403)** |
| Não existe service worker | Há `manifest.json`, mas o app **não funciona offline** e a instalação depende do navegador; item 9.2 deve ser visto com essa ressalva |
| Sem script de lint no frontend | Só typecheck |
| Não há agendador dos robôs RPA | Só rodam por clique; a "frequência" na tela é recomendada |
| Cancelar pedido já entregue é permitido (exige `CANCELAR_PEDIDO` e motivo) | Decidir se deve exigir permissão extra |


## Rodada 1 — resultado do usuário (20/10/2026) e encaminhamentos

| Item | Resultado relatado | Encaminhamento |
|---|---|---|
| 0.3 | Bloqueio de ~1 min após tentativas | Esperado (limite de 10/min) |
| 0.8 | Cookie forjado "piscava" a tela de gestão | **Corrigido**: o guarda decide antes de renderizar; volta a `/cliente` e o cookie é corrigido pelo servidor |
| 1.1 | Aba lateral e tela de cliente apareciam para todos; entregador sem logout; **403 intermitente** | **Corrigido**: (a) "Cardápio do Cliente" só para admin/superadmin; (b) entregador sem menu lateral e com "Sair da Conta" (volta a `/cliente`); (c) **causa real do 403**: o middleware casava a rota `/` como prefixo de tudo e bloqueava qualquer perfil operacional em recarga de página (F5/link direto) — corrigido e conferido para 6 perfis × 11 rotas; (d) login/logout passaram a navegar com recarga completa (sem cache de sessão anterior) |
| 1.3 / 5.6 | Cozinheiro "travado" após remover EDITAR_ESTOQUE; 403 persistia mesmo logando como superadmin | Mesma causa do 1.1(c). Regra mantida: sem `EDITAR_ESTOQUE` o cozinheiro **vê** o estoque, mas não edita; atendente não tem acesso à tela (403 por perfil) |
| 1.4 | Segundo cliente "não vê" o que o primeiro escolheu | Comportamento correto (pedidos e carrinho são por cliente) |
| 2.8 | Sem importação em lote | Registrado como melhoria futura (planilha com imagem/nome/valor/descrição, validada) |
| 3.5 | "Testar som" toca mesmo mudo | Aceito (é teste manual) |
| 4.1 | Troco | Conferido no banco (ex.: total 34,00, recebido 50,00, troco 16,00) |
| 5.4 | Sem ficha técnica no produto | **Implementado**: seção "Ficha Técnica" no formulário do produto (insumo + quantidade por unidade) |
| 10.2 | Só consegue uma sessão em `localhost:3000` | Não é defeito: cookies são por navegador/origem. Para vários perfis ao mesmo tempo use janela anônima, outro navegador/perfil, ou `127.0.0.1:3000` em paralelo a `localhost:3000` |

Novas solicitações atendidas: **nome do estabelecimento vindo do banco** (Configurações → Nome Fantasia; aplica em menu, login, cardápio, cupom e título da aba; padrão "PL Lanchonete & Pastelaria"), **financeiro sem barra de rolagem interna**, **imagens no PDV** (clicar na imagem/card adiciona o item), **dica de credenciais de demonstração oculta fora do ambiente de desenvolvimento**.

## Rodada 2 — pauta (a executar)

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| R2.1 | Os 6 perfis em **recarga de página (F5)** em sua tela inicial | Nenhum 403 indevido; cada perfil abre o seu ambiente | |
| R2.2 | Cozinheiro/atendente: menu lateral | Só os itens do perfil; sem "Cardápio do Cliente" | |
| R2.3 | Entregador (celular): Conta → Sair | Vai para `/cliente` (tela pública); entrar de novo leva a `/entregador` | |
| R2.4 | Logar pelo `/cliente` com usuário da equipe | Segue para o ambiente do perfil | |
| R2.5 | Configurações → alterar Nome Fantasia → Salvar | Nome muda em menu, login, cardápio, cupom e título; auditoria `ALTEROU_NOME_ESTABELECIMENTO` em `/equipe` | |
| R2.6 | Catálogo → produto → Ficha Técnica: adicionar 2 insumos, salvar, reabrir, remover 1 | Ficha persiste e reflete as alterações | |
| R2.7 | Confirmar pedido de produto com ficha técnica | Estoque dos insumos baixa; cancelar antes do preparo devolve | |
| R2.8 | PDV: clicar na imagem e no botão amarelo | Ambos adicionam o item | |
| R2.9 | `/finance` | Uma única barra de rolagem (a da direita da página) | |
| R2.10 | Alterar **tempo de expiração do token** (ex.: 10 s, só em teste) e usar o sistema | Renova sozinho ou volta ao login sem tela quebrada (antigo 1.5) | |
| R2.11 | Itens pendentes da rodada 1: 0.2, 0.9, 4.6 (impressora térmica), 8.4, 8.6, bloco 9 (mobile/PWA com HTTPS), 10.1, 10.3, 10.4 | Conforme descritos nos blocos | |
| R2.12 | Revisar 3.7–3.14 (entrega, falha, cancelamento, receita no pagamento) | Conforme descritos | |


### Validação de regras dos itens 3.7 a 3.14 (automatizada, 25 cenários em `orders/test_fluxo_entrega.py`)

| Item | Regra verificada | Resultado |
|---|---|---|
| 3.7 | Entregador vê só as corridas atribuídas a ele; atribuição exige entregador online com turno; cliente não atribui | ✅ |
| 3.7 | Atribuir só a pedido **delivery** e em andamento (confirmado → retornando à base) | ❌→✅ corrigido (antes aceitava mesa, cancelado e finalizado; o botão "+ Atribuir Moto" também aparecia nesses casos) |
| 3.8 | PIN errado recusado; PIN certo → Entregue; outro entregador não confirma; pedido ainda em preparo não confirma; receita **não** nasce na entrega | ✅ |
| 3.8 | PIN não pode ser lido pelo entregador | ❌→✅ corrigido (a API entregava o PIN ao entregador, anulando a validação; agora só o cliente dono e a equipe o veem) |
| 3.9 | Falha exige motivo; vai a "Retornando à base"; motivo gravado; sem receita; pode ser cancelado | ✅ |
| 3.9 | **Reenvio** após falha: equipe libera o pedido (volta a "Pronto", sem entregador e sem motivo, PIN do cliente mantido, auditoria `REENVIOU_ENTREGA`); outro entregador conclui com o mesmo PIN; o primeiro deixa de ver a corrida; cliente não libera | ✅ **novo** |
| 3.10 | Cancelar confirmado devolve estoque; após iniciar o preparo **não** devolve por padrão (consumo/perda), mas o operador pode marcar "devolver insumos" (e, antes do preparo, pode optar por não devolver); sai da fila da cozinha; finalizado não cancela; cliente não cancela | ✅ **regra ampliada** |
| 3.10 | Cancelamento exige motivo | ❌→✅ corrigido (a API aceitava sem motivo; a tela já preenchia um padrão) |
| 3.11 | Edição recalcula o total e usa o **preço do catálogo** (ignora preço enviado); só em pedido "criado"; cliente não edita | ✅ |
| 3.12 / 3.13 | Cozinha não entrega delivery; mesa → receita só no pagamento, com forma e responsável corretos; pagar duas vezes não duplica | ✅ |
| 3.14 | Cliente só lista/abre os próprios pedidos (o alheio dá 404); equipe vê todos | ✅ |

O que continua **só no olho**: a aparência das telas, mensagens de erro exibidas ao operador e o fluxo no celular do entregador.


## Rodada 3 — visual novo, tema claro e logo (22/10/2026)

Pré-verificações já feitas: `tsc`, build de produção, 6 telas nos dois temas, pares de cor (WCAG AA), logo enviada ponta a ponta
(upload → menu, favicon, manifest e ícones 192/512) e restaurada ao padrão; backend com testes de upload/validação/permissão da logo.

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| R3.1 | Alternar tema (sol/lua no menu, login e cardápio) e recarregar a página | Tema é lembrado; sem "flash" do tema errado; todas as telas legíveis nos dois | |
| R3.2 | Percorrer todas as telas nos dois temas (painel, PDV, gestão, cozinha, financeiro, estoque, cardápio, equipe, permissões, automações, configurações, login, cardápio do cliente, entregador) | Sem texto invisível, sem sobreposição, sem barra de rolagem dupla | |
| R3.3 | Cozinha: ler a tela a ~2 metros | Número da comanda e itens legíveis; coluna "No fogo" destaca o que está sendo feito | |
| R3.4 | PDV no tablet/toque: tocar rápido várias vezes no mesmo produto | Todas as unidades entram na comanda; contador no produto acompanha | |
| R3.5 | Configurações → enviar logo PNG (fundo transparente) | Logo aparece dentro do quadrado (menu, login, cardápio); aba do navegador muda | |
| R3.6 | Enviar GIF, PDF ou imagem acima de 2 MB | Mensagem de erro clara; logo anterior mantida | |
| R3.7 | "Restaurar ícone padrão" | Volta ao chapéu de cozinheiro | |
| R3.8 | Celular: abrir `/cliente` e (com HTTPS) instalar o app | Ícone instalado é a logo enviada | |
| R3.9 | Celular (375 px): cardápio, carrinho, entregador | Sem rolagem horizontal; botões com área de toque confortável | |
| R3.10 | Entregador ao sol (brilho alto) | Cartão de entrega (papel claro) legível | |
| R3.11 | Navegar só com teclado (Tab/Enter) no login, PDV e cardápio | Foco sempre visível; é possível concluir um pedido | |
| R3.12 | Cupom do cliente com logo enviada, na impressora térmica 58 e 80 mm | Logo preto e branco no topo, nítida e centralizada (logos escuras imprimem melhor; amarelas viram pontilhado leve); via da cozinha sem logo | |
| R3.13 | Primeira visita com o aparelho no modo claro e no escuro (sem escolha salva) | O tema inicial acompanha o aparelho; o botão sol/lua sobrepõe e é lembrado | |
| R3.14 | Tema claro com logo amarela/colorida | Quadrado da marca branco com borda; a logo não some | |


## Rodada 4 — responsivo, diálogos e mensagens de erro (P0/P1 da avaliação)

Já verificado em navegador emulado: menu em gaveta (celular), PDV com barra "Comanda" (tablet 768 px), cozinha em 3 colunas no tablet,
diálogo de pagamento (foco entra, Tab circula dentro, Esc fecha e devolve o foco), folha de produto do cliente, campos com 16 px em toque,
tradução de erros da API (sem JSON cru). Falta confirmar em aparelho real.

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| R4.1 | Celular: entrar como admin/atendente | Barra superior com ☰; menu abre como gaveta, fecha ao tocar fora, em Esc ou ao navegar | |
| R4.2 | Tablet em pé (balcão): PDV | Produtos ocupam a tela; barra amarela "Comanda · N itens · total" abre a comanda; "Voltar aos produtos" retorna | |
| R4.3 | Tablet em pé: cozinha | Três colunas lado a lado (Na fila / No fogo / Prontos) | |
| R4.4 | iPhone: tocar em campos (busca, valor recebido, observações) | A tela **não** dá zoom | |
| R4.5 | iPhone com "notch"/indicador: cardápio do cliente e app do entregador | Barra inferior e botões não ficam sob o indicador; nada escondido atrás da barra do carrinho | |
| R4.6 | Teclado: abrir qualquer modal (pagamento, cancelar, lançamento, insumo, produto...) | Foco vai para dentro, Tab não sai do modal, Esc fecha e o foco volta ao botão que abriu | |
| R4.7 | Leitor de tela (NVDA/VoiceOver) em um modal | Anuncia como diálogo com o título certo | |
| R4.8 | Provocar erros: valor inválido, campo vazio, servidor desligado, 11 logins errados | Mensagens em português com o que fazer (ex.: "Categoria: este campo é obrigatório", "Sem conexão com o servidor…", "Muitas tentativas…") | |
| R4.9 | Sistema com "reduzir movimento" ligado | Modais e gaveta aparecem com esmaecimento simples, sem deslizar/escalar; nada pisca continuamente | |
| R4.10 | Barra do sistema do celular (Android) nos dois temas | Cor acompanha o tema (preto/branco) | |


## Rodada 5 — acabamento (P2/P3 da avaliação) e dados reais da loja

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| R5.1 | Configurações → Estabelecimento: preencher telefone, endereço e CNPJ; salvar | Aparecem no cupom do cliente; com CNPJ vazio o cupom não mostra CNPJ | |
| R5.2 | Configurações → Pedidos e entrega: taxa R$ 6,50, tempo "30–40 min" | No app do cliente, "Entrega" mostra "R$ 6,50 · 30–40 min"; o total do delivery soma a taxa (inclusive no balcão/PDV) e o cupom mostra a linha "Taxa de entrega" | |
| R5.3 | Pedido mínimo R$ 50 e carrinho de R$ 34 no app | Aviso "Faltam R$ 16,00" e botão bloqueado; o servidor também recusa | |
| R5.4 | Desligar "Aceitar pedidos pelo aplicativo" | Cardápio aparece, mas o cliente não consegue enviar; o balcão continua normal | |
| R5.5 | Pagamento no app do cliente | Não pede dados de cartão; pagamento é feito na entrega/retirada (Pix, cartão na maquininha ou dinheiro) | |
| R5.6 | Menu lateral | Grupos Operação / Gestão / Aplicativos / Sistema, sem siglas; cada perfil vê só os seus grupos | |
| R5.7 | Cozinha com pedido antigo | Tempo como "2 d 3 h" (não "2933 min") | |
| R5.8 | Entregador e gestão | Valores com vírgula (R$ 45,00) | |
| R5.9 | Tocar em botões e produtos (PDV/cardápio) | Leve "afundada" ao toque; nada pisca continuamente | |
| R5.10 | Painel, financeiro, permissões e automações | Totais como rodapé de comanda (rótulo · pontilhado · valor) | |

## 0. Infra e segurança básica (homologação)
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 0.1 | Abrir `/api/health/` | `{"status":"ok"}` | |
| 0.2 | Abrir o sistema pelo IP da VM em outro dispositivo da rede | Tela de login carrega, sem erro de CORS no console | |
| 0.3 | Errar a senha 11 vezes seguidas no login | A partir da 11ª: erro de limite de tentativas (HTTP 429) | |
| 0.4 | Entrar como `cliente` e digitar `/finance` na URL | Redireciona para `/unauthorized` ou tela do perfil | |
| 0.5 | Sem login, abrir `/gestao` | Redireciona para `/login` | |
| 0.6 | `docker compose ... ps` | Todos os serviços `running`; `db` e `backend` `healthy` | |
| 0.7 | Reiniciar a VM / `docker compose restart` | Dados continuam (produtos, pedidos, imagens) | |
| 0.8 | Cookie `user_role=administrador` forjado no navegador, logado como cliente | Telas abrem vazias/erro, **nenhum dado** de admin aparece (API devolve 403) | |
| 0.9 | Abrir `/admin/` (Django) pelo IP da VM | Carrega com CSS; login funciona (sem erro de CSRF) | |

## 1. Acesso e perfis (RBAC)
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 1.1 | Login como cada perfil | Cada um cai na sua tela inicial (admin: dashboard; atendente: `/orders` (PDV); cozinheiro: cozinha; entregador: entregas; cliente: cardápio) | |
| 1.2 | Menu lateral de cada perfil | Só mostra telas permitidas ao perfil | |
| 1.3 | `/permissoes` (admin): desligar `CANCELAR_PEDIDO` do atendente | Atendente perde o botão de cancelar após recarregar | |
| 1.4 | Logout e login novamente | Sessão limpa, sem dados do usuário anterior | |
| 1.5 | Deixar a aba aberta além da expiração do token (ou apagar `access_token`) | Renova sozinho ou volta ao login, sem tela quebrada | |

## 2. Cardápio e imagens (`/catalog`)
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 2.1 | Criar categoria "Pastéis" | Aparece no seletor do produto | |
| 2.2 | Novo produto com imagem JPG | Miniatura na lista; imagem no cardápio do cliente | |
| 2.3 | Tentar enviar PDF/GIF ou arquivo > 5 MB | Mensagem de erro clara, produto não salvo | |
| 2.4 | Editar produto: trocar imagem | Nova imagem aparece (recarregar com Ctrl+F5) | |
| 2.5 | Editar produto sem mexer na imagem | Imagem anterior preservada | |
| 2.6 | Remover imagem | Volta ao ícone padrão | |
| 2.7 | Marcar produto "indisponível" | Some do cardápio do cliente | |
| 2.8 | Cadastrar 25+ produtos (ou importar) | Todos aparecem (não limita em 20) | |
| 2.9 | Excluir produto já usado em pedido | Mensagem de erro amigável (vínculo), sem quebrar | |

## 3. Fluxo de pedido ponta a ponta
Faça **um pedido de mesa** e **um delivery**.
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 3.1 | `/cliente` (celular): cadastrar-se, escolher itens, delivery com endereço, finalizar | Pedido criado; aparece em `/gestao` como "Criado" | |
| 3.2 | `/orders` (atendente): novo pedido de mesa com 3 itens | Total correto; pedido listado em `/gestao` | |
| 3.3 | `/gestao`: confirmar o pedido | Vai para a fila da cozinha | |
| 3.4 | `/cozinha` **aberta antes** de 3.3, volume ligado, som ativado | **Toca a campainha** quando o pedido chega; Testar Som funciona | |
| 3.5 | Cozinha: silenciar e confirmar novo pedido | Nenhum som; preferência persiste após F5 | |
| 3.6 | Cozinha: Iniciar Preparo → Marcar como Pronto → Entregar | Status muda na cozinha e em `/gestao` (até 4 s) | |
| 3.7 | Delivery: atribuir entregador (`/gestao`) | Entregador vê a corrida em `/entregador` | |
| 3.8 | Entregador (celular): iniciar turno, coletar, entregar com PIN | Pedido vai a "Entregue" | |
| 3.9 | Falha de entrega (informar motivo) | Pedido retorna à base; motivo visível na gestão; faixa vermelha com botão **Reenviar entrega** | |
| 3.9b | Clicar em **Reenviar entrega** e atribuir outro entregador | Pedido volta a "Pronto"; aparece "+ Atribuir Moto"; o novo entregador vê a corrida e conclui com PIN | |
| 3.10 | Cancelar um pedido com motivo (inclusive já entregue e ainda não pago) | Status "Cancelado"; não gera receita | |
| 3.10b | Cancelar pedido **em preparo** com e sem a caixa "Devolver insumos ao estoque" | Marcada: estoque volta; desmarcada: permanece baixado. Antes do preparo a caixa não aparece e o estoque volta sozinho | |
| 3.11 | Editar itens de um pedido antes do preparo | Total recalculado | |
| 3.12 | Pedido delivery pronto na cozinha | Card mostra "Aguardando entregador" (sem botão Entregar); pedido só vira Entregue após PIN do entregador | |
| 3.13 | Pedido de mesa: cozinha entrega, caixa paga depois | Receita só aparece **após o pagamento**, com a forma correta e o responsável = quem recebeu | |
| 3.14 | Cliente com perfil `cliente` acompanha o pedido | Vê só os próprios pedidos | |

## 4. Pagamento e impressão térmica
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 4.1 | Pagar em dinheiro com valor maior que o total | Troco correto; receita aparece em `/finance` | |
| 4.2 | Valor menor que o total | Bloqueia com "Valor insuficiente" | |
| 4.3 | Pagar com Pix e cartão | Registra a forma correta | |
| 4.4 | Pós-pagamento: **Imprimir Cupom do Cliente** | Cupom com cabeçalho, comanda, itens, total, pagamento e troco | |
| 4.5 | `/gestao`: ícone de impressora na linha e no modal de detalhes | Abre o cupom do pedido | |
| 4.6 | Imprimir em impressora térmica 80 mm e 58 mm (ou "Salvar PDF") | Só o cupom é impresso (sem menu/ERP), sem cortes laterais | |
| 4.7 | Cupom de delivery | Bloco de endereço completo em destaque | |
| 4.8 | `/cozinha`: impressora no card | Via da cozinha **sem valores** | |

## 5. Estoque (`/inventory`)
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 5.1 | Criar insumo (mínimo 5, atual 3) | Aparece como crítico/atenção | |
| 5.2 | Movimentar: entrada e saída | Quantidade atualiza; histórico registra o responsável | |
| 5.3 | Saída maior que o estoque | Bloqueado com mensagem | |
| 5.4 | Confirmar pedido de produto com ficha técnica | Baixa automática dos insumos | |
| 5.5 | **Exportar Inventário (CSV)** → abrir no Excel/LibreOffice | Acentos corretos, colunas separadas, status Normal/Crítico | |
| 5.6 | Perfil sem `EDITAR_ESTOQUE` | Não vê botões de editar/movimentar | |

## 6. Financeiro (`/finance`)
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 6.1 | Dashboard e resumo | Receita bate com os pedidos pagos | |
| 6.2 | Lançar uma despesa manual | Saldo diminui | |
| 6.3 | Filtrar por período/tipo | Lista e totais refletem o filtro | |
| 6.4 | **Exportar Relatório (CSV)** com filtro ativo | CSV só com o filtrado; rodapé com Receitas, Despesas e Saldo | |
| 6.5 | Descrição com `;` ou aspas | CSV não quebra colunas | |
| 6.6 | Coluna Categoria e Responsável na tabela e no CSV | Preenchidas (não "Sistema"/vazio) para vendas e lançamentos manuais | |
| 6.7 | Buscar por nome de categoria/responsável | Filtra a lista | |

## 7. Equipe, caixa e turnos (`/equipe`)
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 7.1 | Criar funcionário e trocar perfil | Reflete no acesso dele | |
| 7.2 | Check-in/check-out de turno | Registra horários | |
| 7.3 | Entregador encerra turno com entregas em dinheiro | Saldo a repassar correto | |
| 7.4 | Gerente confirma acerto de caixa | Marca como confirmado; gera auditoria | |
| 7.5 | Tabela de auditoria | Mostra as ações acima, com usuário e hora | |

## 8. Automações RPA (`/rpa`)
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 8.1 | Executar rpa-01 | Mensagem com nº de pedidos auditados; registro em `/equipe` | |
| 8.2 | Executar rpa-02 com insumo crítico | Aviso lista a quantidade de críticos; auditoria cita os itens | |
| 8.3 | Executar rpa-03 com vendas em dinheiro no dia | Auditoria com receitas, despesas, por forma e divergência | |
| 8.4 | Executar como atendente (via URL) | Acesso negado | |
| 8.5 | Botão "Executar RPA agora" do menu lateral (admin) | Roda os 3 robôs; "Última execução" e "Execuções hoje" atualizam; cartões de `/rpa` batem com `/equipe` | |
| 8.6 | Rodar rpa-03 após pagar em dinheiro sem turno de entregador | Divergência = valor em dinheiro do dia (comportamento esperado do robô) | |

## 9. Mobile / PWA (`/cliente`)
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 9.1 | Abrir no celular | Layout mobile, imagens carregam, rolagem fluida | |
| 9.2 | "Instalar app / adicionar à tela inicial" (requer HTTPS; não há service worker) | Instala como atalho e abre em tela cheia; **sem funcionamento offline** | |
| 9.3 | Desktop `/cliente` | Layout web adaptado | |
| 9.4 | Logado como `cliente` no celular | Sem menu administrativo; barra inferior (Início/Pedidos/Carrinho/Conta) funciona | |

## 10. Robustez
| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 10.1 | Derrubar o backend (`stop backend`) com uma tela aberta | Mensagem de erro amigável; volta sozinha ao religar | |
| 10.2 | Dois atendentes editando o mesmo pedido | Sem corrupção; último estado consistente | |
| 10.3 | Rodar `./infrastructure/backup.sh` e restaurar (comandos impressos no final do script) em banco limpo | Dados **e imagens** restaurados | |
| 10.4 | Pico: 30 pedidos seguidos na cozinha | Tela fluida; som não "metralha" (um toque por lote) | |

## Registro de defeitos
| Item | O que ocorreu | Gravidade (bloqueia 1.0? s/n) |
|---|---|---|
| | | |
