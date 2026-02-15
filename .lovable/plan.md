
# Correcao: Dados Blue faltando de 01 a 08 de Fevereiro

## Diagnostico

A investigacao revelou que os dias **02 a 08 de fevereiro** simplesmente **nao existem** na tabela `campanha_metricas_dia` para a Blue. O dia 01 existe mas com verba = R$ 0.

### Causa raiz
1. O **Metricool** nao retornou dados para esses dias (a API pode ter limitacao de historico ou as campanhas nao tinham gasto reportado)
2. Os coletores nativos (`coletar-metricas-meta` e `coletar-metricas-google`) so coletam o dia **atual** (`date_preset=today`), entao nunca retroagiram
3. As funcoes historicas (`coletar-metricas-meta-historico` e `coletar-metricas-google-historico`) existem e conseguem buscar dados por periodo, **porem nao incluem `fonte_conversoes`** no upsert - o que faz os registros ficarem com NULL e serem filtrados pelo dashboard

## Plano de Correcao

### Passo 1 - Corrigir as funcoes historicas para incluir `fonte_conversoes`
Atualizar as duas edge functions de coleta historica para incluir `fonte_conversoes` no upsert:

- `coletar-metricas-meta-historico`: adicionar `fonte_conversoes: 'META_API_DAILY'`
- `coletar-metricas-google-historico`: adicionar `fonte_conversoes: 'GOOGLE_API_DAILY'`

### Passo 2 - Executar coleta historica para a Blue (01-08/02)
Chamar as duas funcoes com os parametros:

```text
POST coletar-metricas-meta-historico
{ "data_inicio": "2026-02-01", "data_fim": "2026-02-08" }

POST coletar-metricas-google-historico
{ "data_inicio": "2026-02-01", "data_fim": "2026-02-08" }
```

Isso ira buscar os dados diarios diretamente das APIs nativas do Meta e Google para o periodo faltante e salva-los com a tag correta.

### Passo 3 - Verificar resultados
Consultar o banco apos a execucao para confirmar que os dias 01-08 agora possuem dados com `fonte_conversoes` preenchido.

### Detalhes Tecnicos

- As funcoes historicas ja suportam paginacao (Meta) e segmentacao por data (Google GAQL `segments.date BETWEEN`)
- O upsert com `onConflict: "id_campanha,data"` garante que se ja existir um registro para um dia, ele sera atualizado (nao duplicado)
- A Blue possui 2 integracoes META_ADS e 1 GOOGLE_ADS ativas, com campanhas ativas desde janeiro/fevereiro
- O `coletar-metricas-meta-historico` busca todas as campanhas da conta (nao apenas ativas), garantindo cobertura completa
