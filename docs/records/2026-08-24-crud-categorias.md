# CRUD de categorias

**Data:** 24 de agosto de 2026  
**Status:** Concluída  
**Responsável:** Danilo Augusto

## Objetivo

Implementar o primeiro CRUD do catálogo para categorizar os produtos vendidos.

## Decisões

- A categoria possui nome único, descrição opcional e situação ativa/inativa.
- As rotas internas exigem usuário autenticado por JWT; perfis específicos serão incluídos na task de autorização.
- A lista é ordenada alfabeticamente pelo nome.

## Entregas

- Modelo `Categoria`, migração inicial e administração no Django Admin.
- API em `/api/catalog/categorias/` com criação, listagem, consulta, atualização completa e exclusão.
- Testes de CRUD, acesso sem autenticação e nome duplicado.

## Verificações

Os comandos `python manage.py check`, `python manage.py makemigrations --check --dry-run` e `python manage.py test` devem ser executados dentro de `backend/` em um ambiente com Python e as dependências instaladas.
