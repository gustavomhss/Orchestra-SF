## WP10 — W29; C09 aprovado, gates de fontes aprovados, X29 em voo

Continuação da mesma branch/PR, preservando o histórico. **PR draft; não há aceite global.** W28 compôs o diagnóstico PR59 em dois arquivos próprios e acrescentou provas C09/UI. W29 corrigiu somente os testes novos (oracle pós-revogação e anotações de tipo). Os dois arquivos de produto e C09 permaneceram idênticos. Sem testes de produto locais.

| Identidade / gate | Pin / resultado real |
| --- | --- |
| Produto W29 | [`813806af6c2ce74b2a087139c544e90dd1adcbe4`](https://github.com/gustavomhss/Orchestra-SF/commit/813806af6c2ce74b2a087139c544e90dd1adcbe4), tree `06db6b04ee6bdb2af26b71d0b4031d769b76d219` |
| Pai W28 | `90f2c4f81f74edc26a1783bfda7891638b429fa6` |
| [C28 / 43627315630](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627315630) | W28, S `8dedb1fa71a0805505e50eda8c0a038de79276a8`; **FAIL 8/1, 136expects, 9testes/3files**. **C09 2/2 e autoridade5/5 PASS**; único fail no oracle novo de contagem depois de revogar. Cleanup success. |
| [CHECK28 / 43627330840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627330840) | **FAIL**,13externos+3próprios de testes. Mantido como failure. |
| [C29 / 43628006308](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628006308) | W29, S `d33cc53660250bde7bfb19a26401f4c722fe4875`; **FAIL3/3,36expects,6testes/4files,42,39s**. Cálculo2/2PASS; startupPASS; UI timeout30s +segunda aquisição recusada +finalizador com invariantesfail. Processo físico terminou; cleanup success. |
| [CHECK29 / 43628024706](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628024706) | W29, S `92319dad2957a023cf1a7c9cfe0e03e77e2242af`; **FAIL apenas13externos; zero próprios**. WP10 tests/CLI/Atlas/typegen/spawn/guards PASS. Artifact14127078300. |
| [F29 / 43628418430](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628418430) | W29, S `e71d4beacdc1309c1affa571454809dce172b8c1`; **PASS10/0,132expects,10testes/3files,1.044ms**. Cleanup success; artifacts[]. |
| [X29 / 43628663680](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628663680) | W29, S `d356d543298835b09b0452777fbd76cdaea77c85`; **em voo, nenhum resultado atribuído**. Único novo run longo após os gates estruturais/fontes. |

C28 preserva request original e ordem real observada. C29/F29/X29 usam paths literais `./` conforme `script/test-ci-paths.ts`; ordem de startup→consumidores→lifecycle confirmada em C29. Cada S altera só seu envelope, e nenhum test-ci se sobrepõe a outro test-ci WP10.

### Revisões reconciliadas

| Finding | Origem/composição e ação |
| --- | --- |
| FIN-IND-001 | Callback `verifyScenarioOperations` instalado em `87f7317d5f983adb255a5707b65d6f07bfa5a0d4`, preservado. A27 passou os casos analysis-services com autoridade/readers reais e produtor/verificador de análise declarado como fixture. Os dois casos C09 passaram em C28 com a leitura canônica real; preparação completa de forecast pelo Planner continua distinta. |
| FIN-IND-002 | A revisão PR50 analisou candidato `4f82cf10ae6766c56e9bf1862fc5198a5246cb5c` com produtor `{host,cases}` (blob `3cff741ce7dd96b7fdec8ac803e3b27c6170a463`). O produtor instalado usa `{host,state,authorizeCase,authorizeEvidence}` (blob `41741c5131ea66242c881126c22c6d03cfd9c3c3`) e o caller corresponde. Não foi adicionada propriedade obsoleta. Os dois casos C28 passaram pelo caminho real instalado, sem reader permissivo. |
| FIN-IND-003 | Prefixo privado `sf:portfolio:campaign:` já presente desde `d41ea01b8d9aa068301c1643c1ec3dc088900533`. Os cinco casos do arquivo existente de autoridade passaram em C28, recheck justificado pelas mudanças de migração/guard após W1. Nenhuma reimplementação. |
| CR-C11-001 | Observation instalada em `c3b02c7693c1ff3b702596c7c8458f913972a404`. Quatro casos específicos passaram em [A21 / 43604032487](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43604032487). Seis blobs relevantes são idênticos a W27; não se repete o teste. O run completo histórico continua failure. |
| FIN-IND-004 | `forecast-analysis.ts` é byte-idêntico a `astra-wp12@ba27411a7cda9301aa162680a94153a5e643be4d`, blob `973a2f09b394426364c514b923ecdc8e10ffb184`. Preservado. Novo teste próprio de click/Enter usa renderer/script/shell/browser e catálogo reais, com fronteira HTTP de UI explicitamente fixture. C29 iniciou a prova de UI, mas a primeira execução atingiu30s e impediu a segunda aquisição do pool; a finalização física do processo foi observada. A prova completa permanece HOLD, com observabilidade/limites internos sendo preparados sem aumento de budget. |

A prova C09 cobre caso/evento válido, resolver/continuity reais, versão atual do caso maior que a do evento, identidade original, fonte histórica, referência forjada/substituição física, revogação dentro do lease, nova admissão, replay e reabertura. O ledger sintético é gravado por C08/outbox reais; não equivale a uma jornada financeira integral.

### Intake do diagnóstico de cálculo

PR59 `e80fdc933dfd25956a50c22dea76bf077e79815b` foi conferida contra os preimages W27 e aplicada exatamente em `source-lifecycle.ts` e `planner-sources.ts`. A preparação recebe clone isolado, o kernel de observação/materialização permanece, as duas observações atuais continuam e todas as autenticações/revalidações são mantidas. O sinal do Request acompanha a transação.

Os dois testes estruturais completos passaram em C29 (o run misto permanece FAIL por UI): **4→2 transações de fonte, 6 autenticações diretas e 4 revalidações**, igualdade/digest, nova observação a cada chamada, ABA, revogação e abort. F29 também passou: 10/10, 132expects, três arquivos completos. Isso ainda não comprova ganho de latência. X29 foi admitido após esses dois gates, com os mesmos40asserts e budgets285/300s; está em voo. Os três arquivos financeiros sugeridos pelo diagnóstico não alcançam os módulos alterados (fontes de fixture): permanecem pendênciasglobais, sem rerun como suposta prova4→2.

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
- C17 headers entre observações externas permanece constatação estática em código estrangeiro INSTALADO: business-context blob5cca27ce239c92a8e3c9f9f92f816f5224562904, ownerWP00/PR32@35b9fd4f532abeb1058f00281d4ad8885ca9966f. Não é o cohort CurrentChoice retido; C09/intraobservação não fecha essa janela.
- **171 critérios, sete tasks, 80 obrigações**, inputs estrangeiros congelados e histórico integral preservados. Ainda faltam três pareceres **FINAL** independentes no candidato terminal. Preflights aqui não recebem esse crédito. Sem FINAL W/D ou GLOBAL_RELEASE.

[Recibos desta continuação](https://github.com/gustavomhss/Orchestra-SF/tree/813806af6c2ce74b2a087139c544e90dd1adcbe4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-continuation-c09/) · [Corpo anterior da PR preservado](https://github.com/gustavomhss/Orchestra-SF/blob/813806af6c2ce74b2a087139c544e90dd1adcbe4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-continuation-c09/prior-PR29-body.md)

Handoff `a3d29d011ba3607a57914701300f09117a3e2de9`; plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campanha SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.

**S0 revisa e integra. Sem merge, epic/full suite, deploy ou alterações Maestro/Relay/Schedule.**
