import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

// Gerar últimos 12 meses para seleção
const gerarOpcoesMeses = () => {
  const opcoes = [];
  const hoje = new Date();
  
  for (let i = 0; i < 12; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    opcoes.push({
      mes: data.getMonth() + 1,
      ano: data.getFullYear(),
      label: `${MESES[data.getMonth()].label} ${data.getFullYear()}`,
    });
  }
  
  return opcoes;
};

export default function RelatorioNovo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useEmpresa();
  const [empresaRelatorio, setEmpresaRelatorio] = useState("");
  const [mesSelecionado, setMesSelecionado] = useState("");

  const opcoesMeses = gerarOpcoesMeses();

  // Usar empresa do contexto se for única
  const empresaParaRelatorio = empresasPermitidas.length === 1 
    ? empresasPermitidas[0].id_empresa 
    : empresaRelatorio;

  const criarRelatorioMutation = useMutation({
    mutationFn: async () => {
      if (!empresaParaRelatorio || !mesSelecionado) {
        throw new Error("Selecione empresa e mês");
      }

      const [mes, ano] = mesSelecionado.split("-").map(Number);

      // Verificar se já existe relatório para esta combinação
      const { data: existente } = await supabase
        .from("relatorio_semanal")
        .select("id_relatorio")
        .eq("id_empresa", empresaParaRelatorio)
        .eq("mes", mes)
        .eq("ano", ano)
        .single();

      if (existente) {
        throw new Error("Já existe um relatório para esta empresa e mês");
      }

      const { data, error } = await supabase
        .from("relatorio_semanal")
        .insert({
          id_empresa: empresaParaRelatorio,
          mes,
          ano,
          status: "EM_EDICAO",
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Relatório criado",
        description: "O relatório foi criado com sucesso.",
      });
      navigate(`/relatorios/${data.id_relatorio}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar relatório",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Loading state
  if (loadingEmpresas) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Sem acesso
  if (!hasAccess) {
    return <SemAcessoEmpresas />;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/relatorios")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Criar Novo Relatório Mensal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {empresasPermitidas.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Empresa</label>
                <Select value={empresaRelatorio} onValueChange={setEmpresaRelatorio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresasPermitidas.map((empresa) => (
                      <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                        {empresa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {empresasPermitidas.length === 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Empresa</label>
                <p className="text-sm text-muted-foreground">{empresasPermitidas[0].nome}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesMeses.map((opcao) => (
                    <SelectItem key={`${opcao.mes}-${opcao.ano}`} value={`${opcao.mes}-${opcao.ano}`}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={() => criarRelatorioMutation.mutate()}
              disabled={!empresaParaRelatorio || !mesSelecionado || criarRelatorioMutation.isPending}
            >
              {criarRelatorioMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Relatório
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
