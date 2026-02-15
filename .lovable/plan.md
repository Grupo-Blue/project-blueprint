
# Corrigir Previews de Criativos Meta

## Problema

Nenhum preview de criativo Meta esta funcionando por 3 razoes encadeadas:

1. **Thumbnails expiradas**: 209 criativos usam URLs `fbcdn.net` que expiram em horas. As imagens nos cards estao quebradas.
2. **Links preview expirados**: 122 criativos ainda tem `url_preview` com `fb.me` (temporario, ja expirado). A funcao `atualizar-preview-criativos` converteu 300 mas nao alcancou todos (limite de 200 por execucao).
3. **Apify indisponivel**: O limite mensal do Apify foi excedido, entao o fallback de screenshots nao funciona.
4. **94 criativos sem id_anuncio_externo**: Esses nao geram nenhum link permanente.

## Solucao

### Passo 1 - Salvar thumbnails no Storage (resolver imagens quebradas)

Criar uma edge function `salvar-thumbnails-criativos` que:
- Busca criativos com `url_midia` contendo `fbcdn.net` (URLs temporarias)
- Faz download de cada imagem enquanto ainda esta acessivel
- Salva no bucket `criativos-media` do Storage
- Atualiza `url_midia` com a URL publica permanente do Storage

Isso resolve definitivamente o problema de thumbnails que expiram.

### Passo 2 - Corrigir links preview restantes

Executar `atualizar-preview-criativos` com `forcar: true` e `max_criativos: 500` para converter TODOS os `fb.me` restantes para links permanentes (Ads Manager ou Ad Library).

Para os 94 sem `id_anuncio_externo`: a funcao ja tem logica para buscar via Graph API usando `id_criativo_externo`. So precisa rodar com limite maior.

### Passo 3 - Exibir thumbnail placeholder inteligente no card

Atualizar `CriativoRankingCard.tsx` para:
- Detectar quando a imagem falha (evento `onError`) e mostrar um placeholder com o tipo do criativo
- Usar `url_preview` como fallback de imagem quando `url_midia` falha
- Mostrar um indicador visual quando a thumbnail nao esta disponivel

### Passo 4 - Automatizar refresh de thumbnails

Adicionar a funcao `salvar-thumbnails-criativos` ao `orquestrador-coleta` para que novas thumbnails sejam salvas automaticamente apos cada coleta de criativos.

## Detalhes Tecnicos

### Edge Function: salvar-thumbnails-criativos
```text
1. Buscar criativos com url_midia LIKE '%fbcdn.net%'
2. Para cada criativo:
   a. Fetch da url_midia (pode falhar se ja expirou)
   b. Se sucesso: upload para Storage bucket 'criativos-media/{id_criativo}.jpg'
   c. Atualizar url_midia com URL publica do Storage
   d. Se falha: tentar re-buscar thumbnail via Graph API (GET /{ad_id}?fields=creative{thumbnail_url})
   e. Se re-buscou: fazer download e salvar no Storage
3. Processar em batches de 10 com delay de 1s
```

### Bucket Storage
- Nome: `criativos-media`
- Politica: publico para leitura (imagens de anuncios nao sao sensiveis)
- Estrutura: `/{id_criativo}.{ext}`

### Atualizacao no CriativoRankingCard.tsx
```text
- Adicionar estado 'imagemQuebrada' com onError no img
- Quando imagem quebra: mostrar placeholder com icone do tipo (Image/Video/FileText)
- Background do placeholder em cor suave com texto "Preview indisponivel"
```

### Sequencia no orquestrador-coleta
```text
Fase 2: Criativos Meta em lote
Fase 2.5: Salvar thumbnails no Storage  (NOVO)
```

### Riscos e Mitigacoes
- URLs fbcdn ja expiradas: fallback via Graph API para re-buscar thumbnail_url fresca, depois salvar
- Bucket Storage cheio: limitar a 5MB por imagem, usar compressao
- Token Meta expirado: pular empresa e logar erro (mesma logica atual)
