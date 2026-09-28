-- Schema do banco de dados para os pedidos (Supabase / PostgreSQL)
-- Tabela: pedidos

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(30) NOT NULL DEFAULT 'aguardando_pagamento', -- aguardando_pagamento, pago, expirado, cancelado
  cliente JSONB NOT NULL, -- { nome, email, whatsapp, cpf, endereco: { cep, logradouro, numero, complemento, bairro, cidade, uf } }
  itens JSONB NOT NULL, -- lista de itens, kit, cores, bumps, upsell
  subtotal INTEGER NOT NULL, -- em centavos (ex: 6790 = R$ 67,90)
  total INTEGER NOT NULL, -- em centavos (ex: 6790 = R$ 67,90)
  envio VARCHAR(20) NOT NULL DEFAULT 'padrao', -- 'padrao' | 'prioritario'
  txid VARCHAR(100),
  copia_e_cola TEXT,
  expira_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  webhook_token VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para buscas rápidas e webhooks
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_txid ON pedidos(txid);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em ON pedidos(criado_em);

-- Ativar Row Level Security (RLS) sem políticas públicas.
-- Somente o backend com a service_role key tem permissão de leitura/escrita.
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
