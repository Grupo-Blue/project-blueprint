## Objetivo
Expor as funcionalidades da página `/inteligencia/irpf` (Oportunidades IRPF) no MCP server, permitindo que LLMs consultem KPIs, listem oportunidades com filtros/paginação e detalhem declarações.

## Novas tools no `supabase/functions/mcp-server/index.ts`

1. **`get_irpf_oportunidades_kpis`**
   - Input: `id_empresa` (obrigatório)
   - Chama RPC `irpf_inteligencia_kpis`
   - Retorna: total de declarações, patrimônio total agregado, sem lead, e contagens por tipo (imobiliário, investidor, empresarial, cripto, tributário) e total de oportunidades.

2. **`list_irpf_oportunidades`**
   - Input: `id_empresa` (obrigatório), `busca`, `uf`, `exercicio`, `tipo` (todos|imobiliario|empresarial|investidor|cripto|tributario), `patrimonio_min`, `ordenacao` (patrimonio|investimentos|variacao), `limite` (default 20, max 100), `offset`
   - Chama RPC `irpf_inteligencia_listar`
   - Retorna lista paginada com `total_count` + registros (CPF, nome, patrimônio, distribuição de ativos, vínculo com lead, etc.).

3. **`get_irpf_oportunidades_facetas`**
   - Input: `id_empresa`
   - Chama RPC `irpf_inteligencia_facetas`
   - Retorna UFs e exercícios disponíveis para popular filtros.

4. **`get_irpf_declaracao`**
   - Input: `id_declaracao`
   - Retorna a declaração completa de `irpf_declaracao` + arrays de `irpf_bem_direito` e `irpf_divida_onus` associados, para drill-down de uma oportunidade específica.

5. **`refresh_irpf_oportunidades`**
   - Sem input
   - Chama RPC `refresh_mv_irpf_inteligencia` para atualizar a materialized view após novas importações.

## Detalhes técnicos
- Todas as tools usam o cliente service role (`getAdmin()`) já existente no arquivo, mantendo o padrão das outras tools.
- Erros das RPCs propagados como `text` no `content`, igual padrão atual.
- Sem mudanças de schema no banco — apenas consumo das RPCs/MV já existentes (`mv_irpf_inteligencia`, `irpf_inteligencia_*`, `refresh_mv_irpf_inteligencia`).
- Sem mudanças no fluxo de autenticação por API key (já validado no middleware Hono).

## Arquivos alterados
- `supabase/functions/mcp-server/index.ts` (adicionar 5 tools)

## Fora de escopo
- Não altera UI da página `/inteligencia/irpf`.
- Não cria novas tabelas, RPCs ou políticas RLS.
- Não altera autenticação/permissões do MCP.