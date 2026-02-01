import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AlertLevel = "INFO" | "WARNING" | "CRITICAL";

interface Alert {
  id_empresa: string;
  tipo: string;
  nivel: AlertLevel;
  titulo: string;
  descricao: string;
  dados_contexto?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const nomeCronjob = "detectar-alertas-automaticos";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Iniciando detecção de alertas automáticos...");

    // Buscar todas as empresas ativas
    const { data: empresas, error: empresasError } = await supabase
      .from("empresa")
      .select("id_empresa, nome, cpl_maximo, cac_maximo")
      .eq("ativa", true);

    if (empresasError) throw empresasError;

    if (!empresas || empresas.length === 0) {
      console.log("Nenhuma empresa ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma empresa ativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const alertas: Alert[] = [];
    const hoje = new Date();
    const tresDiasAtras = new Date(hoje);
    tresDiasAtras.setDate(hoje.getDate() - 3);
    const dataInicio3d = tresDiasAtras.toISOString().split("T")[0];

    const duasSemanasAtras = new Date(hoje);
    duasSemanasAtras.setDate(hoje.getDate() - 14);
    const dataInicio2s = duasSemanasAtras.toISOString().split("T")[0];

    const umDiaAtras = new Date(hoje);
    umDiaAtras.setDate(hoje.getDate() - 1);
    const dataOntem = umDiaAtras.toISOString().split("T")[0];

    const doisDiasAtras = new Date(hoje);
    doisDiasAtras.setDate(hoje.getDate() - 2);
    const data48hAtras = doisDiasAtras.toISOString().split("T")[0];

    console.log(`Analisando ${empresas.length} empresas...`);

    for (const empresa of empresas) {
      console.log(`\n📊 Empresa: ${empresa.nome} (${empresa.id_empresa})`);

      // ========== ALERTA 1: CPL > cpl_maximo por 3 dias → WARNING ==========
      if (empresa.cpl_maximo && empresa.cpl_maximo > 0) {
        const { data: metricasCPL, error: cplError } = await supabase
          .from("campanha_metricas_dia")
          .select(`
            data,
            verba_investida,
            leads,
            campanha!inner(id_campanha, nome, id_conta)
          `)
          .gte("data", dataInicio3d)
          .eq("campanha.id_conta", await supabase
            .from("conta_anuncio")
            .select("id_conta")
            .eq("id_empresa", empresa.id_empresa)
            .then(r => r.data?.map(c => c.id_conta) || [])
          );

        if (!cplError && metricasCPL && metricasCPL.length > 0) {
          // Agrupar por data e calcular CPL médio
          const cplPorDia: Record<string, { verba: number; leads: number }> = {};
          
          for (const metrica of metricasCPL) {
            if (!cplPorDia[metrica.data]) {
              cplPorDia[metrica.data] = { verba: 0, leads: 0 };
            }
            cplPorDia[metrica.data].verba += metrica.verba_investida || 0;
            cplPorDia[metrica.data].leads += metrica.leads || 0;
          }

          // Verificar se CPL ultrapassou limite por 3 dias consecutivos
          const datasOrdenadas = Object.keys(cplPorDia).sort().reverse().slice(0, 3);
          let diasAcimaDoLimite = 0;

          for (const data of datasOrdenadas) {
            const { verba, leads } = cplPorDia[data];
            const cpl = leads > 0 ? verba / leads : 0;
            
            if (cpl > empresa.cpl_maximo) {
              diasAcimaDoLimite++;
            }
          }

          if (diasAcimaDoLimite >= 3) {
            const ultimoDia = datasOrdenadas[0];
            const { verba, leads } = cplPorDia[ultimoDia];
            const cplAtual = leads > 0 ? verba / leads : 0;

            alertas.push({
              id_empresa: empresa.id_empresa,
              tipo: "CPL_ALTO",
              nivel: "WARNING",
              titulo: `CPL acima do limite há ${diasAcimaDoLimite} dias`,
              descricao: `O custo por lead está em R$ ${cplAtual.toFixed(2)}, acima do limite de R$ ${empresa.cpl_maximo.toFixed(2)}`,
              dados_contexto: {
                cpl_atual: cplAtual,
                cpl_maximo: empresa.cpl_maximo,
                dias_consecutivos: diasAcimaDoLimite,
                periodo: `${datasOrdenadas[datasOrdenadas.length - 1]} a ${datasOrdenadas[0]}`
              }
            });

            console.log(`  ⚠️ CPL alto detectado: R$ ${cplAtual.toFixed(2)} > R$ ${empresa.cpl_maximo.toFixed(2)}`);
          }
        }
      }

      // ========== ALERTA 2: CAC > cac_maximo por 2 semanas → CRITICAL ==========
      if (empresa.cac_maximo && empresa.cac_maximo > 0) {
        const { data: metricasCAC, error: cacError } = await supabase
          .from("campanha_metricas_dia")
          .select(`
            data,
            verba_investida,
            leads,
            campanha!inner(id_campanha, nome, id_conta)
          `)
          .gte("data", dataInicio2s)
          .eq("campanha.id_conta", await supabase
            .from("conta_anuncio")
            .select("id_conta")
            .eq("id_empresa", empresa.id_empresa)
            .then(r => r.data?.map(c => c.id_conta) || [])
          );

        if (!cacError && metricasCAC && metricasCAC.length > 0) {
          // Calcular investimento total e leads qualificados (convertidos em clientes)
          let investimentoTotal = 0;
          let leadsTotal = 0;

          for (const metrica of metricasCAC) {
            investimentoTotal += metrica.verba_investida || 0;
            leadsTotal += metrica.leads || 0;
          }

          // Buscar leads que viraram clientes (assumindo status "CLIENTE" ou conversão)
          const { data: leadsConvertidos } = await supabase
            .from("lead")
            .select("id_lead")
            .eq("id_empresa", empresa.id_empresa)
            .eq("status_qualificacao", "CLIENTE")
            .gte("data_criacao", dataInicio2s);

          const clientesNovos = leadsConvertidos?.length || 0;
          const cac = clientesNovos > 0 ? investimentoTotal / clientesNovos : 0;

          if (cac > empresa.cac_maximo && clientesNovos > 0) {
            alertas.push({
              id_empresa: empresa.id_empresa,
              tipo: "CAC_ALTO",
              nivel: "CRITICAL",
              titulo: "CAC acima do limite nas últimas 2 semanas",
              descricao: `O custo de aquisição de cliente está em R$ ${cac.toFixed(2)}, acima do limite de R$ ${empresa.cac_maximo.toFixed(2)}`,
              dados_contexto: {
                cac_atual: cac,
                cac_maximo: empresa.cac_maximo,
                investimento_total: investimentoTotal,
                novos_clientes: clientesNovos,
                periodo: `${dataInicio2s} a ${hoje.toISOString().split("T")[0]}`
              }
            });

            console.log(`  🚨 CAC alto detectado: R$ ${cac.toFixed(2)} > R$ ${empresa.cac_maximo.toFixed(2)}`);
          }
        }
      }

      // ========== ALERTA 3: Campanha sem impressões há >24h → WARNING ==========
      const { data: campanhasSemImpressao, error: impError } = await supabase
        .from("campanha")
        .select(`
          id_campanha,
          nome,
          id_conta,
          conta_anuncio!inner(id_empresa)
        `)
        .eq("ativa", true)
        .eq("conta_anuncio.id_empresa", empresa.id_empresa);

      if (!impError && campanhasSemImpressao && campanhasSemImpressao.length > 0) {
        for (const campanha of campanhasSemImpressao) {
          const { data: metricasRecentes } = await supabase
            .from("campanha_metricas_dia")
            .select("impressoes")
            .eq("id_campanha", campanha.id_campanha)
            .gte("data", dataOntem)
            .gt("impressoes", 0);

          if (!metricasRecentes || metricasRecentes.length === 0) {
            alertas.push({
              id_empresa: empresa.id_empresa,
              tipo: "CAMPANHA_SEM_IMPRESSOES",
              nivel: "WARNING",
              titulo: `Campanha sem impressões: ${campanha.nome}`,
              descricao: `A campanha "${campanha.nome}" está ativa mas não gerou impressões nas últimas 24 horas`,
              dados_contexto: {
                id_campanha: campanha.id_campanha,
                nome_campanha: campanha.nome,
                verificado_em: hoje.toISOString()
              }
            });

            console.log(`  ⚠️ Campanha sem impressões: ${campanha.nome}`);
          }
        }
      }

      // ========== ALERTA 4: Leads sem follow-up há >48h → INFO ==========
      const { data: leadsSemFollowup } = await supabase
        .from("lead")
        .select("id_lead, nome, email, data_criacao")
        .eq("id_empresa", empresa.id_empresa)
        .lte("data_criacao", data48hAtras)
        .or("status_qualificacao.is.null,status_qualificacao.eq.NOVO");

      if (leadsSemFollowup && leadsSemFollowup.length > 0) {
        // Verificar se tem atividades registradas
        const leadsIds = leadsSemFollowup.map(l => l.id_lead);
        
        const { data: activities } = await supabase
          .from("pipedrive_activity")
          .select("id_lead")
          .in("id_lead", leadsIds);

        const leadsComActivity = new Set(activities?.map(a => a.id_lead) || []);
        const leadsSemActivityCount = leadsSemFollowup.filter(l => !leadsComActivity.has(l.id_lead)).length;

        if (leadsSemActivityCount > 0) {
          alertas.push({
            id_empresa: empresa.id_empresa,
            tipo: "LEADS_SEM_FOLLOWUP",
            nivel: "INFO",
            titulo: `${leadsSemActivityCount} leads sem follow-up há mais de 48h`,
            descricao: `Existem ${leadsSemActivityCount} leads novos sem atividades registradas há mais de 2 dias`,
            dados_contexto: {
              total_leads: leadsSemActivityCount,
              data_limite: data48hAtras
            }
          });

          console.log(`  ℹ️ ${leadsSemActivityCount} leads sem follow-up`);
        }
      }
    }

    console.log(`\n✅ Detecção concluída: ${alertas.length} alertas encontrados`);

    // Salvar alertas no banco
    let alertasSalvos = 0;
    for (const alerta of alertas) {
      const { error: insertError } = await supabase
        .from("alerta_automatico")
        .insert(alerta);

      if (insertError) {
        console.error(`Erro ao salvar alerta:`, insertError);
      } else {
        alertasSalvos++;
      }
    }

    // Se houver alertas, chamar edge function de envio de email
    if (alertasSalvos > 0) {
      console.log(`\n📧 Enviando ${alertasSalvos} alertas por email...`);
      
      try {
        await supabase.functions.invoke("alertar-integracoes-email", {
          body: { alertas }
        });
        console.log("✅ Emails de alerta disparados");
      } catch (emailError) {
        console.error("⚠️ Erro ao enviar emails de alerta:", emailError);
      }
    }

    const duracao = Date.now() - startTime;

    // Registrar execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "sucesso",
      duracao_ms: duracao,
      detalhes_execucao: {
        empresas_analisadas: empresas.length,
        alertas_detectados: alertas.length,
        alertas_salvos: alertasSalvos
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Detecção concluída: ${alertasSalvos} alertas detectados`,
        empresas_analisadas: empresas.length,
        alertas_detectados: alertas.length,
        alertas_salvos: alertasSalvos,
        alertas
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro geral:", error);
    
    const duracao = Date.now() - startTime;
    await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    ).from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "erro",
      duracao_ms: duracao,
      mensagem_erro: error instanceof Error ? error.message : String(error)
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
