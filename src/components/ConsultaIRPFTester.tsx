import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, FileText, Send, Code, Key, ExternalLink } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function ConsultaIRPFTester() {
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("documentacao");

  const endpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultar-irpf`;

  const handleTest = async () => {
    if (!token) {
      toast.error("Informe o token de autenticação (IRPF_WEBHOOK_SECRET)");
      return;
    }

    if (!cpf && !email) {
      toast.error("Informe CPF ou email para consulta");
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const body: any = {};
      if (cpf) body.cpf = cpf;
      if (email) body.email = email;

      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      setResponse({ status: res.status, data });

      if (res.ok) {
        toast.success(`Consulta realizada! ${data.total || 0} declaração(ões) encontrada(s)`);
      } else {
        toast.error(data.error || "Erro na consulta");
      }
    } catch (error: any) {
      toast.error("Erro de conexão: " + error.message);
      setResponse({ status: 0, data: { error: error.message } });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const curlExample = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \\
  -d '{"cpf": "12345678900"}'`;

  const curlEmailExample = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \\
  -d '{"email": "cliente@exemplo.com"}'`;

  const responseExample = `{
  "declaracoes": [
    {
      "id": "uuid",
      "cpf": "12345678900",
      "nome_contribuinte": "João Silva",
      "ano_calendario": 2024,
      "exercicio": 2025,
      "email": "joao@exemplo.com",
      "dependentes": [...],
      "rendimentos": [...],
      "bens_direitos": [...],
      "dividas": [...],
      "deducoes": [...],
      "impostos_pagos": [...],
      "ganhos_capital": [...],
      "doacoes": [...],
      "evolucao_patrimonial": [...],
      "atividades_rurais": [...],
      "fundos_imobiliarios": [...],
      "alimentandos": [...],
      "demonstrativos_lei_14754": [...]
    }
  ],
  "total": 1,
  "query_duration_ms": 150
}`;

  return (
    <Card className="mt-8">
      <CardHeader className="p-4 md:p-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-base md:text-lg">API Consulta IRPF</CardTitle>
        </div>
        <CardDescription className="text-xs md:text-sm">
          Endpoint para consulta de dados IRPF por sistemas externos
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="documentacao">
              <Code className="h-4 w-4 mr-2" />
              Documentação
            </TabsTrigger>
            <TabsTrigger value="testar">
              <Send className="h-4 w-4 mr-2" />
              Testar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documentacao" className="space-y-6">
            {/* Endpoint Info */}
            <div className="space-y-2">
              <Label className="text-xs md:text-sm font-medium">Endpoint</Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Badge variant="secondary">POST</Badge>
                <code className="flex-1 bg-muted px-2 md:px-3 py-2 rounded text-xs font-mono break-all w-full">
                  {endpointUrl}
                </code>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToClipboard(endpointUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Authentication */}
            <div className="space-y-2">
              <Label className="text-xs md:text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                Autenticação
              </Label>
              <div className="bg-muted p-3 md:p-4 rounded-lg space-y-2">
                <p className="text-xs md:text-sm">Header obrigatório:</p>
                <code className="block bg-background px-2 md:px-3 py-2 rounded text-xs font-mono break-all">
                  Authorization: Bearer {"<IRPF_WEBHOOK_SECRET>"}
                </code>
                <p className="text-xs text-muted-foreground">
                  O token deve ser configurado nos Secrets do projeto.
                </p>
              </div>
            </div>

            {/* Request Body */}
            <div className="space-y-2">
              <Label className="text-xs md:text-sm font-medium">Request Body (JSON)</Label>
              <div className="bg-muted p-3 md:p-4 rounded-lg space-y-3">
                <p className="text-xs md:text-sm">Envie <strong>cpf</strong> ou <strong>email</strong>:</p>
                <div className="grid gap-2 text-xs">
                  <div className="flex flex-col sm:flex-row items-start gap-1 sm:gap-2">
                    <code className="bg-background px-2 py-1 rounded shrink-0">cpf</code>
                    <span className="text-muted-foreground">string - CPF do contribuinte</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start gap-1 sm:gap-2">
                    <code className="bg-background px-2 py-1 rounded shrink-0">email</code>
                    <span className="text-muted-foreground">string - Email do contribuinte</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Curl Examples */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Exemplos cURL
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Consulta por CPF</Label>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {curlExample}
                    </pre>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(curlExample)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Consulta por Email</Label>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {curlEmailExample}
                    </pre>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(curlEmailExample)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Response Example */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Exemplo de Resposta
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <ScrollArea className="h-[300px]">
                  <pre className="bg-muted p-4 rounded-lg text-xs font-mono whitespace-pre-wrap">
                    {responseExample}
                  </pre>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>

            {/* Data Tables */}
            <div className="space-y-2">
              <Label className="text-xs md:text-sm font-medium">Tabelas Retornadas</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2">
                {[
                  "dependentes", "rendimentos", "bens_direitos", "dividas", 
                  "deducoes", "impostos_pagos", "ganhos_capital", "doacoes",
                  "evolucao_patrimonial", "atividades_rurais", "fundos_imobiliarios",
                  "alimentandos", "demonstrativos"
                ].map((table) => (
                  <Badge key={table} variant="outline" className="justify-center py-1 text-xs truncate">
                    {table}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="testar" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Token de Autenticação *</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="IRPF_WEBHOOK_SECRET"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    placeholder="12345678900"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="cliente@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleTest} disabled={loading} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Consultando..." : "Testar Consulta"}
              </Button>

              {response && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Resposta</Label>
                    <Badge variant={response.status === 200 ? "default" : "destructive"}>
                      Status: {response.status}
                    </Badge>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <Textarea
                      readOnly
                      value={JSON.stringify(response.data, null, 2)}
                      className="font-mono text-xs h-full min-h-[280px]"
                    />
                  </ScrollArea>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
