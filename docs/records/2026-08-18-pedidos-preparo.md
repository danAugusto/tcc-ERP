# Pedidos, Fila FIFO e Preparo — regras e registro de implementação

**Data:** 18 de agosto de 2026
**Status:** Tasks 01 a 08 concluídas
**Responsável:** Equipe do TCC

## Task 01 — Regras de pedidos, status e fila FIFO

### Dados de um pedido e de cada item

- **Pedido:** status, cliente, total (calculado dos itens), timestamps de confirmação/cancelamento, responsável e motivo do cancelamento.
- **Item:** produto (catálogo), quantidade, preço unitário registrado no momento da venda (snapshot) e subtotal calculado.
- O total do pedido é sempre recalculado a partir dos itens — não é informado manualmente.

### Fluxo de status

`criado → confirmado → em_preparo → pronto → entregue`

- **Cancelamento** é permitido em qualquer etapa **antes da entrega**.
- Pedidos **entregues** são finais: não mudam de status, não podem ser excluídos e geram receita financeira.
- Pedidos **cancelados** são finais e não voltam à fila.

### Permissões de alteração por status

| Ação | Permissão |
| --- | --- |
| Criar pedido | Qualquer usuário autenticado (cliente cria o próprio; equipe pode criar) |
| Visualizar | Cliente vê apenas os próprios; equipe vê todos |
| Alterar status / cancelar / excluir | Somente equipe (atendente, cozinheiro, administrador) |
| Operar a fila (próximo pedido, concluir) | Somente cozinheiro |

### Regra FIFO

- O pedido **entra na fila ao ser confirmado** (status `confirmado`).
- A fila é ordenada por `entered_at` (data de entrada), com `id` como desempate — **primeiro confirmado é o primeiro preparado**.
- Pedidos cancelados saem da fila (status `cancelado`).
- Exceção registrada: pedidos cancelados não retornam à fila.

## Tasks implementadas

| Task | Entrega | Situação |
| --- | --- | --- |
| 02 — Estrutura do módulo | App `orders` completo: `Pedido` (cliente, timestamps, cancelamento) + `ItemPedido` (produto, quantidade, preço snapshot); app `preparation` registrado. | Concluída |
| 03 — Criação e consulta | Criação com itens aninhados e total calculado; validações (item obrigatório, quantidade > 0, produto disponível); listagem/detalhe com visibilidade por perfil. | Concluída |
| 04 — Status e cancelamento | Transições validadas via `transicionar_status` (atômico); confirmação registra `confirmed_at`; cancelamento registra data, responsável e motivo. | Concluída |
| 05 — Fila FIFO | App `preparation` com modelo `Preparo` (OneToOne com pedido); entrada na fila ao confirmar; ordenação FIFO; cancelados fora da fila. | Concluída |
| 06 — Operação da cozinha | Endpoints `next/` (inicia o próximo pendente) e `<pk>/complete/` (marca pronto); somente cozinheiro. | Concluída |
| 07 — Integrações | Confirmado entra na fila; indisponibilidade de produto bloqueia criação; cancelamento atualiza fila e não gera receita. | Concluída* |
| 08 — Testes, revisão e documentação | 66 testes no total; este registro. | Concluída |

\* A baixa de estoque pertence ao epic Estoque e Produtos (#12) e será conectada quando o módulo `inventory` existir.

## Dependência criada: catálogo mínimo

- Para validar produtos nos itens, foi criado o modelo mínimo `catalog.Product` (nome, preço, disponível).
- O catálogo completo (categorias, insumos, ficha técnica, CRUD avançado) permanece no epic Estoque e Produtos (#12).

## Endpoints disponíveis

```text
# Pedidos
GET/POST   /api/orders/
GET/PATCH/DELETE /api/orders/<id>/

# Fila de preparo
GET        /api/preparation/                # fila FIFO (equipe)
POST       /api/preparation/next/           # inicia próximo pedido (cozinheiro)
POST       /api/preparation/<id>/complete/  # marca pronto (cozinheiro)

# Catálogo mínimo
GET/POST   /api/catalog/products/
GET/PATCH/DELETE /api/catalog/products/<id>/
```

Todos exigem token JWT válido.

## Validações aplicadas

- Pedido deve ter pelo menos um item; quantidade deve ser > 0; produto deve estar disponível.
- Itens só podem ser alterados enquanto o pedido está `criado`.
- Pedidos são criados apenas com status `criado`; demais transições passam pelas regras de `TRANSICOES_VALIDAS`.
- Total é somente leitura e calculado dos itens (preço snapshot × quantidade).
- Cliente não consegue alterar/excluir pedidos nem acessar pedidos de outros clientes.
- Pedido entregue não pode ser excluído nem gerar receita duplicada.
- `next/` com fila vazia retorna 400.

## Integração com o financeiro

- `transicionar_status` cria a receita (categoria Vendas) quando o pedido é **entregue**, dentro da mesma transação — preserva a regra financeira de um lançamento por pedido.

## Verificação

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test   # 66 testes
```

## Pendências futuras (fora deste epic)

1. Epic Estoque e Produtos (#12): catálogo completo, insumos, ficha técnica e baixa automática de estoque (a ser conectada à confirmação do pedido).
2. Relatórios operacionais.
3. Frontend para consumo da API.