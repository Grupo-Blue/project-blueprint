import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, DollarSign, CheckCircle2, Calendar, ExternalLink, Search, Clock, Building2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const Leads = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead")
        .select(`
          *,
          empresa:id_empresa (
            nome
          ),
          lead_evento (
            etapa,
            data_evento,
            observacao
          )
        `)
        .order("data_criacao", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data;
    },
  });

  // Filtrar leads
  const filteredLeads = leads?.filter((lead) => {
    const matchesSearch = 
      !searchTerm ||
      lead.nome_lead?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.organizacao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead as any).empresa?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "mql" && lead.is_mql) ||
      (statusFilter === "reuniao" && lead.tem_reuniao) ||
      (statusFilter === "venda" && lead.venda_realizada) ||
      (statusFilter === "novo" && !lead.is_mql);

    return matchesSearch && matchesStatus;
  });

  // Calcular estatísticas
  const stats = {
    total: leads?.length || 0,
    novos: leads?.filter(l => !l.is_mql).length || 0,
    mqls: leads?.filter(l => l.is_mql).length || 0,
    reunioes: leads?.filter(l => l.tem_reuniao).length || 0,
    vendas: leads?.filter(l => l.venda_realizada).length || 0,
    valorTotal: leads?.reduce((sum, l) => sum + (l.valor_venda || 0), 0) || 0,
    taxaConversaoMQL: leads?.length ? ((leads.filter(l => l.is_mql).length / leads.length) * 100).toFixed(1) : "0",
    taxaConversaoVenda: leads?.filter(l => l.is_mql).length ? 
      ((leads.filter(l => l.venda_realizada).length / leads.filter(l => l.is_mql).length) * 100).toFixed(1) : "0",
  };

  // Calcular tempo médio no funil
  const tempoMedioFunil = leads?.filter(l => l.venda_realizada && l.data_venda).reduce((acc, l) => {
    const dias = differenceInDays(new Date(l.data_venda!), new Date(l.data_criacao));
    return acc + dias;
  }, 0) || 0;
  const tempoMedio = leads?.filter(l => l.venda_realizada).length 
    ? Math.round(tempoMedioFunil / leads.filter(l => l.venda_realizada).length)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Leads</h1>
        <p className="text-muted-foreground">
          Gerencie todos os leads sincronizados do Pipedrive
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.novos} novos • {stats.mqls} MQLs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taxaConversaoVenda}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              MQL → Venda • {stats.taxaConversaoMQL}% Lead → MQL
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Fechadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vendas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.reunioes} com reunião agendada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
              }).format(stats.valorTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tempo médio: {tempoMedio} dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, organização ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Leads</SelectItem>
              <SelectItem value="novo">Novos</SelectItem>
              <SelectItem value="mql">MQLs</SelectItem>
              <SelectItem value="reuniao">Com Reunião</SelectItem>
              <SelectItem value="venda">Vendas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Leads ({filteredLeads?.length || 0})</CardTitle>
          <CardDescription>
            Leads sincronizados do Pipedrive com informações detalhadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead / Organização</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads?.map((lead) => {
                  const diasNoFunil = differenceInDays(new Date(), new Date(lead.data_criacao));
                  
                  return (
                    <TableRow key={lead.id_lead}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{lead.nome_lead || "Lead sem nome"}</span>
                          {lead.organizacao && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {lead.organizacao}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {(lead as any).empresa?.nome || "N/A"}
                      </TableCell>
                      <TableCell>
                        {lead.stage_atual ? (
                          <Badge variant="outline">{lead.stage_atual}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {!lead.is_mql && (
                            <Badge variant="secondary">Novo</Badge>
                          )}
                          {lead.is_mql && (
                            <Badge variant="default">MQL</Badge>
                          )}
                          {lead.tem_reuniao && (
                            <Badge variant="outline">Reunião</Badge>
                          )}
                          {lead.venda_realizada && (
                            <Badge className="bg-green-600">Venda</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(lead.data_criacao), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {diasNoFunil} {diasNoFunil === 1 ? "dia" : "dias"} no funil
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {lead.valor_venda ? (
                          <span className="font-semibold">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(lead.valor_venda)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {lead.url_pipedrive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={lead.url_pipedrive}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              Abrir no Pipedrive
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filteredLeads || filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchTerm || statusFilter !== "all" 
                        ? "Nenhum lead encontrado com os filtros aplicados"
                        : "Nenhum lead encontrado"
                      }
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Leads;