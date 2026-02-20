

# Melhorar busca na pagina /leads

## Problemas identificados

1. **Filtro client-side conflita com busca server-side**: Enquanto o usuario digita, o `searchTerm` atualiza imediatamente e filtra os 1000 leads carregados em memoria (linhas 347-357). So apos 400ms o `debouncedSearch` dispara a busca no banco. Isso causa resultados inconsistentes durante a digitacao -- o usuario ve os resultados "sumirem" antes da busca real acontecer.

2. **Busca client-side limitada a 1000 registros**: Antes do debounce disparar, a busca filtra apenas os 1000 leads ja carregados, perdendo matches que estao alem desse limite.

3. **Pagina nao reseta ao buscar**: Quando o usuario digita uma busca, a pagina atual nao volta para a 1 automaticamente.

## Solucao

### Arquivo: `src/pages/Leads.tsx`

1. **Remover filtro client-side de busca**: Na secao `filteredLeads` (linha 347-357), quando houver `searchTerm` digitado mas o `debouncedSearch` ainda nao atualizou, nao aplicar filtro local. Apenas confiar na busca server-side apos o debounce.

2. **Mostrar indicador de "buscando..."**: Enquanto `searchTerm !== debouncedSearch`, exibir um estado visual de loading no campo de busca para o usuario saber que a busca esta sendo processada.

3. **Resetar pagina ao buscar**: Adicionar `setCurrentPage(1)` quando `debouncedSearch` mudar.

4. **Aumentar debounce para 600ms**: Dar mais tempo para o usuario terminar de digitar antes de disparar a query.

### Detalhes tecnicos

**Mudanca 1 - Remover filtro client-side de busca (linhas 347-357)**:

Substituir a logica atual por:
```text
// Se tem searchTerm digitado, confiar inteiramente na busca server-side
// Nao filtrar client-side para evitar inconsistencias
const matchesSearch = !searchTerm || debouncedSearch.length >= 2;
```

Isso significa: se o usuario digitou algo, os resultados so mudam quando a busca server-side retornar (apos o debounce). Sem flickering.

**Mudanca 2 - Indicador de loading no input**:

Adicionar um spinner ou texto "Buscando..." ao lado do campo de busca quando `searchTerm.length >= 2 && searchTerm !== debouncedSearch`. Isso da feedback visual ao usuario de que a busca vai acontecer.

**Mudanca 3 - Reset de pagina**:

No useEffect do debounce, adicionar `setCurrentPage(1)` apos atualizar o `debouncedSearch`.

**Mudanca 4 - Debounce de 600ms**:

Alterar o `setTimeout` de 400ms para 600ms para dar mais margem ao usuario.

### Resultado esperado

- Usuario digita no campo de busca
- Resultados atuais permanecem estaveis (sem flickering)
- Apos 600ms sem digitar, aparece um loading
- Query server-side dispara e retorna resultados parciais via `ilike %termo%`
- Pagina reseta para a primeira automaticamente
- Busca funciona em toda a base (nao limitada a 1000)

