# CRUD de produtos

**Data:** 31 de agosto de 2026  
**Status:** Concluída  
**Responsável:** Danilo Augusto

## Objetivo

Implementar o CRUD interno dos produtos comercializados pelo restaurante.

## Decisões

- Produto possui nome único, descrição opcional, preço decimal positivo e disponibilidade.
- Todo produto pertence a uma categoria existente e ativa no momento do cadastro ou alteração.
- Categorias com produtos não podem ser excluídas, para preservar a integridade dos dados.
- Imagem, estoque, receitas e pedidos permanecem fora desta task.

## Entregas

- Modelo `Produto`, relacionado a `Categoria`.
- API JWT em `/api/catalog/produtos/` com CRUD completo.
- Validações para preço, nome e categoria.
- Configuração no Django Admin e testes automatizados.

## Verificações

Executados em `backend/` em 31 de agosto de 2026:

- `manage.py check`: nenhum problema identificado;
- `manage.py makemigrations --check --dry-run`: nenhuma alteração pendente;
- `manage.py test`: 15 testes executados com sucesso;
- `manage.py migrate`: migração `catalog.0003_produto` aplicada com sucesso.
