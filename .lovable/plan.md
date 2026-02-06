

# Correção das Integrações Meta Ads

## Problemas Identificados

Foram identificados **dois problemas distintos** ao testar todas as 3 integrações Meta ativas:

### Problema 1: Tokens invalidados (2 integrações)
As integrações `2a95ae46` (BlueConsult) e `d63b40e7` (Tokeniza) retornam **erro 190** da Meta API, indicando tokens inválidos. Apesar de terem sido configurados como System User Tokens (permanentes), a migração de v18 para v22 pode ter invalidado permissões necessárias, exigindo regeneração.

### Problema 2: Conflito de campanhas entre contas (1 integração)
A integração `f0fc054f` (BlueConsult, conta `act_1902838123192201`) tenta acessar campanhas que pertencem a outra conta (`act_419200126640368`). Isso ocorre porque a busca de campanhas filtra por empresa (`id_empresa`), e nao pela conta de anúncio (`ad_account_id`) vinculada à integração. Assim, uma integração tenta acessar campanhas da outra com o token errado.

### Problema 3: Falta de log do corpo do erro
A função `coletar-criativos-meta` loga apenas o status code (`Erro API Meta: 400`), mas nao loga o corpo da resposta de erro. Isso dificulta o diagnóstico.

---

## Alteracoes Tecnicas

### 1. Fix: Filtrar campanhas pela conta de anuncio da integracao

Atualmente, a funcao busca campanhas por `id_empresa`, o que faz com que integrações para contas de anúncio diferentes da mesma empresa tentem acessar campanhas que nao pertencem a elas. A correção:

- Extrair o `ad_account_id` da integração
- Buscar a `conta_anuncio` correspondente pelo `id_externo` (ex: `act_419200126640368`)
- Filtrar campanhas apenas por essa conta específica, e nao por todas as contas META da empresa

Isso afeta:
- `coletar-criativos-meta` (principal)
- `coletar-metricas-meta` (métricas diárias)
- `coletar-metricas-meta-historico` (métricas históricas)

### 2. Melhorar logging de erros

Adicionar log do corpo completo da resposta de erro da API Meta em `coletar-criativos-meta`:

```
console.error(`Erro API Meta: ${adsResponse.status}`, errorText);
```

Isso permitirá diagnósticos mais rápidos no futuro.

### 3. Sobre os tokens expirados

Os tokens precisam ser regenerados no Meta Business Manager. Isso nao pode ser feito pelo sistema -- o usuário deve gerar novos System User Tokens com as permissões `ads_read` e `ads_management` e atualizar na página de Integrações.

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/coletar-criativos-meta/index.ts` | Filtrar campanhas por conta de anúncio da integração + logging |
| `supabase/functions/coletar-metricas-meta/index.ts` | Filtrar campanhas por conta de anúncio da integração |
| `supabase/functions/coletar-metricas-meta-historico/index.ts` | Filtrar campanhas por conta de anúncio da integração |

