
-- =====================================================
-- FASE 1: TABELAS DO IMPORTADOR DE IRPF (18 TABELAS)
-- =====================================================

-- 1. TABELA PRINCIPAL: irpf_declaracao
CREATE TABLE public.irpf_declaracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_lead UUID REFERENCES public.lead(id_lead),
  id_cliente_notion UUID REFERENCES public.cliente_notion(id_cliente),
  id_empresa UUID NOT NULL REFERENCES public.empresa(id_empresa),
  
  -- IDENTIFICAÇÃO COMPLETA
  cpf VARCHAR(14) NOT NULL,
  nome_contribuinte TEXT NOT NULL,
  data_nascimento DATE,
  
  -- DECLARAÇÃO
  exercicio INTEGER NOT NULL,
  ano_calendario INTEGER NOT NULL,
  tipo_declaracao VARCHAR(50) DEFAULT 'original',
  numero_recibo_anterior VARCHAR(50),
  
  -- ESTADO CIVIL/FAMILIAR
  possui_conjuge BOOLEAN DEFAULT FALSE,
  cpf_conjuge VARCHAR(14),
  nome_conjuge TEXT,
  doenca_grave_ou_deficiencia BOOLEAN DEFAULT FALSE,
  
  -- ENDEREÇO COMPLETO
  endereco_logradouro TEXT,
  endereco_numero VARCHAR(20),
  endereco_complemento TEXT,
  endereco_bairro VARCHAR(100),
  endereco_municipio VARCHAR(100),
  endereco_uf VARCHAR(2),
  endereco_cep VARCHAR(10),
  telefone_ddd VARCHAR(3),
  telefone_numero VARCHAR(15),
  celular_ddd VARCHAR(3),
  celular_numero VARCHAR(15),
  email TEXT,
  
  -- OCUPAÇÃO
  natureza_ocupacao_codigo VARCHAR(10),
  natureza_ocupacao_descricao TEXT,
  ocupacao_principal_codigo VARCHAR(10),
  ocupacao_principal_descricao TEXT,
  
  -- ATIVIDADE RURAL
  possui_atividade_rural BOOLEAN DEFAULT FALSE,
  resultado_atividade_rural NUMERIC DEFAULT 0,
  
  -- STATUS PROCESSAMENTO
  status_processamento VARCHAR(20) DEFAULT 'pendente',
  data_importacao TIMESTAMPTZ DEFAULT now(),
  arquivo_origem TEXT,
  erro_processamento TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para irpf_declaracao
CREATE INDEX idx_irpf_declaracao_cpf ON public.irpf_declaracao(cpf);
CREATE INDEX idx_irpf_declaracao_exercicio ON public.irpf_declaracao(exercicio);
CREATE INDEX idx_irpf_declaracao_id_empresa ON public.irpf_declaracao(id_empresa);
CREATE INDEX idx_irpf_declaracao_id_lead ON public.irpf_declaracao(id_lead);
CREATE INDEX idx_irpf_declaracao_id_cliente_notion ON public.irpf_declaracao(id_cliente_notion);

-- RLS para irpf_declaracao
ALTER TABLE public.irpf_declaracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode gerenciar irpf_declaracao"
ON public.irpf_declaracao FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Direcao pode ver irpf_declaracao"
ON public.irpf_declaracao FOR SELECT
USING (has_role(auth.uid(), 'direcao'::app_role));

-- 2. TABELA: irpf_dependente
CREATE TABLE public.irpf_dependente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  nome TEXT NOT NULL,
  cpf VARCHAR(14),
  data_nascimento DATE,
  tipo_dependencia_codigo VARCHAR(10),
  tipo_dependencia_descricao TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_dependente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_dependente" ON public.irpf_dependente FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_dependente" ON public.irpf_dependente FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 3. TABELA: irpf_alimentando
CREATE TABLE public.irpf_alimentando (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  nome TEXT NOT NULL,
  cpf VARCHAR(14),
  data_nascimento DATE,
  tipo_relacao TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_alimentando ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_alimentando" ON public.irpf_alimentando FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_alimentando" ON public.irpf_alimentando FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 4. TABELA: irpf_rendimento
CREATE TABLE public.irpf_rendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  categoria VARCHAR(50) NOT NULL,
  codigo_rendimento VARCHAR(10),
  descricao_tipo TEXT,
  
  cnpj_fonte VARCHAR(18),
  cpf_fonte VARCHAR(14),
  nome_fonte TEXT,
  
  beneficiario VARCHAR(20) DEFAULT 'titular',
  cpf_beneficiario VARCHAR(14),
  nome_beneficiario TEXT,
  
  valor_rendimento NUMERIC DEFAULT 0,
  contribuicao_previdenciaria NUMERIC DEFAULT 0,
  imposto_retido_fonte NUMERIC DEFAULT 0,
  decimo_terceiro_salario NUMERIC DEFAULT 0,
  irrf_decimo_terceiro NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_rendimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_rendimento" ON public.irpf_rendimento FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_rendimento" ON public.irpf_rendimento FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 5. TABELA: irpf_imposto_pago
CREATE TABLE public.irpf_imposto_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  codigo VARCHAR(10) NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC DEFAULT 0,
  
  imposto_devido_com_rendimentos_exterior NUMERIC,
  imposto_devido_sem_rendimentos_exterior NUMERIC,
  diferenca_limite_legal NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_imposto_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_imposto_pago" ON public.irpf_imposto_pago FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_imposto_pago" ON public.irpf_imposto_pago FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 6. TABELA: irpf_pagamento_deducao
CREATE TABLE public.irpf_pagamento_deducao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  codigo VARCHAR(10) NOT NULL,
  descricao_codigo TEXT,
  nome_beneficiario TEXT,
  cpf_cnpj_beneficiario VARCHAR(18),
  valor_pago NUMERIC DEFAULT 0,
  parcela_nao_dedutivel NUMERIC DEFAULT 0,
  beneficiario VARCHAR(20) DEFAULT 'titular',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_pagamento_deducao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_pagamento_deducao" ON public.irpf_pagamento_deducao FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_pagamento_deducao" ON public.irpf_pagamento_deducao FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 7. TABELA: irpf_doacao
CREATE TABLE public.irpf_doacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  tipo VARCHAR(30) NOT NULL,
  codigo VARCHAR(10),
  nome_beneficiario TEXT,
  cpf_cnpj_beneficiario VARCHAR(18),
  partido TEXT,
  candidato TEXT,
  cargo TEXT,
  valor NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_doacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_doacao" ON public.irpf_doacao FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_doacao" ON public.irpf_doacao FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 8. TABELA: irpf_bem_direito (COMPLETA COM DISCRIMINAÇÃO)
CREATE TABLE public.irpf_bem_direito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  -- IDENTIFICAÇÃO
  numero_bem INTEGER NOT NULL,
  grupo_codigo VARCHAR(10) NOT NULL,
  grupo_descricao TEXT,
  codigo_bem VARCHAR(10) NOT NULL,
  codigo_descricao TEXT,
  
  -- DISCRIMINAÇÃO COMPLETA
  discriminacao TEXT NOT NULL,
  
  -- VALORES
  valor_ano_anterior NUMERIC DEFAULT 0,
  valor_ano_atual NUMERIC DEFAULT 0,
  
  -- TITULARIDADE
  pertence_a VARCHAR(20) DEFAULT 'titular',
  cpf_titular VARCHAR(14),
  cpf_dependente VARCHAR(14),
  
  -- LOCALIZAÇÃO
  pais_codigo VARCHAR(10),
  pais_nome VARCHAR(100),
  
  -- DADOS IMÓVEL
  imovel_tipo VARCHAR(50),
  imovel_area_total NUMERIC,
  imovel_matricula VARCHAR(50),
  imovel_cartorio TEXT,
  imovel_data_aquisicao DATE,
  imovel_forma_aquisicao TEXT,
  imovel_endereco TEXT,
  imovel_inscricao_iptu VARCHAR(50),
  
  -- DADOS VEÍCULO
  veiculo_tipo VARCHAR(50),
  veiculo_marca TEXT,
  veiculo_modelo TEXT,
  veiculo_ano_fabricacao INTEGER,
  veiculo_placa VARCHAR(10),
  veiculo_renavam VARCHAR(20),
  
  -- DADOS CONTA BANCÁRIA
  banco_codigo VARCHAR(10),
  banco_nome TEXT,
  banco_agencia VARCHAR(20),
  banco_conta VARCHAR(30),
  banco_tipo_conta VARCHAR(30),
  conta_pagamento BOOLEAN DEFAULT FALSE,
  cnpj_instituicao VARCHAR(18),
  
  -- DADOS INVESTIMENTO
  investimento_tipo TEXT,
  investimento_cnpj_administradora VARCHAR(18),
  investimento_nome_fundo TEXT,
  
  -- DADOS PARTICIPAÇÃO SOCIETÁRIA
  participacao_cnpj VARCHAR(18),
  participacao_razao_social TEXT,
  participacao_tipo VARCHAR(30),
  participacao_quantidade NUMERIC,
  participacao_percentual NUMERIC,
  participacao_data_constituicao DATE,
  participacao_registro TEXT,
  
  -- DADOS CRÉDITO
  credito_cpf_cnpj_devedor VARCHAR(18),
  credito_nome_devedor TEXT,
  credito_data_concessao DATE,
  credito_valor_original NUMERIC,
  credito_parcelas_totais INTEGER,
  credito_parcelas_recebidas INTEGER,
  credito_valor_parcela NUMERIC,
  
  -- DADOS CRIPTOATIVO
  cripto_codigo VARCHAR(20),
  cripto_tipo VARCHAR(30),
  cripto_exchange TEXT,
  cripto_autocustodiante BOOLEAN DEFAULT FALSE,
  cripto_quantidade NUMERIC,
  cripto_lucro_prejuizo NUMERIC DEFAULT 0,
  cripto_valor_recebido NUMERIC DEFAULT 0,
  cripto_imposto_pago_exterior NUMERIC DEFAULT 0,
  cripto_irrf_brasil NUMERIC DEFAULT 0,
  cripto_aplicacao_financeira BOOLEAN DEFAULT FALSE,
  cripto_lucros_dividendos BOOLEAN DEFAULT FALSE,
  
  -- DADOS FII
  fii_cnpj VARCHAR(18),
  fii_nome TEXT,
  fii_quantidade_cotas NUMERIC,
  
  -- LEI 14.973/2024
  atualizou_valor_imovel_lei_14973 BOOLEAN DEFAULT FALSE,
  ganho_capital_pago_ate_16_12 NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_irpf_bem_direito_declaracao ON public.irpf_bem_direito(id_declaracao);
CREATE INDEX idx_irpf_bem_direito_grupo ON public.irpf_bem_direito(grupo_codigo);

ALTER TABLE public.irpf_bem_direito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_bem_direito" ON public.irpf_bem_direito FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_bem_direito" ON public.irpf_bem_direito FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 9. TABELA: irpf_divida_onus (COMPLETA COM DISCRIMINAÇÃO)
CREATE TABLE public.irpf_divida_onus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  -- IDENTIFICAÇÃO
  numero_divida INTEGER,
  codigo VARCHAR(10) NOT NULL,
  codigo_descricao TEXT,
  
  -- DISCRIMINAÇÃO COMPLETA
  discriminacao TEXT NOT NULL,
  
  -- VALORES
  situacao_ano_anterior NUMERIC DEFAULT 0,
  situacao_ano_atual NUMERIC DEFAULT 0,
  valor_pago_no_ano NUMERIC DEFAULT 0,
  
  -- CREDOR
  credor_cpf_cnpj VARCHAR(18),
  credor_nome TEXT,
  
  -- DETALHES
  natureza_divida TEXT,
  data_contratacao DATE,
  valor_original NUMERIC,
  taxa_juros NUMERIC,
  prazo_meses INTEGER,
  garantia TEXT,
  
  -- VINCULAÇÃO
  vinculada_atividade_rural BOOLEAN DEFAULT FALSE,
  id_bem_vinculado UUID REFERENCES public.irpf_bem_direito(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_irpf_divida_onus_declaracao ON public.irpf_divida_onus(id_declaracao);

ALTER TABLE public.irpf_divida_onus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_divida_onus" ON public.irpf_divida_onus FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_divida_onus" ON public.irpf_divida_onus FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 10. TABELA: irpf_atividade_rural
CREATE TABLE public.irpf_atividade_rural (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  localizacao VARCHAR(20) DEFAULT 'brasil',
  nome_imovel TEXT,
  endereco TEXT,
  area_total NUMERIC,
  area_explorada NUMERIC,
  tipo_exploracao TEXT,
  inscricao_nirf VARCHAR(50),
  
  receita_producao_vegetal NUMERIC DEFAULT 0,
  receita_producao_animal NUMERIC DEFAULT 0,
  receita_produtos_agroindustriais NUMERIC DEFAULT 0,
  receita_venda_bens NUMERIC DEFAULT 0,
  receitas_outras NUMERIC DEFAULT 0,
  total_receitas NUMERIC DEFAULT 0,
  
  despesa_custeio NUMERIC DEFAULT 0,
  despesa_investimentos NUMERIC DEFAULT 0,
  despesa_depreciacao NUMERIC DEFAULT 0,
  despesas_outras NUMERIC DEFAULT 0,
  total_despesas NUMERIC DEFAULT 0,
  
  resultado_bruto NUMERIC DEFAULT 0,
  resultado_tributavel NUMERIC DEFAULT 0,
  prejuizo_compensar NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_atividade_rural ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_atividade_rural" ON public.irpf_atividade_rural FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_atividade_rural" ON public.irpf_atividade_rural FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 11. TABELA: irpf_atividade_rural_rebanho
CREATE TABLE public.irpf_atividade_rural_rebanho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_atividade_rural UUID NOT NULL REFERENCES public.irpf_atividade_rural(id) ON DELETE CASCADE,
  
  tipo_animal VARCHAR(50),
  quantidade_inicial INTEGER DEFAULT 0,
  nascimentos INTEGER DEFAULT 0,
  compras INTEGER DEFAULT 0,
  vendas INTEGER DEFAULT 0,
  abates INTEGER DEFAULT 0,
  mortes INTEGER DEFAULT 0,
  quantidade_final INTEGER DEFAULT 0,
  valor_medio_cabeca NUMERIC DEFAULT 0,
  valor_total NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_atividade_rural_rebanho ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_atividade_rural_rebanho" ON public.irpf_atividade_rural_rebanho FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_atividade_rural_rebanho" ON public.irpf_atividade_rural_rebanho FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 12. TABELA: irpf_ganho_capital
CREATE TABLE public.irpf_ganho_capital (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  tipo_operacao VARCHAR(50),
  descricao_bem TEXT,
  data_aquisicao DATE,
  data_alienacao DATE,
  
  valor_aquisicao NUMERIC DEFAULT 0,
  custo_aquisicao_atualizado NUMERIC DEFAULT 0,
  valor_alienacao NUMERIC DEFAULT 0,
  
  ganho_capital NUMERIC DEFAULT 0,
  imposto_devido NUMERIC DEFAULT 0,
  imposto_pago NUMERIC DEFAULT 0,
  
  tipo_moeda VARCHAR(10),
  valor_moeda_original NUMERIC,
  taxa_cambio_aquisicao NUMERIC,
  taxa_cambio_alienacao NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_ganho_capital ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_ganho_capital" ON public.irpf_ganho_capital FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_ganho_capital" ON public.irpf_ganho_capital FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 13. TABELA: irpf_renda_variavel
CREATE TABLE public.irpf_renda_variavel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  beneficiario VARCHAR(20) DEFAULT 'titular',
  mes INTEGER NOT NULL,
  
  resultado_comum_mercado_vista NUMERIC DEFAULT 0,
  resultado_comum_opcoes NUMERIC DEFAULT 0,
  resultado_comum_futuros NUMERIC DEFAULT 0,
  resultado_comum_outros NUMERIC DEFAULT 0,
  total_operacoes_comuns NUMERIC DEFAULT 0,
  base_calculo_comum NUMERIC DEFAULT 0,
  imposto_devido_comum NUMERIC DEFAULT 0,
  
  resultado_daytrade_mercado_vista NUMERIC DEFAULT 0,
  resultado_daytrade_opcoes NUMERIC DEFAULT 0,
  resultado_daytrade_futuros NUMERIC DEFAULT 0,
  resultado_daytrade_outros NUMERIC DEFAULT 0,
  total_operacoes_daytrade NUMERIC DEFAULT 0,
  base_calculo_daytrade NUMERIC DEFAULT 0,
  imposto_devido_daytrade NUMERIC DEFAULT 0,
  
  irrf_comum NUMERIC DEFAULT 0,
  irrf_daytrade NUMERIC DEFAULT 0,
  
  prejuizo_comum_anterior NUMERIC DEFAULT 0,
  prejuizo_daytrade_anterior NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_renda_variavel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_renda_variavel" ON public.irpf_renda_variavel FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_renda_variavel" ON public.irpf_renda_variavel FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 14. TABELA: irpf_fundo_imobiliario
CREATE TABLE public.irpf_fundo_imobiliario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  beneficiario VARCHAR(20) DEFAULT 'titular',
  mes INTEGER NOT NULL,
  
  resultado_liquido NUMERIC DEFAULT 0,
  base_calculo NUMERIC DEFAULT 0,
  imposto_devido NUMERIC DEFAULT 0,
  irrf NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_fundo_imobiliario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_fundo_imobiliario" ON public.irpf_fundo_imobiliario FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_fundo_imobiliario" ON public.irpf_fundo_imobiliario FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 15. TABELA: irpf_demonstrativo_lei_14754
CREATE TABLE public.irpf_demonstrativo_lei_14754 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  numero_bem INTEGER,
  id_bem UUID REFERENCES public.irpf_bem_direito(id),
  
  tipo VARCHAR(5),
  
  ganho_prejuizo NUMERIC DEFAULT 0,
  imposto_devido NUMERIC DEFAULT 0,
  imposto_pago_brasil NUMERIC DEFAULT 0,
  imposto_pago_exterior NUMERIC DEFAULT 0,
  base_calculo NUMERIC DEFAULT 0,
  saldo NUMERIC DEFAULT 0,
  
  prejuizo_ano_anterior NUMERIC DEFAULT 0,
  prejuizo_a_compensar NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_demonstrativo_lei_14754 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_demonstrativo_lei_14754" ON public.irpf_demonstrativo_lei_14754 FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_demonstrativo_lei_14754" ON public.irpf_demonstrativo_lei_14754 FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 16. TABELA: irpf_resumo_tributario
CREATE TABLE public.irpf_resumo_tributario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  tipo_tributacao VARCHAR(30),
  
  rend_pj_titular NUMERIC DEFAULT 0,
  rend_pj_dependentes NUMERIC DEFAULT 0,
  rend_pf_exterior_titular NUMERIC DEFAULT 0,
  rend_pf_exterior_dependentes NUMERIC DEFAULT 0,
  rend_acumulado_titular NUMERIC DEFAULT 0,
  rend_acumulado_dependentes NUMERIC DEFAULT 0,
  resultado_atividade_rural NUMERIC DEFAULT 0,
  total_rendimentos_tributaveis NUMERIC DEFAULT 0,
  
  contrib_previdencia_oficial NUMERIC DEFAULT 0,
  contrib_previdencia_rra NUMERIC DEFAULT 0,
  contrib_previdencia_complementar NUMERIC DEFAULT 0,
  deducao_dependentes NUMERIC DEFAULT 0,
  despesas_instrucao NUMERIC DEFAULT 0,
  despesas_medicas NUMERIC DEFAULT 0,
  pensao_alimenticia_judicial NUMERIC DEFAULT 0,
  pensao_alimenticia_escritura NUMERIC DEFAULT 0,
  pensao_alimenticia_rra NUMERIC DEFAULT 0,
  livro_caixa NUMERIC DEFAULT 0,
  total_deducoes NUMERIC DEFAULT 0,
  
  base_calculo NUMERIC DEFAULT 0,
  imposto_devido NUMERIC DEFAULT 0,
  deducao_incentivo NUMERIC DEFAULT 0,
  imposto_devido_apos_deducao NUMERIC DEFAULT 0,
  imposto_devido_rra NUMERIC DEFAULT 0,
  total_imposto_devido NUMERIC DEFAULT 0,
  aliquota_efetiva NUMERIC DEFAULT 0,
  
  irrf_titular NUMERIC DEFAULT 0,
  irrf_dependentes NUMERIC DEFAULT 0,
  carne_leao_titular NUMERIC DEFAULT 0,
  carne_leao_dependentes NUMERIC DEFAULT 0,
  imposto_complementar NUMERIC DEFAULT 0,
  imposto_pago_exterior NUMERIC DEFAULT 0,
  irrf_lei_11033 NUMERIC DEFAULT 0,
  irrf_rra NUMERIC DEFAULT 0,
  total_imposto_pago NUMERIC DEFAULT 0,
  
  imposto_a_restituir NUMERIC DEFAULT 0,
  imposto_a_pagar NUMERIC DEFAULT 0,
  
  numero_quotas INTEGER DEFAULT 0,
  valor_quota NUMERIC DEFAULT 0,
  
  banco_codigo VARCHAR(10),
  banco_agencia VARCHAR(20),
  banco_conta VARCHAR(30),
  banco_tipo_conta VARCHAR(20),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_resumo_tributario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_resumo_tributario" ON public.irpf_resumo_tributario FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_resumo_tributario" ON public.irpf_resumo_tributario FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 17. TABELA: irpf_evolucao_patrimonial
CREATE TABLE public.irpf_evolucao_patrimonial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  bens_ano_anterior NUMERIC DEFAULT 0,
  bens_ano_atual NUMERIC DEFAULT 0,
  variacao_bens NUMERIC DEFAULT 0,
  
  dividas_ano_anterior NUMERIC DEFAULT 0,
  dividas_ano_atual NUMERIC DEFAULT 0,
  variacao_dividas NUMERIC DEFAULT 0,
  
  patrimonio_liquido_anterior NUMERIC DEFAULT 0,
  patrimonio_liquido_atual NUMERIC DEFAULT 0,
  variacao_patrimonial NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_evolucao_patrimonial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_evolucao_patrimonial" ON public.irpf_evolucao_patrimonial FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_evolucao_patrimonial" ON public.irpf_evolucao_patrimonial FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- 18. TABELA: irpf_outras_informacoes
CREATE TABLE public.irpf_outras_informacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_declaracao UUID NOT NULL REFERENCES public.irpf_declaracao(id) ON DELETE CASCADE,
  
  rendimentos_isentos_nao_tributaveis NUMERIC DEFAULT 0,
  rendimentos_tributacao_exclusiva NUMERIC DEFAULT 0,
  rendimentos_exigibilidade_suspensa NUMERIC DEFAULT 0,
  depositos_judiciais_imposto NUMERIC DEFAULT 0,
  imposto_pago_ganhos_capital NUMERIC DEFAULT 0,
  imposto_pago_ganhos_moeda_estrangeira NUMERIC DEFAULT 0,
  irrf_lei_11033_informado NUMERIC DEFAULT 0,
  imposto_pago_renda_variavel NUMERIC DEFAULT 0,
  doacoes_partidos_politicos NUMERIC DEFAULT 0,
  imposto_pagar_ganho_moeda_especie NUMERIC DEFAULT 0,
  imposto_diferido_ganhos_capital NUMERIC DEFAULT 0,
  imposto_devido_ganhos_capital NUMERIC DEFAULT 0,
  imposto_devido_renda_variavel NUMERIC DEFAULT 0,
  imposto_devido_ganhos_moeda_estrangeira NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.irpf_outras_informacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia irpf_outras_informacoes" ON public.irpf_outras_informacoes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Direcao ve irpf_outras_informacoes" ON public.irpf_outras_informacoes FOR SELECT USING (has_role(auth.uid(), 'direcao'::app_role));

-- =====================================================
-- NOVOS CAMPOS NA TABELA LEAD PARA ENRIQUECIMENTO IRPF
-- =====================================================
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS id_irpf_declaracao UUID REFERENCES public.irpf_declaracao(id);
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_ano_mais_recente INTEGER;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_renda_anual NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_patrimonio_liquido NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_total_bens NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_total_dividas NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_aliquota_efetiva NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_imposto_restituir NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_imposto_pagar NUMERIC;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_possui_cripto BOOLEAN DEFAULT FALSE;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_valor_cripto NUMERIC DEFAULT 0;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_tipos_cripto TEXT[];
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_possui_empresas BOOLEAN DEFAULT FALSE;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_qtd_empresas INTEGER DEFAULT 0;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_possui_imoveis BOOLEAN DEFAULT FALSE;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_qtd_imoveis INTEGER DEFAULT 0;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_possui_investimentos BOOLEAN DEFAULT FALSE;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_valor_investimentos NUMERIC DEFAULT 0;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_possui_atividade_rural BOOLEAN DEFAULT FALSE;
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_perfil_investidor VARCHAR(30);
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_faixa_patrimonial VARCHAR(30);
ALTER TABLE public.lead ADD COLUMN IF NOT EXISTS irpf_complexidade_declaracao VARCHAR(20);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_irpf_declaracao_updated_at
  BEFORE UPDATE ON public.irpf_declaracao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
