-- ============================================
-- SGT - Sistema de Governança de Tráfego
-- Modelo de Dados Completo
-- ============================================

-- 1. ENUMS E TIPOS
-- ============================================

-- Perfis de usuário
CREATE TYPE public.perfil_usuario AS ENUM ('TRAFEGO', 'SDR_COMERCIAL', 'DIRECAO', 'ADMIN');

-- Roles (para RLS e controle de acesso)
CREATE TYPE public.app_role AS ENUM ('admin', 'direcao', 'trafego', 'sdr');

-- Plataformas de mídia
CREATE TYPE public.plataforma_midia AS ENUM ('META', 'GOOGLE');

-- Tipo de integração
CREATE TYPE public.tipo_integracao AS ENUM ('META_ADS', 'GOOGLE_ADS', 'PIPEDRIVE', 'TOKENIZA');

-- Canal de origem
CREATE TYPE public.canal_origem AS ENUM ('META', 'GOOGLE', 'ORGANICO', 'OUTRO');

-- Categoria de ação
CREATE TYPE public.categoria_acao AS ENUM ('A', 'B', 'C');

-- Status da ação
CREATE TYPE public.status_acao AS ENUM ('PENDENTE', 'APROVADA', 'REPROVADA', 'EXECUTADA');

-- Status de aprovação
CREATE TYPE public.status_aprovacao AS ENUM ('APROVADA', 'REPROVADA');

-- Status do relatório
CREATE TYPE public.status_relatorio AS ENUM ('EM_EDICAO', 'PRONTO', 'VALIDADO');

-- Tipo de criativo
CREATE TYPE public.tipo_criativo AS ENUM ('VIDEO', 'IMAGEM', 'CARROSSEL', 'OUTRO');

-- Tipo de aprendizado
CREATE TYPE public.tipo_aprendizado AS ENUM ('CRIATIVO', 'PUBLICO', 'OFERTA', 'FUNIL', 'OUTRO');

-- Resultado de hipótese
CREATE TYPE public.resultado_hipotese AS ENUM ('VALIDADA', 'REFUTADA', 'INCONCLUSIVA');

-- 2. TABELAS BASE / CONFIGURAÇÕES
-- ============================================

-- 2.1 Empresa (Blue / Tokeniza)
CREATE TABLE public.empresa (
    id_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    ticket_medio_alvo DECIMAL(10,2) NOT NULL,
    margem_minima_percentual DECIMAL(5,2) NOT NULL,
    lucro_minimo_por_venda DECIMAL(10,2) NOT NULL,
    cac_maximo DECIMAL(10,2) NOT NULL,
    cpl_maximo DECIMAL(10,2) NOT NULL,
    meta_conversao_lead_venda DECIMAL(5,4) NOT NULL,
    dias_alerta_cpl INTEGER NOT NULL DEFAULT 3,
    semanas_alerta_cac INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Profiles (estende auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    perfil perfil_usuario NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 User Roles (para RLS)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- 2.4 Integração (armazena tokens e chaves)
CREATE TABLE public.integracao (
    id_integracao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo tipo_integracao NOT NULL,
    config_json JSONB NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MÓDULO DE MÍDIA (META / GOOGLE)
-- ============================================

-- 3.1 Conta de Anúncio
CREATE TABLE public.conta_anuncio (
    id_conta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
    plataforma plataforma_midia NOT NULL,
    nome VARCHAR(255) NOT NULL,
    id_externo VARCHAR(100) NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(plataforma, id_externo)
);

-- 3.2 Campanha
CREATE TABLE public.campanha (
    id_campanha UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_conta UUID REFERENCES public.conta_anuncio(id_conta) NOT NULL,
    id_campanha_externo VARCHAR(100) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    objetivo VARCHAR(100),
    ativa BOOLEAN NOT NULL DEFAULT true,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(id_conta, id_campanha_externo)
);

-- 3.3 Criativo
CREATE TABLE public.criativo (
    id_criativo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_campanha UUID REFERENCES public.campanha(id_campanha) NOT NULL,
    id_criativo_externo VARCHAR(100) NOT NULL,
    tipo tipo_criativo NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 Métricas Diárias da Campanha
CREATE TABLE public.campanha_metricas_dia (
    id_metricas_dia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_campanha UUID REFERENCES public.campanha(id_campanha) NOT NULL,
    data DATE NOT NULL,
    verba_investida DECIMAL(10,2) NOT NULL DEFAULT 0,
    leads INTEGER NOT NULL DEFAULT 0,
    impressoes INTEGER NOT NULL DEFAULT 0,
    cliques INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(id_campanha, data)
);

-- 4. MÓDULO DE CRM / VENDAS
-- ============================================

-- 4.1 Lead
CREATE TABLE public.lead (
    id_lead UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
    id_lead_externo VARCHAR(100),
    origem_canal canal_origem,
    origem_campanha VARCHAR(255),
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_mql BOOLEAN NOT NULL DEFAULT false,
    levantou_mao BOOLEAN NOT NULL DEFAULT false,
    tem_reuniao BOOLEAN NOT NULL DEFAULT false,
    reuniao_realizada BOOLEAN NOT NULL DEFAULT false,
    venda_realizada BOOLEAN NOT NULL DEFAULT false,
    valor_venda DECIMAL(10,2),
    data_venda TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 Eventos do Lead
CREATE TABLE public.lead_evento (
    id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_lead UUID REFERENCES public.lead(id_lead) ON DELETE CASCADE NOT NULL,
    etapa VARCHAR(100) NOT NULL,
    data_evento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MÓDULO DE MÉTRICAS / FUNIL
-- ============================================

-- 5.1 Semana
CREATE TABLE public.semana (
    id_semana UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    ano INTEGER NOT NULL,
    numero_semana INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ano, numero_semana)
);

-- 5.2 Métricas Semanais por Empresa
CREATE TABLE public.empresa_semana_metricas (
    id_empresa_semana UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
    id_semana UUID REFERENCES public.semana(id_semana) NOT NULL,
    verba_investida DECIMAL(10,2) NOT NULL DEFAULT 0,
    leads_total INTEGER NOT NULL DEFAULT 0,
    mqls INTEGER NOT NULL DEFAULT 0,
    levantadas INTEGER NOT NULL DEFAULT 0,
    reunioes INTEGER NOT NULL DEFAULT 0,
    vendas INTEGER NOT NULL DEFAULT 0,
    ticket_medio DECIMAL(10,2),
    cpl DECIMAL(10,2),
    cac DECIMAL(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(id_empresa, id_semana)
);

-- 5.3 Métricas Semanais por Campanha
CREATE TABLE public.campanha_semana_metricas (
    id_campanha_semana UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_campanha UUID REFERENCES public.campanha(id_campanha) NOT NULL,
    id_semana UUID REFERENCES public.semana(id_semana) NOT NULL,
    verba_investida DECIMAL(10,2) NOT NULL DEFAULT 0,
    leads INTEGER NOT NULL DEFAULT 0,
    mqls INTEGER,
    levantadas INTEGER,
    reunioes INTEGER,
    vendas INTEGER,
    ticket_medio DECIMAL(10,2),
    cpl DECIMAL(10,2),
    cac DECIMAL(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(id_campanha, id_semana)
);

-- 6. MÓDULO DE GOVERNANÇA A/B/C
-- ============================================

-- 6.1 Ação de Tráfego
CREATE TABLE public.acao (
    id_acao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
    id_usuario UUID REFERENCES auth.users(id) NOT NULL,
    categoria categoria_acao NOT NULL,
    tipo_acao VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL,
    impacto_esperado TEXT,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_execucao TIMESTAMPTZ,
    status status_acao NOT NULL DEFAULT 'PENDENTE',
    motivo_reprovacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.2 Ação x Campanha (N:N)
CREATE TABLE public.acao_campanha (
    id_acao_campanha UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_acao UUID REFERENCES public.acao(id_acao) ON DELETE CASCADE NOT NULL,
    id_campanha UUID REFERENCES public.campanha(id_campanha) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(id_acao, id_campanha)
);

-- 6.3 Aprovação de Ação C
CREATE TABLE public.acao_aprovacao (
    id_aprovacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_acao UUID REFERENCES public.acao(id_acao) ON DELETE CASCADE NOT NULL UNIQUE,
    id_usuario_aprovador UUID REFERENCES auth.users(id) NOT NULL,
    data_aprovacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status status_aprovacao NOT NULL,
    comentario TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. MÓDULO DE RELATÓRIOS SEMANAIS
-- ============================================

-- 7.1 Relatório Semanal
CREATE TABLE public.relatorio_semanal (
    id_relatorio UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
    id_semana UUID REFERENCES public.semana(id_semana) NOT NULL,
    status status_relatorio NOT NULL DEFAULT 'EM_EDICAO',
    texto_comparacao TEXT,
    aprendizado_resumo TEXT,
    data_fechamento TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(id_empresa, id_semana)
);

-- 7.2 Relatório x Ações (N:N)
CREATE TABLE public.relatorio_acao (
    id_relatorio_acao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_relatorio UUID REFERENCES public.relatorio_semanal(id_relatorio) ON DELETE CASCADE NOT NULL,
    id_acao UUID REFERENCES public.acao(id_acao) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(id_relatorio, id_acao)
);

-- 7.3 Relatório x Hipóteses (N:N)
CREATE TABLE public.relatorio_hipotese (
    id_relatorio_hipotese UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_relatorio UUID REFERENCES public.relatorio_semanal(id_relatorio) ON DELETE CASCADE NOT NULL,
    id_hipotese UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. MÓDULO DE TESTES E APRENDIZADOS
-- ============================================

-- 8.1 Hipótese de Teste
CREATE TABLE public.hipotese_teste (
    id_hipotese UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
    id_campanha UUID REFERENCES public.campanha(id_campanha),
    id_semana UUID REFERENCES public.semana(id_semana) NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL,
    criterio_sucesso TEXT NOT NULL,
    resultado_semana_seguinte resultado_hipotese,
    comentario_resultado TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8.2 Aprendizado da Semana
CREATE TABLE public.aprendizado_semana (
    id_aprendizado UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
    id_semana UUID REFERENCES public.semana(id_semana) NOT NULL,
    tipo tipo_aprendizado NOT NULL,
    descricao TEXT NOT NULL,
    metricas_suporte TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. MÓDULO DE AUDITORIA
-- ============================================

-- 9.1 Log de Ações
CREATE TABLE public.log_acao (
    id_log UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID REFERENCES auth.users(id),
    acao VARCHAR(255) NOT NULL,
    tabela_afetada VARCHAR(100),
    id_registro UUID,
    data_log TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valores_antes JSONB,
    valores_depois JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. FUNÇÕES AUXILIARES
-- ============================================

-- Função para verificar se usuário tem role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para criar profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'perfil')::perfil_usuario, 'TRAFEGO'::perfil_usuario)
  );
  RETURN NEW;
END;
$$;

-- 11. TRIGGERS
-- ============================================

-- Trigger para criar profile automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers para updated_at
CREATE TRIGGER update_empresa_updated_at BEFORE UPDATE ON public.empresa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conta_anuncio_updated_at BEFORE UPDATE ON public.conta_anuncio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campanha_updated_at BEFORE UPDATE ON public.campanha
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_criativo_updated_at BEFORE UPDATE ON public.criativo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_updated_at BEFORE UPDATE ON public.lead
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_acao_updated_at BEFORE UPDATE ON public.acao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_relatorio_semanal_updated_at BEFORE UPDATE ON public.relatorio_semanal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hipotese_teste_updated_at BEFORE UPDATE ON public.hipotese_teste
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. HABILITAR RLS EM TODAS AS TABELAS
-- ============================================

ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_anuncio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criativo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanha_metricas_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semana ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_semana_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanha_semana_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acao_campanha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acao_aprovacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatorio_hipotese ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hipotese_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aprendizado_semana ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_acao ENABLE ROW LEVEL SECURITY;

-- 13. POLÍTICAS RLS
-- ============================================

-- Policies para EMPRESA (todos podem ver, apenas admin/direcao editam)
CREATE POLICY "Todos podem ver empresas" ON public.empresa
  FOR SELECT USING (true);

CREATE POLICY "Admin e Direção podem inserir empresas" ON public.empresa
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'direcao')
  );

CREATE POLICY "Admin e Direção podem atualizar empresas" ON public.empresa
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'direcao')
  );

-- Policies para PROFILES
CREATE POLICY "Usuários podem ver próprio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin pode ver todos perfis" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários podem atualizar próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policies para USER_ROLES
CREATE POLICY "Admin pode gerenciar roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários podem ver próprias roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Policies para INTEGRACAO (apenas admin)
CREATE POLICY "Admin pode gerenciar integrações" ON public.integracao
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Policies para CONTA_ANUNCIO (todos autenticados podem ver)
CREATE POLICY "Todos podem ver contas de anúncio" ON public.conta_anuncio
  FOR SELECT USING (true);

CREATE POLICY "Admin e Tráfego podem gerenciar contas" ON public.conta_anuncio
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

-- Policies para CAMPANHA
CREATE POLICY "Todos podem ver campanhas" ON public.campanha
  FOR SELECT USING (true);

CREATE POLICY "Admin e Tráfego podem gerenciar campanhas" ON public.campanha
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

-- Policies para CRIATIVO
CREATE POLICY "Todos podem ver criativos" ON public.criativo
  FOR SELECT USING (true);

CREATE POLICY "Admin e Tráfego podem gerenciar criativos" ON public.criativo
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

-- Policies para CAMPANHA_METRICAS_DIA
CREATE POLICY "Todos podem ver métricas diárias" ON public.campanha_metricas_dia
  FOR SELECT USING (true);

CREATE POLICY "Sistema pode inserir métricas diárias" ON public.campanha_metricas_dia
  FOR INSERT WITH CHECK (true);

-- Policies para LEAD
CREATE POLICY "Todos podem ver leads" ON public.lead
  FOR SELECT USING (true);

CREATE POLICY "Sistema pode gerenciar leads" ON public.lead
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego') OR
    public.has_role(auth.uid(), 'sdr')
  );

-- Policies para SEMANA (todos podem ver)
CREATE POLICY "Todos podem ver semanas" ON public.semana
  FOR SELECT USING (true);

CREATE POLICY "Sistema pode criar semanas" ON public.semana
  FOR INSERT WITH CHECK (true);

-- Policies para METRICAS SEMANAIS (todos podem ver)
CREATE POLICY "Todos podem ver métricas semanais empresa" ON public.empresa_semana_metricas
  FOR SELECT USING (true);

CREATE POLICY "Todos podem ver métricas semanais campanha" ON public.campanha_semana_metricas
  FOR SELECT USING (true);

-- Policies para ACAO
CREATE POLICY "Todos podem ver ações" ON public.acao
  FOR SELECT USING (true);

CREATE POLICY "Tráfego pode criar ações" ON public.acao
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

CREATE POLICY "Tráfego pode atualizar próprias ações" ON public.acao
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR 
    id_usuario = auth.uid()
  );

-- Policies para ACAO_APROVACAO
CREATE POLICY "Todos podem ver aprovações" ON public.acao_aprovacao
  FOR SELECT USING (true);

CREATE POLICY "Direção pode aprovar ações" ON public.acao_aprovacao
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'direcao')
  );

-- Policies para RELATORIO_SEMANAL
CREATE POLICY "Todos podem ver relatórios" ON public.relatorio_semanal
  FOR SELECT USING (true);

CREATE POLICY "Tráfego pode gerenciar relatórios" ON public.relatorio_semanal
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

-- Policies para HIPOTESE_TESTE
CREATE POLICY "Todos podem ver hipóteses" ON public.hipotese_teste
  FOR SELECT USING (true);

CREATE POLICY "Tráfego pode gerenciar hipóteses" ON public.hipotese_teste
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

-- Policies para APRENDIZADO_SEMANA
CREATE POLICY "Todos podem ver aprendizados" ON public.aprendizado_semana
  FOR SELECT USING (true);

CREATE POLICY "Tráfego pode gerenciar aprendizados" ON public.aprendizado_semana
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

-- Policies para tabelas auxiliares (N:N)
CREATE POLICY "Todos podem ver acao_campanha" ON public.acao_campanha
  FOR SELECT USING (true);

CREATE POLICY "Tráfego pode gerenciar acao_campanha" ON public.acao_campanha
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

CREATE POLICY "Todos podem ver relatorio_acao" ON public.relatorio_acao
  FOR SELECT USING (true);

CREATE POLICY "Tráfego pode gerenciar relatorio_acao" ON public.relatorio_acao
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

CREATE POLICY "Todos podem ver relatorio_hipotese" ON public.relatorio_hipotese
  FOR SELECT USING (true);

CREATE POLICY "Tráfego pode gerenciar relatorio_hipotese" ON public.relatorio_hipotese
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'trafego')
  );

CREATE POLICY "Todos podem ver lead_evento" ON public.lead_evento
  FOR SELECT USING (true);

CREATE POLICY "Sistema pode gerenciar lead_evento" ON public.lead_evento
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'sdr') OR
    public.has_role(auth.uid(), 'trafego')
  );

-- Policies para LOG_ACAO (apenas visualização para admin)
CREATE POLICY "Admin pode ver logs" ON public.log_acao
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sistema pode inserir logs" ON public.log_acao
  FOR INSERT WITH CHECK (true);