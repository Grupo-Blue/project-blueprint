import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  X,
  Send,
  Plus,
  MessageCircle,
  ChevronLeft,
  Trash2,
  Loader2,
} from "lucide-react";

interface Conversa {
  id: string;
  titulo: string;
  id_empresa: string | null;
  created_at: string;
}

interface Mensagem {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const SUGESTOES = [
  "Como estão as campanhas ativas esse mês?",
  "Qual campanha tem o menor CPL?",
  "Me dê um resumo geral da empresa",
  "Quais leads converteram em venda?",
  "Sugira uma nova campanha de Google Ads",
  "Analise o funil de conversão do último mês",
];

export function ChatIAFlutuante() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaAtual, setConversaAtual] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConversas, setLoadingConversas] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { empresaSelecionada, nomeEmpresaSelecionada } = useEmpresa();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens, scrollToBottom]);

  // Load conversations list
  const carregarConversas = useCallback(async () => {
    setLoadingConversas(true);
    const { data, error } = await supabase
      .from("chat_conversa")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setConversas(data as Conversa[]);
    }
    setLoadingConversas(false);
  }, []);

  useEffect(() => {
    if (open) carregarConversas();
  }, [open, carregarConversas]);

  // Load messages for a conversation
  const carregarMensagens = useCallback(async (idConversa: string) => {
    const { data, error } = await supabase
      .from("chat_mensagem")
      .select("*")
      .eq("id_conversa", idConversa)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMensagens(data as Mensagem[]);
    }
  }, []);

  const abrirConversa = useCallback(
    async (idConversa: string) => {
      setConversaAtual(idConversa);
      setShowHistory(false);
      await carregarMensagens(idConversa);
    },
    [carregarMensagens]
  );

  const novaConversa = useCallback(() => {
    setConversaAtual(null);
    setMensagens([]);
    setShowHistory(false);
  }, []);

  const excluirConversa = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await supabase.from("chat_mensagem").delete().eq("id_conversa", id);
      await supabase.from("chat_conversa").delete().eq("id", id);
      setConversas((prev) => prev.filter((c) => c.id !== id));
      if (conversaAtual === id) novaConversa();
    },
    [conversaAtual, novaConversa]
  );

  const enviarMensagem = useCallback(
    async (texto?: string) => {
      const msg = texto || input.trim();
      if (!msg || loading) return;

      setInput("");
      setLoading(true);

      let idConversa = conversaAtual;

      // Create conversation if needed
      if (!idConversa) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({ title: "Erro", description: "Você precisa estar logado", variant: "destructive" });
          setLoading(false);
          return;
        }

        const titulo = msg.slice(0, 60) + (msg.length > 60 ? "..." : "");
        const { data: novaConv, error } = await supabase
          .from("chat_conversa")
          .insert({
            user_id: user.id,
            titulo,
            id_empresa: empresaSelecionada !== "todas" ? empresaSelecionada : null,
          })
          .select()
          .single();

        if (error || !novaConv) {
          toast({ title: "Erro", description: "Não foi possível criar conversa", variant: "destructive" });
          setLoading(false);
          return;
        }

        idConversa = novaConv.id;
        setConversaAtual(idConversa);
        setConversas((prev) => [novaConv as Conversa, ...prev]);
      }

      // Save user message
      const { data: msgSalva } = await supabase
        .from("chat_mensagem")
        .insert({ id_conversa: idConversa, role: "user", content: msg })
        .select()
        .single();

      if (msgSalva) {
        setMensagens((prev) => [...prev, msgSalva as Mensagem]);
      }

      // Call edge function
      try {
        const allMessages = [
          ...mensagens.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: msg },
        ];

        const { data: session } = await supabase.auth.getSession();
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ia-assistente`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.session?.access_token}`,
            },
            body: JSON.stringify({
              messages: allMessages,
              id_empresa: empresaSelecionada !== "todas" ? empresaSelecionada : null,
              id_conversa: idConversa,
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Erro ao consultar IA");
        }

        const data = await response.json();

        if (data.response) {
          // The edge function already saved the message, just add to UI
          const { data: assistantMsg } = await supabase
            .from("chat_mensagem")
            .select("*")
            .eq("id_conversa", idConversa)
            .eq("role", "assistant")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (assistantMsg) {
            setMensagens((prev) => [...prev, assistantMsg as Mensagem]);
          }
        }

        // Update conversation title timestamp
        await supabase
          .from("chat_conversa")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", idConversa);
      } catch (err: any) {
        console.error("Chat IA error:", err);
        toast({
          title: "Erro na IA",
          description: err.message || "Não foi possível obter resposta",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [input, loading, conversaAtual, mensagens, empresaSelecionada, toast]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const panelClasses = isMobile
    ? "fixed inset-0 z-[60] flex flex-col bg-background"
    : "fixed bottom-20 right-4 z-[60] w-[420px] h-[560px] rounded-xl border shadow-2xl flex flex-col bg-background overflow-hidden";

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[60] h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className={panelClasses}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">
            {showHistory ? "Histórico" : conversaAtual ? "Chat IA" : "Novo Chat"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(!showHistory)}>
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={novaConversa}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showHistory ? (
        /* History list */
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConversas ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversas.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Nenhuma conversa ainda</p>
            ) : (
              conversas.map((c) => (
                <div
                  key={c.id}
                  onClick={() => abrirConversa(c.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer hover:bg-accent transition-colors group ${
                    conversaAtual === c.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => excluirConversa(c.id, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      ) : (
        <>
          {/* Messages area */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {mensagens.length === 0 && !loading && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <Sparkles className="h-10 w-10 mx-auto text-primary/60 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Olá! Sou o assistente IA do SGT.
                      {nomeEmpresaSelecionada && (
                        <> Contexto: <strong>{nomeEmpresaSelecionada}</strong></>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pergunte sobre campanhas, leads, métricas ou peça sugestões.
                    </p>
                  </div>

                  {/* Suggested questions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sugestões</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGESTOES.map((s) => (
                        <button
                          key={s}
                          onClick={() => enviarMensagem(s)}
                          className="text-xs px-3 py-1.5 rounded-full border bg-card hover:bg-accent transition-colors text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mensagens.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Analisando dados...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t p-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Faça uma pergunta..."
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[120px]"
                rows={1}
                disabled={loading}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => enviarMensagem()}
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
