## Problema

Em produção, mesmo após salvar um link UTM, a lista "Links salvos" não mostra. Causa raiz identificada:

1. `form.id_empresa` é inicializado uma única vez no `useState`, quando `empresasPermitidas` ainda está vazio (React Query carregando). Fica como `""` permanentemente.
2. Quando o usuário admin tem `empresaSelecionada = "todas"`, o código cai no fallback `form.id_empresa` — que é `""`. A query fica `enabled: false` e nunca lista nada.
3. Mesmo quando o usuário troca a empresa no Select do form, a lista passa a mostrar os links daquela empresa, mas se ele salvou um link em outra empresa antes, parece que "sumiu".
4. Adicionalmente, salvar com `form.id_empresa = ""` deve estar bloqueado pelo toast "Selecione uma empresa", mas em produção (com a empresa global selecionada como "todas") o usuário pode confundir qual empresa está ativa.

## Correção

### `src/components/utm/GeradorUTM.tsx`

1. **Sincronizar `form.id_empresa` com o contexto** via `useEffect`:
   - Quando `empresaSelecionada` mudar e for diferente de `"todas"`, atualizar `form.id_empresa`.
   - Quando `empresasPermitidas` carregar e `form.id_empresa` ainda estiver vazio, escolher a primeira automaticamente.

2. **Adicionar uma 3ª opção na resolução de `empresaIdParaListar`**: se `empresaSelecionada === "todas"`, listar pela empresa do form; se vazio, mostrar mensagem clara "Selecione uma empresa no seletor global ou no formulário acima".

3. **Mostrar badge da empresa atual no header dos "Links salvos"** (ex.: "Mostrando: Blue") para deixar claro de qual empresa são os links exibidos — evita confusão quando o usuário tem várias empresas.

4. **Após salvar**, forçar `empresaIdParaListar = form.id_empresa` (já é o caso) e invalidar **todas** as queries `["utm-links-com-contagem"]` (já feito) — isso resolve o caso onde o link salvo vai para a empresa correta mas a lista estava apontando para outra.

### Resultado esperado

- Lista sempre exibe links da empresa relevante (global se selecionada, senão a do form).
- Após salvar, link aparece imediatamente na lista (já estava ok no preview, vai funcionar igual em produção).
- Header indica qual empresa está sendo listada, evitando confusão.

## Arquivos modificados

- `src/components/utm/GeradorUTM.tsx` (sincronização de empresa + badge informativo)
