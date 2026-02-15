
# Corrigir "Nenhuma Keyword Encontrada"

## Problema Identificado

A campanha Google Search que possui keywords (`af9ec2f4`) esta com `ativa = false` no banco de dados. A pagina `/relatorio-criativos` filtra apenas campanhas com `ativa = true` (linha 51), por isso ela nunca aparece no grid -- e consequentemente a tabela de keywords nao e exibida.

Todas as 7 campanhas SEARCH desta empresa estao com `ativa = false`.

## Solucao

Duas correcoes complementares:

### 1. Incluir campanhas com keywords mesmo se pausadas

Na query da pagina `RelatorioCreativos.tsx`, apos carregar campanhas ativas, fazer uma segunda consulta para buscar campanhas GOOGLE pausadas que tenham keywords vinculadas na tabela `google_ads_keyword`. Essas campanhas serao incluidas no grid com um badge visual "Pausada" para diferenciar.

Isso garante que qualquer campanha Search com dados de keywords apareca na analise, mesmo pausada.

### 2. Badge visual para campanhas pausadas

No componente `CampanhaSuperTrunfo.tsx`, quando `ativa = false`, mostrar um indicador visual (badge "Pausada" em cinza) no header do card para que o usuario saiba que a campanha nao esta rodando ativamente.

## Detalhes Tecnicos

### RelatorioCreativos.tsx

Apos a query principal de campanhas ativas, adicionar:

```text
1. Buscar keywords distintas por id_empresa com id_campanha preenchido
2. Coletar os id_campanha dessas keywords
3. Buscar campanhas pausadas cujo id_campanha esteja nessa lista
4. Mesclar com as campanhas ativas antes de processar metricas
```

### CampanhaSuperTrunfo.tsx

- Verificar campo `ativa` da campanha
- Se `ativa === false`, exibir badge "Pausada" ao lado do nome

### Arquivos a modificar
- `src/pages/RelatorioCreativos.tsx` (incluir campanhas pausadas com keywords)
- `src/components/campanhas/CampanhaSuperTrunfo.tsx` (badge "Pausada")
