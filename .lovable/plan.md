

## Diagnóstico — `/inteligencia` está vazio

### O que está no banco hoje
| Tabela | Status |
|---|---|
| `icp_perfil` | **1** registro (Tokeniza, auto-gerado, com critérios incorretos) |
| `icp_match` | **0** registros — função `calcular-icp-match` **nunca rodou** (sem logs) |
| `lead_segmento` | 20 segmentos padrão criados, mas **só 3 têm membros** (72 leads) |
| `lead_segmento_membro` | 72 (de 30k+ leads) |

### Causas raiz

**1. Motor de Match nunca foi disparado**
- A função `calcular-icp-match` existe, mas **não tem cron** e ninguém clicou para rodar manualmente. Por isso `icp_match` está vazia → página `/inteligencia/match` não tem o que mostrar.

**2. ICP auto-gerado tem critério quebrado**
- O único ICP existente tem este critério: `{campo: "tokeniza_qtd_investimentos", operador: "is_true", valor: 38}`. Operador `is_true` num campo numérico nunca dá match — bug na lógica de `gerarICPAuto` em `InteligenciaICP.tsx`.
- Também não usa os campos com **mais dados disponíveis**: `amelia_score` (724 leads), `amelia_icp` (724), `mautic_score` (4.981), `mautic_page_hits` (83 engajados).

**3. Segmentos padrão estão filtrando errado**
- Os segmentos "Quase Cliente", "Cliente Quente" e "Reativação" usam `stage_atual IN ('proposta','negociacao','contrato')` → **0 leads** têm esses estágios na base. Os stages reais são outros.
- "Alta Intenção" e "Cliente Quente" filtram por `stape_last_activity` / eventos Stape recentes — provavelmente sem dados na janela de 7 dias.
- Resultado: cron roda 12x/dia com sucesso mas só popula "Aquecimento" (mautic_page_hits > 3).

**4. Página `/inteligencia/segmentos` sem membros para mostrar**
- Como só 3 dos 20 segmentos têm membros, a página parece vazia para a maioria das empresas.

**5. Falta integração visual entre as páginas**
- `/inteligencia/icp` cria ICP mas não dispara match automaticamente.
- `/inteligencia/match` exige clicar "recalcular" manualmente.
- `/inteligencia/irpf` depende de leads com IRPF (só 84 na base, ~0,3%).

---

## Plano de correção

### Correção 1 — Consertar o gerador de ICP automático (`InteligenciaICP.tsx`)
- Bug: critério `tokeniza_qtd_investimentos` está usando operador `is_true` com valor numérico. Trocar para `gte` com mediana.
- Garantir que critérios numéricos sempre usem `gte`/`lte`/`between` e booleanos usem `is_true`/`is_false`.
- Apagar o ICP existente quebrado (ou recriar via UI depois do fix).

### Correção 2 — Disparar `calcular-icp-match` automaticamente
- Quando salvar/criar um ICP em `InteligenciaICP.tsx`, invocar `calcular-icp-match` em background.
- Adicionar **cron diário** (1x/dia, após `calcular-segmentos`) chamando `calcular-icp-match` para todos os ICPs.
- Adicionar registro em `cronjob_execucao` (já feito no código mas precisa ser disparado).

### Correção 3 — Ajustar regras dos segmentos padrão (`calcular-segmentos`)
- "Quase Cliente": substituir `stage_atual IN ('proposta','negociacao','contrato')` pelos **stages reais** da base (preciso confirmar os valores em uso). Usar fallback inteligente: leads com `mautic_score > 70` ou `amelia_temperatura = 'quente'`.
- "Cliente Quente" / "Alta Intenção": além de Stape, usar `mautic_last_active` ou `amelia_score` recente como sinal alternativo.
- "Reativação": além dos stages, considerar leads sem atividade há 30+ dias com qualquer engajamento prévio.

### Correção 4 — Recriar segmentos padrão "novos" em vez de editar os existentes
- Adicionar 2-3 segmentos novos baseados em campos com **dados reais**:
  - "Investidores Tokeniza Ativos" → `tokeniza_investidor = true` (2.512 leads)
  - "Alta Qualificação Amélia" → `amelia_score >= 70` (de 724 com score)
  - "Engajados Mautic" → `mautic_page_hits > 3` (83 leads)
- Disparar `calcular-segmentos` manualmente após criar.

### Correção 5 — Melhorar UX da página `/inteligencia/match`
- Quando não houver matches, mostrar CTA claro: "Nenhum match calculado. Clique em Recalcular ou crie um ICP em /inteligencia/icp".
- Auto-disparar `calcular-icp-match` se a query retornar 0 e houver ICP selecionado (uma vez).

### Correção 6 — Limpar dados inconsistentes
- Deletar o `ICP Auto-gerado` atual (id `8d853b38…`) com critérios quebrados.
- Após fix, usuário pode regerar.

### Arquivos afetados
- `src/pages/InteligenciaICP.tsx` — fix gerador + auto-trigger match
- `src/pages/InteligenciaMatch.tsx` — auto-trigger + empty state melhor
- `supabase/functions/calcular-segmentos/index.ts` — ajustar regras dos tipos `quase_cliente`, `cliente_quente`, `alta_intencao`, `reativacao` + adicionar 3 segmentos novos
- **Migration** — novo cron para `calcular-icp-match` 1x/dia + DELETE do ICP quebrado + atualização das regras dos segmentos padrão

### Confirmação necessária antes de executar
Preciso **olhar os valores reais de `stage_atual`** na base para ajustar os filtros de segmentos sem chutar. Também vou verificar quais empresas devem receber os 3 segmentos novos sugeridos.

