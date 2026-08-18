## Task 1 - Definição de dados e regras


**Estrutura: Campo | Tipo | Obrigatório | Descrição | Regra de negócio**

> Observação: os campos `id` serão criados automaticamente pelo Django e não devem ser preenchidos manualmente pelos usuários da API.


Categoria:

id | Int | Automático | Identificador da categoria | Deve ser único
Nome | String | Sim | Nome da categoria | Não pode ser vazio, não pode ter mais de 255 caracteres
Descricao | String | Não | Descrição da categoria | Pode ser nula
Status | Boolean | Sim | Indica se está ativa | Não pode ser nulo; uma categoria inativa não pode receber novos produtos
created_at | DateTime | Automático | Data/hora de criação | Registrada automaticamente
updated_at | DateTime | Automático | Data/hora da última alteração | Atualizada automaticamente


Produto:

id | Int | Automático | Identificador do produto | Deve ser único
Nome | String | Sim | Nome do produto | Não pode ser vazio, não pode ter outro produto com mesmo nome
Descricao | String | Não | Descrição do produto | Pode ser nula
Preco | Decimal(10,2) | Sim | Preço de venda | Deve ser maior que 0
categoria_id | Int | Sim | Categoria do produto | Deve referenciar uma categoria existente e ativa no momento do cadastro
Disponibilidade | Boolean | Sim | Indica se está disponível | Não pode ser nulo; se `false`, o produto não pode ser vendido. A validação automática com o estoque será implementada após a task de receita e baixa automática
Imagem | String | Não | Referência de imagem | Pode ser adicionada posteriormente
created_at | DateTime | Automático | Data/hora de criação | Registrada automaticamente
updated_at | DateTime | Automático | Data/hora da última alteração | Atualizada automaticamente


Insumo:

id | Int | Automático | Identificador | Deve ser único
Nome | String | Sim | Nome do insumo | Não pode ser vazio
Unidade_medida | Enum | Sim | Unidade utilizada | Deve possuir uma unidade válida: KG, G, L, ML ou UN
Quantidade_atual | Decimal(10,3) | Sim | Quantidade disponível | Não pode ser negativa
Estoque_minimo | Decimal(10,3) | Sim | Quantidade mínima desejada | Não pode ser negativa; quando `Quantidade_atual` for menor que `Estoque_minimo`, o sistema deve indicar necessidade de reposição
created_at | DateTime | Automático | Data/hora de criação | Registrada automaticamente
updated_at | DateTime | Automático | Data/hora da última alteração | Atualizada automaticamente


Movimentacao:

id | Int | Automático | Identificador | Deve ser único
Tipo | Enum | Sim | Entrada ou saída | Aceita apenas `ENTRADA` e `SAÍDA`; uma saída não pode ser maior que o saldo disponível do insumo
Quantidade | Decimal(10,3) | Sim | Quantidade movimentada | Deve ser maior que 0; uma entrada aumenta e uma saída diminui a quantidade disponível
Motivo | Enum | Sim | Motivo da movimentação | Deve ser um motivo previamente definido: compra, baixa por pedido, perda, devolução ou ajuste
Data | DateTime | Automático | Data/hora da movimentação | Registrada pelo servidor; não pode ser futura
Responsavel | ForeignKey(User) | Sim | Pessoa responsável | Deve referenciar um usuário existente e autorizado no sistema
insumo_id | Int | Sim | Insumo movimentado | Deve referenciar um insumo existente

**Regra adicional:** movimentações são registros de auditoria e não devem ser editadas ou removidas. Caso exista erro, deve ser criada uma nova movimentação do tipo `AJUSTE`.


**Relacionamentos**

Categoria ----> Produto     Cardinalidade: 1:N    Regra: Uma categoria pode ter varios produtos
Insumo ----> Movimentacao   Cardinalidade: 1:N    Regra: Um insumo pode ter varias movimentacoes
Produto <----> Insumo       Cardinalidade: N:N    Regra: Um produto pode utilizar vários insumos e um insumo pode ser utilizado em vários produtos

## Relação Produto × Insumo

A cardinalidade N:N deve ser implementada em uma task posterior por meio de uma entidade intermediária, sugerida como `ReceitaItem` ou `ProdutoInsumo`.

Além das chaves de Produto e Insumo, essa entidade deverá guardar a **quantidade do insumo necessária para produzir/vender uma unidade do produto**. Ela será utilizada futuramente para validar disponibilidade e realizar a baixa automática de estoque após a confirmação de um pedido.

## Decisões para a implementação inicial

- A modelagem inicial pode criar Categoria, Produto, Insumo e Movimentação.
- A relação Produto × Insumo ficará para a task de receitas e baixa automática de estoque.
- A disponibilidade automática do produto em função dos insumos também ficará para essa task posterior.
- A quantidade atual do insumo deve ser atualizada de forma consistente sempre que uma movimentação for criada.
