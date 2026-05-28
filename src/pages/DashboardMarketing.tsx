import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePeriodo } from "@/contexts/PeriodoContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SaudeIntegracoes } from "@/components/dashboard/SaudeIntegracoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ModeloAtribuicao = "first" | "last" | "linear";

interface FunilRow {
  id_empresa: string;
  mes: string;
  canal_first: string;
  canal_last: string;
  leads: number;
  mqls: number;
  levantadas: number;
  reunioes: number;
  vendas: number;
  receita: number;
}

const CANAIS_ORDEM = ["META", "GOOGLE", "EMAIL", "ORGANICO", "SOCIAL_ORGANICO", "WHATSAPP", "DIRETO", "OUTRO"];

export default function DashboardMarketing() {
  const { empresaSelecionada } = useEmpresa();
  const { getInicioFim, labelPeriodo } = usePeriodo();
  const { inicio, fim } = getInicioFim();

  const [modelo, setModelo] = useState<ModeloAtribuicao>(() => {
    return (localStorage.getItem("sgt_modelo_atribuicao") as ModeloAtribuicao) || "last";
  });
  const trocarModelo = (m: ModeloAtribuicao) => {
    setModelo(m);
    localStorage.setItem("sgt_modelo_atribuicao", m);
  };

  // Query funil unificado (view vw_funil_marketing)
  const { data: funilData, isLoading } = useQuery({
    queryKey: ["funil-marketing", empresaSelecionada, inicio, fim],
    queryFn: async () => {
      const mesInicio = format(inicio, "yyyy-MM-01");
      const mesFim = format(fim, "yyyy-MM-01");
      let q = supabase
        .from("vw_funil_marketing" as any)
        .select("*")
        .gte("mes", mesInicio)
        .lte("mes", mesFim);
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        q = q.eq("id_empresa", empresaSelecionada);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FunilRow[];
    },
  });

  // Query atribuição linear: lead.atribuicao_linear agregado
  const { data: linearData } = useQuery({
    queryKey: ["lead-linear", empresaSelecionada, inicio, fim],
    queryFn: async () => {
      let q = supabase
        .from("lead")
        .select("atribuicao_linear, venda_realizada, valor_venda")
        .gte("data_criacao", inicio.toISOString())
        .lte("data_criacao", fim.toISOString())
        .eq("merged", false);
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        q = q.eq("id_empresa", empresaSelecionada);
      }
      const { data, error } = await q.limit(50000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Verba investida (de empresa_metricas_dia)
  const { data: verbaInvestida } = useQuery({
    queryKey: ["verba", empresaSelecionada, inicio, fim],
    queryFn: async () => {
      let q = supabase
        .from("empresa_metricas_dia" as any)
        .select("verba_investida")
        .gte("data", format(inicio, "yyyy-MM-dd"))
        .lte("data", format(fim, "yyyy-MM-dd"));
      if (empresaSelecionada && empresaSelecionada !== "todas") {
        q = q.eq("id_empresa", empresaSelecionada);
      }
      const { data } = await q;
      return (data as unknown as { verba_investida: number }[] ?? []).reduce((s, r) => s + Number(r.verba_investida ?? 0), 0);
    },
  });

  // Agregado por canal — depende do modelo selecionado
  const porCanal = useMemo(() => {
    const map = new Map<string, { leads: number; vendas: number; receita: number; mqls: number; reunioes: number }>();
    const initCanal = (c: string) => {
      if (!map.has(c)) map.set(c, { leads: 0, vendas: 0, receita: 0, mqls: 0, reunioes: 0 });
      return map.get(c)!;
    };

    if (modelo === "linear" && linearData) {
      for (const lead of linearData) {
        const dist = (lead.atribuicao_linear as Record<string, number>) ?? {};
        const totalPesos = Object.values(dist).reduce((s, v) => s + (v as number), 0);
        if (totalPesos > 0) {
          for (const [canal, peso] of Object.entries(dist)) {
            const c = initCanal(canal);
            c.leads += peso as number;
            if (lead.venda_realizada) {
              c.vendas += peso as number;
              c.receita += (lead.valor_venda ?? 0) * (peso as number);
            }
          }
        }
      }
    } else if (funilData) {
      const campo = modelo === "first" ? "canal_first" : "canal_last";
      for (const row of funilData) {
        const canal = (row as any)[campo];
        const c = initCanal(canal);
        c.leads += Number(row.leads ?? 0);
        c.vendas += Number(row.vendas ?? 0);
        c.receita += Number(row.receita ?? 0);
        c.mqls += Number(row.mqls ?? 0);
        c.reunioes += Number(row.reunioes ?? 0);
      }
    }

    const rows = CANAIS_ORDEM
      .filter((c) => map.has(c))
      .map((c) => ({ canal: c, ...map.get(c)! }));
    const outros = Array.from(map.entries()).filter(([k]) => !CANAIS_ORDEM.includes(k));
    rows.push(...outros.map(([k, v]) => ({ canal: k, ...v })));
    return rows;
  }, [funilData, linearData, modelo]);

  const totais = useMemo(() => {
    return porCanal.reduce(
      (acc, c) => {
        acc.leads += c.leads;
        acc.vendas += c.vendas;
        acc.receita += c.receita;
        return acc;
      },
      { leads: 0, vendas: 0, receita: 0 },
    );
  }, [porCanal]);

  const cpl = (verbaInvestida ?? 0) > 0 && totais.leads > 0 ? (verbaInvestida! / totais.leads) : 0;
  const cac = (verbaInvestida ?? 0) > 0 && totais.vendas > 0 ? (verbaInvestida! / totais.vendas) : 0;
  const roas = (verbaInvestida ?? 0) > 0 ? totais.receita / (verbaInvestida!) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard de Marketing</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de todos os canais — {labelPeriodo}</p>
        </div>
        <Tabs value={modelo} onValueChange={(v) => trocarModelo(v as ModeloAtribuicao)}>
          <TabsList>
            <TabsTrigger value="first">First-touch</TabsTrigger>
            <TabsTrigger value="last">Last-touch</TabsTrigger>
            <TabsTrigger value="linear">Linear</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <SaudeIntegracoes />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Leads" value={Math.round(totais.leads).toLocaleString("pt-BR")} />
        <KPICard label="Vendas" value={Math.round(totais.vendas).toLocaleString("pt-BR")} />
        <KPICard label="Receita" value={formatBRL(totais.receita)} />
        <KPICard label="Verba" value={formatBRL(verbaInvestida ?? 0)} />
        <KPICard label="CPL" value={cpl > 0 ? formatBRL(cpl) : "—"} />
        <KPICard label="CAC" value={cac > 0 ? formatBRL(cac) : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance por canal — atribuição {modelo}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : porCanal.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados no período. Confirme que leads têm origem_canal ou first_touch_canal preenchidos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-4">Canal</th>
                    <th className="py-2 pr-4 text-right">Leads</th>
                    <th className="py-2 pr-4 text-right">Vendas</th>
                    <th className="py-2 pr-4 text-right">Conversão</th>
                    <th className="py-2 pr-4 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {porCanal.map((c) => {
                    const conv = c.leads > 0 ? (c.vendas / c.leads) * 100 : 0;
                    return (
                      <tr key={c.canal} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium">{nomeCanal(c.canal)}</td>
                        <td className="py-2 pr-4 text-right">{Math.round(c.leads).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
                        <td className="py-2 pr-4 text-right">{Math.round(c.vendas).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
                        <td className="py-2 pr-4 text-right">{conv > 0 ? `${conv.toFixed(1)}%` : "—"}</td>
                        <td className="py-2 pr-4 text-right">{formatBRL(c.receita)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FunilUnificado funilData={funilData ?? []} totais={totais} verba={verbaInvestida ?? 0} roas={roas} />
        <EvolucaoMensal funilData={funilData ?? []} modelo={modelo} />
      </div>
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </Card>
  );
}

function FunilUnificado({ funilData, totais, verba, roas }: { funilData: FunilRow[]; totais: { leads: number; vendas: number; receita: number }; verba: number; roas: number }) {
  const mqls = funilData.reduce((s, r) => s + Number(r.mqls ?? 0), 0);
  const reunioes = funilData.reduce((s, r) => s + Number(r.reunioes ?? 0), 0);
  const stages = [
    { label: "Leads", value: totais.leads },
    { label: "MQLs", value: mqls },
    { label: "Reuniões", value: reunioes },
    { label: "Vendas", value: totais.vendas },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funil de marketing</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stages.map((s, idx) => {
            const pct = idx === 0 ? 100 : stages[0].value > 0 ? (s.value / stages[0].value) * 100 : 0;
            return (
              <div key={s.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-muted-foreground">{Math.round(s.value).toLocaleString("pt-BR")}{idx > 0 ? ` (${pct.toFixed(1)}%)` : ""}</span>
                </div>
                <div className="h-2 bg-muted rounded">
                  <div className="h-full bg-primary rounded" style={{ width: `${Math.max(pct, 1)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t flex gap-6 text-sm">
          <div><span className="text-muted-foreground">Verba:</span> <strong>{formatBRL(verba)}</strong></div>
          <div><span className="text-muted-foreground">ROAS:</span> <strong>{roas > 0 ? `${roas.toFixed(2)}x` : "—"}</strong></div>
        </div>
      </CardContent>
    </Card>
  );
}

function EvolucaoMensal({ funilData, modelo }: { funilData: FunilRow[]; modelo: ModeloAtribuicao }) {
  // Agrupa por mês, soma leads
  const porMes = new Map<string, number>();
  for (const r of funilData) {
    const m = String(r.mes).slice(0, 7);
    porMes.set(m, (porMes.get(m) ?? 0) + Number(r.leads ?? 0));
  }
  const ordenado = Array.from(porMes.entries()).sort();
  const max = Math.max(1, ...ordenado.map(([, v]) => v));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leads por mês ({modelo})</CardTitle>
      </CardHeader>
      <CardContent>
        {ordenado.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="space-y-1">
            {ordenado.map(([mes, leads]) => (
              <div key={mes} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{format(new Date(`${mes}-15T12:00:00`), "MMM/yy", { locale: ptBR })}</span>
                  <span className="text-muted-foreground">{leads.toLocaleString("pt-BR")}</span>
                </div>
                <div className="h-2 bg-muted rounded">
                  <div className="h-full bg-primary/60 rounded" style={{ width: `${(leads / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function nomeCanal(c: string): string {
  const map: Record<string, string> = {
    META: "Meta Ads",
    GOOGLE: "Google Ads",
    EMAIL: "E-mail",
    ORGANICO: "Orgânico / SEO",
    SOCIAL_ORGANICO: "Social orgânico",
    WHATSAPP: "WhatsApp",
    DIRETO: "Direto",
    OUTRO: "Outro",
  };
  return map[c] ?? c;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
