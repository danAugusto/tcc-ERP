# TCC ERP - Lanchonete e Pastelaria

Sistema ERP desenvolvido para o Trabalho de Conclusão de Curso (TCC).
Aplicações para gestão de catálogo, estoque, financeiro, pedidos e preparo.

## Tecnologias
- **Backend:** Python, Django, Django REST Framework, PostgreSQL
- **Frontend:** Next.js, React, TailwindCSS
- **Infraestrutura:** Docker, Docker Compose

## Instalação e Execução com Docker (Recomendado)

A maneira mais fácil de rodar o projeto é utilizando o Docker e o Docker Compose.

1. Instale o [Docker Desktop](https://www.docker.com/products/docker-desktop).
2. Na raiz do projeto, renomeie o arquivo `.env.example` para `.env` dentro da pasta `backend`:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Execute o comando para subir os containers (Banco de Dados, Backend e Frontend):
   ```bash
   docker compose up -d
   ```
4. Após os containers iniciarem, execute as migrações e crie os dados iniciais do banco:
   ```bash
   docker compose exec backend python manage.py migrate
   docker compose exec backend python manage.py load_initial_data
   ```

A API estará disponível em: `http://localhost:8000/api/`
O Frontend estará disponível em: `http://localhost:3000/`

## Comandos Úteis (Docker)

- Parar a aplicação: `docker compose down`
- Ver os logs do backend: `docker compose logs -f backend`
- Criar um superusuário manualmente: `docker compose exec backend python manage.py createsuperuser`
- Acessar o shell do Django: `docker compose exec backend python manage.py shell`

## Executando o Backend Manualmente (Sem Docker)

1. Crie um ambiente virtual: `python -m venv .venv`
2. Ative o ambiente: `.venv\Scripts\activate` (Windows) ou `source .venv/bin/activate` (Linux/Mac)
3. Instale as dependências: `pip install -r backend/requirements.txt`
4. Crie o arquivo `backend/.env` com a URL do banco (`DATABASE_URL=sqlite:///db.sqlite3` para rodar sem Postgres local).
5. Execute as migrações: `python manage.py migrate`
6. Rode o servidor: `python manage.py runserver`

## Estrutura do Banco de Dados
A documentação e o Diagrama Entidade-Relacionamento estão disponíveis em `docs/der.md`.
