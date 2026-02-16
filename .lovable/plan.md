
# API de Busca e Enriquecimento de Leads para Sistemas Externos

## Visao Geral

Criar uma nova edge function `buscar-lead-api` que permite que sistemas externos enviem um telefone ou email e recebam de volta os dados completos e enriquecidos do lead na base (Mautic, Tokeniza, LinkedIn, GA4, Stape, IRPF, Metricool, score, UTMs, etc).

## Autenticacao

A API sera protegida por um header `x-api-key` validado contra um novo secret `SGT_API_KEY` (ou reutilizar o `SGT_WEBHOOK_SECRET` ja existente, conforme preferencia). Sistemas externos precisam enviar esse token para consultar.

## Normalizacao de Telefone

Reutiliza a mesma logica de `normalizarTelefone` ja presente em `enriquecer-lead-mautic`:
- Remove caracteres nao numericos
- Remove DDI 55 se presente
- Insere o digito 9 apos DDD quando necessario (10 digitos -> 11)
- Busca no banco com e sem o prefixo `+55` para garantir match

## Logica de Busca

1. Se `email` fornecido: busca exata por `email` (case-insensitive via `ilike`)
2. Se `telefone` fornecido: normaliza e busca em multiplos formatos (`+55XXXXXXXXXXX`, `XXXXXXXXXXX`, parcial via `ilike`)
3. Se ambos fornecidos: busca por email primeiro, fallback para telefone
4. Filtra leads com `merged = false` (ou null) para nao retornar duplicados

## Payload de Resposta

Retorna um JSON rico com todas as dimensoes de enriquecimento disponiveis:

```text
{
  "found": true,
  "lead": {
    // Dados basicos
    "id_lead", "nome_lead", "email", "telefone", "organizacao",
    "origem_canal", "stage_atual", "id_empresa",
    
    // Comercial
    "venda_realizada", "valor_venda", "data_venda",
    "is_mql", "levantou_mao", "tem_reuniao",
    "score_temperatura", "proprietario_nome",
    
    // UTMs
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    
    // Mautic
    "mautic_score", "mautic_page_hits", "mautic_tags", "cidade_mautic", "estado_mautic",
    
    // LinkedIn
    "linkedin_cargo", "linkedin_empresa", "linkedin_setor", "linkedin_senioridade",
    
    // Tokeniza
    "tokeniza_investidor", "tokeniza_valor_investido", "tokeniza_qtd_investimentos",
    
    // GA4
    "ga4_landing_page", "ga4_engajamento_score", "ga4_sessoes",
    
    // Stape
    "stape_paginas_visitadas", "stape_eventos",
    
    // IRPF
    "irpf_renda_anual", "irpf_patrimonio_liquido", "irpf_perfil_investidor",
    
    // Metricool
    "metricool_roas_campanha", "metricool_cpc_campanha"
  }
}
```

## Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/buscar-lead-api/index.ts` | Criar |
| `supabase/config.toml` | Atualizar (verify_jwt = false) |

## Exemplo de chamada

```text
POST /functions/v1/buscar-lead-api
Headers:
  x-api-key: <SGT_WEBHOOK_SECRET>
  Content-Type: application/json

Body:
  { "telefone": "(11) 98765-4321" }
  -- ou --
  { "email": "joao@empresa.com" }
  -- ou --
  { "telefone": "5511987654321", "email": "joao@empresa.com" }
```

## Detalhes tecnicos

- Autenticacao via `x-api-key` comparado com `SGT_WEBHOOK_SECRET` (secret ja existente)
- Busca usa `supabase.from('lead').select(...)` com service role key
- Normalizacao gera multiplas variantes do telefone para buscar com `or(telefone.eq.variant1, telefone.eq.variant2, ...)`
- Leads com `merged = true` sao excluidos do resultado
- Se multiplos leads encontrados, retorna o mais recente (`order by data_criacao desc, limit 1`)
- Nenhum secret novo necessario
