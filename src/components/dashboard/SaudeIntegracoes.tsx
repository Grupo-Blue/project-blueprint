import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, XCircle, Clock, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface IntegracaoSaude {
  id_integracao: string;
  tipo: string;
  ativo: boolean;
  ultimo_erro: string | null;
  ultima_validacao: string | null;
  id_empresa: string;
  nome_empresa?: string;
}

const TIPOS_RELEVANTES = ["META_ADS", "GOOGLE_ADS", "GA4", "MAUTIC", "GSC", "WORDPRESS"] as const satisfies readonly ("META_ADS" | "GOOGLE_ADS" | "GA4" | "MAUTIC" | "GSC" | "WORDPRESS")[];

export const SaudeIntegracoes = () => {
  const [items, setItems] = useState<IntegracaoSaude[]>([]);
  const [loading, setLoading] = useState(true);
  const { empresaSelecionada } = useEmpresa();
  const navigate = useNavigate();

  useEffect(() => {
    fetch();
  }, [empresaSelecionada]);

  const fetch = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("integracao")
        .select("id_integracao, tipo, ativo, ultimo_erro, ultima_validacao, id_empresa, empresa:id_empresa(nome)")
        .in("tipo", [...TIPOS_RELEVANTES]);

      if (empresaSelecionada && empresaSelecionada !== "todas") {
        q = q.eq("id_empresa", empresaSelecionada);
      }

      const { data } = await q;
      const mapeado = (data ?? []).map((d: any) => ({
        id_integracao: d.id_integracao,
        tipo: d.tipo,
        ativo: d.ativo,
        ultimo_erro: d.ultimo_erro,
        ultima_validacao: d.ultima_validacao,
        id_empresa: d.id_empresa,
        nome_empresa: d.empresa?.nome,
      }));
      setItems(mapeado);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const comProblema = items.filter((i) => !i.ativo || i.ultimo_erro);
  const stale = items.filter((i) => {
    if (!i.ultima_validacao) return true;
    const horas = (Date.now() - new Date(i.ultima_validacao).getTime()) / (1000 * 60 * 60);
    return horas > 26;
  });

  if (items.length === 0 || (comProblema.length === 0 && stale.length === 0)) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Saúde das integrações de tráfego
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Todas as {items.length} integrações estão saudáveis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={comProblema.length > 0 ? "border-red-300 dark:border-red-800" : "border-amber-300 dark:border-amber-800"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className={comProblema.length > 0 ? "h-4 w-4 text-red-600" : "h-4 w-4 text-amber-600"} />
            Saúde das integrações de tráfego
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate("/integracoes")} className="gap-1">
            <Settings className="h-3 w-3" />
            Gerenciar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {comProblema.map((i) => (
          <div key={i.id_integracao} className="flex items-start justify-between gap-2 p-2 rounded border bg-red-50 dark:bg-red-950/30">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-3 w-3 text-red-600 shrink-0" />
                <span className="text-sm font-medium">{i.tipo}</span>
                {i.nome_empresa && <Badge variant="outline" className="text-xs">{i.nome_empresa}</Badge>}
                {!i.ativo && <Badge variant="destructive" className="text-xs">Desativada</Badge>}
              </div>
              {i.ultimo_erro && (
                <p className="text-xs text-muted-foreground truncate" title={i.ultimo_erro}>
                  {i.ultimo_erro}
                </p>
              )}
            </div>
          </div>
        ))}
        {stale.filter((s) => !comProblema.includes(s)).map((i) => (
          <div key={i.id_integracao} className="flex items-start justify-between gap-2 p-2 rounded border bg-amber-50 dark:bg-amber-950/30">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                <span className="text-sm font-medium">{i.tipo}</span>
                {i.nome_empresa && <Badge variant="outline" className="text-xs">{i.nome_empresa}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {i.ultima_validacao
                  ? `Última coleta há ${formatDistanceToNow(new Date(i.ultima_validacao), { locale: ptBR })}`
                  : "Nunca foi validada"}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
