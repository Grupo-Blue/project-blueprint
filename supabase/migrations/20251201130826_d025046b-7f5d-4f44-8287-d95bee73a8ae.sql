-- Adicionar NOTION ao enum tipo_integracao
ALTER TYPE tipo_integracao ADD VALUE IF NOT EXISTS 'NOTION';

-- Criar tabela cliente_notion
CREATE TABLE IF NOT EXISTS cliente_notion (
  id_cliente uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_notion varchar NOT NULL UNIQUE,
  nome varchar NOT NULL,
  cpf_cnpj varchar,
  telefone varchar,
  data_nascimento date,
  email text,
  email_secundario text,
  status_cliente varchar NOT NULL DEFAULT 'cliente',
  produtos_contratados jsonb DEFAULT '[]'::jsonb,
  anos_fiscais jsonb DEFAULT '[]'::jsonb,
  last_edited_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes para match eficiente
CREATE INDEX IF NOT EXISTS idx_cliente_notion_email ON cliente_notion(email);
CREATE INDEX IF NOT EXISTS idx_cliente_notion_email_sec ON cliente_notion(email_secundario);
CREATE INDEX IF NOT EXISTS idx_cliente_notion_status ON cliente_notion(status_cliente);

-- RLS Policies
ALTER TABLE cliente_notion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver clientes notion" ON cliente_notion 
  FOR SELECT USING (true);

CREATE POLICY "Admin pode gerenciar clientes notion" ON cliente_notion 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Adicionar campos na tabela lead
ALTER TABLE lead 
  ADD COLUMN IF NOT EXISTS id_cliente_notion uuid REFERENCES cliente_notion(id_cliente),
  ADD COLUMN IF NOT EXISTS cliente_status varchar;

-- Trigger para updated_at
CREATE TRIGGER update_cliente_notion_updated_at
  BEFORE UPDATE ON cliente_notion
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();