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

interface ResultadoAtualizacao {
  sucesso: boolean;
  fases: FaseExecucao[];
  duracao_total_ms: number;
  mensagem: string;
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const inicioTotal = Date.now();
  const resultado: ResultadoAtualizacao = {
    sucesso: true,
    fases: [],
    duracao_total_ms: 0,
    mensagem: "",
  };

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

    const temMeta = contas?.some((c) => c.plataforma === "META");
    const temGoogle = contas?.some((c) => c.plataforma === "GOOGLE");

    console.log(`[Orquestrador] Plataformas: Meta=${temMeta}, Google=${temGoogle}`);

    // Executar cada fase em sequência
    for (const fase of FASES) {
      const faseExecucao: FaseExecucao = {
        nome: fase.nome,
        jobs: fase.jobs,
        status: "executando",
      };

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
          faseExecucao.status = "concluido";
          faseExecucao.duracao_ms = 0;
          resultado.fases.push(faseExecucao);
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
              body.data = "today"; // Calcular para hoje
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

        faseExecucao.status = "concluido";
        faseExecucao.duracao_ms = Date.now() - inicioFase;
        console.log(`[Orquestrador] Fase ${fase.nome} concluída em ${faseExecucao.duracao_ms}ms`);

      } catch (error: any) {
        faseExecucao.status = "erro";
        faseExecucao.duracao_ms = Date.now() - inicioFase;
        faseExecucao.erro = error.message;
        resultado.sucesso = false;
        console.error(`[Orquestrador] Erro na fase ${fase.nome}:`, error.message);
        // Não interromper, continuar com as próximas fases
      }

      resultado.fases.push(faseExecucao);
    }

    resultado.duracao_total_ms = Date.now() - inicioTotal;
    resultado.mensagem = resultado.sucesso
      ? `Atualização concluída em ${(resultado.duracao_total_ms / 1000).toFixed(1)}s`
      : `Atualização concluída com erros em ${(resultado.duracao_total_ms / 1000).toFixed(1)}s`;

    console.log(`[Orquestrador] ${resultado.mensagem}`);

    // Registrar execução no cronjob_execucao
    await supabase.from("cronjob_execucao").insert({
      nome_cronjob: "atualizar-dados-empresa",
      status: resultado.sucesso ? "sucesso" : "parcial",
      duracao_ms: resultado.duracao_total_ms,
      detalhes_execucao: {
        id_empresa,
        fases: resultado.fases,
      },
    });

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("[Orquestrador] Erro crítico:", error);

    resultado.sucesso = false;
    resultado.duracao_total_ms = Date.now() - inicioTotal;
    resultado.mensagem = `Erro crítico: ${error.message}`;

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
