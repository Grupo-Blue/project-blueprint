# Fix: Tela branca em `/inteligencia/irpf`

## Causa raiz (confirmada)
A materialized view `mv_irpf_inteligencia` contém registros com `uf = ''` (string vazia). A função `irpf_inteligencia_facetas` filtra apenas `IS NOT NULL`, então retorna a string vazia no array de UFs. No frontend (`src/pages/InteligenciaIRPF.tsx` linha 298), esse valor é passado direto para `<SelectItem value={u}>`. O Radix UI proíbe `value=""` em `SelectItem` e lança um erro que derruba a árvore React inteira → tela branca.

## Correções (defesa em profundidade)

### 1. Backend — `irpf_inteligencia_facetas` (migration)
Excluir UFs vazias/whitespace do array retornado:

```sql
CREATE OR REPLACE FUNCTION public.irpf_inteligencia_facetas(_id_empresa uuid)
RETURNS TABLE(ufs text[], exercicios integer[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    ARRAY(
      SELECT DISTINCT uf FROM public.mv_irpf_inteligencia
      WHERE id_empresa = _id_empresa
        AND uf IS NOT NULL AND trim(uf) <> ''
      ORDER BY uf
    ),
    ARRAY(
      SELECT DISTINCT exercicio FROM public.mv_irpf_inteligencia
      WHERE id_empresa = _id_empresa AND exercicio IS NOT NULL
      ORDER BY exercicio DESC
    );
$$;
```

### 2. Frontend — `src/pages/InteligenciaIRPF.tsx` (linha 298)
Filtro defensivo antes do `.map`, para nunca mais crashar mesmo se outra fonte retornar vazio:

```tsx
{(facetas?.ufs || [])
  .filter(u => u && u.trim() !== "")
  .map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
```

## Arquivos
- `supabase/migrations/<timestamp>_fix_irpf_facetas_uf_vazia.sql` (novo)
- `src/pages/InteligenciaIRPF.tsx` (1 linha alterada)

## Validação pós-deploy
1. Acessar `/inteligencia/irpf` → página carrega normalmente.
2. Abrir o dropdown de UF → nenhuma opção em branco aparece.
3. Console sem erro do Radix sobre `value=""`.
