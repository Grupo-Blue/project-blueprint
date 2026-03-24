

# Adicionar Extrator LinkedIn com Email e Telefone

## Análise dos Actors

Ambos os actors que você encontrou são bons, e cada um serve um caso diferente:

| Actor | O que faz | Email | Telefone | Melhor para |
|-------|-----------|-------|----------|-------------|
| **harvestapi/linkedin-profile-search** | Busca pessoas por filtros (cargo, empresa, localização) | Sim (modo "Full + email") | Não | Encontrar leads por critérios |
| **dev_fusion/linkedin-profile-scraper** | Enriquece perfis a partir de URLs do LinkedIn | Sim | Sim (para usuários pagos do Apify) | Enriquecer uma lista existente |

**Recomendação**: usar os dois em combo. O `harvestapi` busca os perfis por filtros e o `dev_fusion` enriquece com email + telefone. Mas para simplificar, podemos começar com o **harvestapi** no modo "Full + email search" que já retorna perfis completos com email numa única etapa. Se quiser telefone, rodamos o `dev_fusion` como segunda passada nos perfis encontrados.

## O que será feito

1. **Novo tipo de extração `LINKEDIN_PROFILE_SEARCH`** usando `harvestapi/linkedin-profile-search` com filtros avançados (cargo, empresa, localização, setor, keywords) e modo "Full + email search" ativado
2. **Novo tipo `LINKEDIN_ENRICH`** usando `dev_fusion/linkedin-profile-scraper` para enriquecer perfis do LinkedIn com email + telefone (aceita URLs de perfis)
3. Substituir os actors antigos `anchor~linkedin-people-search` e `anchor~linkedin-company-scraper` que não retornavam email

## Alterações

### Edge Function `extrair-leads-apify/index.ts`
- Substituir `LINKEDIN_SEARCH` → actor `harvestapi~linkedin-profile-search` com input: `keyword`, `company`, `location`, `industry`, `maxItems`, `scrapeProfiles: "full + email"`
- Substituir `LINKEDIN_COMPANY` → mesmo actor com filtro por empresa
- Adicionar `LINKEDIN_ENRICH` → actor `dev_fusion~linkedin-profile-scraper` com input: `urls` (array de URLs de perfis)

### Edge Function `verificar-extracao-leads/index.ts`
- Atualizar parsers para os novos schemas de output (harvestapi retorna `fullName`, `headline`, `location`, `email`, `profileUrl`, etc.; dev_fusion retorna `email`, `mobileNumber`, `fullName`, `headline`)

### Página `ExtracaoLeads.tsx`
- Atualizar tipos de extração com novos campos:
  - **Busca LinkedIn**: keyword, empresa, localização, setor, limite
  - **Enriquecer LinkedIn**: campo de texto para colar URLs de perfis (uma por linha)
- Exibir colunas de email e telefone na tabela de resultados

## Detalhes técnicos

- O `harvestapi` cobra $0.10/página de busca + $0.01/perfil com email — custo controlável
- O `dev_fusion` cobra por uso do actor — telefone só disponível para contas pagas do Apify
- Nenhum cookie ou login do LinkedIn é necessário em ambos os actors

