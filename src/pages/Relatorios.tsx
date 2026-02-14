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

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface Relatorio {
  id_relatorio: string;
  id_empresa: string;
  mes: number | null;
  ano: number | null;
  status: string;
  texto_comparacao: string | null;
  aprendizado_resumo: string | null;
  data_fechamento: string | null;
  created_at: string;
  empresa: {
    nome: string;
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
      const { data, error } = await supabase.from("empresa").select("id_empresa, nome");
      if (error) throw error;
      return data;
    }
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
    }
  });

  const handleExportLeads = async () => {
    if (!ofertaSelecionada) {
      toast.error("Selecione uma oferta primeiro");
      return;
    }
    setIsExporting(true);
    try {
      const { data: investimentos, error: invError } = await supabase
        .from("tokeniza_investimento")
        .select("user_id_tokeniza, amount, data_criacao")
        .eq("project_id", ofertaSelecionada);

      if (invError) throw invError;
      if (!investimentos || investimentos.length === 0) {
        toast.warning("Nenhum investimento encontrado para esta oferta");
        return;
      }

      const investimentosPorUsuario = new Map<string, {
        total: number;
        qtd: number;
        primeiro: Date;
        ultimo: Date;
      }>();

      investimentos.forEach(inv => {
        const userId = inv.user_id_tokeniza;
        if (!userId) return;
        const dataInv = inv.data_criacao ? new Date(inv.data_criacao) : new Date();
        const valor = Number(inv.amount) || 0;
        if (investimentosPorUsuario.has(userId)) {
          const atual = investimentosPorUsuario.get(userId)!;
          atual.total += valor;
          atual.qtd += 1;
          if (dataInv < atual.primeiro) atual.primeiro = dataInv;
          if (dataInv > atual.ultimo) atual.ultimo = dataInv;
        } else {
          investimentosPorUsuario.set(userId, {
            total: valor,
            qtd: 1,
            primeiro: dataInv,
            ultimo: dataInv
          });
        }
      });

      const userIds = Array.from(investimentosPorUsuario.keys());
      const { data: usuarios, error: userError } = await supabase
        .from("tokeniza_usuario")
        .select("user_id_tokeniza, email, phone, first_name, last_name")
        .in("user_id_tokeniza", userIds);

      if (userError) throw userError;

      type ExportRow = {
        nome: string;
        email: string;
        telefone: string;
        valor_investido: number;
        qtd_investimentos: number;
        primeiro_investimento: Date;
        ultimo_investimento: Date;
      };

      const dadosExportacao: ExportRow[] = [];
      const emailsVistos = new Set<string>();

      usuarios?.forEach(usuario => {
        const userId = usuario.user_id_tokeniza;
        const inv = investimentosPorUsuario.get(userId);
        if (!inv) return;
        const email = (usuario.email || "").trim().toLowerCase();
        if (email && emailsVistos.has(email)) return;
        if (email) emailsVistos.add(email);
        dadosExportacao.push({
          nome: `${usuario.first_name || ""} ${usuario.last_name || ""}`.trim(),
          email: usuario.email || "",
          telefone: usuario.phone || "",
          valor_investido: inv.total,
          qtd_investimentos: inv.qtd,
          primeiro_investimento: inv.primeiro,
          ultimo_investimento: inv.ultimo
        });
      });

      dadosExportacao.sort((a, b) => b.valor_investido - a.valor_investido);

      if (dadosExportacao.length === 0) {
        toast.warning("Nenhum investidor encontrado para esta oferta");
        return;
      }

      const headers = ["Nome", "Email", "Telefone", "Valor Investido", "Qtd Investimentos", "Primeiro Investimento", "Último Investimento"];
      const rows = dadosExportacao.map(row => [
        row.nome,
        row.email,
        row.telefone,
        row.valor_investido.toFixed(2).replace(".", ","),
        row.qtd_investimentos.toString(),
        format(row.primeiro_investimento, "dd/MM/yyyy"),
        format(row.ultimo_investimento, "dd/MM/yyyy")
      ]);

      const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(";"))
      ].join("\n");

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

      const totalInvestido = dadosExportacao.reduce((sum, r) => sum + r.valor_investido, 0);
      toast.success(`${dadosExportacao.length} investidores exportados (Total: R$ ${totalInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar leads");
    } finally {
      setIsExporting(false);
    }
  };

  const ofertasDisponiveis = projetosTokeniza || [];

  const { data: relatorios, isLoading } = useQuery({
    queryKey: ["relatorios", filtroStatus, filtroEmpresa],
    queryFn: async () => {
      let query = supabase
        .from("relatorio_semanal")
        .select(`
          *,
          empresa:id_empresa (nome)
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
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
      EM_EDICAO: { variant: "secondary", label: "Em Edição" },
      PRONTO: { variant: "default", label: "Pronto" },
      VALIDADO: { variant: "outline", label: "Validado" }
    };
    const config = variants[status] || variants.EM_EDICAO;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getInicioFimMes = (mes: number, ano: number) => {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0);
    return { inicio, fim };
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
    <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground mt-2">Gerencie e visualize os relatórios mensais de desempenho</p>
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
              {empresas?.map(empresa => (
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
                    {ofertasDisponiveis.map(oferta => (
                      <SelectItem key={oferta.project_id} value={oferta.project_id}>
                        {oferta.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleExportLeads} disabled={!ofertaSelecionada || isExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exportando..." : "Exportar CSV"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {relatorios?.map(relatorio => {
            const mesNome = relatorio.mes ? MESES[relatorio.mes - 1] : "N/A";
            const periodo = relatorio.mes && relatorio.ano 
              ? getInicioFimMes(relatorio.mes, relatorio.ano) 
              : null;

            return (
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
                        {mesNome} {relatorio.ano}
                        {getStatusBadge(relatorio.status)}
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {periodo && (
                          <span className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(periodo.inicio, "dd/MM", { locale: ptBR })} - {format(periodo.fim, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        <span className="font-medium">{relatorio.empresa?.nome}</span>
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
            );
          })}
        </div>

        {relatorios?.length === 0 && (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-xl font-semibold">Nenhum relatório encontrado</h3>
                <p className="text-muted-foreground">
                  {filtroStatus === "todos" && filtroEmpresa === "todas" 
                    ? "Crie seu primeiro relatório mensal." 
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
  );
}
