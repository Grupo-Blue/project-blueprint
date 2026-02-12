
# Mapeamento de Segmentos Mautic por Empresa

## Objetivo
Separar a pontuacao e classificacao MQL por empresa, usando os segmentos do Mautic como criterio de mapeamento. Um lead pode estar quente para a Blue mas frio para a Tokeniza.

## Etapa 1 -- Criar tabela de configuracao

Criar a tabela `mautic_segmento_empresa` para mapear segmentos do Mautic a empresas do SGT, com threshold de score personalizado por segmento.

Ja inserir os mapeamentos conhecidos:

| Segmento ID | Nome | Empresa | Threshold |
|---|---|---|---|
| 1 | (BLUE) Leads - Quiz Risco Fiscal | Blue (`95e7adaf...`) | 50 |
| 2 | (BLUE) Leads - LP ir-no-prazo | Blue | 50 |
| 3 | (BLUE) Leads - LP regularizacao-cripto | Blue | 50 |
| 4 | (BLUE) Leads - LP apuracao-darf | Blue | 50 |
| 15 | Tokeniza - Usuarios sem KYC | Tokeniza (`61b5ffeb...`) | 50 |

Politica RLS: leitura para usuarios autenticados, escrita apenas para admins.

## Etapa 2 -- Atualizar a Edge Function `mautic-webhook`

Alterar a logica de determinacao de empresa (atualmente na secao 7 do codigo, linhas 230-255):

**Logica atual:**
1. Se lead existe, usa empresa do lead
2. Senao, busca primeira integracao Mautic ativa

**Nova logica:**
1. Extrair segmentos do contato Mautic (`contact.segments` ou campo equivalente no payload)
2. Consultar `mautic_segmento_empresa` para mapear segmento a empresa
3. Usar o `threshold_score` do segmento correspondente em vez do valor fixo `50`
4. **Fallback**: se nenhum segmento bater, manter a logica atual (integracao Mautic ativa)
5. Se o lead ja existe e pertence a outra empresa, manter a empresa original (nao sobrescrever)

**Mudanca no calculo MQL:**
- Substituir a constante `MQL_SCORE_MINIMO = 50` pelo `threshold_score` vindo da tabela de mapeamento
- Cada empresa/segmento pode ter seu proprio threshold

## Etapa 3 -- Tratar lead em multiplos segmentos

Se um contato pertence a segmentos de empresas diferentes (ex: segmentos Blue E Tokeniza), a logica usara o **primeiro mapeamento encontrado** como empresa principal. Caso futuramente precise criar leads duplicados (um por empresa), isso pode ser evoluido.

## Detalhes tecnicos

### SQL da migracao
```sql
CREATE TABLE public.mautic_segmento_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa UUID REFERENCES public.empresa(id_empresa) NOT NULL,
  segmento_mautic_id INTEGER NOT NULL,
  segmento_mautic_nome VARCHAR(255) NOT NULL,
  threshold_score INTEGER DEFAULT 50,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(segmento_mautic_id)
);

ALTER TABLE public.mautic_segmento_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler mapeamentos"
  ON public.mautic_segmento_empresa FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins podem gerenciar mapeamentos"
  ON public.mautic_segmento_empresa FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'));

INSERT INTO public.mautic_segmento_empresa
  (id_empresa, segmento_mautic_id, segmento_mautic_nome, threshold_score)
VALUES
  ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db', 1, '(BLUE) Leads - Quiz Risco Fiscal', 50),
  ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db', 2, '(BLUE) Leads - LP ir-no-prazo', 50),
  ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db', 3, '(BLUE) Leads - LP regularizacao-cripto', 50),
  ('95e7adaf-a89a-4bb5-a2bb-7a7af89ce2db', 4, '(BLUE) Leads - LP apuracao-darf', 50),
  ('61b5ffeb-fbbc-47c1-8ced-152bb647ed20', 15, 'Tokeniza - Usuarios sem KYC', 50);
```

### Mudancas na Edge Function
No arquivo `supabase/functions/mautic-webhook/index.ts`:

1. Extrair segmentos do contato (campo `segments` do payload Mautic)
2. Substituir o bloco "Determinar empresa" (linhas 230-255) pela nova logica de mapeamento por segmento
3. Usar `threshold_score` do mapeamento no calculo de MQL em vez da constante fixa
4. Manter fallback para integracao Mautic ativa caso nenhum segmento case

Nenhuma mudanca no frontend e necessaria -- a tabela sera gerenciada via SQL por enquanto.
