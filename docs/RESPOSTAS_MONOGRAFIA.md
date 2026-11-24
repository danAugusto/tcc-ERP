# Subsídios técnicos para a monografia — TCC ERP (PL Lanchonete)

Repositório: https://github.com/danAugusto/tcc-ERP · Base: código e histórico git até 19/10/2026.

**Convenção das marcas** (para o outro chat tratar cada trecho corretamente):
- **[CÓDIGO]** fato verificado no repositório; pode ser escrito como afirmação.
- **[PREVISTO]** lacuna do código/documentação que será fechada antes da entrega; escrever como funcionalidade entregue **somente após** confirmação do autor.
- **[A PREENCHER]** dado empírico ou documental que só os autores possuem. **Não inventar valores.** Enquanto vazio, redigir de forma condicional ("os resultados obtidos foram…" só com o número real).

---

## 1. Stack e infraestrutura

**1. Banco de dados [CÓDIGO].** PostgreSQL 15 (imagem `postgres:15-alpine`), acessado via `psycopg2-binary` e `dj-database-url`. Sem `DATABASE_URL` o Django cai em SQLite, uso restrito ao desenvolvimento local.

**2. Frontend e backend [CÓDIGO].** Frontend: Next.js 15 (App Router) com React 19, TypeScript 5.7 e Tailwind CSS 4. Backend: Django 6.1 e Django REST Framework 3.18, Python 3.13 no CI. Autenticação JWT (djangorestframework-simplejwt 5.5).

**3. Bibliotecas [CÓDIGO].**
- Backend: Django, djangorestframework, djangorestframework-simplejwt, PyJWT, django-cors-headers, dj-database-url, psycopg2-binary, python-dotenv, gunicorn, whitenoise, pillow, sqlparse, asgiref, tzdata.
- Frontend: next, react, react-dom, axios, swr, recharts, lucide-react, js-cookie, clsx, tailwind-merge; dev: typescript, tailwindcss, @tailwindcss/postcss, shadcn, tipos.

**4. Rotinas de RPA [CÓDIGO].** São três rotinas em `backend/core/services.py` (`executar_rpa`), expostas em `POST /api/core/rpa/execute/` e acionadas por botão na tela `/rpa` e no menu lateral:
- `rpa-01` — sincroniza pedidos em andamento com a fila FIFO de preparo;
- `rpa-02` — varre insumos e consolida os que estão no estoque mínimo ou abaixo;
- `rpa-03` — totaliza lançamentos do dia por forma de pagamento e concilia o dinheiro dos turnos.

Cada execução grava evidência na trilha de auditoria (`RPA_SINCRONIZACAO_PEDIDOS`, `RPA_ALERTA_ESTOQUE`, `RPA_CONCILIACAO_CAIXA`). **Não há agendador** (Celery, cron ou management command): a execução é manual sob demanda; a tela exibe uma frequência apenas como recomendação. Redigir como "automação por demanda (robôs de software acionados pelo gestor)", e registrar o agendamento periódico como trabalho futuro. [PREVISTO: se o agendamento for implementado, atualizar.]

**5. Hospedagem [A PREENCHER].** O repositório contém duas topologias: `docker-compose.yml` (desenvolvimento: db, backend, frontend) e `docker-compose.prod.yml` com proxy reverso Caddy (HTTPS automático ou `tls internal` para IP/LAN), gunicorn e Postgres, pensada para uma VM/VPS. Informar: ambiente real (VM local, VPS, nuvem), URL/IP e data de entrada no ar. Se só houve homologação em VM na rede local, escrever exatamente isso.

**6. Backup [CÓDIGO].** `infrastructure/backup.sh` executa `pg_dump` compactado (`.sql.gz`) e tar dos uploads de imagens, com retenção padrão de 14 dias e instruções de restauração. É disparado manualmente; o agendamento via cron é recomendado. [A PREENCHER: informar se o cron foi configurado no ambiente de homologação.]

**7. Ferramentas [A PREENCHER].** Evidenciadas no repositório: Git/GitHub (pull requests, issues, Actions), Docker/Docker Compose (WSL no Windows), Caddy. Os autores devem completar IDE, cliente de banco, Postman e ferramenta de prototipagem, se usadas.

---

## 2. Funcionalidades

**8. Baixa automática de insumos [CÓDIGO].** Existe. A ficha técnica é o modelo `ReceitaItem` (produto → insumo → quantidade para 1 unidade). Ao confirmar o pedido, `orders/services.py` cria `Movimentacao` de saída com motivo BAIXA para cada insumo; no cancelamento cria entrada com motivo DEVOLUCAO. Um signal (`inventory/signals.py`, `post_save` de `Movimentacao`) atualiza `Insumo.quantidade_atual`. Entradas manuais de estoque também são `Movimentacao`. Alertas de estoque baixo comparam quantidade atual com `estoque_minimo`.

**9. Cadastro de insumo [CÓDIGO].** Campos: nome (único), unidade de medida (KG, G, L, ML, UN), quantidade atual, estoque mínimo, datas de criação e atualização. **Não há entidade nem campo de fornecedor.** Descrever como limitação; se o campo for adicionado no ajuste final, passa a [PREVISTO].

**10. Fechamento de caixa e conciliação por turno [CÓDIGO].**
1. O funcionário inicia o turno (`Turno`, `ACAO: INICIOU_TURNO`).
2. Os pagamentos dos pedidos geram `Lancamento` financeiro com forma de pagamento (dinheiro, débito, crédito, Pix, outros) e responsável.
3. Ao encerrar o turno, para o perfil entregador o sistema soma os pedidos entregues pagos em dinheiro no intervalo do turno e grava em `saldo_dinheiro` (valor a repassar); o entregador fica offline.
4. O gerente/administrador confirma o acerto (`acerto_confirmado = true`), registrado na auditoria com valor e responsável.
5. A rotina `rpa-03` totaliza os lançamentos do dia por forma de pagamento e concilia o dinheiro dos turnos, apontando divergências no resumo/auditoria.

[A PREENCHER: descrever a sequência de telas observada (rótulos dos botões) a partir do uso ou dos prints.]

**11. Relatórios [CÓDIGO / PREVISTO].** `GET /api/core/metricas/?periodo=` aceita `hoje`, `7dias`, `mes_atual` e `mes_passado` e devolve faturamento, número de pedidos, ticket médio, distribuição por tipo de atendimento e por forma de pagamento, série diária (gráfico Recharts) e progresso da meta mensal (`Configuracao`). O módulo financeiro tem resumo e exportação CSV. **Não há ranking de produtos mais vendidos** no código atual: tratar como [PREVISTO] ou como limitação/trabalho futuro. Visão semanal existe como janela de 7 dias.

**12. Tipos de atendimento [CÓDIGO].** `Pedido.tipo_atendimento`: mesa (com número da mesa/comanda), balcão, delivery (com `EnderecoPedido` e consulta de CEP via ViaCEP) e retirada.

**13. Perfis de acesso [CÓDIGO].** Seis perfis (`users.Perfil.role`): cliente, atendente, cozinheiro, entregador, administrador e superadmin (DevMode). RBAC em duas camadas: (a) classes de permissão na API (retornam 403) e (b) matriz dinâmica `Permissao`/`RolePermissao` editável em `/permissoes` (permissões base: VER_METRICAS, CANCELAR_PEDIDO, FECHAR_CAIXA, EDITAR_ESTOQUE, GERENCIAR_USUARIOS), além de middleware de rota no Next.js.
Resumo por perfil:
- **cliente:** vê o cardápio, cria e acompanha apenas os próprios pedidos; auto-cadastro.
- **atendente:** PDV (criar/editar pedidos, itens, pagamento, impressão de cupom).
- **cozinheiro:** KDS (fila FIFO; iniciar, marcar pronto); não entrega delivery.
- **entregador:** suas entregas, confirmar entrega ou registrar falha, turno e saldo em dinheiro.
- **administrador:** catálogo, estoque, financeiro, métricas, equipe, auditoria, permissões, RPA, configurações, acerto de caixa.
- **superadmin:** tudo, mais indicador de DevMode.
Nota de segurança [CÓDIGO]: a guarda de rota do frontend usa cookie editável; os dados permanecem protegidos pela API (403), validado em teste de matriz perfil × endpoint.

**14. Módulo de entregas [CÓDIGO].** Atribuição de entregador disponível (online) ao pedido de delivery; entregador consulta "minhas entregas"; confirmação de entrega (com PIN, conforme roteiro de testes) e registro de falha (status `retornando_base`); fechamento de turno com saldo em dinheiro e acerto pelo gerente.

**15. Trilha de auditoria [CÓDIGO].** Tabela `rh_auditoria`: usuário, ação, entidade, ID da entidade, detalhes e data/hora. Registra início/fim de turno, confirmação de acerto de caixa, execuções de RPA e demais ações críticas. Consulta pela API somente leitura (`AuditoriaViewSet`) e pela tela de equipe/auditoria.

**16. Funcionalidades além dos RF01–RF13 (sugestão de RF14–RF16) [CÓDIGO].**
- RF14 — Cardápio do cliente híbrido web/mobile (PWA com manifesto, sem service worker/offline) com auto-cadastro.
- RF15 — Exportação CSV (financeiro e inventário) e impressão de cupom do cliente e via da cozinha (sem valores).
- RF16 — Gestão de imagens de produtos, configuração de metas/contatos e campainha sonora no KDS.
Outras: limitação de tentativas de login (HTTP 429), health check, carga inicial de usuários e permissões.

**17. Pedidos do WhatsApp [A PREENCHER].** O sistema não integra WhatsApp (há só o campo de telefone/WhatsApp de atendimento em Configurações). Portanto, pedidos recebidos por WhatsApp são registrados manualmente por atendente no PDV. Confirmar com a lanchonete se isso reflete a prática.

---

## 3. Modelagem e figuras

**18. Entidades [CÓDIGO].** 17 modelos (detalhes em `docs/schema.sql`):
- Usuários: `Perfil`, `Permissao`, `RolePermissao` (+ `auth.User`).
- Catálogo: `Categoria`, `Produto` (com imagem).
- Estoque: `Insumo`, `Movimentacao`, `ReceitaItem`.
- Pedidos: `Pedido` (status, tipo de atendimento, mesa, forma de pagamento, valor recebido, entregador), `ItemPedido`, `EnderecoPedido`.
- Preparo: `Preparo` (fila FIFO).
- Financeiro: `FinanceCategory`, `Lancamento`.
- Núcleo: `Turno`, `Auditoria`, `Configuracao`.
Fluxo de status do pedido: criado → confirmado → em_preparo → pronto → entregue → finalizado → arquivado; ramos: retornando_base e cancelado.

**19. Telas [A PREENCHER].** Capturar: login, dashboard/gestão, PDV, KDS (cozinha), estoque, catálogo, financeiro, permissões, equipe/auditoria, RPA, cardápio do cliente, app do entregador.

**20. Diagramas.** DER existente em `docs/der.md` (Mermaid), **desatualizado** (ex.: campo `fone` em Perfil que não existe no modelo) → [PREVISTO: regenerar a partir dos models]. Diagramas de classes e de sequência (pedido → preparo → pagamento → baixa de estoque) ainda não existem → [PREVISTO: gerar a partir do código].

---

## 4. Testes e resultados

**21. Testes automatizados [CÓDIGO].** 132 testes (Django TestCase) em 7 apps: catalog 20, core 8, finance 34, inventory 15, orders 33, preparation 11, users 11. Cobrem: transições de status, total do pedido via signal, baixa e devolução de estoque, lançamentos e pagamento, filas FIFO, RBAC por perfil, execução dos robôs e isolamento do cliente. CI (GitHub Actions, `backend-checks.yml`) em push/PR para `develop` e `main`: `manage.py check`, `manage.py test` (Python 3.13), e no frontend `npm ci`, `tsc --noEmit` e `next build` (Node 22). Não há testes automatizados nem lint no frontend.

**22. Testes funcionais manuais.** Há o roteiro `docs/ROTEIRO_TESTES_FISICOS.md` (seções 0 em diante: infraestrutura/segurança, fluxos por perfil, KDS, entrega, financeiro, RPA etc.). Já constam pré-verificações executadas em 19/10/2026, todas aprovadas: 132 testes, typecheck/build, migrations sem pendências, `check --deploy`, stack de produção em HTTP, limite de login (429 na 11ª tentativa), matriz de permissões (5 perfis + anônimo × 13 endpoints) sem acesso indevido, fluxo pedido → KDS → pagamento → auditoria, CSVs, cupons, robôs RPA e imagens. Defeitos encontrados e corrigidos na rodada: forma de pagamento "Outros" em receitas, categoria/responsável ausentes na tela financeira, listagens paginadas vazias, cozinha entregando delivery, receita lançada no momento errado, itens decorativos de RPA/menu. Pontos abertos: cookie de papel editável (mitigado pela API), ausência de service worker, ausência de agendador RPA, falha de entrega sem caminho de reenvio, cancelamento de pedido entregue permitido.
[A PREENCHER: resultado (✅/❌) de cada passo manual; anexar como tabela de casos de teste na monografia.]

**23. Uso na PL Lanchonete [A PREENCHER].** O repositório não contém evidência de uso em produção. Preencher somente com dados reais: período, operadores, nº de pedidos registrados, erros de pedido (comparar com 10%), tempo de reposição emergencial (comparar com 30 min/dia), faltas e alertas críticos gerados, divergências de caixa encontradas na conciliação e depoimentos. Se não houver, usar o item 24.

**24. Demonstração com dados simulados [A PREENCHER].** O sistema possui carga de usuários de demonstração (`SEED_DEMO_USERS`) e dados iniciais. Informar data da demonstração ao proprietário e a reação. Na ausência de uso real, redigir o Cap. 5 como **validação em ambiente de homologação com dados simulados**, tratando as metas (10% e 30 min/dia) como hipóteses a verificar em estudo de campo futuro, sem afirmar redução alcançada.

**25. Usabilidade (SUS) [A PREENCHER].** Nada no repositório. Recomendação: aplicar o SUS (10 afirmações, escala 1–5) a 3–6 pessoas por perfil (atendente, cozinha, gestor); pontuação = (soma dos ímpares −1 + 5 − soma dos pares) × 2,5; média ≥ 68 considerada acima da média.

**26. RNF01 e navegadores [A PREENCHER / PREVISTO].** Não há medição registrada. Medir tempo de resposta dos endpoints principais (login, listagem de pedidos, criação de pedido, métricas) e testar em Chrome e Firefox; registrar versão e resultado. Pode-se usar o painel de rede do navegador ou um script `curl` com cronometragem.

---

## 5. Processo e equipe

**27. Período e entregas [CÓDIGO, pelo git].**
- **Ago/2026 (13–18/08):** estrutura inicial; módulo financeiro; pedidos, fila FIFO e preparo; documentação de regras; demo do dashboard.
- **Ago–Set (31/08–01/09):** catálogo (categorias e produtos); insumos; movimentação; ficha técnica e baixa automática; alertas de estoque; Docker/Postgres; dashboard com KPIs, dark mode e JWT.
- **Set (02–04/09):** KDS, autenticação, pagamento, endereço com ViaCEP, turnos, auditoria, métricas, entregas, RBAC dinâmico e matriz visual.
- **Set (17–21/09):** regras finais e RBAC; dashboard financeiro; superadmin; auto-cadastro; roteamento por perfil; cardápio híbrido PWA.
- **Out/2026:** infraestrutura de produção (Caddy, compose de produção, backup), imagens de produto, CSV, cupons, hardening, 132 testes, CI e roteiro de testes físicos; ajustes finais de casos de uso.

**28. Divisão de trabalho.** Pelo git: Carlos — backend de finanças, pedidos/preparo, core (turnos, auditoria, métricas, RPA, entregas), RBAC, frontend e infraestrutura; Pedro (PedroSouzaAguiar) — CRUD de catálogo e de insumos; Danilo Augusto — estrutura inicial e integração. Banco de dados (Pedro Vinícius) e demais contribuições fora do git: [A PREENCHER].

**29. Dificuldades [PARCIAL].** Evidenciadas no histórico: instabilidade do Docker no WSL e conflito de porta do Postgres; colisão de rotas entre dashboard e app mobile; sincronização entre branches (`integrate`, feature branches) e merges; permissões e RBAC consistentes entre frontend e API; fuso/horário e paginação no frontend; correções de regra de negócio (momento de geração da receita, entrega de delivery). [A PREENCHER: dificuldades de equipe — prazos, divisão de tarefas, disponibilidade.]

**30. Troca do chatbot pelo RPA [A PREENCHER].** Não há registro no código. Há apenas o argumento técnico verificável: o RPA implementado atua sobre dados internos (pedidos, estoque, caixa), é auditável e dispensa dependência de API de mensageria externa, enquanto o pedido por WhatsApp segue manual. O motivo real deve ser informado pelos autores.

---

## 6. Documentos e pesquisa

**31. Entrevista (Apêndice A) [A PREENCHER].** Roteiro, respostas e fotos das fichas de pedido e anotações de estoque.

**32. Autorização de uso do nome [A PREENCHER].** Termo de consentimento da PL Lanchonete; sem ele, usar nome fictício/anonimizado.

**33. Referências [A PREENCHER].** PDFs/links de Meza, Santa et al., Panesar e Markeset, Akamine e a publicação do SEBRAE do "97,8%". Não citar o percentual sem a fonte confirmada.

**34. Formatação [A PREENCHER].** Confirmar com a orientadora o modelo (template UNIP) ou usar ABNT padrão.

---

## Orientações de redação para o outro chat
1. Descrever a solução como **sistema ERP web com automações (RPA) acionadas sob demanda**, não como "RPA agendado".
2. Não afirmar fornecedor de insumo, ranking de produtos, integração WhatsApp, service worker/offline ou agendamento de robôs, salvo se marcados como entregues.
3. Resultados do Cap. 5: apresentar apenas (a) testes automatizados (132, CI), (b) verificações de homologação já executadas, (c) roteiro manual e SUS **após preenchidos**. Metas de 10% e 30 min/dia devem ser tratadas como hipóteses, com conclusão condicionada aos dados do item 23/24.
4. Todo item **[A PREENCHER]** deve virar uma lista de pendências visível para os autores antes da entrega.
