# Diagnóstico de IRPF não importados

## Confirmado
- Folder ID configurado: `1pmMUVlfiLl2KXfByjmIG82TlpYCN5D1r` (bate com a URL enviada).
- Service Account: `blue-cripto-ir-upload@sound-datum-391213.iam.gserviceaccount.com`.
- A função `monitorar-pasta-irpf` roda OK, mas a listagem retorna 0 PDFs — ou seja, **a Service Account não enxerga os arquivos** que aparecem no navegador.

A causa quase certa é uma das três:
1. Os PDFs novos foram enviados por outro usuário e **não foram compartilhados individualmente** com a SA (no "Meu Drive" o compartilhamento da pasta nem sempre se propaga para arquivos colocados depois, dependendo de quem é o owner).
2. A pasta foi recriada/movida e a SA perdeu acesso.
3. Os arquivos estão em **subpastas** dentro da pasta principal (a função só lista a raiz).

## Passos do plano

### 1. Criar função `debug-listar-pasta-irpf` (temporária)
Lista TUDO que a SA vê na pasta, sem filtros — incluindo subpastas, Google Docs, qualquer mimeType, com `owners` e `permissions`. Isso identifica imediatamente o caso real:
- Se vier vazio → problema de permissão (SA não foi adicionada / foi removida).
- Se vier subpastas com PDFs dentro → ajustar `monitorar-pasta-irpf` para recursão.
- Se vierem arquivos com mimeType ≠ `application/pdf` → ampliar filtro.

Output JSON com: `total`, `lista[{id,name,mimeType,owners,createdTime,parents}]`, `subpastas[]`.

### 2. Rodar a função e diagnosticar
Executo o curl, leio a resposta e te mostro o que está acontecendo na pasta do ponto de vista da SA, comparando com o que você vê no navegador.

### 3. Aplicar a correção apropriada
Conforme o resultado:
- **Permissão**: te peço para reabrir a pasta no Drive → "Compartilhar" → adicionar `blue-cripto-ir-upload@sound-datum-391213.iam.gserviceaccount.com` como **Editor**, e marcar "Notificar pessoas = não". Alternativa robusta: mover a pasta para um **Shared Drive** com a SA como membro (resolve definitivamente).
- **Subpastas**: ajustar `monitorar-pasta-irpf` para varrer recursivamente (BFS simples até X níveis, mantendo o batch_size).
- **MimeType**: ampliar filtro para aceitar `application/pdf` + heurística por extensão `.pdf` no `name`.

### 4. Remover a função de debug
Após confirmar que está importando, deleto `debug-listar-pasta-irpf` para manter a base limpa.

## Por que não basta "olhar o Drive"
A view do navegador usa o seu usuário Google; a SA é uma identidade independente. Um arquivo pode estar visível pra você e invisível pra ela — daí a necessidade de listar pelo lado da SA.

Posso seguir?