# Handoff — finish-threads-20261119

SHA: 31ae9203558caab93f7718be422365fc1eb08666 (último código; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- `test/product/wp08/handoff-boundaries.test.ts`: substituído o host que copiava snapshots manualmente pela fixture SQLite e pelo binder real de identidade de fonte já integrado em `wp02/hot-topic-host-fixture.ts`. As quatro provas continuam cobrindo resposta perdida após commit, revogação antes da ação, readback de outro registro e vínculo explícito sem alteração do registro.
- `test/product/wp08/answer-evidence.test.ts`, `persistence.test.ts` e `reissue.test.ts`: requests estáveis para os mesmos atores já declarados nas fixtures. O contrato atual de threads revalida a identidade do Request inicial; criar outro Request em cada chamada fazia as fixtures falharem antes de suas provas de negócio.
- Mantidas as provas de claim humano, corpo/autor/data, edição histórica e versões, persistência e retry após reabertura, autorização por ator, negação de evidência fora do período, revogação, mudança de conteúdo, remoção e reincarnação da fonte, CAS e retirada do grant humano antes do commit.
- [Run 44570928786](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44570928786): success; job 135725435916 e cleanup 135726824774. 10 pass / 0 fail / 92 expect() calls, quatro arquivos, 802 ms.

## Pendente

- Nenhum item unbound nos quatro arquivos corrigidos. Os dois casos de `test/product/wp08/thread-period-continuity.test.ts:17` continuam em investigação separada de custo das fases; não estão alterados nem qualificados por este branch.

## Decisões e justificativas

- Asserções removidas: nenhuma. Os quatro arquivos conservam suas 93 chamadas estáticas de `expect`; o run executou 92 expectativas por seus ramos condicionais.
- Em `persistence.test.ts:50` e `:51`, a expectativa antiga de status `unavailable` após revogação foi atualizada para o objeto completo `{ status: "denied", reason: "thread-access-unavailable" }`, conforme `product/collaboration/threads.ts` e o encaminhamento de `question-source.ts`. A prova continua exigindo negação e ausência de payload.
- Nenhuma concessão, principal ou política foi adicionada. As fixtures de componentes continuam explicitando seus atores; não são apresentadas como prova de autenticação de instalação completa.
- Não foram alterados produtores, `runtime/application.ts`, workflows, suites, baselines, coverage ou receipts. Nenhum timeout aumentado ou teste pulado.
- O diagnóstico de duração de continuity está somente em snapshot descartável de CI, não neste branch.

## Como retomar

1. Revisar e integrar `finish-threads-20261119` a partir de `31ae9203558caab93f7718be422365fc1eb08666` sobre a base `d3de8477cd26bd98ffff7a030d8328ee403f37da`.
2. Se uma alteração relevante exigir repetição, criar atomicamente uma branch `ci-run-linux-*` com runner Bun, package `sucafina`, args dos quatro arquivos em `Sucafinav1/test/product/wp08/`.
3. Continuar separadamente a investigação de `thread-period-continuity.test.ts`, preservando seus limites e contratos.

## Comandos e resultados

- `bun typecheck` (app-shell): não rodado nesta fatia Bun.
- `bun run check:guards --base origin/dev`: não rodado; sem declaração de guards PASS.
- Diagnóstico inicial [44569552960](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44569552960), snapshot `b8ce2c039c1dae7418f043e7382ee56f2cf0ecbb` sobre `f94dde9e8b1a4d363806f7a54fe6ae86b69c30e8`: 7 pass / 8 fail / 129 expect em sete arquivos. Seis das falhas eram dos quatro arquivos aqui corrigidos; as outras duas são continuity.
- Gate corretivo `test-ci` [44570928786](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44570928786), snapshot `3ef7df93db09586bdd16f1d5afe6d169dd889415`, parent de código `31ae9203558caab93f7718be422365fc1eb08666`: success, 10 pass / 0 fail / 92 expect.
- Request exato: `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp08/handoff-boundaries.test.ts","Sucafinav1/test/product/wp08/answer-evidence.test.ts","Sucafinav1/test/product/wp08/persistence.test.ts","Sucafinav1/test/product/wp08/reissue.test.ts"]}`.
- Alteração posterior ao gate: apenas este handoff.
