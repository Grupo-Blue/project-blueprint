

## Plano — Corrigir "Gerar ICP Automático"

### Problema raiz
A função `gerarICPAuto` só analisa campos IRPF (renda, patrimônio, possui_empresas, possui_cripto) que estão **todos vazios** na base. Os campos que realmente têm dados — `tokeniza_investidor` (2.310 leads), `tokeniza_qtd_investimentos`, `tokeniza_valor_investido` — não geram critérios porque o código não os considera no auto-gerador. Resultado: 0 critérios gerados, dialog abre vazio.

Além disso, `.limit(1000)` pega só 8% dos 11.537 leads com venda.

### Correções em `src/pages/InteligenciaICP.tsx`

1. **Incluir campos Tokeniza na geração automática**
   - Adicionar lógica para `tokeniza_investidor`, `tokeniza_qtd_investimentos`, `tokeniza_valor_investido`
   - Se >40% dos leads com venda são `tokeniza_investidor = true`, gerar critério
   - Se `tokeniza_valor_investido` tem dados, gerar critério com mediana

2. **Aumentar limite da query para 5000** (amostrar melhor a base)

3. **Validar que pelo menos 1 critério foi gerado** — se não, mostrar toast explicativo: "Dados insuficientes para gerar ICP automático. Enriqueça seus leads com dados IRPF ou Tokeniza."

4. **Incluir `irpf_valor_investimentos`** com filtro `> 0` (atualmente todos são 0, mas prepara para quando tiver dados)

5. **Adicionar campos Amélia (`amelia_icp`, `amelia_temperatura`, `amelia_score`)** na query e na lógica de auto-geração — esses campos estão populados nos webhooks da Amélia

### Arquivo alterado
- `src/pages/InteligenciaICP.tsx` — mutation `gerarICPAuto`

