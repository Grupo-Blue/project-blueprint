

# Chat IA Flutuante com Historico e Perguntas Sugeridas

## Visao Geral

Botao flutuante no canto inferior direito que abre um chat com IA (google/gemini-3-pro-preview) usando sua propria chave API do Google. O chat persiste conversas no banco de dados, permitindo alternar entre chats antigos e criar novos. Botoes de perguntas sugeridas aparecem no inicio de cada conversa para facilitar o uso.

---

## Chave de API

Voce precisara fornecer sua chave da API do Google Gemini. Ela sera armazenada de forma segura como um secret do backend (acessivel apenas pela edge function, nunca exposta no frontend). A edge function chamara a API do Google Gemini diretamente (nao pelo gateway Lovable AI).

---

## Estrutura do Chat

### Painel Flutuante
- Botao circular fixo no canto inferior direito (icone Sparkles/MessageCircle)
- Ao clicar, abre painel de ~400x550px (desktop) ou tela cheia (mobile)
- Cabecalho com: titulo do chat, botao "Novo Chat", botao para ver lista de chats

### Lista de Chats (sidebar/drawer)
- Lista de conversas anteriores com titulo e data
- Titulo gerado automaticamente a partir da primeira mensagem do usuario
- Ao clicar, carrega as mensagens daquele chat
- Opcao de excluir chat

### Area de Conversa
- Mensagens renderizadas com Markdown (react-markdown)
- Streaming token por token
- Indicador "pensando..." enquanto a IA consulta dados

### Perguntas Sugeridas
- Aparecem como botoes/chips no inicio de cada novo chat
- Mudam conforme a empresa selecionada
- Exemplos:
  - "Como estao as campanhas ativas esse mes?"
  - "Quais leads da {empresa} converteram em venda?"
  - "Me sugira uma nova campanha de Google Ads"
  - "Qual criativo esta com melhor CPL?"
  - "Analise o funil de conversao do ultimo mes"

---

## Persistencia no Banco

### Duas novas tabelas:

**`chat_conversa`**
- `id` (UUID, PK)
- `user_id` (UUID, FK auth.users)
- `titulo` (TEXT) -- gerado pela primeira mensagem
- `id_empresa` (UUID, nullable) -- empresa no contexto quando criou
- `created_at`, `updated_at`

**`chat_mensagem`**
- `id` (UUID, PK)
- `id_conversa` (UUID, FK chat_conversa)
- `role` (TEXT: 'user' | 'assistant')
- `content` (TEXT)
- `created_at`

RLS: Cada usuario so ve seus proprios chats (`user_id = auth.uid()`).

---

## Edge Function: `chat-ia-assistente`

### Fluxo
1. Recebe: mensagens do chat + id_empresa + id_conversa
2. Busca dados relevantes do banco usando Supabase client (service role)
3. Chama a API do Google Gemini diretamente com a chave `GEMINI_API_KEY`
4. Usa **tool calling** para que a IA decida quais dados consultar
5. Retorna resposta em streaming (SSE)

### Ferramentas disponiveis para a IA (tool calling)
- `buscar_campanhas` -- campanhas ativas com metricas agregadas
- `buscar_leads` -- leads com filtros (periodo, venda, canal, empresa)
- `buscar_criativos` -- criativos com performance e ranking
- `buscar_metricas_empresa` -- metricas consolidadas (leads, vendas, CPL, ROAS)
- `buscar_demandas` -- demandas/tarefas de trafego existentes
- `resumo_geral` -- visao consolidada rapida

### System Prompt
A IA sera instruida a:
- Responder em portugues brasileiro
- Ser proativa, sugerindo acoes concretas ("Posso criar essa demanda no sistema?")
- Usar dados reais para fundamentar respostas
- Formatar com Markdown (tabelas, listas, negrito)

---

## Detalhes Tecnicos

### Arquivos a criar

1. **Migracao SQL** -- tabelas `chat_conversa` e `chat_mensagem` com RLS
2. **`supabase/functions/chat-ia-assistente/index.ts`** -- edge function com tool calling e streaming via API Gemini direta
3. **`src/components/ChatIAFlutuante.tsx`** -- componente completo (botao + painel + lista de chats + conversa + sugestoes)
4. **`src/components/AppLayout.tsx`** -- adicionar `<ChatIAFlutuante />` antes do fechamento do div principal

### Modificacoes

- **`supabase/config.toml`** -- registrar `[functions.chat-ia-assistente]` com `verify_jwt = false` (validacao manual no codigo)

### Chamada a API Gemini (direta, sem gateway)

A edge function chamara diretamente:
```text
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse
```
Usando a chave `GEMINI_API_KEY` armazenada nos secrets.

Nota: O modelo `gemini-3-pro-preview` sera usado conforme disponibilidade na API do Google. Se ainda nao estiver disponivel na API direta, usaremos `gemini-2.5-pro` como fallback ate a liberacao.

---

## Sequencia de Implementacao

1. Solicitar a chave `GEMINI_API_KEY` ao usuario
2. Criar migracao SQL (tabelas + RLS)
3. Criar edge function `chat-ia-assistente` com tool calling e streaming
4. Registrar no config.toml
5. Criar componente `ChatIAFlutuante` com lista de chats, sugestoes e streaming
6. Integrar no AppLayout

