

# Enriquecer Sistema com Dados Completos do Metricool

## O que ja temos hoje

O sistema atualmente coleta do Metricool:
- **Metricas timeline por rede** (seguidores, alcance, impressoes, cliques) via `sincronizar-metricool`
- **Metricas de Ads** (campanhas Google/Meta com conversoes) via `enriquecer-campanhas-metricool`
- **SmartLinks** (cliques por dia)

## O que vamos adicionar

### Fase 1 -- Posts Organicos (Instagram, Facebook, LinkedIn, TikTok)

Coletar todos os posts publicados com suas metricas individuais e, crucialmente, **URLs de midia/thumbnail** que podem servir como previews visiveis para criativos.

**Dados coletados por post:**
- ID do post, data de publicacao, tipo (imagem, video, carrossel, reel, story)
- Texto/legenda
- URL da midia (imagem ou thumbnail do video) -- persistente, nao expira
- Likes, comentarios, compartilhamentos, salvos
- Alcance, impressoes
- Cliques no link, visitas ao perfil geradas
- Taxa de engajamento

**Nova tabela:** `social_posts`

### Fase 2 -- Demographics da Audiencia

Coletar dados demograficos dos seguidores para entender melhor o publico.

**Dados coletados:**
- Distribuicao por genero (masculino/feminino/outro)
- Distribuicao por faixa etaria (13-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+)
- Top paises e top cidades

**Nova tabela:** `social_audiencia_demografica`

### Fase 3 -- Competitors (Benchmarking)

Coletar dados de concorrentes configurados no Metricool para comparacao.

**Dados coletados:**
- Seguidores, posts, engajamento dos concorrentes
- Comparativo com perfis proprios

**Nova tabela:** `social_concorrentes_metricool`

### Fase 4 -- Conteudo Agendado / Planejado

Coletar posts agendados no Metricool para visibilidade do calendario editorial.

**Nova tabela:** `social_posts_agendados`

### Fase 5 -- Dashboard de Conteudo Organico

Novo componente no frontend para visualizar:
- Ranking dos melhores posts por engajamento
- Preview visual dos posts (usando URLs de midia do Metricool)
- Distribuicao demografica da audiencia em graficos
- Calendario de publicacoes

---

## Detalhes Tecnicos

### Novas Tabelas no Banco

```sql
-- Posts organicos de todas as redes
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES empresa(id_empresa),
  rede_social TEXT NOT NULL, -- INSTAGRAM, FACEBOOK, LINKEDIN, TIKTOK, YOUTUBE, TWITTER
  post_id_externo TEXT NOT NULL,
  tipo TEXT, -- IMAGE, VIDEO, CAROUSEL, REEL, STORY, TEXT
  data_publicacao TIMESTAMPTZ,
  texto TEXT,
  url_midia TEXT, -- URL persistente da imagem/thumbnail
  url_post TEXT, -- Link para o post original
  likes INTEGER DEFAULT 0,
  comentarios INTEGER DEFAULT 0,
  compartilhamentos INTEGER DEFAULT 0,
  salvos INTEGER DEFAULT 0,
  alcance INTEGER DEFAULT 0,
  impressoes INTEGER DEFAULT 0,
  cliques_link INTEGER DEFAULT 0,
  visitas_perfil INTEGER DEFAULT 0,
  engajamento_total INTEGER DEFAULT 0,
  taxa_engajamento NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, rede_social, post_id_externo)
);

-- Demograficos da audiencia
CREATE TABLE social_audiencia_demografica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES empresa(id_empresa),
  rede_social TEXT NOT NULL,
  data_coleta DATE NOT NULL,
  tipo TEXT NOT NULL, -- GENDER, AGE, COUNTRY, CITY
  label TEXT NOT NULL, -- ex: "male", "18-24", "Brazil", "Sao Paulo"
  valor NUMERIC DEFAULT 0,
  percentual NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, rede_social, data_coleta, tipo, label)
);

-- Concorrentes via Metricool
CREATE TABLE social_concorrentes_metricool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES empresa(id_empresa),
  rede_social TEXT NOT NULL,
  nome_concorrente TEXT NOT NULL,
  username_concorrente TEXT,
  data DATE NOT NULL,
  seguidores INTEGER DEFAULT 0,
  posts_total INTEGER DEFAULT 0,
  engajamento_medio NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_empresa, rede_social, nome_concorrente, data)
);
```

### Nova Edge Function: `coletar-conteudo-metricool`

Funcao dedicada para coletar posts organicos e demograficos. Endpoints da API Metricool utilizados:

- `GET /stats/instagram/posts` -- Posts do Instagram com metricas e URLs de midia
- `GET /stats/instagram/reels` -- Reels do Instagram
- `GET /stats/instagram/stories` -- Stories do Instagram
- `GET /stats/facebook/posts` -- Posts do Facebook
- `GET /stats/linkedin/posts` -- Posts do LinkedIn
- `GET /stats/tiktok/posts` -- Posts do TikTok
- `GET /stats/youtube/videos` -- Videos do YouTube
- `GET /stats/twitter/tweets` -- Tweets/X posts
- `GET /stats/gender` -- Distribuicao por genero
- `GET /stats/age` -- Distribuicao por faixa etaria
- `GET /stats/country` -- Top paises
- `GET /stats/city` -- Top cidades
- `GET /competitors` -- Dados de concorrentes

### Atualizacao da Edge Function existente: `sincronizar-metricool`

Adicionar chamada a `coletar-conteudo-metricool` no fluxo existente ou manter como funcao separada chamada pelo orquestrador.

### Novos Componentes Frontend

1. **`PostsOrganicosRanking.tsx`** -- Grid de cards com preview visual dos posts, metricas de engajamento, filtros por rede
2. **`AudienciaDemografica.tsx`** -- Graficos de pizza/barras com distribuicao por genero, idade, pais e cidade
3. **`CalendarioPublicacoes.tsx`** -- Visualizacao calendario dos posts publicados
4. Integracao dos novos componentes no `DashboardTrafego.tsx`

### Arquivos a criar:
- `supabase/functions/coletar-conteudo-metricool/index.ts`

### Arquivos a modificar:
- `src/pages/DashboardTrafego.tsx` -- adicionar novos componentes
- `src/components/CronjobsMonitor.tsx` -- registrar novo cronjob
- `supabase/config.toml` -- configurar nova funcao

### RLS
- Todas as novas tabelas terao RLS habilitado com politicas de leitura baseadas nas empresas do usuario, seguindo o padrao existente nas outras tabelas do sistema.

