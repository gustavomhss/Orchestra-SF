# WP10 W29 — F29 source fences

**Resultado: SUCCESS. Dez testes completos passaram nos três arquivos prescritos.**

[Run 43628418430](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628418430).

- Produto W29: `813806af6c2ce74b2a087139c544e90dd1adcbe4`.
- Tree do produto: `06db6b04ee6bdb2af26b71d0b4031d769b76d219`.
- Snapshot S: `e71d4beacdc1309c1affa571454809dce172b8c1`.
- Tree do snapshot: `c75ec5350874d8e6c0bf7de8c79f099e496578a0`.
- Parent único de S: W29; compare contém somente adição de .ci-run.json.
- Request blob: `dea0dacd170e18998c7b4b499389a1cfa824df82`.
- Request SHA-256: `cede46b79a37583c13ce622322628e3f4851d3cf0d56fa02c640259898ae36b9`.

## Execução observada

Job de testes 132549392319: success. Cleanup 132549821272: success. Artefatos: nenhum. Run concluído em 2026-11-14T18:47:37Z.

**10 pass / 0 fail / 132 expects / 10 testes / 3 arquivos / 1.044,00 ms no Bun.**

Os cabeçalhos reais seguem a ordem literal da request com caminhos ./:

1. source-lifecycle.test.ts — cinco testes.
2. source-read-fence.test.ts — dois testes.
3. source-fence-read.test.ts — três testes.

Passaram os casos de reopen/deleção/recriação; rollback de preview, callback e cancelamento; restore com preservação do namespace protegido; revisões de projeção e escritas intermediárias; recusa de incarnation antiga entre lookup/observação; leitura staged sem refrescar identidade; proteção contra substituição de snapshot; leitura C08 real sem writer aninhado; mudanças de domínio/C08 em ambas as fronteiras; e Request, headers, abort, lease e autoridade atuais.

Omni nonce `a1e93437d3e876aa71de81b22665a064`: not applicable, zero spawns e delegações. O arquivo não declarou teste positivo de Omni; não há aceite nativo inferido.

## Composição dos gates

Os dois casos estruturais de cálculo passaram no W29 em C29. O F29 agora confirma o gate completo de três arquivos de lifecycle/C08/fences no mesmo produto. A prova UI de FIN-IND-004 permanece HOLD no recibo C29 e não é critério deste gate.

A jornada exact-threshold integral continua sem resultado no W29 nesta observação. Os gates curtos sustentam a próxima qualificação discriminante pelo owner; não demonstram por si tempo final, persistência utilizável, recomposição, retry ou revogação da jornada completa.

## Preservação

F29.log.txt preserva os bytes UTF-8 do log decodificado pelo GitHub MCP: 72.718 bytes, SHA-256 `6d03dd2863d5946ba47b29af3111b6f43feaacfb8c8310fb8ba40ad898224546`.

Request, jobs, artefatos, Omni, W/S, parents/trees, compare, nomes dos dez testes e resultados estão em F29-terminal.json e nos arquivos adjacentes. Nenhum teste local, novo dispatch ou alteração de produto foi realizado nesta coleta. Nenhum merge ou GLOBAL_RELEASE é declarado.
