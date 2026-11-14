# S22 — falha observada nos históricos de renovação

**FAIL: 14 casos passaram e dois terminaram por timeout.** Foram 16 casos em sete arquivos, 195 assertions e 560,64 s. Os casos aprovados permanecem registrados; o resultado do conjunto não é PASS. Nenhuma correção futura é qualificada por este recibo.

## Pins e evidência

| Campo | Valor |
| --- | --- |
| Produto W32 | `79531aefa2bf72a9d13deba5164f725ec7da0e0f` |
| Tree de produto | `485a3ac2ac1322d03d7421a17eb1791153f11c1b` |
| Snapshot S22 | `ef218e5c436f8518ee582232a820cd41048f8d3b` |
| Tree do snapshot | `4634ce02d9e3127a9fa3fcc51dcec262a74f947c` |
| Run / job | [43597449806](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597449806) / `132454907023` |
| Request SHA256 | `76efd1280d0df63faa5de9680e3afad82e70f151db82b780fd2dc921d708c228` |
| Log bruto MCP SHA256 | `c7fd561530a6fb0965e6b117d32e9de67067fde1b9e6a707bd2b48b8e3ef588d` |

O snapshot difere do produto somente em `.ci-run.json`, conforme o compare registrado no [ledger de produto](product-tests.json). O controle Omni foi `not applicable (focused: no declaring test ran)`: nenhum spawn ou cadeia nativa foi demonstrado. Não há artefato obrigatório ausente atribuído como aprovação.

## Dois timeouts preservados

| Teste | Tempo reportado | Limite configurado | Última fase registrada no deadline |
| --- | ---: | ---: | --- |
| `renewal-choice-history.test.ts` | 180034.05 ms | 180000 ms | `threshold-after:start` |
| `renewal-choice-revision.test.ts` | 196569.25 ms | 180000 ms | `prepare:transition-confirmed:complete` |

O trace de `renewal-choice-history` iniciou `threshold-after:start` em 126519 ms e registrou o deadline em 180030 ms. O teste não concluiu essa jornada. O trace do teste de revisão registrou `prepare:transition-confirmed:complete` em 133559 ms; no deadline em 196567 ms esse ainda era o último marcador. Esse marcador identifica a última fase emitida, não mede isoladamente todo o trabalho executado depois dela.

O tempo reportado de 196569,25 ms não é um novo limite autorizado: ambos os testes continuam configurados com 180000 ms e o log registra timeout após esse limite. O request geral conserva `--timeout 120000`; os dois testes longos mantêm seus limites explícitos de 180000 ms. Não houve aumento de timeout ou remoção de assertions.

## Casos observados

| Arquivo | Resultado | Tempo reportado |
| --- | --- | ---: |
| `current-choice-read-fence.test.ts` — current-choice read suppresses its binding when membership changes during the final case authorization | pass | 122.87 ms |
| `current-choice-read-fence.test.ts` — current-choice read suppresses its binding when preferences read changes during the final case authorization | pass | 63.48 ms |
| `renewal-source-admission.test.ts` — empty-source admission observes two authenticated projections and refuses a static reference after a real Planner edit | pass | 62.60 ms |
| `renewal-source-admission.test.ts` — empty-source admission refuses second-source-resolve before its final projection | pass | 41.91 ms |
| `renewal-source-admission.test.ts` — empty-source admission refuses last-revalidate-source-change before its final projection | pass | 42.69 ms |
| `renewal-source-admission.test.ts` — empty-source admission refuses last-revalidate-revocation before its final projection | pass | 50.80 ms |
| `renewal-source-admission.test.ts` — empty-source admission refuses authority revoked by its final authentication callback | pass | 44.73 ms |
| `renewal-source-admission.test.ts` — empty-source admission refuses mismatched scope, projection fields, digest and source period | pass | 41.97 ms |
| `renewal-source-admission.test.ts` — nonempty operations retain the canonical target verifier and never write the real source | pass | 76.75 ms |
| `renewal-read-scope.test.ts` — renewal admission verifies operations and source-only alternatives without changing any durable snapshot | pass | 60.10 ms |
| `renewal-read-scope.test.ts` — a later renewal admission observes a canonical source edit instead of reusing the earlier read scope | pass | 42.73 ms |
| `renewal-read-scope.test.ts` — renewal admission refuses a UI lease revoked during an awaited source callback inside the read scope | pass | 59.87 ms |
| `current-choice-lifecycle.test.ts` — a current quote replays the same historical choice, requires a separate human promotion, and survives reopen without applying Planner operations | pass | 70042.47 ms |
| `renewal-choice-history.test.ts` — the same durable choice preserves omitted training while a confirmed source revision reverses cost and criterion | fail | 180034.05 ms |
| `renewal-choice-revision.test.ts` — new human operations replace a choice after the quote revision and retain that choice with a new reason without rewriting any history | fail | 196569.25 ms |
| `implementation-quote-history.test.ts` — a confirmed implementation quote of 70000 yields 235000 and 5000 advantage in the same case while preserving shared scope and the human choice | pass | 113051.04 ms |

Os 12 casos diretos de leitura, admissão de fonte e escopo passaram. Também passaram o ciclo de vida da escolha atual (70042,47 ms) e a implantação confirmada de 70000 (113051,04 ms). Esses resultados qualificam apenas os comportamentos exercitados no W32/S22. Não validam os dois históricos interrompidos nem bytes posteriores do helper.

## Limite da comparação com S19

S19, run [43594791351](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594791351), usou W `bd168e193e7bb4a43893c24c5370c9c3fa205fc1` e S `823311ee83c6a28273bc8d63bb1157e9bdcb01e7`. Nesse recorte, os mesmos históricos passaram em 146843,85 ms e 124684,11 ms. Os passes e as falhas posteriores são mantidos com seus próprios pins.

- Em S19, `planner.verifySourceOnly` era medido dentro da transação externa de leitura. A abertura e a decodificação da transação externa ficavam fora desse timer.
- Em S22, o timer de mesmo nome envolve a admissão sem operações, incluindo duas transações raiz frescas. O timer `planner.verifySourceProjection` está aninhado nesse intervalo.
- Portanto, esses elapsedMs não medem o mesmo trecho. Somá-los, subtraí-los ou comparar razões não isola uma causa de regressão. Os tempos aninhados também se sobrepõem.
- As observações estabelecem dois timeouts no produto W32; não estabelecem por si só uma causa única. Este documento não revisa nem valida o patch de desempenho em preparação.

## Próxima prova exigida

Uma mudança delimitada deve preservar a autorização canônica, os fences de fonte, as assertions e os limites existentes, ser publicada com W/tree exatos e receber a seleção Actions afetada. O novo resultado pertence ao seu W/S; S22 continuará registrado como falha histórica. Provas instaladas/nativas, C/D e o aceite integral permanecem abertos.

O [JSON correspondente](s22-findings.json) preserva os 16 resultados individuais, os dois traces de deadline, o request, o controle Omni, os hashes e as fronteiras desta análise.
