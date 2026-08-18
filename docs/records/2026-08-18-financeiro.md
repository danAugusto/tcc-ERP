# Módulo Financeiro — regras e registro de implementação

**Data:** 18 de agosto de 2026
**Status:** Tasks 01 a 09 concluídas
**Responsável:** Equipe do TCC

## Task 01 — Regras financeiras

### O que é receita e despesa

- **Receita:** entrada de valores, criada manualmente ou automaticamente a partir de pedidos entregues. Ex.: vendas e outros ganhos.
- **Despesa:** saída de valores, criada manualmente. Ex.: compra de insumos, aluguel e manutenção.

### Formas de pagamento

- Formas de pagamento disponíveis no lançamento: dinheiro, cartão de débito, cartão de crédito, pix e outros.
- Campo `payment_method` é opcional (padrão `outros`); receitas geradas de pedidos usam o padrão até o pedido registrar a forma.

### Quando uma venda vira receita

- **Decisão:** a venda vira receita quando o pedido atinge o status **entregue** (conclusão).
- Pedidos cancelados antes da entrega não geram receita.
- A receita é criada automaticamente pela Task 05, vinculada ao pedido de origem e protegida contra duplicidade (um pedido gera no máximo um lançamento).

### Categorias de receita e despesa

- Receita: Vendas, Outros ganhos.
- Despesa: Compra de insumos, Aluguel, Manutenção.
- Novas categorias podem ser criadas pela API; cada lançamento deve pertencer a uma categoria do mesmo tipo.

### Perfis que acessam o financeiro

- Somente administradores acessam e alteram o financeiro (Task 08).
- A restrição considera o perfil de acesso `users.Perfil` (role `administrador`) ou contas `is_staff`/`is_superuser`.

## Tasks implementadas

| Task | Entrega | Situação |
| --- | --- | --- |
| 02 — Estrutura do módulo | App `finance`, modelos `Lancamento` e `FinanceCategory`, migrações, Django Admin. | Concluída |
| 03 — CRUD de lançamentos | Endpoints `lancamentos/` com validação de valor positivo e tipo/categoria. | Concluída |
| 04 — Categorias financeiras | Modelo, seed das categorias padrão, relação com lançamentos e endpoints de categorias. | Concluída |
| 05 — Integração pedidos → receitas | App `orders` mínimo (modelo `Pedido` e fluxo de status) + receita automática na entrega, sem duplicidade. | Concluída |
| 06 — Consultas e filtros | Filtros por tipo, período e categoria na listagem de lançamentos; vínculo com o pedido de origem. | Concluída |
| 07 — Resumo financeiro | Rota `summary/` com totais de receitas, despesas e saldo por período. | Concluída |
| 08 — Permissões e auditoria | Apenas administradores acessam o financeiro; responsável registrado automaticamente e não alterável pela API. | Concluída |
| 09 — Testes, revisão e documentação | 49 testes (CRUD, validações, filtros, resumo, integração, permissões); este registro. | Concluída |

## Módulos de apoio criados

### `users` — Perfil de acesso

- Modelo `Perfil` (role: cliente, atendente, cozinheiro, administrador), criado automaticamente no registro do usuário.
- Migração `0002` faz backfill dos usuários existentes.

### `orders` — Pedidos (mínimo)

- Modelo `Pedido` com status: criado, confirmado, em preparo, pronto, entregue, cancelado.
- Regras de transição de status e criação de receita na entrega.
- Não é possível excluir pedido entregue (já gerou receita).

## Endpoints disponíveis

```text
# Financeiro (somente administradores)
GET/POST   /api/finance/categories/?tipo=receita|despesa
GET/PATCH/DELETE /api/finance/categories/<id>/
GET/POST   /api/finance/lancamentos/?tipo=&categoria=&pedido=&inicio=AAAA-MM-DD&fim=AAAA-MM-DD
GET/PATCH/DELETE /api/finance/lancamentos/<id>/
GET        /api/finance/summary/?inicio=AAAA-MM-DD&fim=AAAA-MM-DD

# Pedidos (qualquer usuário autenticado)
GET/POST   /api/orders/
GET/PATCH/DELETE /api/orders/<id>/
```

Todos exigem token JWT válido.

## Validações aplicadas

- Valor do lançamento e total do pedido devem ser maiores que zero.
- Categoria deve ser do mesmo tipo do lançamento (receita/despesa).
- Nome de categoria é único.
- Categoria com lançamentos não pode ser excluída.
- Período inválido: `fim` anterior a `inicio` é rejeitado; datas fora do formato AAAA-MM-DD geram 400.
- Responsável do lançamento é definido pelo usuário autenticado e não pode ser alterado pela API.
- Transições de status de pedido seguem o fluxo: criado → confirmado → em preparo → pronto → entregue, com cancelamento permitido antes da entrega.
- Pedido entregue não pode ser excluído nem gerar receita duplicada.

## Verificação

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test   # 49 testes
```

## Pendências futuras (fora do escopo financeiro)

1. Módulo `orders` completo: itens de pedido, ficha técnica e baixa de estoque.
2. Relatórios operacionais e formas de pagamento por pedido.
3. Frontend para consumo da API.