# 🚀 [Sprint 1] Integração SGT → CRM via Webhook

## 📋 Descrição

Implementa integração automática entre SGT e CRM. Quando um lead é capturado/importado no SGT, um webhook é disparado automaticamente para o CRM, que classifica o lead e inicia cadências de aquecimento.

**Epic:** Integração SGT-CRM-ChatBlue  
**Sprint:** 1 de 4  
**Tempo estimado:** 2 dias  

---

## 🎯 Objetivo

Leads capturados no SGT são automaticamente enviados para o CRM para qualificação e aquecimento, reduzindo tempo de resposta de 24-48h para 5-15 minutos.

---

## 🔄 Fluxo Implementado

```
SGT (Captura Lead)  →  Webhook  →  CRM (Classifica + Cadência)
```

1. Lead é importado/capturado no SGT
2. SGT salva no banco local
3. SGT dispara webhook para CRM
4. CRM classifica lead (Temperatura, ICP, Persona)
5. CRM inicia cadência automatizada
6. CRM retorna confirmação

---

## 📦 Mudanças

### ✅ Arquivos Novos

- `src/lib/webhookService.ts` - Serviço de webhook para CRM

### 🔧 Arquivos Modificados

- `src/components/leads/ImportarLeadsModal.tsx` - Integração com webhookService
- `.env.example` - Variáveis de ambiente do webhook

### 📝 Documentação

- `SPRINT1-INTEGRACAO-CRM.md` - Documentação completa da implementação

---

## 🧪 Como Testar

### 1. Configurar ambiente

```bash
# Copiar .env.example para .env
cp .env.example .env

# Editar .env e configurar:
VITE_CRM_WEBHOOK_URL=https://crm.blueconsult.com.br/functions/v1/sgt-webhook
VITE_CRM_WEBHOOK_TOKEN=seu-token-aqui
```

### 2. Testar importação

1. `npm run dev`
2. Acessar "Leads" > "Importar Leads"
3. Upload CSV com 1-5 leads de teste
4. Abrir console (F12)
5. Verificar logs: "📤 Disparando webhooks..."
6. Verificar CRM: leads aparecem classificados

### 3. Testar conexão

```javascript
// No console do navegador
import { testarConexaoCRM } from './src/lib/webhookService';
await testarConexaoCRM(); // deve retornar true
```

---

## ✅ Checklist de Review

- [ ] Código segue padrões do projeto
- [ ] Variáveis de ambiente documentadas
- [ ] Erros de webhook não travam importação
- [ ] Logs informativos no console
- [ ] Documentação clara e completa
- [ ] Testado com 1 lead
- [ ] Testado com 50+ leads
- [ ] Testado erro de conexão (webhook falha gracefully)

---

## 📊 Métricas Esperadas

**Antes:**
- Tempo de resposta: 24-48h
- Leads perdidos: 30-40%

**Depois:**
- Tempo de resposta: 5-15min
- Leads perdidos: <10%
- Taxa de qualificação: 100% (automática)

---

## 🔍 Screenshots

### Console logs (webhook enviado com sucesso)
```
📤 Disparando webhooks para 10 leads novos...
✅ Webhook CRM enviado com sucesso: { 
  lead_id: "abc-123", 
  classificacao: { temperatura: "QUENTE", score: 85 },
  cadencia_iniciada: { cadence_id: "xyz-789" }
}
```

### CRM - Lead classificado automaticamente
_(Adicionar screenshot do CRM mostrando lead com temperatura, ICP, score)_

---

## 🚀 Próximos Passos (Sprint 2)

Após merge desta PR:

- [ ] Sprint 2: CRM → ChatBlue (mensagens WhatsApp reais)
- [ ] Sprint 3: ChatBlue → CRM (contexto do lead na tela)
- [ ] Sprint 4: Dashboard consolidado (ROI por campanha)

---

## 🐛 Troubleshooting

### Webhook não dispara
- Verificar `.env` (variáveis configuradas?)
- Verificar console (erros de CORS?)
- Testar `testarConexaoCRM()`

### 401 Unauthorized
- Verificar `VITE_CRM_WEBHOOK_TOKEN`
- Confirmar token com time do CRM

### Lead não aparece no CRM
- Verificar resposta do webhook (console)
- Verificar mapeamento de empresa (BLUE/TOKENIZA)
- Contatar time do CRM (verificar logs do lado deles)

---

## 📞 Contatos

- **SGT:** [Time SGT]
- **CRM:** Arthur, Chagas, Tayara
- **Dúvidas:** @jarvis no Telegram

---

**Documentação completa:** Ver `SPRINT1-INTEGRACAO-CRM.md`
