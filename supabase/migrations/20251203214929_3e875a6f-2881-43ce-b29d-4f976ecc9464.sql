-- Adicionar campo url_esperada na tabela campanha (nível base)
ALTER TABLE public.campanha 
ADD COLUMN url_esperada text;

-- Adicionar campo url_esperada na tabela criativo (override)
ALTER TABLE public.criativo 
ADD COLUMN url_esperada text;

-- Comentários para documentação
COMMENT ON COLUMN public.campanha.url_esperada IS 'URL de destino esperada com UTMs configurados pelo gestor de tráfego';
COMMENT ON COLUMN public.criativo.url_esperada IS 'URL de destino esperada específica do criativo (override da campanha)';