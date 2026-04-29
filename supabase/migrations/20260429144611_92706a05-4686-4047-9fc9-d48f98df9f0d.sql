CREATE OR REPLACE FUNCTION public.irpf_inteligencia_facetas(_id_empresa uuid)
RETURNS TABLE(ufs text[], exercicios integer[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;