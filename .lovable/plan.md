
# Correção: Dados financeiros zerados no Dashboard (Blue)

## Diagnóstico

O problema tem duas causas encadeadas:

### 1. Dados da Blue sem tag METRICOOL
A empresa **Blue** (id `95e7adaf`) tem **29 registros** de fevereiro em `campanha_metricas_dia` com `fonte_conversoes = NULL` (totalizando R$ 2.162,91), mas apenas **3 registros** com `METRICOOL_GOOGLE_DAILY` (R$ 0,00). A **Tokeniza** funciona corretamente com 46 registros `METRICOOL_META_DAILY`.

### 2. Filtro exclui dados sem tag
Ao adicionar `.like("fonte_conversoes", "METRICOOL_%_DAILY")` no PacingOrcamento e Dashboard, os registros da Blue (que possuem `fonte_conversoes = NULL`) foram corretamente excluidos pelo filtro, resultando em gastos zerados.

### Por que a Blue nao tem tag METRICOOL?
A edge function `enriquecer-campanhas-metricool` faz matching de campanhas do Metricool com campanhas locais por `id_campanha_externo` ou `nome`. Se o Metricool retorna nomes diferentes dos cadastrados localmente, o matching falha e o registro nao e salvo com a tag `METRICOOL_*_DAILY`. Os dados com `NULL` provavelmente vem de outras funcoes de coleta (`coletar-metricas-meta`, `coletar-metricas-google`).

## Plano de Correção

### Passo 1 - Correcao imediata dos dados
Executar UPDATE no banco para taguear os registros existentes da Blue (e de qualquer empresa) que possuem `fonte_conversoes = NULL`, usando a plataforma da conta de anuncio como referencia:

```sql
UPDATE campanha_metricas_dia cmd
SET fonte_conversoes = 'METRICOOL_' || ca.plataforma || '_DAILY'
FROM campanha c
JOIN conta_anuncio ca ON ca.id_conta = c.id_conta
WHERE cmd.id_campanha = c.id_campanha
AND cmd.data >= '2026-02-01'
AND cmd.fonte_conversoes IS NULL
```

### Passo 2 - Melhorar matching na edge function
Atualizar `enriquecer-campanhas-metricool` para usar matching mais flexivel (case-insensitive, trim, e partial match) entre nomes de campanhas do Metricool e campanhas locais. Adicionar logs quando campanhas do Metricool nao encontram correspondencia local para facilitar debug futuro.

### Passo 3 - Garantir que TODAS as coletas tagueem os registros
Modificar as funcoes `coletar-metricas-meta` e `coletar-metricas-google` para tambem salvar com `fonte_conversoes` preenchido (ex: `META_API_DAILY`, `GOOGLE_API_DAILY`). Assim, nenhum registro fica com NULL.

### Passo 4 - Aplicar filtro consistente em TODOS os componentes
Atualizar todos os componentes que consultam `campanha_metricas_dia` para usar o filtro `fonte_conversoes IS NOT NULL` (em vez de filtrar apenas METRICOOL), garantindo que qualquer fonte tagueada seja incluida:

Componentes a atualizar:
- `src/pages/Dashboard.tsx` (TrafficFlowChart) - ja tem filtro METRICOOL
- `src/components/dashboard/PacingOrcamento.tsx` - ja tem filtro METRICOOL
- `src/components/dashboard/ROIProfitability.tsx`
- `src/components/dashboard/AlertasAnomalias.tsx`
- `src/components/dashboard/MetricasAwareness.tsx`
- `src/pages/DashboardTrafego.tsx`
- `src/pages/RelatorioEditor.tsx`
- `src/pages/RelatorioCreativos.tsx`

### Detalhes Tecnicos

- A tabela `campanha_metricas_dia` tem constraint unica em `(id_campanha, data)`, entao so existe 1 registro por campanha/dia
- O UPDATE do Passo 1 nao cria duplicatas, apenas preenche o campo `fonte_conversoes` nos registros existentes
- O filtro `.not("fonte_conversoes", "is", null)` e mais robusto que `.like("fonte_conversoes", "METRICOOL_%_DAILY")` porque aceita qualquer fonte tagueada
- No Passo 3, as funcoes de coleta passam a funcionar como backup: se o Metricool ja gravou com METRICOOL_*_DAILY, o upsert sobrescreve com a nova tag, sem duplicar
