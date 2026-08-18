# Módulo Financeiro — regras e registro de implementação

**Data:** 18 de agosto de 2026
**Status:** Tasks 01, 02, 03, 04, 07 e parte da 09 concluídas
**Responsável:** Equipe do TCC

## Task 01 — Regras financeiras

### O que é receita e despesa

- **Receita:** entrada de valores, criada manualmente ou (futuramente) de pedidos concluídos. Ex.: vendas e outros ganhos.
- **Despesa:** saída de valores, criada manualmente. Ex.: compra de insumos, aluguel e manutenção.

### Formas de pagamento

- Decisão inicial: os lançamentos financeiros registram o valor e a data, sem exigir forma de pagamento nesta etapa.
- Formas de pagamento (dinheiro, cartão, pix) ficam registradas para definição junto ao módulo de pedidos.

### Quando uma venda vira receita

- Pendente de definição com o módulo `orders`: pedido confirmado, pronto ou concluído.
- A Task 05 (integração pedidos → receitas) definirá o gatilho e a proteção contra duplicidade.

### Categorias de receita e despesa

- Receita: Vendas, Outros ganhos.
- Despesa: Compra de insumos, Aluguel, Manutenção.
- Novas categorias podem ser criadas pela API; cada lançamento deve pertencer a uma categoria do mesmo tipo.

### Perfis que acessam o financeiro

- Pendente do sistema de perfis do app `users`: somente administradores acessarão e alterarão o financeiro.
- Até lá, o módulo exige autenticação JWT (IsAuthenticated).

## Tasks implementadas

| Task | Entrega | Situação |
| --- | --- | --- |
| 02 — Estrutura do módulo | App `finance`, modelos `Lancamento` e `FinanceCategory`, migração 0001, Django Admin. | Concluída |
| 03 — CRUD de lançamentos | Endpoints `lancamentos/` com validação de valor positivo e tipo/categoria. | Concluída |
| 04 — Categorias financeiras | Modelo, seed das categorias padrão, relação com lançamentos e endpoints de categorias. | Concluída |
| 07 — Resumo financeiro | Rota `summary/` com totais de receitas, despesas e saldo por período. | Concluída |
| 06 — Consultas e filtros | Filtros por tipo, período e categoria na listagem de lançamentos. | Parcial (histórico por pedido depende de `orders`) |
| 08 — Permissões e auditoria | Responsável registrado automaticamente; perfil admin depende do sistema de perfis. | Parcial |
| 05 — Integração pedidos → receitas | Depende do módulo `orders`. | Pendente |
| 09 — Testes, revisão e documentação | 20+ testes de CRUD, validações, filtros e resumo; este registro. | Parcial |

## Endpoints disponíveis

```text
GET/POST   /api/finance/categories/?tipo=receita|despesa
GET/PATCH/DELETE /api/finance/categories/<id>/
GET/POST   /api/finance/lancamentos/?tipo=&categoria=&inicio=AAAA-MM-DD&fim=AAAA-MM-DD
GET/PATCH/DELETE /api/finance/lancamentos/<id>/
GET        /api/finance/summary/?inicio=AAAA-MM-DD&fim=AAAA-MM-DD
```

Todos exigem token JWT válido.

## Validações aplicadas

- Valor do lançamento deve ser maior que zero.
- Categoria deve ser do mesmo tipo do lançamento (receita/despesa).
- Nome de categoria é único.
- Categoria com lançamentos não pode ser excluída.
- Período inválido: `fim` anterior a `inicio` é rejeitado; datas fora do formato AAAA-MM-DD geram 400.
- Responsável do lançamento é definido pelo usuário autenticado e não pode ser alterado pela API.

## Pendências para as próximas tasks

1. Definir sistema de perfis em `users` para restringir o financeiro ao administrador (Task 08).
2. Implementar `orders` para integrar pedidos concluídos às receitas sem duplicidade (Tasks 05 e 06).
3. Testes integrados de cancelamento de pedido e duplicidade de receita (Task 09).