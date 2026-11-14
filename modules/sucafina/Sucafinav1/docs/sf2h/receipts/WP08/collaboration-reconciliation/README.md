# WP08 — reconciliação integral dos 132 critérios

A PR #28 foi reaproveitada no grupo #33. Este recibo preserva os 132 IDs e textos canônicos, os resultados anteriores e os onze inputs estrangeiros arquivados. Não aceita WP08 integralmente antes das provas correntes e dos consumidores externos.

## Estado concreto

CI04 executou `ea5a6f965c803d436202934872c3650ab8f8eb19`, tree `8535b4ffdbbeee8549bc8820fec2551fa6cf9d09`, snapshot `c03b06bea510e0ed8ec8df105c269304d388317f`, run 43584357490: 42 pass / 2 fail em 17 arquivos. As quatro falhas WP08 da CI03 foram corrigidas e passaram. First-confirm HTTP e closure→ação concluída→Meu trabalho passaram. A falha WP08 restante era tentativa de reutilizar um grant UI permanentemente revogado; o incremento12 acrescenta nova admissão e mantém o negativo do antigo. Check03, run 43584368239: 74 diagnósticos (69 externos e 5 tipos literais de teste, estes corrigidos no incremento12); guards com 78 regras, 832 paths e 0 erros.

## Comportamento próprio ainda em execução

O contexto de closure C05 na mesma linha canônica já foi implementado e passou no teste real de WP07. A auditoria encontrou uma obrigação própria distinta: perguntas/discussões sobre revisão preservada precisam guardar pin C05 explícito, além de fontes de domínio originais. O incremento12 implementa esse comportamento com produtor C05 real, pin protegido em cada mensagem, ACL e fence na leitura e no commit, sem referência BusinessEvidenceRef inventada. A prova própria no Actions permanece pendente. A confirmação genérica de resposta C05 é recusada com motivo explícito; o incremento13 implementará o observer e o ciclo de confirmação/reuso C05 próprio. Essa recusa não fecha o comportamento solicitado e não será promovida a bloqueio externo. As demais correções qualificadas são oráculos/tipos de teste; não são encobertas por bloqueio global.

## Limites de produção

- O mount real ainda não fornece recipientAuthority/checkAtCommit. As fixtures usam atores independentemente admitidos e leases explícitos; não conferem permissão ao destinatário por inferência.
- O producer `createSfRecordHistory` publicado em compose 7c/8f foi lido: possui captura Atlas protegida e currentRef, mas exige período atual igual ao original. H04 precisa emissão autoritativa do novo período; C06 também precisa entrada de captura quando não existir Atlas/C12. As fronteiras injetadas dos testes H04 permanecem explícitas, mesmo após os casos passarem.
- C06 preserva cada período original. O consumidor de rollover usa somente currentRef histórico autorizado, checa fresh atual, física e fence; não infere data pelo tipo. Resposta nova tem base própria e confirmação antiga não migra.
- Transporte native/Relay/SessionV2/SkillLoadReceipt, UI geral montada, C11 e a campanha S0 não são substituídos pelos adapters/fixtures.
- O produtor Dashboard precisa normalizar o scope exibido: All Projects e Portfolio Dashboard geram scoped incarnations diferentes, e o receipt exato recusa a troca silenciosa.

## Mapa completo

| Critério | Estado corrente | Testes novos/afetados | Dependências/pendências |
|---|---|---|---|
| WP08.DOD.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, handoff-shared-dispatch.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, PROCUREMENT, CURRENT_GATE |
| WP08.DOD.02 | CURRENT_HEAD_VALIDATION_PENDING | closure-work.test.ts, handoff-relation-continuity.test.ts, work-review-context.test.ts | OWN_CONTEXT, CURRENT_GATE |
| WP08.DOD.03 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, answer-first-confirm-http.test.ts, collaboration-http.test.ts, recipient-human-actions.test.ts, thread-actors.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_RECIPIENT, PROD_HISTORY, QUESTION_CASE, PROCUREMENT, CURRENT_GATE |
| WP08.DOD.20 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | NORMALIZED_CONFIRMATION_SCOPE, DOMAIN_PRODUCERS, ROUTINE, CURRENT_GATE |
| WP08.DOD.10 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.INV.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-official-source.test.ts, confirmation-real-dependencies.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts, recipient-human-actions.test.ts, thread-actors.test.ts | DOMAIN_PRODUCERS, CURRENT_GATE |
| WP08.INV.02 | CURRENT_HEAD_VALIDATION_PENDING | relations-value-time.test.ts | CURRENT_GATE |
| WP08.INV.20 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | NORMALIZED_CONFIRMATION_SCOPE, DOMAIN_PRODUCERS, ROUTINE, CURRENT_GATE |
| WP08.INV.10 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.QLT.01 | OWN_CURRENT_PROOF_PENDING | closure-work.test.ts, review-thread-context.test.ts, answer-evidence.test.ts, handoff-relation-continuity.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts, work-review-context.test.ts | OWN_CONTEXT, OWN_C05_DISCUSSION, PROD_HISTORY, UI, CURRENT_GATE |
| WP08.QLT.02 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.QLT.20 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-real-dependencies.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | UI, CURRENT_GATE |
| WP08.QLT.10 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.CMP.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, confirmation-real-dependencies.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, DOMAIN_PRODUCERS, CURRENT_GATE |
| WP08.CMP.02 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, DOMAIN_PRODUCERS, PROCUREMENT, CURRENT_GATE |
| WP08.CMP.03 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | PROCUREMENT |
| WP08.CMP.04 | CURRENT_HEAD_VALIDATION_PENDING | recipient-human-actions.test.ts, thread-actors.test.ts | PROD_RECIPIENT, QUESTION_CASE, PROCUREMENT, CURRENT_GATE |
| WP08.CMP.20 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | DOMAIN_PRODUCERS, CURRENT_GATE |
| WP08.CMP.10 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.SUC.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, PROCUREMENT, UI, CURRENT_GATE |
| WP08.SUC.02 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | PROCUREMENT, UI |
| WP08.SUC.20 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-scope-reader.test.ts | ROUTINE, UI, CURRENT_GATE |
| WP08.SUC.10 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T01.CHK.01 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T01.CHK.02 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T01.CHK.03 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T01.CHK.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T01.DOD.01 | CURRENT_HEAD_VALIDATION_PENDING | relations-value-time.test.ts | CURRENT_GATE |
| WP08.T01.DOD.02 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  |  |
| WP08.T01.DOD.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T01.INV.01 | CURRENT_HEAD_VALIDATION_PENDING | relations-value-time.test.ts | CURRENT_GATE |
| WP08.T01.INV.02 | CURRENT_HEAD_VALIDATION_PENDING | relations-value-time.test.ts | DOMAIN_PRODUCERS, CURRENT_GATE |
| WP08.T01.INV.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T01.QLT.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.T01.QLT.02 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.T01.QLT.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T01.CMP.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | PROCUREMENT |
| WP08.T01.CMP.02 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T01.CMP.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T01.SUC.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.T01.SUC.02 | CURRENT_HEAD_VALIDATION_PENDING | relations-value-time.test.ts | UI, CURRENT_GATE |
| WP08.T01.SUC.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T02.CHK.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, CURRENT_GATE |
| WP08.T02.CHK.02 | CURRENT_HEAD_VALIDATION_PENDING | recipient-human-actions.test.ts, thread-actors.test.ts | PROD_RECIPIENT, CURRENT_GATE |
| WP08.T02.CHK.03 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, CURRENT_GATE |
| WP08.T02.CHK.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T02.DOD.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-first-confirm-http.test.ts, collaboration-http.test.ts | CURRENT_GATE |
| WP08.T02.DOD.02 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, CURRENT_GATE |
| WP08.T02.DOD.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T02.INV.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-official-source.test.ts | CURRENT_GATE |
| WP08.T02.INV.02 | CURRENT_HEAD_VALIDATION_PENDING | recipient-human-actions.test.ts, thread-actors.test.ts | PROD_RECIPIENT, CURRENT_GATE |
| WP08.T02.INV.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T02.QLT.01 | OWN_CURRENT_PROOF_PENDING | review-thread-context.test.ts, answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | OWN_C05_DISCUSSION, PROD_HISTORY, UI, CURRENT_GATE |
| WP08.T02.QLT.02 | CURRENT_HEAD_VALIDATION_PENDING | recipient-human-actions.test.ts, thread-actors.test.ts | PROD_RECIPIENT, UI, CURRENT_GATE |
| WP08.T02.QLT.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T02.CMP.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, CURRENT_GATE |
| WP08.T02.CMP.02 | OWN_IMPLEMENTATION_IN_PROGRESS | review-thread-context.test.ts, answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | OWN_C05_CONFIRMATION_REUSE, OWN_C05_DISCUSSION, PROD_HISTORY, CURRENT_GATE |
| WP08.T02.CMP.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T02.SUC.01 | OWN_CURRENT_PROOF_PENDING | review-thread-context.test.ts, answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | OWN_C05_DISCUSSION, PROD_RECIPIENT, PROD_HISTORY, UI, CURRENT_GATE |
| WP08.T02.SUC.02 | CURRENT_HEAD_VALIDATION_PENDING | answer-evidence.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | PROD_HISTORY, UI, CURRENT_GATE |
| WP08.T02.SUC.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T03.CHK.01 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-scope-reader.test.ts | ROUTINE, CURRENT_GATE |
| WP08.T03.CHK.02 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | CURRENT_GATE |
| WP08.T03.CHK.03 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-real-dependencies.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | CURRENT_GATE |
| WP08.T03.CHK.04 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | ROUTINE, CURRENT_GATE |
| WP08.T03.CHK.05 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | DOMAIN_PRODUCERS, CURRENT_GATE |
| WP08.T03.DOD.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-first-confirm-http.test.ts, collaboration-http.test.ts, confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | NORMALIZED_CONFIRMATION_SCOPE, CURRENT_GATE |
| WP08.T03.DOD.02 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-scope-reader.test.ts | CURRENT_GATE |
| WP08.T03.INV.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  |  |
| WP08.T03.INV.02 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-real-dependencies.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | CURRENT_GATE |
| WP08.T03.INV.03 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | DOMAIN_PRODUCERS, CURRENT_GATE |
| WP08.T03.QLT.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.T03.QLT.02 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.T03.CMP.01 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | NORMALIZED_CONFIRMATION_SCOPE, DOMAIN_PRODUCERS, CURRENT_GATE |
| WP08.T03.CMP.02 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-real-dependencies.test.ts, confirmation-scope-reader.test.ts, confirmation-source-lifecycle.test.ts, confirmation-work-integration.test.ts | CURRENT_GATE |
| WP08.T03.SUC.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.T03.SUC.02 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-scope-reader.test.ts | PROD_HISTORY, ROUTINE, UI, CURRENT_GATE |
| WP08.T04.CHK.01 | CURRENT_HEAD_VALIDATION_PENDING | closure-work.test.ts, handoff-relation-continuity.test.ts, work-review-context.test.ts | OWN_CONTEXT, CURRENT_GATE |
| WP08.T04.CHK.02 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T04.CHK.03 | CURRENT_HEAD_VALIDATION_PENDING | recipient-human-actions.test.ts, thread-actors.test.ts | PROD_RECIPIENT, CURRENT_GATE |
| WP08.T04.CHK.04 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | PROCUREMENT |
| WP08.T04.CHK.20 | CURRENT_HEAD_VALIDATION_PENDING | confirmation-integration.test.ts, confirmation-scope-reader.test.ts | CURRENT_GATE |
| WP08.T04.CHK.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T04.DOD.01 | CURRENT_HEAD_VALIDATION_PENDING | recipient-human-actions.test.ts, thread-actors.test.ts | PROCUREMENT, CURRENT_GATE |
| WP08.T04.DOD.02 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T04.DOD.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T04.INV.01 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T04.INV.02 | CURRENT_HEAD_VALIDATION_PENDING | recipient-human-actions.test.ts, thread-actors.test.ts | PROD_RECIPIENT, CURRENT_GATE |
| WP08.T04.INV.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T04.QLT.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | PROCUREMENT, UI |
| WP08.T04.QLT.02 | CURRENT_HEAD_VALIDATION_PENDING | closure-work.test.ts, handoff-relation-continuity.test.ts, work-review-context.test.ts | OWN_CONTEXT, UI, CURRENT_GATE |
| WP08.T04.QLT.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T04.CMP.01 | CURRENT_HEAD_VALIDATION_PENDING | recipient-human-actions.test.ts, thread-actors.test.ts | CURRENT_GATE |
| WP08.T04.CMP.02 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T04.CMP.03 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | PROCUREMENT |
| WP08.T04.CMP.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T04.SUC.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | PROCUREMENT, UI |
| WP08.T04.SUC.02 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | PROCUREMENT, UI |
| WP08.T04.SUC.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T05.CHK.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  |  |
| WP08.T05.CHK.02 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T05.CHK.03 | CURRENT_HEAD_VALIDATION_PENDING | closure-work.test.ts, handoff-relation-continuity.test.ts, work-review-context.test.ts | OWN_CONTEXT, PROD_HISTORY, CURRENT_GATE |
| WP08.T05.CHK.18 | CURRENT_HEAD_VALIDATION_PENDING | handoff-shared-dispatch.test.ts | NATIVE, CURRENT_GATE |
| WP08.T05.DOD.01 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T05.DOD.02 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T05.DOD.18 | CURRENT_HEAD_VALIDATION_PENDING | handoff-shared-dispatch.test.ts | NATIVE, CURRENT_GATE |
| WP08.T05.INV.01 | CURRENT_HEAD_VALIDATION_PENDING | handoff-shared-dispatch.test.ts | CURRENT_GATE |
| WP08.T05.INV.02 | CURRENT_HEAD_VALIDATION_PENDING | handoff-shared-dispatch.test.ts | CURRENT_GATE |
| WP08.T05.INV.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T05.QLT.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.T05.QLT.02 | CURRENT_HEAD_VALIDATION_PENDING | closure-work.test.ts, handoff-relation-continuity.test.ts, work-review-context.test.ts | OWN_CONTEXT, PROD_HISTORY, UI, CURRENT_GATE |
| WP08.T05.QLT.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T05.CMP.01 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T05.CMP.02 | CURRENT_HEAD_VALIDATION_PENDING | closure-work.test.ts, handoff-relation-continuity.test.ts, work-review-context.test.ts | OWN_CONTEXT, DOMAIN_PRODUCERS, PROCUREMENT, CURRENT_GATE |
| WP08.T05.CMP.18 | CURRENT_HEAD_VALIDATION_PENDING | handoff-shared-dispatch.test.ts | NATIVE, CURRENT_GATE |
| WP08.T05.SUC.01 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  | UI |
| WP08.T05.SUC.02 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | UI |
| WP08.T05.SUC.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T06.CHK.01 | PRESERVED_PRIOR_PROOF_WITH_EXPLICIT_LIMITS |  |  |
| WP08.T06.CHK.02 | CURRENT_HEAD_VALIDATION_PENDING | answer-official-source.test.ts | QUESTION_CASE, CURRENT_GATE |
| WP08.T06.CHK.03 | OWN_IMPLEMENTATION_IN_PROGRESS | answer-first-confirm-http.test.ts, collaboration-http.test.ts, confirmation-integration.test.ts, confirmation-scope-reader.test.ts | OWN_C05_CONFIRMATION_REUSE, ROUTINE, CURRENT_GATE |
| WP08.T06.CHK.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T06.DOD.01 | OWN_IMPLEMENTATION_IN_PROGRESS | answer-evidence.test.ts, answer-first-confirm-http.test.ts, collaboration-http.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | OWN_C05_CONFIRMATION_REUSE, PROD_RECIPIENT, PROD_HISTORY, QUESTION_CASE, CURRENT_GATE |
| WP08.T06.DOD.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | QUESTION_CASE, NATIVE |
| WP08.T06.INV.01 | CURRENT_HEAD_VALIDATION_PENDING | answer-official-source.test.ts, recipient-human-actions.test.ts, thread-actors.test.ts | QUESTION_CASE, CURRENT_GATE |
| WP08.T06.INV.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T06.QLT.01 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | QUESTION_CASE, UI |
| WP08.T06.QLT.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T06.CMP.01 | OWN_IMPLEMENTATION_IN_PROGRESS | answer-evidence.test.ts, answer-official-source.test.ts, recipient-human-actions.test.ts, thread-actors.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | OWN_C05_CONFIRMATION_REUSE, PROD_RECIPIENT, PROD_HISTORY, QUESTION_CASE, CURRENT_GATE |
| WP08.T06.CMP.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |
| WP08.T06.SUC.01 | OWN_IMPLEMENTATION_IN_PROGRESS | answer-evidence.test.ts, answer-first-confirm-http.test.ts, collaboration-http.test.ts, confirmation-integration.test.ts, confirmation-scope-reader.test.ts, thread-context.test.ts, thread-history-continuity.test.ts, thread-history-supplements.test.ts, thread-period-continuity.test.ts | OWN_C05_CONFIRMATION_REUSE, PROD_HISTORY, QUESTION_CASE, ROUTINE, UI, CURRENT_GATE |
| WP08.T06.SUC.18 | PARTIAL_WITH_IDENTIFIED_DEPENDENCIES |  | NATIVE |

O JSON guarda o texto literal de cada critério, a prova anterior integral, paths, consumidores, referências novas e limites por cenário. Todas as tasks permanecem sujeitas aos critérios completos; nenhuma foi reduzida.
