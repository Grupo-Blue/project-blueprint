-- 1. Limpar o ICP auto-gerado quebrado (operador is_true em campo numérico)
DELETE FROM public.icp_perfil WHERE auto_gerado = true;

-- 2. Inserir os 3 novos segmentos padrão para todas as empresas existentes que ainda não os têm
INSERT INTO public.lead_segmento (id_empresa, nome, descricao, regras, ativo)
SELECT e.id_empresa, s.nome, s.descricao, s.regras::jsonb, true
FROM public.empresa e
CROSS JOIN (VALUES
  ('Investidores Tokeniza', 'Leads com tokeniza_investidor = true', '{"tipo":"investidor_tokeniza"}'),
  ('Alta Qualificação Amélia', 'Score Amélia ≥ 70 ou temperatura quente', '{"tipo":"amelia_qualificado"}'),
  ('Engajados Mautic', 'Mautic page_hits > 3 ou score > 50', '{"tipo":"mautic_engajado"}')
) AS s(nome, descricao, regras)
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_segmento ls
  WHERE ls.id_empresa = e.id_empresa
  AND ls.regras->>'tipo' = s.regras::jsonb->>'tipo'
);

-- 3. Atualizar descrições dos segmentos padrão existentes para refletir as novas regras
UPDATE public.lead_segmento SET descricao = 'Sinais de intenção: stape recente, Amélia quente, "Atacar agora" ou Levantada de mão'
WHERE regras->>'tipo' = 'alta_intencao';

UPDATE public.lead_segmento SET descricao = 'Mautic page_hits > 3 ou score > 30'
WHERE regras->>'tipo' = 'aquecimento';

UPDATE public.lead_segmento SET descricao = 'Stages avançados (Apresentação/Negociação) ou alta qualificação'
WHERE regras->>'tipo' = 'quase_cliente';

UPDATE public.lead_segmento SET descricao = 'Comprou + voltou via stape/mautic nos últimos 7 dias'
WHERE regras->>'tipo' = 'cliente_quente';

UPDATE public.lead_segmento SET descricao = 'Lead/MQL/Contato inativo há 30+ dias'
WHERE regras->>'tipo' = 'reativacao';