

# Corrigir Links de Preview dos Criativos Meta

## Problema Identificado

Os links armazenados no banco estao no formato `https://fb.me/XXXXX` (vindos do campo `preview_shareable_link` da Graph API). Esses links sao **temporarios e expiram**, por isso nao funcionam.

O formato desejado e `https://fb.me/adspreview/facebook/CODE` que vem do Ads Manager e tambem pode expirar.

## Solucao Recomendada

Como ambos os formatos `fb.me` sao temporarios, a melhor abordagem e usar o **link permanente do Ads Manager** que funciona sempre, desde que o usuario esteja logado no Facebook:

```
https://www.facebook.com/ads/manager/creation/adpreview/?act={account_id}&adId={ad_id}
```

**Alternativa publica (sem login):** Para casos onde nao ha sessao ativa no Facebook, usar o link da **Ad Library**:
```
https://www.facebook.com/ads/library/?id={ad_id}
```

## Mudancas

### 1. Edge Function `atualizar-preview-criativos`

- Remover a dependencia do campo `preview_shareable_link` da Graph API (links temporarios)
- Gerar o link de preview no formato do Ads Manager usando `act={account_id}&adId={ad_id}` (dados ja disponiveis no banco)
- O `account_id` ja esta na tabela `conta_anuncio.id_externo` e o `ad_id` esta em `criativo.id_anuncio_externo`

### 2. Frontend - `CriativoRankingCard.tsx` e `CriativoDetalhesModal.tsx`

- Atualizar `getPreviewLink` e `getAdLibraryUrl` para construir o link do Ads Manager diretamente a partir dos dados disponiveis (`id_anuncio_externo` + `id_externo` da conta)
- Manter fallback para Ad Library quando faltar o account ID

### 3. Atualizar registros existentes no banco

- Rodar UPDATE para limpar os `url_preview` com formato `fb.me` que nao funcionam
- Re-executar a funcao para popular com o novo formato

## Detalhes Tecnicos

A prioridade de link ficara:

1. **Ads Manager Preview**: `facebook.com/ads/manager/creation/adpreview/?act={account_id}&adId={ad_id}` (requer login no Facebook)
2. **Ad Library**: `facebook.com/ads/library/?id={ad_id}` (publico, sem login)
3. **Sem link**: quando nao ha `id_anuncio_externo`

Para o frontend funcionar sem depender do banco, os componentes precisarao receber o `id_externo` da conta de anuncio alem do `id_anuncio_externo`. Isso requer ajuste na query que alimenta o relatorio de criativos para incluir esse campo.

### Arquivos a modificar:
- `supabase/functions/atualizar-preview-criativos/index.ts` - simplificar para gerar links permanentes
- `src/components/campanhas/CriativoRankingCard.tsx` - construir link no frontend
- `src/components/dashboard/CriativoDetalhesModal.tsx` - construir link no frontend  
- Pagina/componente que faz a query dos criativos em `/relatorio-criativos` - incluir `id_externo` da conta na query

