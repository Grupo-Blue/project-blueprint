
# Plano: Relatorio Semanal Completo com Top Criativos Editaveis

## Status: ✅ IMPLEMENTADO

## Objetivo
Transformar o relatorio semanal em um documento completo e baseado em dados, com secao dedicada aos top criativos incluindo imagens editaveis.

---

## Componentes Criados

1. **`src/components/relatorios/TopCriativosEditor.tsx`** ✅
   - Lista editável dos top 10 criativos por leads
   - Preview de imagem com fallback para ícone
   - Modal de edição com upload de imagem (base64)
   - Campo para descrição customizada
   - Toggle para incluir/excluir do relatório
   - Métricas: Leads, CPL, CTR, Verba, Impressões, Cliques

2. **`src/components/relatorios/FunilConversao.tsx`** ✅
   - Visualização em barras horizontais
   - Leads → MQLs → Levantadas → Reuniões → Vendas
   - Taxas de conversão entre etapas
   - Taxa geral Lead → Venda

3. **`src/components/relatorios/ComparativoSemanal.tsx`** ✅
   - Cards com métricas e variação vs semana anterior
   - Indicadores visuais de tendência (setas verde/vermelha)
   - Suporte a inverter cores (para CPL, CAC)

4. **`src/components/relatorios/AlertasRelatorio.tsx`** ✅
   - Lista de problemas detectados automaticamente
   - Severidade (warning/error)
   - Tipos: CPL alto, sem leads, sem imagem

5. **`src/components/relatorios/MetricasTopoFunil.tsx`** ✅
   - Impressões, Cliques, CTR, CPC
   - Grid responsivo

6. **`src/components/relatorios/AnaliseFinanceira.tsx`** ✅
   - Verba, Receita, ROAS, ROI
   - CAC, Ticket Médio
   - Lucro Bruto Estimado destacado

---

## Seções do Relatório (RelatorioEditor.tsx)

1. ✅ Resumo Executivo (comparativo semanal)
2. ✅ Métricas de Topo de Funil
3. ✅ CPL por Campanha
4. ✅ Top Criativos (editável)
5. ✅ Funil de Conversão
6. ✅ Análise Financeira
7. ✅ Alertas e Problemas
8. ✅ Comparação Textual
9. ✅ Ações Tomadas
10. ✅ Aprendizados e Hipóteses

---

## Funcionalidades

- **Modo Edição**: Switch para habilitar edição de criativos
- **Upload de Imagem**: Permite trocar imagem de criativos sem preview
- **Descrição Customizada**: Ajustar texto do criativo para o relatório
- **Ocultar Criativo**: Toggle para excluir criativo específico
- **Exportação PDF**: Multi-página com todas as seções
- **Alertas Automáticos**: Detecta CPL acima do limite e criativos sem leads

---

## Queries Implementadas

- `empresa_semana_metricas` (atual e anterior)
- `campanha_semana_metricas`
- `campanha_metricas_dia` (agregado para topo de funil)
- `criativo_metricas_dia` (top criativos)
- `acao` (ações da semana)
