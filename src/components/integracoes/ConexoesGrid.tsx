import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, TestTube2, Plus, CheckCircle2, XCircle, AlertCircle as AlertIcon } from "lucide-react";
import { ImportarCampanhas } from "@/components/ImportarCampanhas";
import { TokenizaProjetosManager } from "@/components/TokenizaProjetosManager";
import { StapeIntegracaoManager } from "@/components/StapeIntegracaoManager";
import type { Database } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Integracao = Database["public"]["Tables"]["integracao"]["Row"];
type Empresa = Database["public"]["Tables"]["empresa"]["Row"];

type Categoria = "todas" | "trafego" | "analytics" | "crm" | "email" | "conteudo" | "tracking";

interface CategoriaInfo {
  label: string;
  tipos: string[];
}

const CATEGORIAS: Record<Exclude<Categoria, "todas">, CategoriaInfo> = {
  trafego: { label: "Tráfego Pago", tipos: ["META_ADS", "GOOGLE_ADS", "METRICOOL"] },
  analytics: { label: "Analytics & SEO", tipos: ["GA4", "GSC"] },
  crm: { label: "CRM & Atendimento", tipos: ["PIPEDRIVE", "TOKENIZA", "CHATWOOT"] },
  email: { label: "E-mail Marketing", tipos: ["MAUTIC"] },
  conteudo: { label: "Conteúdo", tipos: ["WORDPRESS", "NOTION"] },
  tracking: { label: "Tracking", tipos: [] }, // STAPE não está no enum integracao; é manager separado
};

const TIPO_LABEL: Record<string, string> = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  PIPEDRIVE: "Pipedrive",
  TOKENIZA: "Tokeniza",
  MAUTIC: "Mautic",
  NOTION: "Notion",
  METRICOOL: "Metricool",
  CHATWOOT: "Chatblue",
  GA4: "Google Analytics 4",
  GSC: "Google Search Console",
  WORDPRESS: "WordPress",
};

interface Props {
  integracoes: Integracao[];
  empresas: Empresa[];
  empresaFiltro: string;
  testingIds: Set<string>;
  onNovo: (tipo?: string) => void;
  onEditar: (integracao: Integracao) => void;
  onExcluir: (id: string) => void;
  onTestar: (integracao: Integracao) => void;
}

export function ConexoesGrid({ integracoes, empresas, empresaFiltro, testingIds, onNovo, onEditar, onExcluir, onTestar }: Props) {
  const [categoria, setCategoria] = useState<Categoria>("todas");
  const [busca, setBusca] = useState("");

  const empresasMap = useMemo(
    () => new Map(empresas.map((e) => [e.id_empresa, e])),
    [empresas],
  );

  const filtradas = useMemo(() => {
    let arr = integracoes;
    if (empresaFiltro && empresaFiltro !== "todas") {
      arr = arr.filter((i) => i.id_empresa === empresaFiltro);
    }
    if (categoria !== "todas") {
      const tipos = CATEGORIAS[categoria].tipos;
      arr = arr.filter((i) => tipos.includes(i.tipo));
    }
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter((i) => {
        const empresa = empresasMap.get(i.id_empresa)?.nome?.toLowerCase() ?? "";
        return (
          empresa.includes(q)
          || i.tipo.toLowerCase().includes(q)
          || (TIPO_LABEL[i.tipo] ?? "").toLowerCase().includes(q)
        );
      });
    }
    return arr;
  }, [integracoes, empresaFiltro, categoria, busca, empresasMap]);

  // Agrupa por tipo
  const porTipo = useMemo(() => {
    const map = new Map<string, Integracao[]>();
    for (const i of filtradas) {
      const arr = map.get(i.tipo) ?? [];
      arr.push(i);
      map.set(i.tipo, arr);
    }
    return map;
  }, [filtradas]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Input
          placeholder="Buscar por empresa, tipo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="md:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {(["todas", ...Object.keys(CATEGORIAS)] as Categoria[]).map((c) => (
            <Button
              key={c}
              variant={categoria === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoria(c)}
            >
              {c === "todas" ? "Todas" : CATEGORIAS[c as Exclude<Categoria, "todas">].label}
            </Button>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma integração nesta categoria. Use "Nova Integração" no topo para criar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from(porTipo.entries()).map(([tipo, lista]) => (
            <Card key={tipo}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{TIPO_LABEL[tipo] ?? tipo}</CardTitle>
                  <Badge variant="outline" className="text-xs">{lista.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {lista.map((integracao) => (
                  <IntegracaoCard
                    key={integracao.id_integracao}
                    integracao={integracao}
                    empresa={empresasMap.get(integracao.id_empresa)}
                    testing={testingIds.has(integracao.id_integracao)}
                    onEditar={onEditar}
                    onExcluir={onExcluir}
                    onTestar={onTestar}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(categoria === "todas" || categoria === "crm") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projetos Tokeniza</CardTitle>
            <CardDescription>Configuração específica do módulo Tokeniza por empresa.</CardDescription>
          </CardHeader>
          <CardContent>
            <TokenizaProjetosManager />
          </CardContent>
        </Card>
      )}

      {(categoria === "todas" || categoria === "tracking") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stape (Server-side Tracking)</CardTitle>
            <CardDescription>Configuração de Server Containers Stape para Meta CAPI.</CardDescription>
          </CardHeader>
          <CardContent>
            <StapeIntegracaoManager />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function IntegracaoCard({
  integracao,
  empresa,
  testing,
  onEditar,
  onExcluir,
  onTestar,
}: {
  integracao: Integracao;
  empresa: Empresa | undefined;
  testing: boolean;
  onEditar: (i: Integracao) => void;
  onExcluir: (id: string) => void;
  onTestar: (i: Integracao) => void;
}) {
  const ativo = integracao.ativo;
  const ultimoErro = integracao.ultimo_erro;
  const ultimaValidacao = integracao.ultima_validacao;

  const status = !ativo
    ? { icon: <XCircle className="h-3 w-3" />, label: "Desativada", className: "text-red-600 dark:text-red-400" }
    : ultimoErro
      ? { icon: <AlertIcon className="h-3 w-3" />, label: "Erro", className: "text-amber-600 dark:text-amber-400" }
      : { icon: <CheckCircle2 className="h-3 w-3" />, label: "OK", className: "text-green-600 dark:text-green-400" };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{empresa?.nome ?? "Empresa desconhecida"}</div>
          <div className={`text-xs flex items-center gap-1 mt-1 ${status.className}`}>
            {status.icon}
            {status.label}
            {ultimaValidacao && (
              <span className="text-muted-foreground ml-1">
                · atualizada há {formatDistanceToNow(new Date(ultimaValidacao), { locale: ptBR })}
              </span>
            )}
          </div>
          {ultimoErro && (
            <div className="text-xs text-muted-foreground mt-1 truncate" title={ultimoErro}>
              {ultimoErro}
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => onTestar(integracao)} disabled={testing} title="Testar conexão">
            <TestTube2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEditar(integracao)} title="Editar">
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onExcluir(integracao.id_integracao)} title="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {ativo && (integracao.tipo === "META_ADS" || integracao.tipo === "GOOGLE_ADS") && (
        <div className="pt-2 border-t">
          <ImportarCampanhas
            plataforma={integracao.tipo === "META_ADS" ? "META" : "GOOGLE"}
            integracaoId={integracao.id_integracao}
            empresaNome={empresa?.nome ?? ""}
          />
        </div>
      )}
    </div>
  );
}
