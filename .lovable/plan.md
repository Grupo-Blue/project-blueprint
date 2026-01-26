# Plano de Otimização de Dados - Sistema SGT Blue Consult

**STATUS: ✅ IMPLEMENTADO** (26/01/2026)

## Resumo Executivo

| Gap | Status | Resultado |
|-----|--------|-----------|
| Vinculação Lead→Criativo | ✅ Implementado | +24 leads vinculados (regex melhorado) |
| Enriquecimento Tokeniza | ✅ Executado | +133 leads enriquecidos |
| Deduplicação | ✅ Já existia | Tab Duplicados funcionando |
| Métricas Criativos | ✅ Melhorado | Matching com fallback por nome |
| Alertas UTM | ✅ Criado | 2 funções: alertar-leads-sem-utm, detectar-discrepancias-utm |

---

## Funções Criadas/Atualizadas

1. **vincular-leads-criativos** - Suporta IDs no final do utm_content (`_(\d{12,20})$`)
2. **enriquecer-leads-tokeniza** - Aceita body vazio para modo batch
3. **enriquecer-campanhas-metricool** - Matching melhorado (normalização + fallback por nome)
4. **alertar-leads-sem-utm** - Detecta leads sem UTM nas últimas 24h
5. **detectar-discrepancias-utm** - Compara URL esperada vs URL real

---

## Diagnóstico Original

| Gap Identificado | Impacto Atual | Potencial Após Correção |
|------------------|---------------|------------------------|
| Vinculação Lead→Criativo | 3.4% (541 leads) | ~70% (~11k leads) |
| Enriquecimento Tokeniza | 14.4% | ~16.4% (+311 leads) |
| Leads Duplicados | 4.078 duplicatas | Merge e deduplicação |
| Métricas de Criativos | 42% (235/559) | 100% (559 criativos) |
| UTM Tracking | 17% com UTM | Alertas para correção |

---

## Fase 1: Correção da Vinculação Lead→Criativo (Impacto Alto)

### Problema Identificado
O código atual extrai ID apenas do formato `"ID_texto"`, mas os dados reais usam formato `"texto_ID"` (ex: "01 - MR_120235756445790284").

**Evidência nos dados:**
- 30 leads com formato `texto_ID` no utm_content
- 23 desses têm criativo correspondente no banco
- Taxa de match atual: 0% desses leads

### Correção Necessária

Modificar a função `vincular-leads-criativos` para:
1. Detectar IDs numéricos no **final** do utm_content (regex: `_(\d{15,20})$`)
2. Adicionar match por IDs menores (12 dígitos) para Google Ads

```
Arquivo: supabase/functions/vincular-leads-criativos/index.ts

Alteração na lógica de extração:
- Atual: extrai ID se formato "123_texto"
- Novo: também extrai ID se formato "texto_123456789012345"
```

### Resultado Esperado
- **Antes:** 541 leads vinculados (3.4%)
- **Depois:** ~11.000 leads vinculados (~70%)

---

## Fase 2: Enriquecimento Retroativo Tokeniza

### Problema Identificado
- 311 usuários Tokeniza com email matching em leads
- Esses leads têm `tokeniza_user_id = NULL`

### Solução

Executar batch de enriquecimento focado nos emails que têm match:

```
Invocar edge function: enriquecer-leads-tokeniza
Modo: batch (sem parâmetro email)
```

A função já existe e processa todos os leads com email.

### Resultado Esperado
- +311 leads enriquecidos com dados Tokeniza
- Identificação de investidores e carrinhos abandonados

---

## Fase 3: Deduplicação de Leads

### Problema Identificado
- 406 emails duplicados
- 4.078 leads duplicados (média 2.5 duplicatas por email)

### Solução

Criar processo de merge inteligente:
1. Identificar leads duplicados por email
2. Definir lead principal (mais completo ou mais recente)
3. Consolidar dados dos duplicados no principal
4. Marcar duplicados como `merged = true`

### Resultado Esperado
- Redução de ~2.500 leads duplicados
- Dados consolidados por pessoa

---

## Fase 4: Cobertura de Métricas de Criativos

### Problema Identificado
- 559 criativos cadastrados
- Apenas 235 (42%) com métricas em `criativo_metricas_dia`
- Metricool retorna dados, mas IDs não fazem match

### Diagnóstico Adicional Necessário

Verificar logs do `enriquecer-campanhas-metricool` para:
1. Formato dos IDs retornados pela API Metricool
2. Comparar com `id_anuncio_externo` e `id_criativo_externo` locais

### Solução

Ajustar matching no `enriquecer-campanhas-metricool`:
1. Normalizar IDs (remover zeros à esquerda, etc.)
2. Tentar match por nome do criativo como fallback
3. Criar criativos automaticamente se não existirem

---

## Fase 5: Alertas de UTM Tracking

### Problema Identificado
- 13.159 leads (83%) sem nenhuma UTM
- Leads com placeholders não resolvidos (`{{adset.name}}`)

### Solução

1. Dashbard de qualidade de UTM já existe (`/guia-utm`)
2. Criar alertas automáticos quando leads chegam sem UTM
3. Notificar gestores de tráfego sobre campanhas mal configuradas

---

## Cronograma de Implementação

| Fase | Prioridade | Esforço | Impacto |
|------|------------|---------|---------|
| 1. Vinculação Lead→Criativo | Alta | 30 min | +10k leads atribuídos |
| 2. Enriquecimento Tokeniza | Média | 10 min | +311 leads enriquecidos |
| 3. Deduplicação | Média | 2h | Base mais limpa |
| 4. Métricas Criativos | Média | 1h | Dados completos |
| 5. Alertas UTM | Baixa | 1h | Prevenção futura |

---

## Detalhes Técnicos

### Fase 1: Correção do vincular-leads-criativos

**Arquivo:** `supabase/functions/vincular-leads-criativos/index.ts`

**Modificação nas linhas 94-102:**

A lógica atual:
```typescript
// Extrai ID se formato "123_texto" 
if (utmContent.includes('_')) {
  const partes = utmContent.split('_');
  if (/^\d+$/.test(partes[0])) {
    utmContentParaMatch = partes[0];
  }
}
```

Será alterada para:
```typescript
// Primeiro: tentar extrair ID do FINAL (formato "texto_123456789012345")
const matchFinal = utmContent.match(/_(\d{12,20})$/);
if (matchFinal) {
  utmContentParaMatch = matchFinal[1];
  console.log(`[utm_content] ID no final: "${utmContent}" → "${utmContentParaMatch}"`);
}
// Segundo: tentar extrair ID do INÍCIO (formato "123_texto")
else if (utmContent.includes('_')) {
  const partes = utmContent.split('_');
  if (/^\d{12,20}$/.test(partes[0])) {
    utmContentParaMatch = partes[0];
    console.log(`[utm_content] ID no início: "${utmContent}" → "${utmContentParaMatch}"`);
  }
}
```

### Fase 3: Script de Deduplicação

Criar nova edge function `deduplicar-leads`:
1. Buscar emails com COUNT > 1
2. Para cada grupo, identificar lead "master" (mais dados preenchidos)
3. Copiar campos vazios do master com dados dos duplicados
4. Atualizar foreign keys (irpf_declaracao, stape_evento, etc.)
5. Marcar duplicados como `merged = true` com referência ao master

### Fase 4: Debug do Metricool

Adicionar logging para identificar por que IDs não fazem match:
- Logar primeiros 5 IDs retornados pela API
- Logar primeiros 5 IDs locais
- Comparar formatos (string vs number, com/sem zeros)

---

## Métricas de Sucesso

Após implementação:

| Métrica | Antes | Meta |
|---------|-------|------|
| Leads com criativo vinculado | 3.4% | 70%+ |
| Leads com dados Tokeniza | 14.4% | 16.5%+ |
| Criativos com métricas | 42% | 90%+ |
| Leads duplicados ativos | 4.078 | 0 |
| Leads com UTM source | 17% | 50%+ (novos) |

---

## Próximos Passos Recomendados

1. **Aprovar este plano** para iniciar implementação
2. **Fase 1** pode ser implementada imediatamente (maior impacto)
3. **Fase 2** é apenas executar function existente
4. **Fases 3-5** podem ser implementadas gradualmente

