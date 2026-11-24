# CRUD de insumos

**Data:** 1 de setembro de 2026  
**Status:** Concluída  
**Responsável:** Danilo Augusto

## Objetivo

Implementar a estrutura e o CRUD interno dos insumos usados pela operação.

## Decisões

- Cada insumo possui nome único, unidade de medida, saldo atual e estoque mínimo.
- As unidades aceitas são `KG`, `G`, `L`, `ML` e `UN`.
- Saldo e estoque mínimo aceitam até três casas decimais e não podem ser negativos.
- Movimentações, alertas, receitas e baixa automática pertencem às tasks posteriores.

## Entregas

- Novo app `inventory` registrado no Django.
- API JWT em `/api/inventory/insumos/` com CRUD completo.
- Administração no Django Admin e testes automatizados.

## Verificações

Executados em `backend/` em 1 de setembro de 2026:

- `python manage.py makemigrations inventory`: migração `inventory.0001_initial` criada;
- `python manage.py migrate`: migração aplicada com sucesso;
- `python manage.py check`: nenhum problema identificado;
- `python manage.py makemigrations --check --dry-run`: nenhuma alteração pendente;
- `python manage.py test`: 21 testes executados com sucesso.
