import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Calendar, AlertCircle, Download, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Relatorio {
  id_relatorio: string;
  id_empresa: string;
  id_semana: string;
  status: string;
  texto_comparacao: string | null;
  aprendizado_resumo: string | null;
  data_fechamento: string | null;
  created_at: string;
  empresa: {
    nome: string;
  };
  semana: {
    numero_semana: number;
    ano: number;
    data_inicio: string;
    data_fim: string;
  };
}

export default function Relatorios() {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [ofertaSelecionada, setOfertaSelecionada] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa")
        .select("id_empresa, nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar projetos Tokeniza cadastrados
  const { data: projetosTokeniza } = useQuery({
    queryKey: ["tokeniza-projetos-relatorios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokeniza_projeto")
        .select("project_id, nome")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar project_ids únicos do array tokeniza_projetos dos leads investidores
  const { data: projectIdsLeads } = useQuery({
    queryKey: ["tokeniza-project-ids-leads-array"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead")
        .select("tokeniza_projetos")
        .eq("tokeniza_investidor", true);
      if (error) throw error;
      
      // Extrair todos os project_ids únicos do array tokeniza_projetos
      const allProjectIds = new Set<string>();
      data?.forEach(lead => {
        if (lead.tokeniza_projetos && Array.isArray(lead.tokeniza_projetos)) {
          lead.tokeniza_projetos.forEach((pid: string) => {
            if (pid) allProjectIds.add(pid);
          });
        }
      });
      
      return Array.from(allProjectIds);
    },
  });

  const handleExportLeads = async () => {
    if (!ofertaSelecionada) {
      toast.error("Selecione uma oferta primeiro");
      return;
    }

    setIsExporting(true);
    try {
      // Buscar leads que contêm o project_id no array tokeniza_projetos
      // Usando filter com operador cs (contains) para array JSONB
      const { data: leads, error } = await supabase
        .from("lead")
        .select(`
          nome_lead,
          email,
          telefone,
          tokeniza_valor_investido,
          tokeniza_qtd_investimentos,
          tokeniza_primeiro_investimento,
          tokeniza_ultimo_investimento
        `)
        .eq("tokeniza_investidor", true)
        .filter("tokeniza_projetos", "cs", `["${ofertaSelecionada}"]`)
        .order("tokeniza_valor_investido", { ascending: false, nullsFirst: false });

      if (error) throw error;

      if (!leads || leads.length === 0) {
        toast.warning("Nenhum lead investidor encontrado para esta oferta");
        return;
      }

      // Criar CSV com apenas os campos solicitados
      const headers = [
        "Nome",
        "Email",
        "Telefone",
        "Valor Investido",
        "Qtd Investimentos",
        "Primeiro Investimento",
        "Último Investimento"
      ];

      const rows = leads.map(lead => [
        lead.nome_lead || "",
        lead.email || "",
        lead.telefone || "",
        lead.tokeniza_valor_investido?.toString() || "0",
        lead.tokeniza_qtd_investimentos?.toString() || "0",
        lead.tokeniza_primeiro_investimento ? format(new Date(lead.tokeniza_primeiro_investimento), "dd/MM/yyyy") : "",
        lead.tokeniza_ultimo_investimento ? format(new Date(lead.tokeniza_ultimo_investimento), "dd/MM/yyyy") : ""
      ]);

      const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(";"))
      ].join("\n");

      // Download
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const nomeOferta = projetosTokeniza?.find(p => p.project_id === ofertaSelecionada)?.nome || ofertaSelecionada;
      link.download = `investidores_${nomeOferta.replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${leads.length} leads exportados com sucesso`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar leads");
    } finally {
      setIsExporting(false);
    }
  };

  // Consolidar ofertas (projetos cadastrados + project_ids dos leads) - sem duplicatas
  const ofertasDisponiveis = (() => {
    const mapa = new Map<string, string>();
    
    // Adicionar projetos cadastrados com seus nomes
    projetosTokeniza?.forEach(p => {
      mapa.set(p.project_id, p.nome || p.project_id);
    });
    
    // Adicionar project_ids dos leads que não estão cadastrados (mostrar ID)
    projectIdsLeads?.forEach(pid => {
      if (!mapa.has(pid)) {
        mapa.set(pid, `Projeto ${pid.substring(0, 8)}...`);
      }
    });
    
    // Ordenar por nome
    return Array.from(mapa.entries())
      .map(([id, nome]) => ({ project_id: id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  })();

  const { data: relatorios, isLoading } = useQuery({
    queryKey: ["relatorios", filtroStatus, filtroEmpresa],
    queryFn: async () => {
      let query = supabase
        .from("relatorio_semanal")
        .select(`
          *,
          empresa:id_empresa (nome),
          semana:id_semana (numero_semana, ano, data_inicio, data_fim)
        `)
        .order("created_at", { ascending: false });

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus as any);
      }

      if (filtroEmpresa !== "todas") {
        query = query.eq("id_empresa", filtroEmpresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Relatorio[];
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
      EM_EDICAO: { variant: "secondary", label: "Em Edição" },
      PRONTO: { variant: "default", label: "Pronto" },
      VALIDADO: { variant: "outline", label: "Validado" },
    };
    const config = variants[status] || variants.EM_EDICAO;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Relatórios Semanais</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie e visualize os relatórios de desempenho semanais
            </p>
          </div>
          <Button onClick={() => navigate("/relatorios/novo")}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Relatório
          </Button>
        </div>

        <div className="flex gap-4">
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Empresas</SelectItem>
              {empresas?.map((empresa) => (
                <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                  {empresa.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="EM_EDICAO">Em Edição</SelectItem>
              <SelectItem value="PRONTO">Pronto</SelectItem>
              <SelectItem value="VALIDADO">Validado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Exportar Leads Investidores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Exportar Leads Investidores
            </CardTitle>
            <CardDescription>
              Selecione uma oferta Tokeniza para exportar a lista de investidores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Select value={ofertaSelecionada} onValueChange={setOfertaSelecionada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma oferta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ofertasDisponiveis.map((oferta) => (
                      <SelectItem key={oferta.project_id} value={oferta.project_id}>
                        {oferta.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleExportLeads} 
                disabled={!ofertaSelecionada || isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exportando..." : "Exportar CSV"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {relatorios?.map((relatorio) => (
            <Card 
              key={relatorio.id_relatorio} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/relatorios/${relatorio.id_relatorio}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <FileText className="h-6 w-6" />
                      Semana {relatorio.semana.numero_semana}/{relatorio.semana.ano}
                      {getStatusBadge(relatorio.status)}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(relatorio.semana.data_inicio), "dd/MM", { locale: ptBR })} - {format(new Date(relatorio.semana.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="font-medium">{relatorio.empresa.nome}</span>
                    </div>
                  </div>
                  {relatorio.data_fechamento && (
                    <div className="text-right text-sm text-muted-foreground">
                      Fechado em<br />
                      {format(new Date(relatorio.data_fechamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {relatorio.texto_comparacao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {relatorio.texto_comparacao}
                    </p>
                  )}
                  {!relatorio.texto_comparacao && relatorio.status === "EM_EDICAO" && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Relatório incompleto - Continue a edição</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {relatorios?.length === 0 && (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold">Nenhum relatório encontrado</h3>
                <p className="text-muted-foreground">
                  {filtroStatus === "todos" && filtroEmpresa === "todas"
                    ? "Crie seu primeiro relatório semanal."
                    : "Ajuste os filtros para ver outros relatórios."}
                </p>
              </div>
              <Button onClick={() => navigate("/relatorios/novo")}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Relatório
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
