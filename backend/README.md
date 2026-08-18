# Backend — Django e Django REST Framework

Tudo que envolve API, CRUD, banco, autenticação, regras de negócio e testes fica nesta pasta.

`manage.py` é o ponto oficial de comandos do Django. Execute os comandos abaixo a partir de `backend/`.

## Onde editar

| Necessidade | Local |
| --- | --- |
| Configurações globais, banco, JWT e URLs-raiz | `config/` |
| Login, cadastro, usuários, perfis e permissões | `users/` |
| Categorias, produtos, cardápio e futura ficha técnica | `catalog/` |
| Insumos, saldo, alertas e movimentações | Futuro app `inventory/`. |
| Pedidos e itens de pedido | `orders/` |
| Fila da cozinha, status e FIFO | Futuro app `preparation/`. |
| Registros financeiros | `finance/` |

## Estrutura de um módulo CRUD

Hoje, os apps `users/`, `catalog/`, `finance/` e `orders/` existem. O `catalog/` é o esqueleto inicial do próximo CRUD. Para os domínios restantes, crie o app aprovado (`inventory` ou `preparation`) com `python manage.py startapp nome_do_modulo` quando a issue começar.

Em seguida, mantenha os arquivos abaixo no próprio app:

```text
catalog/  # mesma estrutura para qualquer app futuro
  models.py        Entidades e relacionamentos do banco
  serializers.py   JSON de entrada e saída da API
  views.py         Endpoints
  urls.py          Rotas do módulo
  services.py      Regras de negócio e operações transacionais
  permissions.py   Permissões específicas, se houver
  admin.py         Recursos do painel administrativo
  tests.py         Testes do módulo
  migrations/      Histórico das alterações de banco
```

Registre um app novo em `config/settings.py` e conecte suas rotas em `config/urls.py`. Não crie apps vazios antecipadamente. A divisão evita que a baixa de estoque, a fila FIFO e os registros financeiros fiquem acoplados ao CRUD de produtos ou de pedidos.

Antes de adicionar código ao catálogo, leia o [guia do CRUD](../docs/CATALOG_CRUD_GUIDE.md).

## Comandos úteis

```powershell
python manage.py check
python manage.py test
python manage.py makemigrations
python manage.py migrate
```
