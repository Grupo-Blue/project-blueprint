# 🚀 Sprint 1: Integração SGT → CRM

**Data:** 2026-02-13  
**Objetivo:** SGT envia leads automaticamente para o CRM via webhook  
**Status:** ✅ Implementado

---

## 📋 Resumo

Esta implementação adiciona integração automática entre o SGT e o CRM. Quando um lead é capturado/importado no SGT, um webhook é automaticamente disparado para o CRM, que classifica o lead e inicia cadências de aquecimento.

---

## 📦 Arquivos Criados/Modificados

### ✅ Arquivos Novos

1. **`src/lib/webhookService.ts`**
   - Serviço responsável por disparar webhooks para o CRM
   - Funções principais:
     - `dispararWebhookCRM()` - Envia um lead para o CRM
     - `dispararWebhooksCRMLote()` - Envia múltiplos leads em lote
     - `testarConexaoCRM()` - Testa a conexão com o CRM
   - Mapeia empresas do SGT para formato do CRM (BLUE / TOKENIZA)

### 🔧 Arquivos Modificados

1. **`src/components/leads/ImportarLeadsModal.tsx`**
   - Adicionado: Import do `webhookService`
   - Modificado: Após inserir leads novos, dispara webhooks para CRM
   - Mantém: Não quebra funcionalidade existente se webhook falhar

### 📝 Arquivos de Configuração

1. **`.env.example`**
   - Adicionadas variáveis:
     - `VITE_CRM_WEBHOOK_URL`
     - `VITE_CRM_WEBHOOK_TOKEN`

---

## 🔌 Como Funciona

```
┌─────────────────────────────────────────────────────────────────┐
│                    SGT (Sistema de Tráfego)                      │
│                                                                  │
│  1. Lead é capturado/importado                                   │
│  2. Salvo no banco de dados local                                │
│  3. webhookService.dispararWebhookCRM() é chamado               │
│     ↓                                                            │
│  4. POST para CRM webhook endpoint                               │
│                                                                  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         │ HTTP POST
                         │ Authorization: Bearer TOKEN
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CRM (Bluetoken AI)                            │
│                                                                  │
│  5. Recebe payload do webhook                                    │
│  6. Classifica lead (Temperatura, ICP, Persona)                  │
│  7. Calcula score e prioridade                                   │
│  8. Inicia cadência automatizada                                 │
│  9. Retorna confirmação para SGT                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📄 Payload do Webhook

### Request (SGT → CRM)

```json
{
  "evento_tipo": "LEAD_NOVO",
  "empresa": "BLUE",
  "lead_id": "uuid-do-lead",
  "dados": {
    "nome": "João Silva",
    "email": "joao@empresa.com",
    "telefone": "+5511999999999",
    "empresa": "Empresa XYZ",
    "origem": "MANUAL",
    "campanha": "Importação fevereiro",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "ir-cripto"
  },
  "timestamp": "2026-02-13T10:00:00Z"
}
```

### Response (CRM → SGT)

```json
{
  "success": true,
  "lead_id": "uuid-do-lead",
  "classificacao": {
    "temperatura": "QUENTE",
    "icp": "Alto Ticket IR",
    "persona": "Empresário",
    "score": 85,
    "prioridade": 1
  },
  "cadencia_iniciada": {
    "cadence_id": "cadence-uuid",
    "proxima_mensagem": "2026-02-13T10:05:00Z"
  }
}
```

---

## 🛠️ Como Aplicar as Mudanças

### Passo 1: Criar o Serviço de Webhook

```bash
# Copiar o arquivo do serviço
cp SPRINT1-FILES/webhookService.ts src/lib/webhookService.ts
```

### Passo 2: Modificar ImportarLeadsModal

Abra `src/components/leads/ImportarLeadsModal.tsx` e faça as seguintes alterações:

**a) Adicionar import no topo do arquivo:**

```typescript
import { dispararWebhooksCRMLote } from "@/lib/webhookService";
```

**b) Localizar a seção "// 2. Insert new leads" (aproximadamente linha 211)**

**c) Substituir o bloco existente:**

```typescript
// CÓDIGO ANTIGO (REMOVER):
const { data: insertedLeads, error: leadsError } = await supabase
  .from("lead")
  .insert(leadsToInsert)
  .select("id_lead");

if (leadsError) throw leadsError;
if (insertedLeads) allLeadIds.push(...insertedLeads.map(l => l.id_lead));
```

**Por este (NOVO):**

```typescript
// CÓDIGO NOVO (ADICIONAR):
const { data: insertedLeads, error: leadsError } = await supabase
  .from("lead")
  .insert(leadsToInsert)
  .select("id_lead, id_empresa, nome_lead, email, telefone, origem_tipo");

if (leadsError) throw leadsError;

if (insertedLeads) {
  allLeadIds.push(...insertedLeads.map(l => l.id_lead));
  
  // 🔥 NOVO: Disparar webhooks para CRM
  try {
    console.log(`📤 Disparando webhooks para ${insertedLeads.length} leads novos...`);
    await dispararWebhooksCRMLote(insertedLeads, 'LEAD_NOVO');
  } catch (webhookError) {
    // Não falha a importação se webhook falhar
    console.error('⚠️ Erro ao enviar webhooks, mas leads foram salvos:', webhookError);
  }
}
```

### Passo 3: Configurar Variáveis de Ambiente

**a) Adicionar ao `.env`:**

```bash
# Integração CRM
VITE_CRM_WEBHOOK_URL=https://crm.blueconsult.com.br/functions/v1/sgt-webhook
VITE_CRM_WEBHOOK_TOKEN=seu-token-aqui
```

**b) Adicionar ao `.env.example`:**

```bash
# Integração CRM (SGT → CRM Webhook)
VITE_CRM_WEBHOOK_URL=https://crm.blueconsult.com.br/functions/v1/sgt-webhook
VITE_CRM_WEBHOOK_TOKEN=seu-token-seguro-aqui
```

### Passo 4: Testar

```bash
# 1. Instalar dependências (se necessário)
npm install

# 2. Iniciar em modo desenvolvimento
npm run dev

# 3. Abrir console do navegador (F12)

# 4. Importar alguns leads de teste

# 5. Verificar logs no console:
#    - "📤 Disparando webhooks para X leads novos..."
#    - "✅ Webhook CRM enviado com sucesso"
```

---

## ✅ Checklist de Implementação

- [ ] Arquivo `src/lib/webhookService.ts` criado
- [ ] `ImportarLeadsModal.tsx` modificado (import + webhook call)
- [ ] Variáveis de ambiente configuradas (`.env`)
- [ ] `.env.example` atualizado
- [ ] Testado com lead de exemplo
- [ ] Verificado logs no console
- [ ] Confirmado que lead aparece no CRM classificado

---

## 🧪 Como Testar

### Teste 1: Conexão com CRM

```typescript
// No console do navegador (após login no SGT):
import { testarConexaoCRM } from './src/lib/webhookService';
await testarConexaoCRM();
// Deve retornar: true (conexão OK)
```

### Teste 2: Importar Lead Manual

1. Acessar "Leads" no SGT
2. Clicar em "Importar Leads"
3. Fazer upload de CSV com 1 lead de teste
4. Verificar console: deve aparecer "📤 Disparando webhooks..."
5. Verificar CRM: lead deve aparecer classificado

### Teste 3: Importação em Lote

1. Importar CSV com 50 leads
2. Verificar console: deve processar em batches de 10
3. Aguardar 1-2 minutos
4. Verificar CRM: todos os 50 leads devem estar classificados

---

## 🔍 Troubleshooting

### Problema: "CRM_WEBHOOK_URL não configurada"

**Solução:**
```bash
# Verificar se variável está no .env
cat .env | grep CRM_WEBHOOK

# Se não estiver, adicionar:
echo "VITE_CRM_WEBHOOK_URL=https://crm.blueconsult.com.br/functions/v1/sgt-webhook" >> .env
echo "VITE_CRM_WEBHOOK_TOKEN=seu-token-aqui" >> .env

# Reiniciar servidor dev
npm run dev
```

### Problema: "401 Unauthorized" no webhook

**Solução:**
- Verificar se `VITE_CRM_WEBHOOK_TOKEN` está correto
- Confirmar com time do CRM qual é o token válido
- Testar manualmente com curl:

```bash
curl -X POST https://crm.blueconsult.com.br/functions/v1/sgt-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "evento_tipo": "LEAD_NOVO",
    "empresa": "BLUE",
    "lead_id": "test",
    "dados": {"nome": "Teste"},
    "timestamp": "2026-02-13T10:00:00Z"
  }'
```

### Problema: Webhook demora muito

**Solução:**
- Webhooks são disparados em lote (10 por vez)
- Para 100 leads, levará ~1 minuto
- Isso é normal e não trava a UI (assíncrono)
- Se demorar mais de 5 min, verificar conexão com CRM

### Problema: Lead não aparece no CRM

**Solução:**
1. Verificar logs do console (webhook foi enviado?)
2. Verificar resposta do CRM (success: true?)
3. Conferir mapeamento de empresa (BLUE vs TOKENIZA)
4. Verificar se CRM está online
5. Contatar time do CRM para verificar logs do lado deles

---

## 📊 Métricas Esperadas

Após implementação, você deve ver:

### No SGT (Console do Navegador)
- `📤 Disparando webhooks para X leads novos...`
- `✅ Webhook CRM enviado com sucesso: { lead_id, classificacao, cadencia }`

### No CRM (Interface)
- Leads aparecem com classificação automática
- Temperatura: 🔥 QUENTE / 🟡 MORNO / ❄️ FRIO
- ICP identificado
- Persona identificada
- Score calculado
- Cadência iniciada automaticamente

### Tempo de Processamento
- 1 lead: < 1 segundo
- 10 leads: ~2-3 segundos
- 100 leads: ~30-60 segundos
- 1000 leads: ~5-10 minutos

---

## 🚀 Próximos Passos (Sprint 2)

Após validar Sprint 1:

1. **Sprint 2:** CRM → ChatBlue
   - CRM dispara mensagens via WhatsApp real
   - ChatBlue notifica quando lead responde
   - Cadência pausa automaticamente

2. **Sprint 3:** ChatBlue → CRM
   - Atendente vê contexto do lead na tela
   - IA usa contexto para responder melhor
   - Conversões registradas de volta no CRM

3. **Sprint 4:** Dashboard Consolidado
   - ROI por campanha (SGT → Venda)
   - Métricas unificadas
   - Alertas automáticos

---

## 📞 Contato

**Dúvidas sobre a implementação?**
- Time SGT: [contato]
- Time CRM: Arthur, Chagas, Tayara
- Jarvis (IA): Telegram

---

**Criado por:** Jarvis  
**Data:** 2026-02-13  
**Versão:** 1.0
