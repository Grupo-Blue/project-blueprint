import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Comercial</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de vendas, metas e performance</p>
        </div>
        <ToggleGroup type="single" value={tipoNegocio} onValueChange={(v) => v && setTipoNegocio(v)} className="bg-muted rounded-lg p-0.5">
          <ToggleGroupItem value="total" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">Total</ToggleGroupItem>
          <ToggleGroupItem value="new_business" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">New Business</ToggleGroupItem>
          <ToggleGroupItem value="renovacao" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">Renovação</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <AlertasCriticos />

      <Tabs defaultValue="cockpit" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="cockpit" className="text-xs">Cockpit</TabsTrigger>
          <TabsTrigger value="funil" className="text-xs">Funil & Vendedores</TabsTrigger>
          <TabsTrigger value="renovacao" className="text-xs">Renovação</TabsTrigger>
          <TabsTrigger value="marketing" className="text-xs">Marketing</TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
          <TabsTrigger value="operacional" className="text-xs">Operacional</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="cockpit" className="space-y-4">
          <CockpitKPIs tipoNegocio={tipoNegocio} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MetaVsRealizado tipoNegocio={tipoNegocio} />
            <ReceitaAcumulada tipoNegocio={tipoNegocio} />
          </div>
          <InsightsIA />
        </TabsContent>

        <TabsContent value="funil" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FunilNB />
            <PainelAtacarAgora />
          </div>
          <RankingVendedores />
          <MotivosPerdaNB />
        </TabsContent>

        <TabsContent value="renovacao" className="space-y-4">
          <RenovacaoKPIs />
          <MotivosNaoRenovacao />
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          <LeadsPorCanal />
          <CACPorCanal />
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MetaSazonal tipoNegocio={tipoNegocio} />
            <ProjecaoReceita tipoNegocio={tipoNegocio} />
          </div>
          <ROIProfitability empresaId={empresaSelecionada !== "todas" ? empresaSelecionada : undefined} />
          {empresaSelecionada && empresaSelecionada !== "todas" && (
            <PacingOrcamento empresaId={empresaSelecionada} />
          )}
        </TabsContent>

        <TabsContent value="operacional" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SLACompliance />
            <LeadsOrfaos />
          </div>
          {empresaSelecionada && empresaSelecionada !== "todas" && (
            <TempoCiclo empresaId={empresaSelecionada} />
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <ComparativoAnual />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardComercial;
