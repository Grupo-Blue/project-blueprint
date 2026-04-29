
-- =========================================================================
-- VISÃO 360 COMERCIAL — BLUE CONSULT (Fase 1.1: schema fundacional)
-- =========================================================================

-- Necessário para fuzzy matching (Levenshtein, similaridade)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -------------------------------------------------------------------------
-- Função utilitária: client_key canônico
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.blue_client_key(_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
  parts text[];
  filtered text[];
  p text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  -- lowercase + remove acentos
  s := lower(unaccent(_raw));
  -- remove pontuação e mantém só letras/espaço
  s := regexp_replace(s, '[^a-z\s]', '', 'g');
  -- colapsa espaços
  s := regexp_replace(s, '\s+', ' ', 'g');
  s := trim(s);
  IF s = '' THEN RETURN NULL; END IF;
  -- split + filtra tokens com mais de 1 char (descarta "da", "de" não — eles têm 2; descarta apenas iniciais "j", "a")
  parts := string_to_array(s, ' ');
  filtered := ARRAY[]::text[];
  FOREACH p IN ARRAY parts LOOP
    IF length(p) > 1 THEN
      filtered := array_append(filtered, p);
    END IF;
  END LOOP;
  IF array_length(filtered, 1) IS NULL THEN RETURN NULL; END IF;
  -- ordena alfabeticamente para tornar o match estável
  SELECT array_agg(x ORDER BY x) INTO filtered FROM unnest(filtered) AS x;
  RETURN array_to_string(filtered, '-');
END;
$$;

-- unaccent precisa estar disponível (ext)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- -------------------------------------------------------------------------
-- Tabela: blue_cliente_raw_info  (espelho de "Info Clientes")
-- -------------------------------------------------------------------------
CREATE TABLE public.blue_cliente_raw_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text NOT NULL UNIQUE,
  notion_last_edited timestamptz,

  nome_cliente text,
  client_key text GENERATED ALWAYS AS (public.blue_client_key(nome_cliente)) STORED,

  cpf_cnpj text,
  email_principal text,
  email_secundario text,
  telefone_1 text,
  telefone_2 text,
  uf text,
  cidade text,
  cep text,
  endereco text,
  data_nascimento date,
  perfil_cliente text[],
  produtos text[],
  cliente_inativo boolean DEFAULT false,
  data_cancelamento date,
  motivo_cancelamento text,
  vencimento_procuracao date,
  apuracao_b3 text,
  preenchimento_ir_geral text,
  historico_acessorias text,
  historico_pier text,
  raw_payload jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blue_raw_info_client_key ON public.blue_cliente_raw_info (client_key);
CREATE INDEX idx_blue_raw_info_cpf ON public.blue_cliente_raw_info (cpf_cnpj);

-- -------------------------------------------------------------------------
-- Tabela: blue_cliente_raw_crm  (espelho de "CRM Blue Consult - Clientes")
-- -------------------------------------------------------------------------
CREATE TABLE public.blue_cliente_raw_crm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text NOT NULL UNIQUE,
  notion_last_edited timestamptz,

  cliente text,
  client_key text GENERATED ALWAYS AS (public.blue_client_key(cliente)) STORED,

  nivel numeric,
  prioridade text,
  responsavel text,
  status_2021 text,
  status_2022 text,
  status_2023 text,
  status_2024 text,
  status_2025 text,
  preenchimento_ir_geral_2026 text,
  apuracao_b3 text,
  cronograma_inicio timestamptz,
  cronograma_fim timestamptz,
  fim boolean DEFAULT false,
  irpf_cripto_preenchido boolean DEFAULT false,
  validou_dez_2025 boolean DEFAULT false,
  formalizou_sol_docs boolean DEFAULT false,
  raw_payload jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blue_raw_crm_client_key ON public.blue_cliente_raw_crm (client_key);

-- -------------------------------------------------------------------------
-- Tabela: blue_cliente_raw_2026  (espelho de "CRM 2026")
-- -------------------------------------------------------------------------
CREATE TABLE public.blue_cliente_raw_2026 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text NOT NULL UNIQUE,
  notion_last_edited timestamptz,

  cliente text,
  client_key text GENERATED ALWAYS AS (public.blue_client_key(cliente)) STORED,

  status_2026 text,
  apuracao_b3 text,
  ir_geral_2026 text,
  responsavel text,
  cronograma_inicio timestamptz,
  cronograma_fim timestamptz,
  card_2025_anteriores text,
  card_informacoes_cliente text,
  raw_payload jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blue_raw_2026_client_key ON public.blue_cliente_raw_2026 (client_key);

-- -------------------------------------------------------------------------
-- Tabela: blue_cliente_360  (visão consolidada)
-- -------------------------------------------------------------------------
CREATE TABLE public.blue_cliente_360 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text NOT NULL UNIQUE,

  nome_canonico text,
  cpf_cnpj text,
  contato_email text,
  contato_whatsapp text,
  uf text,
  cidade text,
  perfil_psicografico text[],
  produtos_contratados text[],

  cliente_ativo boolean DEFAULT true,
  data_cancelamento date,
  motivo_cancelamento text,
  vencimento_procuracao date,

  nivel numeric,
  prioridade text,
  responsavel_cs text,

  historico_anos jsonb,             -- {"2021": "Finalizada", "2022": "Pausada", ...}
  anos_finalizados integer DEFAULT 0,
  anos_pendentes integer DEFAULT 0,

  status_2026 text,
  tem_2026_ativo boolean DEFAULT false,
  ir_geral_2026 text,
  apuracao_b3_2026 text,

  fase_macro text,                  -- onboarding | execucao | aprovacao | concluido | parado | inativo
  gatilho_principal text,
  oportunidades jsonb DEFAULT '[]'::jsonb,
  filas text[] DEFAULT ARRAY[]::text[], -- subset de {renovacao, upsell, resgate, winback}
  score_priorizacao numeric DEFAULT 0,

  -- ponteiros para os raws de origem (auditabilidade)
  raw_info_id uuid REFERENCES public.blue_cliente_raw_info(id) ON DELETE SET NULL,
  raw_crm_id uuid REFERENCES public.blue_cliente_raw_crm(id) ON DELETE SET NULL,
  raw_2026_id uuid REFERENCES public.blue_cliente_raw_2026(id) ON DELETE SET NULL,

  -- vínculo opcional com lead/Amélia (preenchido posteriormente)
  id_lead uuid,
  amelia_contact_id text,

  ultima_atualizacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blue_360_filas ON public.blue_cliente_360 USING GIN (filas);
CREATE INDEX idx_blue_360_score ON public.blue_cliente_360 (score_priorizacao DESC);
CREATE INDEX idx_blue_360_uf ON public.blue_cliente_360 (uf);
CREATE INDEX idx_blue_360_responsavel ON public.blue_cliente_360 (responsavel_cs);
CREATE INDEX idx_blue_360_nivel ON public.blue_cliente_360 (nivel);

-- -------------------------------------------------------------------------
-- Tabela: blue_match_revisao  (similaridade 70-85% para revisão humana)
-- -------------------------------------------------------------------------
CREATE TABLE public.blue_match_revisao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_origem text NOT NULL,                   -- 'crm' | '2026'
  raw_id uuid NOT NULL,                        -- id na tabela raw correspondente
  raw_nome text NOT NULL,
  raw_client_key text NOT NULL,
  candidato_360_id uuid REFERENCES public.blue_cliente_360(id) ON DELETE CASCADE,
  candidato_nome text,
  candidato_client_key text,
  similaridade numeric NOT NULL,               -- 0..1
  status text NOT NULL DEFAULT 'pendente',     -- pendente | confirmado | rejeitado
  resolvido_por uuid REFERENCES auth.users(id),
  resolvido_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blue_match_revisao_status ON public.blue_match_revisao (status);

-- -------------------------------------------------------------------------
-- Tabela: blue_sync_status (estado da sincronização Notion)
-- -------------------------------------------------------------------------
CREATE TABLE public.blue_sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL UNIQUE,             -- 'info' | 'crm' | '2026' | 'consolidacao'
  ultimo_run_inicio timestamptz,
  ultimo_run_fim timestamptz,
  ultimo_run_status text,                 -- 'ok' | 'erro' | 'em_execucao'
  registros_lidos integer DEFAULT 0,
  registros_upserted integer DEFAULT 0,
  registros_em_revisao integer DEFAULT 0,
  ultimo_erro text,
  metadata jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- Tabela: blue_score_config (pesos do score, ajustáveis pelo gestor)
-- -------------------------------------------------------------------------
CREATE TABLE public.blue_score_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa uuid NOT NULL UNIQUE,
  peso_nivel numeric NOT NULL DEFAULT 100,
  peso_prioridade numeric NOT NULL DEFAULT 30,
  bonus_procuracao_30d numeric NOT NULL DEFAULT 50,
  bonus_procuracao_60d numeric NOT NULL DEFAULT 25,
  bonus_aprovacao numeric NOT NULL DEFAULT 40,
  bonus_fidelidade_por_ano numeric NOT NULL DEFAULT 5,
  bonus_fidelidade_max numeric NOT NULL DEFAULT 25,
  penalty_inatividade_por_mes numeric NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.blue_score_config (id_empresa) VALUES ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db');

-- -------------------------------------------------------------------------
-- Triggers updated_at
-- -------------------------------------------------------------------------
CREATE TRIGGER trg_blue_raw_info_updated BEFORE UPDATE ON public.blue_cliente_raw_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_blue_raw_crm_updated BEFORE UPDATE ON public.blue_cliente_raw_crm
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_blue_raw_2026_updated BEFORE UPDATE ON public.blue_cliente_raw_2026
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_blue_360_updated BEFORE UPDATE ON public.blue_cliente_360
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_blue_match_rev_updated BEFORE UPDATE ON public.blue_match_revisao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_blue_score_cfg_updated BEFORE UPDATE ON public.blue_score_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- Função de acesso ao módulo (Blue Consult fixa em v1)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_blue_visao360_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'direcao'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.user_empresa
        WHERE user_id = auth.uid()
          AND id_empresa = '95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db'::uuid
      )
    )
  );
$$;

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------
ALTER TABLE public.blue_cliente_raw_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_cliente_raw_crm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_cliente_raw_2026 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_cliente_360 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_match_revisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blue_score_config ENABLE ROW LEVEL SECURITY;

-- SELECT: quem tem acesso ao módulo
CREATE POLICY "blue_raw_info_select" ON public.blue_cliente_raw_info FOR SELECT
  USING (public.user_has_blue_visao360_access());
CREATE POLICY "blue_raw_crm_select" ON public.blue_cliente_raw_crm FOR SELECT
  USING (public.user_has_blue_visao360_access());
CREATE POLICY "blue_raw_2026_select" ON public.blue_cliente_raw_2026 FOR SELECT
  USING (public.user_has_blue_visao360_access());
CREATE POLICY "blue_360_select" ON public.blue_cliente_360 FOR SELECT
  USING (public.user_has_blue_visao360_access());
CREATE POLICY "blue_match_rev_select" ON public.blue_match_revisao FOR SELECT
  USING (public.user_has_blue_visao360_access());
CREATE POLICY "blue_sync_select" ON public.blue_sync_status FOR SELECT
  USING (public.user_has_blue_visao360_access());
CREATE POLICY "blue_score_cfg_select" ON public.blue_score_config FOR SELECT
  USING (public.user_has_blue_visao360_access());

-- ALL para admin (inserts/updates/deletes só pelo backend ou por admin)
CREATE POLICY "blue_raw_info_admin_all" ON public.blue_cliente_raw_info FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "blue_raw_crm_admin_all" ON public.blue_cliente_raw_crm FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "blue_raw_2026_admin_all" ON public.blue_cliente_raw_2026 FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "blue_360_admin_all" ON public.blue_cliente_360 FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "blue_match_rev_modify" ON public.blue_match_revisao FOR ALL
  USING (public.user_has_blue_visao360_access())
  WITH CHECK (public.user_has_blue_visao360_access());
CREATE POLICY "blue_sync_admin_all" ON public.blue_sync_status FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "blue_score_cfg_admin_all" ON public.blue_score_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
