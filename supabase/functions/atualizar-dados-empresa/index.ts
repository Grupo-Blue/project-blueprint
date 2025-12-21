import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FaseExecucao {
  nome: string;
  jobs: string[];
  status: "pendente" | "executando" | "concluido" | "erro";
  duracao_ms?: number;
  erro?: string;
}

// Definição das fases com seus jobs
const FASES: { nome: string; jobs: string[] }[] = [
  {
    nome: "Importar Campanhas",
    jobs: ["importar-campanhas-meta", "importar-campanhas-google"],
  },
  {
    nome: "Coletar Métricas",
    jobs: ["coletar-metricas-meta", "coletar-metricas-google"],
  },
  {
    nome: "Coletar Criativos",
    jobs: ["coletar-criativos-meta", "coletar-criativos-google"],
  },
  {
    nome: "Sincronizar Leads",
    jobs: ["sincronizar-pipedrive", "vincular-leads-criativos"],
  },
  {
    nome: "Enriquecer Leads",
    jobs: ["monitorar-enriquecimento-leads"],
  },
  {
    nome: "Calcular Métricas",
    jobs: ["calcular-metricas-diarias"],
  },
];

// Função que executa em background
async function executarAtualizacao(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  id_empresa: string,
  id_execucao: string,
  temMeta: boolean,
  temGoogle: boolean
) {
  const inicioTotal = Date.now();
  const fases: FaseExecucao[] = FASES.map((f) => ({
    nome: f.nome,
    jobs: f.jobs,
    status: "pendente" as const,
  }));
  let sucesso = true;

  // Função para atualizar o progresso no banco
  async function atualizarProgresso(status: string, mensagem?: string) {
    try {
      await supabase
        .from("cronjob_execucao")
        .update({
          status,
          duracao_ms: Date.now() - inicioTotal,
          detalhes_execucao: {
            id_empresa,
            fases,
            mensagem,
          },
        })
        .eq("id_execucao", id_execucao);
    } catch (e) {
      console.error("[Orquestrador] Erro ao atualizar progresso:", e);
    }
  }

  try {
    // Executar cada fase em sequência
    for (let i = 0; i < FASES.length; i++) {
      const fase = FASES[i];
      fases[i].status = "executando";
      await atualizarProgresso("executando");

      const inicioFase = Date.now();
      console.log(`[Orquestrador] Iniciando fase: ${fase.nome}`);

      try {
        // Filtrar jobs baseado nas plataformas disponíveis
        const jobsParaExecutar = fase.jobs.filter((job) => {
          if (job.includes("meta") && !temMeta) return false;
          if (job.includes("google") && !temGoogle) return false;
          return true;
        });

        if (jobsParaExecutar.length === 0) {
          console.log(`[Orquestrador] Fase ${fase.nome} pulada - nenhum job aplicável`);
          fases[i].status = "concluido";
          fases[i].duracao_ms = 0;
          continue;
        }

        // Executar jobs da fase em paralelo
        const resultadosJobs = await Promise.allSettled(
          jobsParaExecutar.map(async (jobName) => {
            console.log(`[Orquestrador] Executando job: ${jobName}`);

            // Preparar body com id_empresa para filtrar
            const body: Record<string, any> = { id_empresa };

            // Adicionar parâmetros específicos para alguns jobs
            if (jobName === "calcular-metricas-diarias") {
              body.data = "today";
            }

            const response = await fetch(
              `${supabaseUrl}/functions/v1/${jobName}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify(body),
              }
            );

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Job ${jobName} falhou: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`[Orquestrador] Job ${jobName} concluído:`, result);
            return { job: jobName, result };
          })
        );

        // Verificar se algum job falhou
        const falhas = resultadosJobs.filter((r) => r.status === "rejected");
        if (falhas.length > 0) {
          const erros = falhas.map((f) => (f as PromiseRejectedResult).reason.message).join("; ");
          throw new Error(erros);
        }

        fases[i].status = "concluido";
        fases[i].duracao_ms = Date.now() - inicioFase;
        console.log(`[Orquestrador] Fase ${fase.nome} concluída em ${fases[i].duracao_ms}ms`);

      } catch (error: any) {
        fases[i].status = "erro";
        fases[i].duracao_ms = Date.now() - inicioFase;
        fases[i].erro = error.message;
        sucesso = false;
        console.error(`[Orquestrador] Erro na fase ${fase.nome}:`, error.message);
        // Não interromper, continuar com as próximas fases
      }
    }

    const duracaoTotal = Date.now() - inicioTotal;
    const mensagemFinal = sucesso
      ? `Atualização concluída em ${(duracaoTotal / 1000).toFixed(1)}s`
      : `Atualização concluída com erros em ${(duracaoTotal / 1000).toFixed(1)}s`;

    console.log(`[Orquestrador] ${mensagemFinal}`);

    // Atualizar status final
    await atualizarProgresso(sucesso ? "sucesso" : "parcial", mensagemFinal);

  } catch (error: any) {
    console.error("[Orquestrador] Erro crítico:", error);
    await atualizarProgresso("erro", `Erro crítico: ${error.message}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id_empresa } = await req.json();

    if (!id_empresa) {
      throw new Error("id_empresa é obrigatório");
    }

    console.log(`[Orquestrador] Iniciando atualização para empresa: ${id_empresa}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar integrações da empresa para saber quais jobs executar
    const { data: contas } = await supabase
      .from("conta_anuncio")
      .select("id_conta, plataforma")
      .eq("id_empresa", id_empresa)
      .eq("ativa", true);

    const temMeta = contas?.some((c: any) => c.plataforma === "META");
    const temGoogle = contas?.some((c: any) => c.plataforma === "GOOGLE");

    console.log(`[Orquestrador] Plataformas: Meta=${temMeta}, Google=${temGoogle}`);

    // Criar registro inicial de execução
    const fasesIniciais = FASES.map((f) => ({
      nome: f.nome,
      jobs: f.jobs,
      status: "pendente",
    }));

    const { data: execucao, error: insertError } = await supabase
      .from("cronjob_execucao")
      .insert({
        nome_cronjob: "atualizar-dados-empresa",
        status: "executando",
        duracao_ms: 0,
        detalhes_execucao: {
          id_empresa,
          fases: fasesIniciais,
        },
      })
      .select("id_execucao")
      .single();

    if (insertError || !execucao) {
      throw new Error(`Erro ao criar registro de execução: ${insertError?.message}`);
    }

    const id_execucao = execucao.id_execucao;
    console.log(`[Orquestrador] Execução criada: ${id_execucao}`);

    // Iniciar execução em background (fire and forget)
    // Não usamos await para que a resposta seja imediata
    executarAtualizacao(
      supabase,
      supabaseUrl,
      supabaseKey,
      id_empresa,
      id_execucao,
      temMeta || false,
      temGoogle || false
    ).catch((e) => console.error("[Orquestrador] Erro na execução background:", e));

    // Retornar imediatamente com o id_execucao para polling
    return new Response(
      JSON.stringify({
        sucesso: true,
        id_execucao,
        mensagem: "Atualização iniciada. Use o id_execucao para acompanhar o progresso.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("[Orquestrador] Erro crítico:", error);

    return new Response(
      JSON.stringify({
        sucesso: false,
        mensagem: `Erro ao iniciar atualização: ${error.message}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
