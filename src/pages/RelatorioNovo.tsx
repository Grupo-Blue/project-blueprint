import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserEmpresas } from "@/hooks/useUserEmpresas";
import { SemAcessoEmpresas } from "@/components/SemAcessoEmpresas";

export default function RelatorioNovo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { empresasPermitidas, isLoading: loadingEmpresas, hasAccess } = useUserEmpresas();
  const [empresaSelecionada, setEmpresaSelecionada] = useState("");
  const [semanaSelecionada, setSemanaSelecionada] = useState("");

  // Auto-selecionar empresa quando carregar (se tiver apenas 1)
  useEffect(() => {
    if (empresasPermitidas.length === 1 && !empresaSelecionada) {
      setEmpresaSelecionada(empresasPermitidas[0].id_empresa);
    }
  }, [empresasPermitidas, empresaSelecionada]);

  const { data: semanas } = useQuery({
    queryKey: ["semanas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semana")
        .select("*")
        .order("ano", { ascending: false })
        .order("numero_semana", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const criarRelatorioMutation = useMutation({
    mutationFn: async () => {
      if (!empresaSelecionada || !semanaSelecionada) {
        throw new Error("Selecione empresa e semana");
      }

      // Verificar se já existe relatório para esta combinação
      const { data: existente } = await supabase
        .from("relatorio_semanal")
        .select("id_relatorio")
        .eq("id_empresa", empresaSelecionada)
        .eq("id_semana", semanaSelecionada)
        .single();

      if (existente) {
        throw new Error("Já existe um relatório para esta empresa e semana");
      }

      const { data, error } = await supabase
        .from("relatorio_semanal")
        .insert({
          id_empresa: empresaSelecionada,
          id_semana: semanaSelecionada,
          status: "EM_EDICAO",
        })
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
            <CardTitle className="text-2xl">Criar Novo Relatório Semanal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Semana</label>
              <Select value={semanaSelecionada} onValueChange={setSemanaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a semana" />
                </SelectTrigger>
                <SelectContent>
                  {semanas?.map((semana) => (
                    <SelectItem key={semana.id_semana} value={semana.id_semana}>
                      Semana {semana.numero_semana}/{semana.ano} ({format(new Date(semana.data_inicio), "dd/MM", { locale: ptBR })} - {format(new Date(semana.data_fim), "dd/MM/yyyy", { locale: ptBR })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={() => criarRelatorioMutation.mutate()}
              disabled={!empresaSelecionada || !semanaSelecionada || criarRelatorioMutation.isPending}
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
