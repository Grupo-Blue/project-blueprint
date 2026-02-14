import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { CockpitKPIs } from "@/components/dashboard/CockpitKPIs";
import { MetaVsRealizado } from "@/components/dashboard/MetaVsRealizado";
import { ReceitaAcumulada } from "@/components/dashboard/ReceitaAcumulada";
import { AlertasCriticos } from "@/components/dashboard/AlertasCriticos";
import { FunilNB } from "@/components/dashboard/FunilNB";
import { PainelAtacarAgora } from "@/components/dashboard/PainelAtacarAgora";
import { RankingVendedores } from "@/components/dashboard/RankingVendedores";
import { MotivosPerdaNB } from "@/components/dashboard/MotivosPerdaNB";
import { RenovacaoKPIs } from "@/components/dashboard/RenovacaoKPIs";
import { MotivosNaoRenovacao } from "@/components/dashboard/MotivosNaoRenovacao";
import { LeadsPorCanal } from "@/components/dashboard/LeadsPorCanal";
import { CACPorCanal } from "@/components/dashboard/CACPorCanal";
import { MetaSazonal } from "@/components/dashboard/MetaSazonal";
import { ProjecaoReceita } from "@/components/dashboard/ProjecaoReceita";
import { ROIProfitability } from "@/components/dashboard/ROIProfitability";
import { SLACompliance } from "@/components/dashboard/SLACompliance";
import { LeadsOrfaos } from "@/components/dashboard/LeadsOrfaos";
import { TempoCiclo } from "@/components/dashboard/TempoCiclo";
import { PacingOrcamento } from "@/components/dashboard/PacingOrcamento";
import { ComparativoAnual } from "@/components/dashboard/ComparativoAnual";
import { InsightsIA } from "@/components/dashboard/InsightsIA";
import { useEmpresa } from "@/contexts/EmpresaContext";

const DashboardComercial = () => {
  const [tipoNegocio, setTipoNegocio] = useState("total");
  const { empresaSelecionada } = useEmpresa();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Dashboard Comercial</h1>
          <p className="text-xs text-muted-foreground">Visão consolidada de vendas, metas e performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/metas-comerciais">
            <Button variant="outline" size="sm" className="rounded-xl border-border/50 bg-accent/30 backdrop-blur-sm hover:bg-accent/60">
              <Target className="h-4 w-4 mr-1" />
              Metas
            </Button>
          </Link>
          <ToggleGroup
            type="single"
            value={tipoNegocio}
            onValueChange={(v) => v && setTipoNegocio(v)}
            className="glass-card !rounded-xl p-0.5 border-0"
          >
            <ToggleGroupItem value="total" className="text-xs px-3 h-8 rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm">Total</ToggleGroupItem>
            <ToggleGroupItem value="new_business" className="text-xs px-3 h-8 rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm">New Business</ToggleGroupItem>
            <ToggleGroupItem value="renovacao" className="text-xs px-3 h-8 rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm">Renovação</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <AlertasCriticos />

      <Tabs defaultValue="cockpit" className="space-y-5">
        <TabsList className="glass-card !rounded-xl border-0 p-1 flex flex-wrap h-auto gap-0.5">
          <TabsTrigger value="cockpit" className="text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Cockpit</TabsTrigger>
          <TabsTrigger value="funil" className="text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Funil & Vendedores</TabsTrigger>
          <TabsTrigger value="renovacao" className="text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Renovação</TabsTrigger>
          <TabsTrigger value="marketing" className="text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Marketing</TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Financeiro</TabsTrigger>
          <TabsTrigger value="operacional" className="text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Operacional</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="cockpit" className="space-y-5">
          <CockpitKPIs tipoNegocio={tipoNegocio} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <MetaVsRealizado tipoNegocio={tipoNegocio} />
            <ReceitaAcumulada tipoNegocio={tipoNegocio} />
          </div>
          <InsightsIA />
        </TabsContent>

        <TabsContent value="funil" className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <FunilNB />
            <PainelAtacarAgora />
          </div>
          <RankingVendedores />
          <MotivosPerdaNB />
        </TabsContent>

        <TabsContent value="renovacao" className="space-y-5">
          <RenovacaoKPIs />
          <MotivosNaoRenovacao />
        </TabsContent>

        <TabsContent value="marketing" className="space-y-5">
          <LeadsPorCanal />
          <CACPorCanal />
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <MetaSazonal tipoNegocio={tipoNegocio} />
            <ProjecaoReceita tipoNegocio={tipoNegocio} />
          </div>
          <ROIProfitability empresaId={empresaSelecionada !== "todas" ? empresaSelecionada : undefined} />
          {empresaSelecionada && empresaSelecionada !== "todas" && (
            <PacingOrcamento empresaId={empresaSelecionada} />
          )}
        </TabsContent>

        <TabsContent value="operacional" className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SLACompliance />
            <LeadsOrfaos />
          </div>
          {empresaSelecionada && empresaSelecionada !== "todas" && (
            <TempoCiclo empresaId={empresaSelecionada} />
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-5">
          <ComparativoAnual />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardComercial;
