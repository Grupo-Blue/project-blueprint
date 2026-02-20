
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS cidade varchar;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS cep varchar;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS perfil_cliente varchar;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS motivo_cancelamento varchar;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS data_cancelamento date;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS tag varchar;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS url_google_drive text;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS vencimento_procuracao date;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS apuracao_b3 varchar;
ALTER TABLE public.cliente_notion ADD COLUMN IF NOT EXISTS telefone_secundario varchar;
