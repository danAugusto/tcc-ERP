# Arquitetura e backlog inicial

## Visão da solução

```text
Cliente (área pública) ──> cardápio e pedido
Equipe interna (JWT) ───> operação, estoque e gestão
                           │
                    Django REST API
                           │
                    banco de dados
```

O login local com JWT é a base inicial. OIDC com Google foi registrado como evolução posterior, quando usuários e perfis locais já estiverem consolidados.

## Mapa físico do repositório

```text
backend/                 Django, DRF, CRUD, regras de negócio e testes
  config/                Configuração compartilhada e rotas-raiz
  users/                 Login local, perfil e autorização
  catalog/               Esqueleto de categorias, produtos e cardápio
  inventory/             Futuro: insumos, saldo, alertas e movimentações
  orders/                Pedidos e itens de pedido
  preparation/           Futuro: fila de cozinha, status e FIFO
  finance/               Registros financeiros
frontend/                Interface web futura
  src/components/        Componentes reutilizáveis
  src/screens/           Telas públicas e internas
  src/services/          Integração HTTP e sessão
docs/                    Decisões, arquitetura e registros das tasks
infrastructure/          Materiais de ambiente e operação futuros
.github/workflows/       CI executado pelo GitHub Actions
```

Regra direta: CRUD e qualquer regra de backend pertencem a `backend/`; telas e integrações do navegador pertencem a `frontend/`. Hoje existem os apps `users`, `catalog`, `finance` e `orders` (mínimo). `catalog` é o esqueleto da próxima issue; `inventory` e `preparation` são módulos aprovados, mas só serão criados quando suas issues começarem.

Essa divisão protege responsabilidades: `catalog` descreve o que é vendido; `inventory` controla insumos e movimentações; `orders` registra o pedido; `preparation` cuida da fila e da ordenação FIFO; e `finance` concentra lançamentos financeiros. A sequência recomendada mantém as dependências claras: perfis → catálogo e inventário → pedidos → preparo/FIFO → baixa de estoque e financeiro.

Para o passo a passo didático de implementação do catálogo, consulte o [Guia do CRUD de catálogo](CATALOG_CRUD_GUIDE.md).

## Perfis planejados

| Perfil | Acesso principal |
| --- | --- |
| Cliente | Cardápio público, pedido e histórico quando autenticado. |
| Atendente | Pedidos, atendimento e atualização de status permitida. |
| Cozinheiro | Fila de preparo e atualização de produção. |
| Administrador | Usuários, catálogo, estoque, caixa, relatórios e configurações. |

## Issues sugeridas

Todas as issues começam atribuídas ao usuário responsável pela coordenação e podem ser redistribuídas no GitHub depois.

| ID | Título | Objetivo | Dependências |
| --- | --- | --- | --- |
| TCC-01 | Perfis e autorização local | Criar perfis, permissões e token com dados mínimos do usuário. | Autenticação atual |
| TCC-02 | Base de categorias e produtos | CRUD interno de categorias e produtos. | TCC-01 |
| TCC-03 | Cardápio público | Listar produtos disponíveis sem login. | TCC-02 |
| TCC-04 | Insumos e controle de saldo | Criar o futuro módulo `inventory` com CRUD de insumos, unidade, estoque mínimo e saldo atual. | TCC-01 |
| TCC-05 | Movimentações de estoque | Implementar em `inventory` entradas/saídas com motivo e consistência transacional. | TCC-04 |
| TCC-06 | Ficha técnica de produtos | Relacionar produto a insumos e quantidades. | TCC-02, TCC-04 |
| TCC-07 | Pedido e itens | Criar o futuro módulo `orders` para pedido público/interno e itens. | TCC-03, TCC-06 |
| TCC-08 | Baixa automática de estoque | Debitar insumos ao confirmar pedido, com validação de saldo. | TCC-05, TCC-06, TCC-07 |
| TCC-09 | Operação e preparo | Criar o futuro módulo `preparation` para fila da cozinha, FIFO e transição de status. | TCC-01, TCC-07 |
| TCC-10 | Alertas, relatórios e financeiro inicial | Alertas em `inventory`, relatórios operacionais e base do futuro módulo `finance`. | TCC-05, TCC-07 |
| TCC-11 | Testes integrados e documentação | Cobrir fluxos críticos e registrar evidências para o TCC. | TCC-01 a TCC-10 |
| TCC-12 | Login social OIDC (futuro) | Adicionar Google após perfis locais estarem estáveis. | TCC-01 |

## Ordem recomendada

1. TCC-01;
2. TCC-02 e TCC-04 em paralelo;
3. TCC-03, TCC-05 e TCC-06;
4. TCC-07, TCC-08 e TCC-09;
5. TCC-10 e TCC-11;
6. TCC-12 somente como melhoria final.
