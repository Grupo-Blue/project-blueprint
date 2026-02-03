
# Plano: Relatorio Semanal Completo com Top Criativos Editaveis

## Objetivo
Transformar o relatorio semanal em um documento completo e baseado em dados, com secao dedicada aos top criativos incluindo imagens editaveis.

## Novas Secoes do Relatorio

### 1. Resumo Executivo (nova)
- Cards com KPIs principais do periodo
- Comparativo automatico vs semana anterior (variacao %)
- Indicadores visuais de tendencia (setas verde/vermelha)

### 2. Metricas de Topo de Funil (nova)
- Total de impressoes e cliques
- CTR medio geral
- CPC medio
- Alcance e frequencia (se disponivel)

### 3. Performance por Campanha (expandida)
- Tabela completa com todas as campanhas
- Metricas: Verba, Impressoes, Cliques, CTR, Leads, CPL
- Variacao vs semana anterior por campanha

### 4. Top Criativos com Imagens (NOVO - Principal)
- Lista dos 10 melhores criativos por leads
- Preview/imagem de cada criativo
- Metricas: Leads, CPL, ROAS, Vendas
- Botao para editar cada criativo (trocar imagem, ajustar descricao)
- Upload de imagem para criativos sem preview

### 5. Funil de Conversao Visual (nova)
- Diagrama visual do funil
- Leads > MQLs > Levantadas > Reunioes > Vendas
- Taxas de conversao entre cada etapa

### 6. Analise Financeira (nova)
- ROI e ROAS do periodo
- Receita gerada vs Verba investida
- CAC vs Ticket Medio
- Lucro bruto estimado

### 7. Alertas e Problemas (nova)
- Criativos com verba sem leads
- Campanhas com CPL acima do limite
- UTMs com problemas detectados

### 8. Secoes Existentes (mantidas)
- Comparacao textual
- Acoes tomadas
- Aprendizados e hipoteses

---

## Componente de Edicao de Criativos

Criar `TopCriativosEditor`:
- Lista editavel dos top criativos
- Cada item mostra: preview, nome, metricas
- Botao "Editar" abre modal com:
  - Upload de nova imagem (se preview estiver faltando)
  - Campo para ajustar descricao do criativo
  - Preview em tempo real
- Estado salvo apenas no relatorio (nao afeta dados originais)

---

## Arquivos a Criar/Modificar

### Criar
1. `src/components/relatorios/TopCriativosEditor.tsx`
   - Componente para exibir e editar top criativos
   - Upload de imagens via input file
   - Estado local para edicoes antes de exportar

2. `src/components/relatorios/FunilConversao.tsx`
   - Visualizacao do funil de conversao
   - Barras horizontais com porcentagens

3. `src/components/relatorios/ComparativoSemanal.tsx`
   - Cards com metricas e variacao vs semana anterior
   - Indicadores visuais de tendencia

4. `src/components/relatorios/AlertasRelatorio.tsx`
   - Lista de problemas detectados no periodo

### Modificar
1. `src/pages/RelatorioEditor.tsx`
   - Adicionar novas queries para buscar dados adicionais
   - Integrar novos componentes
   - Expandir layout do relatorio
   - Atualizar exportacao PDF para incluir novas secoes

---

## Fluxo de Dados

```text
RelatorioEditor
    |
    +-- Query: empresa_semana_metricas (atual)
    +-- Query: campanha_semana_metricas (atual)
    +-- Query: acoes (atual)
    |
    +-- NOVAS QUERIES:
        +-- criativo com metricas (top 10 por leads)
        +-- criativo_metricas_dia (agregado da semana)
        +-- lead (contagem por criativo)
        +-- empresa_semana_metricas (semana anterior para comparativo)
        +-- alerta_automatico (periodo)
```

---

## Estrutura do TopCriativosEditor

```text
+-----------------------------------------------+
| Top Criativos da Semana                  [Edit Mode] |
+-----------------------------------------------+
| +--------+  Criativo: Banner Principal        |
| | [IMG]  |  Campanha: Captacao Blue           |
| |        |  Leads: 45 | CPL: R$12 | ROAS: 3.2x |
| +--------+  [Editar] [Trocar Imagem]          |
+-----------------------------------------------+
| +--------+  Criativo: Video Institucional     |
| | [IMG]  |  Campanha: Awareness               |
| |        |  Leads: 32 | CPL: R$18 | ROAS: 2.1x |
| +--------+  [Editar] [Trocar Imagem]          |
+-----------------------------------------------+
```

---

## Tecnico: Estado de Edicao

O estado de edicao dos criativos sera armazenado localmente no componente:

```typescript
interface CriativoEditado {
  id_criativo: string;
  imagemCustomizada?: string; // base64 ou URL do upload
  descricaoCustomizada?: string;
  incluirNoRelatorio: boolean;
}

const [criativosEditados, setCriativosEditados] = useState<CriativoEditado[]>([]);
```

Na exportacao PDF, usar imagens customizadas quando disponiveis.

---

## Estimativa de Implementacao

1. **TopCriativosEditor**: Componente principal com upload e edicao
2. **Queries adicionais**: Buscar criativos com metricas agregadas
3. **FunilConversao**: Visualizacao do funil
4. **ComparativoSemanal**: Cards com variacao
5. **AlertasRelatorio**: Lista de problemas
6. **Integracao no RelatorioEditor**: Unir tudo
7. **Exportacao PDF**: Atualizar para incluir imagens e novas secoes
