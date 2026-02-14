# Diff para ImportarLeadsModal.tsx

## Linha 1 (Adicionar após imports existentes)

```typescript
import { dispararWebhooksCRMLote } from "@/lib/webhookService";
```

## Linhas 211-221 (Substituir bloco existente)

### ❌ CÓDIGO ANTIGO (REMOVER):

```typescript
        const { data: insertedLeads, error: leadsError } = await supabase
          .from("lead")
          .insert(leadsToInsert)
          .select("id_lead");

        if (leadsError) throw leadsError;
        if (insertedLeads) allLeadIds.push(...insertedLeads.map(l => l.id_lead));
```

### ✅ CÓDIGO NOVO (ADICIONAR):

```typescript
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

## Observações

- **Linha específica:** Localizar comentário `// 2. Insert new leads` (aprox. linha 211)
- **Mudança principal:** 
  1. `.select()` agora retorna campos completos do lead (não só id_lead)
  2. Adicionado bloco try/catch para disparar webhooks
  3. Erro em webhook NÃO falha a importação

---

**Para aplicar:**
1. Abrir `src/components/leads/ImportarLeadsModal.tsx`
2. Adicionar import no topo
3. Localizar linha 211 (comentário "// 2. Insert new leads")
4. Substituir bloco conforme diff acima
5. Salvar
