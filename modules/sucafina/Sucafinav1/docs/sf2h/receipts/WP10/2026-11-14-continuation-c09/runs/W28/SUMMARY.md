# WP10 W28 — C28 e CHECK28 observados

Produto W: `90f2c4f81f74edc26a1783bfda7891638b429fa6`.
Tree: `232c69db4eed34e913f125bb787b926971d6d031`.

## C28 — FAIL preservado

[Run 43627315630](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627315630), snapshot S `8dedb1fa71a0805505e50eda8c0a038de79276a8`, tree `7d885e25c52af39b9d22357c59910df6e6d78051`. S tem parent único W e acrescenta somente .ci-run.json.

Job de testes 132546009522: failure. Cleanup 132546614709: success. Artefatos observados: nenhum.

**8 pass / 1 fail / 136 expects / 9 testes / 3 arquivos / 16,27 s.** Os cabeçalhos reais confirmam exatamente calculation-source-observation.test.ts, authority-composition.test.ts e case-event-continuity.test.ts; sem filtro de nome de teste. Request validada pelo caminho canônico, Bun 1.3.14, Omni strict.

Os dois casos FIN-IND-002 passaram (6.577,14 ms e 9.035,97 ms). Os cinco testes de authority-composition passaram. O teste de abort do cálculo passou.

A única falha foi a assertion de contagem em calculation-source-observation.test.ts:86:29. Depois da revogação, o resultado foi denied, sem value e sem transação/authenticate/preparedRead. A contagem revalidate foi 0 e o teste esperava 1. O root reconciliou o contrato real: revalidação inválida remove a admissão, requestFor retorna undefined e o resolver faz short-circuit antes de outra revalidação. Esta observação não altera retroativamente o FAIL do run; a correção do oracle precisa de outro W/recheck.

O primeiro teste observou fallback com 4 envelopes, candidato com 2, ambos com 6 autenticações e 4 revalidações; nova leitura na mesma instância repetiu as observações. A→B→A retornou stale; revogação no último egresso retornou stale. A assertion final de estado durável posterior à contagem que falhou não foi alcançada. O teste separado de abort passou com 1 transação / 3 autenticações / 1 revalidação e estado durável inalterado.

Omni nonce `81db0eef6ccbc9217052308e67530829`: PASS; dois testes declarados em case-event-continuity.test.ts, quatro spawns, zero delegações. Não atribuir prova inter-observação ou aceitação nativa não selecionada a esse resultado.

## CHECK28 — FAIL preservado

[Run 43627330840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627330840), S `66d3a7fc3160a54aad1766e096a6b4cb397ab82b`, tree `3aaaadc3fc9e1c6264bdc8f54ed6c54ad8ab26c3`. Parents: W28 e CHECK27 `26db95e4764bf80148543798aa594ac7921f3b22`. O envelope acrescenta somente .astra-wp10-check.json e seu gate passou. Guard base: `a1d37698a7bb097c1578f827eba6a19b9917ef07`.

Job composition 132546056147: failure. Não há job dedicado de exclusão da branch neste workflow de check; os passos finais de limpeza passaram.

| Gate | Resultado |
|---|---|
| Sucafina typecheck | FAIL, 16 diagnósticos: 13 externos anteriores e 3 próprios WP10 |
| CLI typecheck | PASS |
| WP10 test consumers | FAIL, 3 diagnósticos próprios |
| Atlas geração/check/diff | PASS |
| Atlas typecheck | PASS |
| Spawn imports | PASS |
| Guards contra origin/dev | PASS |
| Upload de evidência | PASS |

Diagnósticos próprios:

- calculation-source-observation.test.ts(135,62): TS7006, snapshot sem tipo explícito.
- calculation-source-observation.test.ts(135,72): TS7006, blobs sem tipo explícito.
- forecast-submit.test.ts(51,55): TS2352, fixture parcial convertida diretamente para SfHostServices; faltam state, ui, human, humanActions e mais sete propriedades.

## Artefato e logs

Artifact CHECK28: id 14127220650, astra-wp10-check-1, 5.469 bytes, SHA-256 `dd6776908d198c4e130ba5c114da7f5d2eb0a66d0487da99753894228735e42a`, expiração 2026-11-28T18:37:21Z. Obtido pela operação GitHub MCP download_workflow_artifact como file_id `file_000000001e24820eb6638d5a7e896102`, nome astra-wp10-check28-1.zip. Metadata/referência estão preservadas no recibo. Os bytes ZIP não foram materializados em scratch por um transporte remoto alternativo.

Logs completos decodificados pelo GitHub MCP:

- C28.log.txt: 90.781 bytes; SHA-256 `919226002549b6b6d6a6e78c314e0a73ee9f1b0ca1083a2aa2bdd4c83aca4b19`.
- CHECK28.log.txt: 92.957 bytes; SHA-256 `8a7de39dfbf5291348099c02463ce65334e7a3a9740a66d07f950bdb8cc0a365`.

Requests, envelopes, jobs, artefatos, contagens/observações e seleções efetivas estão nos JSON deste diretório. Nenhum novo run foi disparado, nenhum produto foi alterado e nenhum teste foi executado localmente por esta tarefa de acompanhamento.
