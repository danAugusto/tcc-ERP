-- ==============================================================================
-- TCC - SISTEMA ERP LANCHONETE E PASTELARIA
-- SCRIPT COMPLETO DE CRIAÇÃO DO BANCO DE DADOS (POSTGRESQL DDL)
-- ==============================================================================

-- Criação do banco de dados (caso executado fora do container)
-- CREATE DATABASE tcc_erp WITH ENCODING 'UTF8' LC_COLLATE='en_US.utf8' LC_CTYPE='en_US.utf8';

-- ==============================================================================
-- 1. MÓDULO DE USUÁRIOS, PERFIS E AUTENTICAÇÃO
-- ==============================================================================

-- Tabela principal de usuários do sistema (Admin, Atendente, Cozinheiro, Cliente)
CREATE TABLE IF NOT EXISTS public.auth_user (
    id SERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE NULL,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    username VARCHAR(150) NOT NULL UNIQUE,
    first_name VARCHAR(150) NOT NULL DEFAULT '',
    last_name VARCHAR(150) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Perfil estendido com papel (role) e telefone
CREATE TABLE IF NOT EXISTS public.users_perfil (
    id BIGSERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL DEFAULT 'atendente', -- 'admin', 'atendente', 'cozinha', 'cliente'
    fone VARCHAR(20) NOT NULL DEFAULT '',
    user_id INTEGER NOT NULL UNIQUE,
    CONSTRAINT users_perfil_user_id_fk FOREIGN KEY (user_id) 
        REFERENCES public.auth_user(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

-- Tabelas auxiliares de grupos e permissões nativas
CREATE TABLE IF NOT EXISTS public.auth_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.django_content_type (
    id SERIAL PRIMARY KEY,
    app_label VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    CONSTRAINT django_content_type_app_label_model_uniq UNIQUE (app_label, model)
);

CREATE TABLE IF NOT EXISTS public.auth_permission (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL,
    codename VARCHAR(100) NOT NULL,
    CONSTRAINT auth_permission_content_type_id_codename_uniq UNIQUE (content_type_id, codename),
    CONSTRAINT auth_permission_content_type_fk FOREIGN KEY (content_type_id) 
        REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.auth_group_permissions (
    id BIGSERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    CONSTRAINT auth_group_permissions_group_id_permission_id_uniq UNIQUE (group_id, permission_id),
    CONSTRAINT auth_group_permissions_group_id_fk FOREIGN KEY (group_id) 
        REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT auth_group_permissions_permission_id_fk FOREIGN KEY (permission_id) 
        REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.auth_user_groups (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    CONSTRAINT auth_user_groups_user_id_group_id_uniq UNIQUE (user_id, group_id),
    CONSTRAINT auth_user_groups_user_id_fk FOREIGN KEY (user_id) 
        REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT auth_user_groups_group_id_fk FOREIGN KEY (group_id) 
        REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.auth_user_user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    CONSTRAINT auth_user_user_permissions_user_id_permission_id_uniq UNIQUE (user_id, permission_id),
    CONSTRAINT auth_user_user_permissions_user_id_fk FOREIGN KEY (user_id) 
        REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT auth_user_user_permissions_permission_id_fk FOREIGN KEY (permission_id) 
        REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED
);

-- ==============================================================================
-- 2. MÓDULO DE CATÁLOGO / CARDÁPIO (CATEGORIAS E PRODUTOS)
-- ==============================================================================

-- Categorias de Produtos (Lanches, Bebidas, Pasteis, etc.)
CREATE TABLE IF NOT EXISTS public.catalog_categoria (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT NOT NULL DEFAULT '',
    status BOOLEAN NOT NULL DEFAULT TRUE
);

-- Produtos comercializados no cardápio
CREATE TABLE IF NOT EXISTS public.catalog_produto (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    preco NUMERIC(10, 2) NOT NULL,
    disponibilidade BOOLEAN NOT NULL DEFAULT TRUE,
    categoria_id BIGINT NOT NULL,
    CONSTRAINT catalog_produto_categoria_id_fk FOREIGN KEY (categoria_id) 
        REFERENCES public.catalog_categoria(id) DEFERRABLE INITIALLY DEFERRED
);

-- ==============================================================================
-- 3. MÓDULO DE ESTOQUE E RECEITAS / FICHAS TÉCNICAS (INVENTORY)
-- ==============================================================================

-- Insumos e matérias-primas (Carne moída, Queijo mussarela, Farinha, etc.)
CREATE TABLE IF NOT EXISTS public.inventory_insumo (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    unidade_medida VARCHAR(20) NOT NULL, -- 'kg', 'g', 'l', 'ml', 'un'
    quantidade_atual NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    estoque_minimo NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    custo_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- Composição do Produto / Ficha Técnica (quanto de cada insumo vai no produto)
CREATE TABLE IF NOT EXISTS public.inventory_receitaitem (
    id BIGSERIAL PRIMARY KEY,
    quantidade_necessaria NUMERIC(10, 3) NOT NULL,
    insumo_id BIGINT NOT NULL,
    produto_id BIGINT NOT NULL,
    CONSTRAINT inventory_receitaitem_insumo_id_fk FOREIGN KEY (insumo_id) 
        REFERENCES public.inventory_insumo(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT inventory_receitaitem_produto_id_fk FOREIGN KEY (produto_id) 
        REFERENCES public.catalog_produto(id) DEFERRABLE INITIALLY DEFERRED
);

-- Histórico de movimentações de estoque (Entrada, Saída, Ajuste, Descarte)
CREATE TABLE IF NOT EXISTS public.inventory_movimentacao (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL, -- 'entrada', 'saida', 'ajuste', 'descarte'
    quantidade NUMERIC(10, 3) NOT NULL,
    motivo VARCHAR(255) NOT NULL DEFAULT '',
    data TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    insumo_id BIGINT NOT NULL,
    responsavel_id INTEGER NULL,
    CONSTRAINT inventory_movimentacao_insumo_id_fk FOREIGN KEY (insumo_id) 
        REFERENCES public.inventory_insumo(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT inventory_movimentacao_responsavel_id_fk FOREIGN KEY (responsavel_id) 
        REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED
);

-- ==============================================================================
-- 4. MÓDULO DE PEDIDOS E ATENDIMENTO (ORDERS, MESA, BALCÃO, COMANDA)
-- ==============================================================================

-- Pedidos realizados no caixa / balcão / mesas / delivery
CREATE TABLE IF NOT EXISTS public.orders_pedido (
    id BIGSERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'criado', -- 'criado', 'confirmado', 'em_preparo', 'pronto', 'entregue', 'finalizado', 'cancelado', 'arquivado'
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'dinheiro', -- 'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'outros'
    valor_recebido NUMERIC(10, 2) NULL,
    troco NUMERIC(10, 2) NULL,
    tipo_atendimento VARCHAR(20) NOT NULL DEFAULT 'balcao', -- 'mesa', 'balcao', 'delivery', 'retirada'
    numero_mesa VARCHAR(50) NOT NULL DEFAULT 'Balcão',
    numero_comanda VARCHAR(20) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE NULL,
    cancellation_reason TEXT NOT NULL DEFAULT '',
    cancelled_by_id INTEGER NULL,
    cliente_id INTEGER NULL,
    CONSTRAINT orders_pedido_cliente_id_fk FOREIGN KEY (cliente_id) 
        REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT orders_pedido_cancelled_by_id_fk FOREIGN KEY (cancelled_by_id) 
        REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED
);

-- Endereço de entrega para pedidos de Delivery (relação 1:1 com Pedido)
CREATE TABLE IF NOT EXISTS public.orders_enderecopedido (
    id BIGSERIAL PRIMARY KEY,
    cep VARCHAR(9) NOT NULL,
    logradouro VARCHAR(255) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100) NOT NULL DEFAULT '',
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    pedido_id BIGINT NOT NULL UNIQUE,
    CONSTRAINT orders_enderecopedido_pedido_id_fk FOREIGN KEY (pedido_id) 
        REFERENCES public.orders_pedido(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

-- Itens que compõem o pedido
CREATE TABLE IF NOT EXISTS public.orders_itempedido (
    id BIGSERIAL PRIMARY KEY,
    quantidade INTEGER NOT NULL,
    preco_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    pedido_id BIGINT NOT NULL,
    produto_id BIGINT NOT NULL,
    CONSTRAINT orders_itempedido_pedido_id_fk FOREIGN KEY (pedido_id) 
        REFERENCES public.orders_pedido(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT orders_itempedido_produto_id_fk FOREIGN KEY (produto_id) 
        REFERENCES public.catalog_produto(id) DEFERRABLE INITIALLY DEFERRED
);

-- ==============================================================================
-- 5. MÓDULO DE COZINHA E PREPARO KDS (PREPARATION)
-- ==============================================================================

-- Fila de preparação de pedidos na cozinha (KDS)
CREATE TABLE IF NOT EXISTS public.preparation_preparo (
    id BIGSERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente', -- 'pendente', 'em_preparo', 'pronto', 'entregue'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE NULL,
    finished_at TIMESTAMP WITH TIME ZONE NULL,
    pedido_id BIGINT NOT NULL UNIQUE,
    CONSTRAINT preparation_preparo_pedido_id_fk FOREIGN KEY (pedido_id) 
        REFERENCES public.orders_pedido(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

-- ==============================================================================
-- 6. MÓDULO FINANCEIRO (FINANCE)
-- ==============================================================================

-- Categorias financeiras (Vendas, Fornecedores, Despesas Operacionais, etc.)
CREATE TABLE IF NOT EXISTS public.finance_financecategory (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'receita', 'despesa'
    description TEXT NOT NULL DEFAULT ''
);

-- Lançamentos financeiros / Fluxo de caixa
CREATE TABLE IF NOT EXISTS public.finance_lancamento (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL, -- 'receita', 'despesa'
    value NUMERIC(10, 2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    payment_method VARCHAR(20) NOT NULL, -- 'dinheiro', 'pix', 'credito', 'debito', 'boleto'
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    category_id BIGINT NULL,
    pedido_id BIGINT NULL,
    responsible_id INTEGER NULL,
    CONSTRAINT finance_lancamento_category_id_fk FOREIGN KEY (category_id) 
        REFERENCES public.finance_financecategory(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT finance_lancamento_pedido_id_fk FOREIGN KEY (pedido_id) 
        REFERENCES public.orders_pedido(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT finance_lancamento_responsible_id_fk FOREIGN KEY (responsible_id) 
        REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED
);

-- ==============================================================================
-- 7. TABELAS DE SUPORTE E SESSÕES DJANGO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.django_session (
    session_key VARCHAR(40) PRIMARY KEY,
    session_data TEXT NOT NULL,
    expire_date TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.django_admin_log (
    id SERIAL PRIMARY KEY,
    action_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    object_id TEXT NULL,
    object_repr VARCHAR(200) NOT NULL,
    action_flag SMALLINT NOT NULL,
    change_message TEXT NOT NULL,
    content_type_id INTEGER NULL,
    user_id INTEGER NOT NULL,
    CONSTRAINT django_admin_log_content_type_fk FOREIGN KEY (content_type_id) 
        REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT django_admin_log_user_id_fk FOREIGN KEY (user_id) 
        REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.django_migrations (
    id BIGSERIAL PRIMARY KEY,
    app VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 8. ÍNDICES DE PERFORMANCE E OTIMIZAÇÃO DE BUSCA
-- ==============================================================================

CREATE INDEX IF NOT EXISTS catalog_produto_categoria_id_idx ON public.catalog_produto (categoria_id);
CREATE INDEX IF NOT EXISTS inventory_receitaitem_insumo_id_idx ON public.inventory_receitaitem (insumo_id);
CREATE INDEX IF NOT EXISTS inventory_receitaitem_produto_id_idx ON public.inventory_receitaitem (produto_id);
CREATE INDEX IF NOT EXISTS inventory_movimentacao_insumo_id_idx ON public.inventory_movimentacao (insumo_id);
CREATE INDEX IF NOT EXISTS inventory_movimentacao_responsavel_id_idx ON public.inventory_movimentacao (responsavel_id);
CREATE INDEX IF NOT EXISTS orders_pedido_cliente_id_idx ON public.orders_pedido (cliente_id);
CREATE INDEX IF NOT EXISTS orders_pedido_cancelled_by_id_idx ON public.orders_pedido (cancelled_by_id);
CREATE INDEX IF NOT EXISTS orders_pedido_status_idx ON public.orders_pedido (status);
CREATE INDEX IF NOT EXISTS orders_itempedido_pedido_id_idx ON public.orders_itempedido (pedido_id);
CREATE INDEX IF NOT EXISTS orders_itempedido_produto_id_idx ON public.orders_itempedido (produto_id);
CREATE INDEX IF NOT EXISTS preparation_preparo_status_idx ON public.preparation_preparo (status);
CREATE INDEX IF NOT EXISTS finance_lancamento_category_id_idx ON public.finance_lancamento (category_id);
CREATE INDEX IF NOT EXISTS finance_lancamento_pedido_id_idx ON public.finance_lancamento (pedido_id);
CREATE INDEX IF NOT EXISTS finance_lancamento_responsible_id_idx ON public.finance_lancamento (responsible_id);
CREATE INDEX IF NOT EXISTS django_session_expire_date_idx ON public.django_session (expire_date);
