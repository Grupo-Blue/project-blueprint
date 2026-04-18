import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[Segmentos] Iniciando cálculo de segmentos dinâmicos...');

    // 1. Fetch all active segments
    const { data: segmentos, error: segError } = await supabase
      .from('lead_segmento')
      .select('*')
      .eq('ativo', true);

    if (segError) throw segError;
    if (!segmentos || segmentos.length === 0) {
      console.log('[Segmentos] Nenhum segmento ativo encontrado, criando segmentos padrão...');
      await criarSegmentosPadrao(supabase);
      // Re-fetch
      const { data: novos } = await supabase.from('lead_segmento').select('*').eq('ativo', true);
      if (!novos || novos.length === 0) {
        return respondOk(startTime, 0, 0);
      }
      segmentos.push(...novos);
    }

    let totalAdicionados = 0;
    let totalRemovidos = 0;

    for (const segmento of segmentos) {
      const regras = segmento.regras as Record<string, any>;
      const tipo = regras.tipo;

      console.log(`[Segmentos] Processando: "${segmento.nome}" (tipo=${tipo})`);

      let leadIds: string[] = [];

      try {
        switch (tipo) {
          case 'alta_intencao':
            leadIds = await buscarAltaIntencao(supabase, segmento.id_empresa);
            break;
          case 'aquecimento':
            leadIds = await buscarAquecimento(supabase, segmento.id_empresa);
            break;
          case 'quase_cliente':
            leadIds = await buscarQuaseCliente(supabase, segmento.id_empresa);
            break;
          case 'cliente_quente':
            leadIds = await buscarClienteQuente(supabase, segmento.id_empresa);
            break;
          case 'reativacao':
            leadIds = await buscarReativacao(supabase, segmento.id_empresa);
            break;
          case 'investidor_tokeniza':
            leadIds = await buscarInvestidorTokeniza(supabase, segmento.id_empresa);
            break;
          case 'amelia_qualificado':
            leadIds = await buscarAmeliaQualificado(supabase, segmento.id_empresa);
            break;
          case 'mautic_engajado':
            leadIds = await buscarMauticEngajado(supabase, segmento.id_empresa);
            break;
          default:
            console.log(`[Segmentos] Tipo desconhecido: ${tipo}`);
        }
      } catch (err) {
        console.error(`[Segmentos] Erro no segmento "${segmento.nome}":`, err);
        continue;
      }

      // Sync members: add new, remove old
      const { data: membrosAtuais } = await supabase
        .from('lead_segmento_membro')
        .select('id_lead')
        .eq('id_segmento', segmento.id)
        .is('removido_em', null);

      const membrosAtuaisIds = new Set((membrosAtuais || []).map(m => m.id_lead));
      const novosIds = new Set(leadIds);

      // Add new members
      const paraAdicionar = leadIds.filter(id => !membrosAtuaisIds.has(id));
      if (paraAdicionar.length > 0) {
        const inserts = paraAdicionar.map(id_lead => ({
          id_lead,
          id_segmento: segmento.id,
        }));

        // Batch insert in chunks of 100
        for (let i = 0; i < inserts.length; i += 100) {
          const chunk = inserts.slice(i, i + 100);
          await supabase.from('lead_segmento_membro').upsert(chunk, {
            onConflict: 'id_lead,id_segmento',
          });
        }
        totalAdicionados += paraAdicionar.length;
      }

      // Remove members no longer matching
      const paraRemover = Array.from(membrosAtuaisIds).filter(id => !novosIds.has(id));
      if (paraRemover.length > 0) {
        await supabase
          .from('lead_segmento_membro')
          .update({ removido_em: new Date().toISOString() })
          .eq('id_segmento', segmento.id)
          .in('id_lead', paraRemover)
          .is('removido_em', null);
        totalRemovidos += paraRemover.length;
      }

      console.log(`[Segmentos] "${segmento.nome}": ${leadIds.length} leads, +${paraAdicionar.length} -${paraRemover.length}`);
    }

    const duracao = Date.now() - startTime;

    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'calcular-segmentos',
      status: 'sucesso',
      duracao_ms: duracao,
      detalhes_execucao: {
        segmentos_processados: segmentos.length,
        adicionados: totalAdicionados,
        removidos: totalRemovidos,
      },
    });

    return respondOk(startTime, totalAdicionados, totalRemovidos);

  } catch (error) {
    console.error('[Segmentos] Erro:', error);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await supabase.from('cronjob_execucao').insert({
      nome_cronjob: 'calcular-segmentos',
      status: 'erro',
      duracao_ms: Date.now() - startTime,
      mensagem_erro: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function respondOk(startTime: number, adicionados: number, removidos: number) {
  return new Response(
    JSON.stringify({ success: true, adicionados, removidos, duracao_ms: Date.now() - startTime }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ======= Segment Query Functions =======
// Stages reais na base: Lead, MQL, Levantada de mão, Atacar agora!, Atacar Agora,
// Contato Iniciado, Contato estabelecido, Apresentação, Negociação,
// Aguardando pagamento, Vendido, Perdido, WhatsApp, LP, Amélia, etc.

async function buscarAltaIntencao(supabase: any, idEmpresa: string): Promise<string[]> {
  // Sinais de alta intenção: stape recente OU mautic ativo OU amelia quente OU stage "Atacar agora"
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Via stape events
  const { data: eventosRecentes } = await supabase
    .from('stape_evento')
    .select('id_lead')
    .eq('id_empresa', idEmpresa)
    .gte('created_at', seteDiasAtras)
    .not('id_lead', 'is', null);

  const idsStape = new Set((eventosRecentes || []).map((e: any) => e.id_lead));

  // Via lead signals: amelia quente OU stage "Atacar agora!" OU "Levantada de mão"
  const { data: leadsSinais } = await supabase
    .from('lead')
    .select('id_lead')
    .eq('id_empresa', idEmpresa)
    .or('venda_realizada.is.null,venda_realizada.eq.false')
    .or('amelia_temperatura.eq.quente,stage_atual.eq.Atacar agora!,stage_atual.eq.Atacar Agora,stage_atual.eq.Levantada de mão')
    .limit(1000);

  (leadsSinais || []).forEach((l: any) => idsStape.add(l.id_lead));

  if (idsStape.size === 0) return [];

  // Filter out leads with sale
  const idsArr = Array.from(idsStape).slice(0, 1000);
  const { data: leadsAtivos } = await supabase
    .from('lead')
    .select('id_lead')
    .in('id_lead', idsArr)
    .eq('id_empresa', idEmpresa)
    .or('venda_realizada.is.null,venda_realizada.eq.false');

  return (leadsAtivos || []).map((l: any) => l.id_lead);
}

async function buscarAquecimento(supabase: any, idEmpresa: string): Promise<string[]> {
  // Mautic page_hits > 3 OU mautic_score > 30
  const { data } = await supabase
    .from('lead')
    .select('id_lead')
    .eq('id_empresa', idEmpresa)
    .or('venda_realizada.is.null,venda_realizada.eq.false')
    .or('mautic_page_hits.gt.3,mautic_score.gt.30')
    .limit(1000);

  return (data || []).map((l: any) => l.id_lead);
}

async function buscarQuaseCliente(supabase: any, idEmpresa: string): Promise<string[]> {
  // Stages reais avançados + sinais de qualificação
  const { data } = await supabase
    .from('lead')
    .select('id_lead')
    .eq('id_empresa', idEmpresa)
    .or('venda_realizada.is.null,venda_realizada.eq.false')
    .or('stage_atual.eq.Apresentação,stage_atual.eq.Negociação,stage_atual.eq.Aguardando pagamento,stage_atual.eq.Levantada de mão,mautic_score.gt.70,amelia_temperatura.eq.quente')
    .limit(500);

  return (data || []).map((l: any) => l.id_lead);
}

async function buscarClienteQuente(supabase: any, idEmpresa: string): Promise<string[]> {
  // Cliente que comprou + voltou ao site/teve atividade recente (qualquer canal)
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('lead')
    .select('id_lead')
    .eq('id_empresa', idEmpresa)
    .eq('venda_realizada', true)
    .or(`stape_last_activity.gte.${seteDiasAtras},mautic_last_active.gte.${seteDiasAtras}`)
    .limit(500);

  return (data || []).map((l: any) => l.id_lead);
}

async function buscarReativacao(supabase: any, idEmpresa: string): Promise<string[]> {
  // Leads engajados no passado (Lead, MQL, Contato) sem atividade há 30+ dias
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('lead')
    .select('id_lead, mautic_last_active, stape_last_activity, updated_at')
    .eq('id_empresa', idEmpresa)
    .or('venda_realizada.is.null,venda_realizada.eq.false')
    .in('stage_atual', ['Lead', 'MQL', 'Contato Iniciado', 'Contato estabelecido', 'WhatsApp'])
    .limit(2000);

  // Filtrar no client por inatividade (sem activity OU mais antigo que 30d)
  return (data || [])
    .filter((l: any) => {
      const last = l.mautic_last_active || l.stape_last_activity || l.updated_at;
      return !last || new Date(last).toISOString() < trintaDiasAtras;
    })
    .map((l: any) => l.id_lead)
    .slice(0, 500);
}

async function buscarInvestidorTokeniza(supabase: any, idEmpresa: string): Promise<string[]> {
  // Leads marcados como investidores ativos no Tokeniza
  const { data } = await supabase
    .from('lead')
    .select('id_lead')
    .eq('id_empresa', idEmpresa)
    .eq('tokeniza_investidor', true)
    .limit(3000);

  return (data || []).map((l: any) => l.id_lead);
}

async function buscarAmeliaQualificado(supabase: any, idEmpresa: string): Promise<string[]> {
  // Leads com alta qualificação Amélia (score >= 70 OU temperatura quente)
  const { data } = await supabase
    .from('lead')
    .select('id_lead')
    .eq('id_empresa', idEmpresa)
    .or('amelia_score.gte.70,amelia_temperatura.eq.quente')
    .limit(1000);

  return (data || []).map((l: any) => l.id_lead);
}

async function buscarMauticEngajado(supabase: any, idEmpresa: string): Promise<string[]> {
  // Leads com forte engajamento Mautic
  const { data } = await supabase
    .from('lead')
    .select('id_lead')
    .eq('id_empresa', idEmpresa)
    .or('mautic_page_hits.gt.3,mautic_score.gt.50')
    .limit(1000);

  return (data || []).map((l: any) => l.id_lead);
}

// ======= Default Segments Creation =======

async function criarSegmentosPadrao(supabase: any) {
  // Get all empresas
  const { data: empresas } = await supabase.from('empresa').select('id_empresa');

  const segmentosPadrao = [
    { nome: 'Alta Intenção', descricao: 'Sinais de intenção: stape recente, Amélia quente, "Atacar agora" ou Levantada de mão', regras: { tipo: 'alta_intencao' } },
    { nome: 'Aquecimento', descricao: 'Mautic page_hits > 3 ou score > 30', regras: { tipo: 'aquecimento' } },
    { nome: 'Quase Cliente', descricao: 'Stages avançados (Apresentação/Negociação) ou alta qualificação', regras: { tipo: 'quase_cliente' } },
    { nome: 'Cliente Quente', descricao: 'Comprou + voltou via stape/mautic nos últimos 7 dias', regras: { tipo: 'cliente_quente' } },
    { nome: 'Reativação', descricao: 'Lead/MQL/Contato inativo há 30+ dias', regras: { tipo: 'reativacao' } },
    { nome: 'Investidores Tokeniza', descricao: 'Leads com tokeniza_investidor = true', regras: { tipo: 'investidor_tokeniza' } },
    { nome: 'Alta Qualificação Amélia', descricao: 'Score Amélia ≥ 70 ou temperatura quente', regras: { tipo: 'amelia_qualificado' } },
    { nome: 'Engajados Mautic', descricao: 'Mautic page_hits > 3 ou score > 50', regras: { tipo: 'mautic_engajado' } },
  ];

  for (const empresa of (empresas || [])) {
    for (const seg of segmentosPadrao) {
      await supabase.from('lead_segmento').insert({
        id_empresa: empresa.id_empresa,
        ...seg,
      });
    }
  }

  console.log(`[Segmentos] Criados ${segmentosPadrao.length} segmentos padrão para ${empresas?.length || 0} empresas`);
}
