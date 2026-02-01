import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertaConfig {
  tipo: string;
  severidade: "info" | "warning" | "critical";
  titulo: string;
  descricao: string;
  acionavel: boolean;
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

    console.log("🔔 Iniciando detecção de alertas automáticos...");

    // Buscar todas as empresas com configurações de alerta
    const { data: empresas, error: empresasError } = await supabase
      .from("empresa")
      .select("*");

    if (empresasError) throw empresasError;

    const alertasCriados: any[] = [];
    const hoje = new Date();
    const tresDiasAtras = new Date(hoje);
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    for (const empresa of empresas || []) {
      console.log(`\n📊 Analisando empresa: ${empresa.nome}`);

      try {
        // ========== ALERTA 1: CPL ALTO (3+ dias consecutivos) ==========
        if (empresa.cpl_maximo) {
          console.log(`  💰 Verificando CPL (máximo: R$ ${empresa.cpl_maximo})...`);

          const { data: metricasCPL } = await supabase
            .from("empresa_metricas_dia")
            .select("data, cpl")
            .eq("id_empresa", empresa.id_empresa)
            .gte("data", tresDiasAtras.toISOString().split("T")[0])
            .order("data", { ascending: false })
            .limit(3);

          if (metricasCPL && metricasCPL.length >= 3) {
            const diasComCPLAlto = metricasCPL.filter(m => m.cpl && m.cpl > empresa.cpl_maximo);
            
            if (diasComCPLAlto.length >= 3) {
              const cplMedio = diasComCPLAlto.reduce((acc, m) => acc + (m.cpl || 0), 0) / diasComCPLAlto.length;
              
              // Verificar se já existe alerta não resolvido
              const { data: alertaExistente } = await supabase
                .from("alerta_automatico")
                .select("id_alerta")
                .eq("id_empresa", empresa.id_empresa)
                .eq("tipo", "CPL_ALTO")
                .eq("resolvido", false)
                .single();

              if (!alertaExistente) {
                const { error: insertError } = await supabase
                  .from("alerta_automatico")
                  .insert({
                    id_empresa: empresa.id_empresa,
                    tipo: "CPL_ALTO",
                    severidade: "warning",
                    titulo: `CPL acima do limite há ${diasComCPLAlto.length} dias`,
                    descricao: `O CPL médio dos últimos ${diasComCPLAlto.length} dias (R$ ${cplMedio.toFixed(2)}) está acima do limite configurado (R$ ${empresa.cpl_maximo.toFixed(2)}).`,
                    acionavel: true,
                    metadados: {
                      cpl_medio: cplMedio,
                      cpl_maximo: empresa.cpl_maximo,
                      dias_consecutivos: diasComCPLAlto.length,
                      metricas: diasComCPLAlto,
                    },
                  });

                if (!insertError) {
                  alertasCriados.push({ empresa: empresa.nome, tipo: "CPL_ALTO" });
                  console.log(`  🚨 Alerta CPL ALTO criado para ${empresa.nome}`);
                }
              }
            }
          }
        }

        // ========== ALERTA 2: CAC ALTO (2+ semanas consecutivas) ==========
        if (empresa.cac_maximo) {
          console.log(`  💸 Verificando CAC (máximo: R$ ${empresa.cac_maximo})...`);

          const { data: metricasCAC } = await supabase
            .from("empresa_semana_metricas")
            .select("id_semana, cac")
            .eq("id_empresa", empresa.id_empresa)
            .order("id_semana", { ascending: false })
            .limit(empresa.semanas_alerta_cac || 2);

          if (metricasCAC && metricasCAC.length >= 2) {
            const semanasComCACAlto = metricasCAC.filter(m => m.cac && m.cac > empresa.cac_maximo);
            
            if (semanasComCACAlto.length >= 2) {
              const cacMedio = semanasComCACAlto.reduce((acc, m) => acc + (m.cac || 0), 0) / semanasComCACAlto.length;
              
              const { data: alertaExistente } = await supabase
                .from("alerta_automatico")
                .select("id_alerta")
                .eq("id_empresa", empresa.id_empresa)
                .eq("tipo", "CAC_ALTO")
                .eq("resolvido", false)
                .single();

              if (!alertaExistente) {
                const { error: insertError } = await supabase
                  .from("alerta_automatico")
                  .insert({
                    id_empresa: empresa.id_empresa,
                    tipo: "CAC_ALTO",
                    severidade: "critical",
                    titulo: `CAC crítico há ${semanasComCACAlto.length} semanas`,
                    descricao: `O CAC médio das últimas ${semanasComCACAlto.length} semanas (R$ ${cacMedio.toFixed(2)}) está acima do limite configurado (R$ ${empresa.cac_maximo.toFixed(2)}).`,
                    acionavel: true,
                    metadados: {
                      cac_medio: cacMedio,
                      cac_maximo: empresa.cac_maximo,
                      semanas_consecutivas: semanasComCACAlto.length,
                    },
                  });

                if (!insertError) {
                  alertasCriados.push({ empresa: empresa.nome, tipo: "CAC_ALTO" });
                  console.log(`  🔥 Alerta CAC ALTO criado para ${empresa.nome}`);
                }
              }
            }
          }
        }

        // ========== ALERTA 3: CAMPANHAS PARADAS (>24h sem impressões) ==========
        console.log(`  ⏸️ Verificando campanhas paradas...`);

        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);

        const { data: contasEmpresa } = await supabase
          .from("conta_anuncio")
          .select("id_conta")
          .eq("id_empresa", empresa.id_empresa);

        if (contasEmpresa && contasEmpresa.length > 0) {
          const { data: campanhasAtivas } = await supabase
            .from("campanha")
            .select("id_campanha, nome")
            .eq("ativa", true)
            .in("id_conta", contasEmpresa.map(c => c.id_conta));

          for (const campanha of campanhasAtivas || []) {
            const { data: metricasRecentes } = await supabase
              .from("campanha_metricas_dia")
              .select("impressoes")
              .eq("id_campanha", campanha.id_campanha)
              .gte("data", ontem.toISOString().split("T")[0]);

            const totalImpressoes = metricasRecentes?.reduce((acc, m) => acc + (m.impressoes || 0), 0) || 0;

            if (totalImpressoes === 0) {
              const { data: alertaExistente } = await supabase
                .from("alerta_automatico")
                .select("id_alerta")
                .eq("id_empresa", empresa.id_empresa)
                .eq("tipo", "CAMPANHA_PARADA")
                .eq("resolvido", false)
                .contains("metadados", { id_campanha: campanha.id_campanha })
                .single();

              if (!alertaExistente) {
                const { error: insertError } = await supabase
                  .from("alerta_automatico")
                  .insert({
                    id_empresa: empresa.id_empresa,
                    tipo: "CAMPANHA_PARADA",
                    severidade: "warning",
                    titulo: `Campanha "${campanha.nome}" sem impressões`,
                    descricao: `A campanha "${campanha.nome}" está ativa mas não teve impressões nas últimas 24h.`,
                    acionavel: true,
                    metadados: {
                      id_campanha: campanha.id_campanha,
                      nome_campanha: campanha.nome,
                    },
                  });

                if (!insertError) {
                  alertasCriados.push({ empresa: empresa.nome, tipo: "CAMPANHA_PARADA", campanha: campanha.nome });
                  console.log(`  ⏸️ Alerta CAMPANHA PARADA criado para "${campanha.nome}"`);
                }
              }
            }
          }
        }

        // ========== ALERTA 4: LEADS SEM FOLLOW-UP (>48h sem atividade) ==========
        console.log(`  📧 Verificando leads sem follow-up...`);

        const doisDiasAtras = new Date(hoje);
        doisDiasAtras.setDate(doisDiasAtras.getDate() - 2);

        const { data: leadsRecentes } = await supabase
          .from("lead")
          .select("id_lead, nome_lead, id_lead_externo, created_at")
          .eq("id_empresa", empresa.id_empresa)
          .eq("venda_realizada", false)
          .lte("created_at", doisDiasAtras.toISOString())
          .gte("created_at", tresDiasAtras.toISOString())
          .limit(50);

        for (const lead of leadsRecentes || []) {
          // Verificar se tem atividades no Pipedrive
          const { data: atividades } = await supabase
            .from("pipedrive_activity")
            .select("id")
            .eq("id_empresa", empresa.id_empresa)
            .eq("id_deal_externo", lead.id_lead_externo)
            .limit(1);

          if (!atividades || atividades.length === 0) {
            const { data: alertaExistente } = await supabase
              .from("alerta_automatico")
              .select("id_alerta")
              .eq("id_empresa", empresa.id_empresa)
              .eq("tipo", "LEAD_SEM_FOLLOWUP")
              .eq("resolvido", false)
              .contains("metadados", { id_lead: lead.id_lead })
              .single();

            if (!alertaExistente) {
              const { error: insertError } = await supabase
                .from("alerta_automatico")
                .insert({
                  id_empresa: empresa.id_empresa,
                  tipo: "LEAD_SEM_FOLLOWUP",
                  severidade: "info",
                  titulo: `Lead "${lead.nome_lead}" sem follow-up`,
                  descricao: `O lead "${lead.nome_lead}" foi criado há mais de 48h e não possui atividades registradas no Pipedrive.`,
                  acionavel: true,
                  metadados: {
                    id_lead: lead.id_lead,
                    nome_lead: lead.nome_lead,
                    data_criacao: lead.created_at,
                  },
                });

              if (!insertError) {
                alertasCriados.push({ empresa: empresa.nome, tipo: "LEAD_SEM_FOLLOWUP", lead: lead.nome_lead });
                console.log(`  📧 Alerta LEAD SEM FOLLOW-UP criado para "${lead.nome_lead}"`);
              }
            }
          }
        }

      } catch (error: any) {
        console.error(`  ❌ Erro ao analisar empresa ${empresa.nome}:`, error.message);
      }
    }

    // ========== ENVIAR EMAILS DE ALERTA ==========
    if (alertasCriados.length > 0) {
      console.log(`\n📧 Enviando notificações de ${alertasCriados.length} alertas...`);
      
      try {
        await supabase.functions.invoke("alertar-integracoes-email", {
          body: { alertas: alertasCriados },
        });
        console.log("  ✅ Notificações enviadas");
      } catch (emailError) {
        console.error("  ⚠️ Erro ao enviar notificações:", emailError);
      }
    }

    const duracao = Date.now() - startTime;

    // Registrar execução
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "success",
      duracao_ms: duracao,
      detalhes_execucao: {
        empresas_analisadas: empresas?.length || 0,
        alertas_criados: alertasCriados.length,
        alertas: alertasCriados,
      },
    });

    console.log(`\n✅ Detecção concluída em ${(duracao / 1000).toFixed(1)}s - ${alertasCriados.length} alertas criados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Detecção concluída: ${alertasCriados.length} alertas criados`,
        duracao_ms: duracao,
        alertas_criados: alertasCriados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Erro geral:", error.message);

    const duracao = Date.now() - startTime;
    await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    ).from("cronjob_execucao").insert({
      nome_cronjob: nomeCronjob,
      status: "error",
      duracao_ms: duracao,
      mensagem_erro: error.message,
    });

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
