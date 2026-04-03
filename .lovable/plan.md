

# Enriquecer Leads com GCLID do CSV do Pipedrive

## O que foi encontrado

O CSV contém 39 linhas (20 pessoas únicas com gclid). Pesquisei cada uma no banco e encontrei:

| Pessoa de contato | Lead encontrado | ID Lead |
|---|---|---|
| Marcello Alexandre Oliveira da Silva | Sim | a9f7f2c8 |
| Mario Roberto Nalesso Marques | Sim | 2fa22dd8 |
| Natália Franco de Oliveira e Oliveira | Sim | 152e67df |
| Victor Martins Bicudo | Sim (2 registros) | 8deee18f + 4e5828f7 |
| Juscimar Farias Neto | Sim (2 registros) | 6048c015 + aa58aab6 |
| Hermes Monteiro | Sim | 8b1ae8f7 |
| Pablo Silveira da Cunha Lima | **Não encontrado** | — |
| Antonio Adolfo Daniel Garcia | Sim | 1e615828 |
| Álvaro Andreatta Zimmermann | Sim | f7c48239 |
| Washington Campos Albuquerque Cançado | Sim (2 registros) | 0d497753 + e2cbb81b |
| Valdir Lopes Moraes | Sim (3 registros) | 1d34bb51 + 979e3910 + 0e754932 |
| Eduardo Von Atzingen de Almeida Sampaio | **Não encontrado** | — |
| Robinson Herbert Prochnon Trovo | Sim | a2c43575 |
| Leonardo Rikerth | Sim (2 registros) | 32b2a2e3 + c189dea3 |
| Breno Antônio Soto Vieira | Sim | 34f22894 |
| Andre Esposito Roston | Sim | 7a98c7fa |
| Juliana Mascaretti Echem Desidério | Sim | a58e25a6 |
| Daniella de Santana Dantas | Sim | 45ad1ef5 |
| Marcelo Lima Menezes | **Não encontrado** | — |
| Jose Eduardo Oliveira Pinheiro | Sim | 7a627e87 |
| MATHEUS DOS SANTOS BATISTA SALOMAO | **Não encontrado** | — |

**17 de 20 pessoas encontradas** (4 não encontrados no SGT).

## O que será feito

1. **Script de UPDATE em lote** — Para cada lead encontrado, atualizar o campo `gclid` com o valor do CSV. Quando há duplicatas (mesmo nome, múltiplos registros), todos recebem o gclid.

2. **Registrar no Identity Graph** — Inserir o gclid como identificador na tabela `identity_graph` para cada lead, permitindo futura resolução de identidade via Google Ads.

3. **Marcar `venda_realizada = true`** — Todos os leads do CSV são clientes confirmados. Os que ainda não estão marcados serão atualizados.

4. **Relatório final** — Listar os 4 leads não encontrados para decisão (criar manualmente ou ignorar).

## Detalhes técnicos

- Execução via `psql` com statements UPDATE diretos (usando o insert tool para data operations)
- Cada UPDATE usa o `id_lead` específico para precisão
- O gclid é gravado na coluna `gclid` da tabela `lead`
- Identity graph: INSERT com `tipo_identificador = 'gclid'` e `confianca = 0.9`

