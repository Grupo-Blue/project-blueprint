

# Adicionar 13 Novas Tools ao Chat IA Assistente

## Visao Geral

Expandir a edge function `chat-ia-assistente` de 6 para 19 ferramentas, adicionando 9 de leitura e 4 de escrita. Isso dara ao assistente acesso completo ao sistema, permitindo consultar alertas, concorrentes, hipoteses, landing pages, metricas sociais, funil de conversao, e tambem **criar registros** como demandas de campanha, alertas, hipoteses e aprendizados.

---

## Novas Ferramentas de Leitura (9)

1. **`comparar_periodos`** -- Compara metricas de dois periodos (ex: este mes vs mes passado). Consulta `empresa_metricas_dia` para ambos os intervalos e calcula variacao percentual de leads, vendas, CPL, verba.

2. **`buscar_alertas`** -- Consulta `alerta_automatico` filtrando por empresa, severidade (INFO/WARNING/CRITICAL), resolvido ou nao. Retorna alertas pendentes com titulo, descricao e metadados.

3. **`buscar_concorrentes`** -- Consulta `concorrente_anuncio` para ver anuncios de concorrentes detectados. Pode filtrar por concorrente_nome, plataforma e status (ATIVO/INATIVO).

4. **`buscar_hipoteses`** -- Consulta `hipotese_teste` com filtros de empresa e resultado (CONFIRMADA/REFUTADA/INCONCLUSIVA). Retorna tipo, descricao, criterio de sucesso e resultado.

5. **`buscar_aprendizados`** -- Consulta `aprendizado_semana` filtrando por empresa e tipo. Retorna descricao e metricas de suporte.

6. **`buscar_metricas_instagram`** -- Consulta `social_metricas_dia` para uma rede social especifica (INSTAGRAM, FACEBOOK, LINKEDIN, etc). Retorna seguidores, alcance, impressoes, engajamento.

7. **`buscar_landing_pages`** -- Consulta `landingpage_metricas` para performance de LPs (sessoes, conversoes, bounce rate) e `landingpage_analise` para insights IA existentes.

8. **`funil_conversao`** -- Calcula funil completo da empresa: Leads Total -> Leads Pagos -> Levantadas -> MQLs -> Reunioes -> Vendas, com taxas de conversao entre cada etapa. Dados de `empresa_metricas_dia`.

9. **`listar_empresas`** -- Lista todas as empresas no sistema com nome, CPL maximo, CAC maximo e meta de verba. Util quando nenhuma empresa esta selecionada.

## Novas Ferramentas de Escrita (4)

10. **`criar_demanda_campanha`** -- Insere em `demanda_campanha` com titulo, descricao, plataforma (META/GOOGLE), prioridade, verba_diaria, verba_total, data_inicio, UTMs sugeridos. Requer `id_empresa` e usa o `user_id` autenticado como `id_criador`. Status inicial: PENDENTE.

11. **`criar_alerta`** -- Insere em `alerta_automatico` com tipo, severidade, titulo, descricao e metadados. Permite que a IA crie alertas manuais para a equipe acompanhar.

12. **`criar_hipotese`** -- Insere em `hipotese_teste` com tipo, descricao e criterio_sucesso. Requer `id_empresa` e `id_semana`. Permite registrar testes sugeridos pela IA.

13. **`criar_aprendizado`** -- Insere em `aprendizado_semana` com tipo, descricao e metricas_suporte. Permite registrar insights identificados pela IA.

---

## Detalhes Tecnicos

### Arquivo modificado

**`supabase/functions/chat-ia-assistente/index.ts`** -- Unico arquivo a ser alterado:

- Adicionar 13 novas entradas no array `toolDeclarations` com `name`, `description` e `parameters`
- Adicionar 13 novos `case` no `switch` da funcao `executeTool`
- Para as tools de escrita, o `user_id` do usuario autenticado sera passado para a funcao `executeTool` para registrar quem criou o registro
- Atualizar o `SYSTEM_PROMPT` para informar a IA sobre suas novas capacidades de escrita e instrui-la a sempre confirmar antes de criar registros

### Mudancas no System Prompt

Adicionar instrucoes sobre:
- Capacidade de criar demandas, alertas, hipoteses e aprendizados
- **Sempre pedir confirmacao** antes de executar tools de escrita ("Posso registrar essa demanda?")
- Quando criar demandas, sugerir UTMs, verba e segmentacao baseados nos dados historicos

### Fluxo de escrita (seguranca)

A edge function ja usa `SUPABASE_SERVICE_ROLE_KEY` para queries, entao as insercoes funcionarao sem problemas de RLS. O `user_id` autenticado sera extraido do token JWT e usado como `id_criador` nas demandas.

### Aumento de MAX_ITERATIONS

Sera aumentado de 5 para 8, pois com mais ferramentas a IA pode precisar de mais rodadas de tool calling para consultas complexas.

---

## Sequencia de Implementacao

1. Adicionar as 13 declaracoes de ferramentas ao array `toolDeclarations`
2. Implementar os 13 novos cases no `executeTool` (passando `user_id` para writes)
3. Atualizar o system prompt com instrucoes sobre escrita
4. Aumentar `MAX_ITERATIONS` para 8
5. Deploy da edge function
