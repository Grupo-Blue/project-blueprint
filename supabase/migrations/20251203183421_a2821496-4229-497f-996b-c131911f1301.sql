-- Tabela para investimentos de crowdfunding da Tokeniza
CREATE TABLE public.tokeniza_investimento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_externo text NOT NULL UNIQUE,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa),
  project_id text,
  user_id_tokeniza text,
  deposit_id text,
  amount numeric NOT NULL DEFAULT 0,
  usd_amount numeric,
  status text NOT NULL,
  was_paid boolean DEFAULT false,
  fin_operation boolean DEFAULT false,
  created_nft text,
  bank_of_brazil_entry_hash text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now(),
  data_atualizacao timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para vendas automáticas de tokens da Tokeniza
CREATE TABLE public.tokeniza_venda (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_externo text NOT NULL UNIQUE,
  id_empresa uuid NOT NULL REFERENCES public.empresa(id_empresa),
  user_id_tokeniza text,
  user_email text,
  user_wallet_id text,
  external_id text,
  unit_of_money text,
  unit_purchased text,
  store_id text,
  status text NOT NULL,
  transaction_id text,
  payment_method text,
  total_amount numeric NOT NULL DEFAULT 0,
  tokens_amount numeric,
  tax_amount numeric,
  shipping_amount numeric DEFAULT 0,
  quantity integer DEFAULT 0,
  is_token_buy boolean DEFAULT false,
  is_ticket_buy boolean DEFAULT false,
  is_nft_buy boolean DEFAULT false,
  was_paid boolean DEFAULT false,
  has_cashback boolean,
  asset_id text,
  nft_id text,
  package_id text,
  address_id text,
  indication_reward_status text,
  items jsonb DEFAULT '[]'::jsonb,
  data_criacao timestamp with time zone NOT NULL DEFAULT now(),
  data_expiracao timestamp with time zone,
  data_atualizacao timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_tokeniza_investimento_empresa ON public.tokeniza_investimento(id_empresa);
CREATE INDEX idx_tokeniza_investimento_status ON public.tokeniza_investimento(status);
CREATE INDEX idx_tokeniza_investimento_data ON public.tokeniza_investimento(data_criacao);

CREATE INDEX idx_tokeniza_venda_empresa ON public.tokeniza_venda(id_empresa);
CREATE INDEX idx_tokeniza_venda_status ON public.tokeniza_venda(status);
CREATE INDEX idx_tokeniza_venda_data ON public.tokeniza_venda(data_criacao);
CREATE INDEX idx_tokeniza_venda_email ON public.tokeniza_venda(user_email);

-- Enable RLS
ALTER TABLE public.tokeniza_investimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokeniza_venda ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Select
CREATE POLICY "Todos podem ver tokeniza_investimento" ON public.tokeniza_investimento 
FOR SELECT USING (true);

CREATE POLICY "Todos podem ver tokeniza_venda" ON public.tokeniza_venda 
FOR SELECT USING (true);

-- RLS Policies - Insert/Update (sistema)
CREATE POLICY "Sistema pode gerenciar tokeniza_investimento" ON public.tokeniza_investimento 
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode gerenciar tokeniza_venda" ON public.tokeniza_venda 
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_tokeniza_investimento_updated_at
BEFORE UPDATE ON public.tokeniza_investimento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tokeniza_venda_updated_at
BEFORE UPDATE ON public.tokeniza_venda
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();