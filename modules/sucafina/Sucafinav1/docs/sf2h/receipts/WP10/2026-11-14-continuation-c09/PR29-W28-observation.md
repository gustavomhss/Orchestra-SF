## WP10 — W28 composto; provas dirigidas em execução

Continuação da mesma branch e PR a partir de W27, preservando todos os commits e recibos. **PR permanece draft e sem aceite global.** W28 adota a proposta publicada diagnose-calculation PR59 e acrescenta provas próprias de C09→C17 e submit forecast. Nenhum teste de produto foi executado localmente.

| Identidade | Pin / estado |
| --- | --- |
| Produto W28 | [`90f2c4f81f74edc26a1783bfda7891638b429fa6`](https://github.com/gustavomhss/Orchestra-SF/commit/90f2c4f81f74edc26a1783bfda7891638b429fa6) |
| Tree | `232c69db4eed34e913f125bb787b926971d6d031` |
| Pai W27 | `ab8fb4f29d078d179742a77679ef85e5c549b114` |
| C28 | [run 43627315630](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627315630); S `8dedb1fa71a0805505e50eda8c0a038de79276a8`; **em voo, sem resultado atribuído** |
| CHECK28 | [run 43627330840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627330840); S `66d3a7fc3160a54aad1766e096a6b4cb397ab82b`; **em voo** |

### Revisões reconciliadas

| Finding | Origem/composição e ação |
| --- | --- |
| FIN-IND-001 | Callback `verifyScenarioOperations` instalado em `87f7317d5f983adb255a5707b65d6f07bfa5a0d4`, preservado. A27 passou os casos analysis-services com autoridade/readers reais e produtor/verificador de análise declarado como fixture. A nova prova usa a leitura C09 real; preparação completa de forecast pelo Planner continua distinta. |
| FIN-IND-002 | A revisão PR50 analisou candidato `4f82cf10ae6766c56e9bf1862fc5198a5246cb5c` com produtor `{host,cases}` (blob `3cff741ce7dd96b7fdec8ac803e3b27c6170a463`). O produtor instalado usa `{host,state,authorizeCase,authorizeEvidence}` (blob `41741c5131ea66242c881126c22c6d03cfd9c3c3`) e o caller corresponde. Não foi adicionada propriedade obsoleta. C28 prova o caminho real instalado, sem reader permissivo. |
| FIN-IND-003 | Prefixo privado `sf:portfolio:campaign:` já presente desde `d41ea01b8d9aa068301c1643c1ec3dc088900533`. C28 reexecuta o arquivo existente de autoridade porque migração/guard do provider mudaram após W1. Nenhuma reimplementação. |
| CR-C11-001 | Observation instalada em `c3b02c7693c1ff3b702596c7c8458f913972a404`. Quatro casos específicos passaram em [A21 / 43604032487](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43604032487). Seis blobs relevantes são idênticos a W27; não se repete o teste. O run completo histórico continua failure. |
| FIN-IND-004 | `forecast-analysis.ts` é byte-idêntico a `astra-wp12@ba27411a7cda9301aa162680a94153a5e643be4d`, blob `973a2f09b394426364c514b923ecdc8e10ffb184`. Preservado. Novo teste próprio de click/Enter usa renderer/script/shell/browser e catálogo reais, com fronteira HTTP de UI explicitamente fixture. U28 aguarda o término de C28; nenhum resultado nativo/AM05 é inferido. |

A prova C09 cobre caso/evento válido, resolver/continuity reais, versão atual do caso maior que a do evento, identidade original, fonte histórica, referência forjada/substituição física, revogação dentro do lease, nova admissão, replay e reabertura. O ledger sintético é gravado por C08/outbox reais; não equivale a uma jornada financeira integral.

### Intake do diagnóstico de cálculo

PR59 `e80fdc933dfd25956a50c22dea76bf077e79815b` foi conferida contra os preimages W27 e aplicada exatamente em `source-lifecycle.ts` e `planner-sources.ts`. A preparação recebe clone isolado, o kernel de observação/materialização permanece, as duas observações atuais continuam e todas as autenticações/revalidações são mantidas. O sinal do Request acompanha a transação.

C28 inclui a comparação estrutural fallback/novo caminho: **4→2 transações de fonte, 6 autenticações diretas e 4 revalidações**, igualdade/digest, nova observação a cada chamada, ABA, revogação e abort. Isso ainda não comprova ganho de latência. Só após esse gate e os três arquivos completos de source fences passarem será admitido um sucessor X, com os mesmos asserts e budgets 285/300s. Nenhum A27/X27 foi repetido sem discriminante.

### Runs anteriores reanexados e preservados

| Corte original W27 | Terminal real |
| --- | --- |
| [CHECK27 / 43623374771](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43623374771) | **FAIL**, zero diagnósticos próprios / 13 estrangeiros: WP04=3, WP06=4, WP08=5, WP09=1. CLI, WP10 tests, Atlas e guards passaram em seus escopos. Artifact `14125043272`. |
| [X27 / 43623440133](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43623440133) | **FAIL**, 0 pass / 1 fail, 3 expects, 285,57s. Abort no binding/primeira verificação; recertificações posteriores/reload/retry/revogação não alcançados. Cleanup success. |
| [A27 / 43624030665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624030665) | **FAIL**, 59 pass / 1 fail, 1.447 expects, 60 testes / 8 arquivos, 297,68s. `historical-memory.test.ts:580:103`: stale consumer devolve ok para registro corrompido, depois de Atlas recusá-lo. Assertion, não timeout. Cleanup success. |
| [R27 / 43624794783](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624794783) | **FAIL**, 34 pass / 13 fail, 839 expects, 47 testes / 10 arquivos, 1052,08s. Test job `132538121932`, cleanup `132543694722` success, artifacts `[]`, Omni not applicable. |

R27: seis setups bi-call-scope e um bi-case-access divergem na ordem da evidência; quatro lifecycle recebem403 em choices; um teste de lease tem contador0; Review focus excede transporte10s com handlers200 em≈13,65s. Os probes posteriores não foram alcançados; essas 13 falhas não são 13 defeitos de autorização comprovados.

A27/X27/R27 permanecem associados aos seus W/S originais. Logs, hashes, requests, jobs, artefatos e comparações foram preservados. O término de CI não prova término da sessão anterior; a escrita usa head esperado com fast-forward, sem disputa contra autor comprovadamente ativo.

### Pendências exatas preservadas

- Memory PR55 `0d7fb6f12ed053340391ff6e4f95b6f3c1276ea8` consultada; proposta não aplicada. Falha de integridade A27 e cauda de revogação abertas, sem nova investigação duplicada do timeout.
- X completo e seus guards financeiros; ancestry próprio e composição WP11 B26 continuam sem qualificação terminal positiva.
- H05 WP04/WP11 (avanço não interferente de versão), Freeze10 37/38 e cohort CurrentChoice de PR35 **retido**. O hold deste cohort não é atribuído ao runtime instalado.
- BI/Review R27; seleções browser/CLI/D/P/Q pendentes do handoff; 13 diagnósticos estrangeiros exigem entregas compatíveis dos owners.
- Task real com nome/input gravado, cadeia Relay/governança C07, resolver público de anchors e Session real, admissão/ocorrência/owner de Watch e suas demais condições; nove operações nativas, cinco callables, AM/GNATIVE e jornadas instaladas não vazias continuam sem aceite integral.
- C17 headers entre observações externas permanece constatação estática estrangeira; distinto de falha runtime observada.
- **171 critérios, sete tasks, 80 obrigações**, inputs estrangeiros congelados e histórico integral preservados. Ainda faltam três pareceres **FINAL** independentes no candidato terminal. Preflights aqui não recebem esse crédito. Sem FINAL W/D ou GLOBAL_RELEASE.

[Recibos desta continuação](https://github.com/gustavomhss/Orchestra-SF/tree/90f2c4f81f74edc26a1783bfda7891638b429fa6/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-continuation-c09/) · [Corpo anterior da PR preservado](https://github.com/gustavomhss/Orchestra-SF/blob/90f2c4f81f74edc26a1783bfda7891638b429fa6/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-continuation-c09/prior-PR29-body.md)

Handoff `a3d29d011ba3607a57914701300f09117a3e2de9`; plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campanha SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.

**S0 revisa e integra. Sem merge, epic/full suite, deploy ou alterações Maestro/Relay/Schedule.**
