# WP14 — auditoria estática de CI W1–W6

## Resultado e escopo

A última execução de produto é **W5: 39 pass / 0 fail em 6 arquivos**. O check mais recente é **W6: 139 diagnósticos TS; 0 em arquivos WP14**. O package continua falhando. Guards passam, sem gate nem erro; os 11 avisos permanecem.

A auditoria leu os logs e executou somente o parser puro canônico `controlVerdict`. Nenhum teste local de produto, typecheck local, mudança de fonte ou operação remota foi realizado por esta auditoria. Este relatório e o receipt normalizado preservam nomes, durações, linhas de log, mensagens TS atuais e hashes. [wp14-ci-current.json](wp14-ci-current.json) contém os diagnósticos atuais uma única vez e o histórico resumido.

As execuções cirúrgicas são vinculadas aos próprios SHAs e escopos. Não se somam runs para declarar uma nova execução integral dos 17 arquivos. O diagnóstico histórico Procurement em caller WP10 foi causado pelo contrato observado com a API WP14 e resolvido em W4; seu path não foi usado para classificá-lo como simplesmente externo.

## Identidade dos produtos e envelopes

Trees fornecidos pelo root; os SHAs de checkout de testes e `PRODUCT_SHA` dos checks foram conferidos nos logs. Os trees remotos não foram recuperados novamente nesta auditoria.

| Versão | Produto / tree | Envelope testes / tree | Envelope check / tree |
| --- | --- | --- | --- |
| W1 | `7b20f81b5181d57109244236eb46ae049ca5ec8f`<br>`fd5a08bfbaaf255ba2fd43b67638cf5532cbc2a9` | `749bfcec1b1fa9910a1799d7bf887c24158bb17a`<br>`72069d40acb9091d254e146cc3243a86a808f5bc` | `2a7e56587f7b8083b0bd4473759ea4bc89fd03e0`<br>`6062bb3fa13f796aec102723992f6e1934448ccb` |
| W2 | `075cbe04a954b08e946bed676c3901dae13a14cc`<br>`3f59fc019290d4f7a01a42de8a136c36840ff9ee` | `766b30eff18ae3d0bf5310a33eb7e1cd91fdaac0`<br>`7a17558d270af6f8bd9240a0a0e51bbb44baa434` | `d787ab14fc4d3183b805f5271f4a20776094d43f`<br>`bee82457ab93579f36e203ef3760adbd31d3e7df` |
| W3 | `c84ec9f4528d66bbaa3dd70689f6f9d568c463ca`<br>`cf7b3f8a74f101b3d580f6395808d0ddc6d75750` | `11d95450508039b538e7dcc25754d9b1b3adf9ce`<br>`b1d0a675b735519fd1cc3fb5a6ff753740c23ead` | `08ee104fd6931f595cf1f00110b5ed1029a21d58`<br>`83a210a33a50988143312e134a8fbaf396e42549` |
| W4 | `45c4ed69325652d81b0f9954b6fe1debb4cf1301`<br>`181a08e1349bf1d550d14505ff7ad3e81ed4decd` | `cb128c652a567f24b52a00d156a4d24cd94c660d`<br>`5341838230f129fba005d69ca77e3340d582e651` | `ef6bfe69ef8f4a3f2bb95739bffe9a302a4c195f`<br>`54bd56ed8b340dcb254c1e330efaca75d42b6159` |
| W5 | `1240efef88be380c82b29ec422a13c54b42c7b62`<br>`1ebec1428d581c36c706ddbca97ea2b84d9daa0c` | `7376413d8d6b07dd9e86f3f1fc8e1e1a495fe6f1`<br>`d10d96ebbf40e43523ffcfb45a027f58f979befe` | `121915c3661d94f133bea0cbe4a8ca3a4ebea56d`<br>`8a3314a82ff71b54ade5a7d6633a11ce3ddac3b5` |
| W6 | `302332e2d30ecb3426265aac3adaa518b81a5ea3`<br>`f176fd9024d2dd93ad5a40f5e898c3760b7eb10e` | Sem novo run de produto | `760cf0549a5432819f3a3d4a42f87fdbedfb1ece`<br>`655f1bf17cee00502572947c0bde8bd004d7a3d7` |

## Jobs, contagens e controlVerdict

| Versão | Produto run / job | Resultado | Expects | Duração | Check run / job | TS | Guards |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | [43580834753 / 132405026618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580834753/job/132405026618) | 52 pass / 2 fail; 17 arquivos | 431 | 245.67s | [43580850502 / 132405069162](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580850502/job/132405069162) | 142 — falhou | 78 regras; 594 paths; 0 gate / 11 warn / 0 erros |
| W2 | [43581868850 / 132408115499](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581868850/job/132408115499) | 57 pass / 1 fail; 17 arquivos | 543 | 118.35s | [43581908400 / 132408235781](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581908400/job/132408235781) | 140 — falhou | 78 regras; 605 paths; 0 gate / 11 warn / 0 erros |
| W3 | [43582306795 / 132409435524](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582306795/job/132409435524) | 14 pass / 0 fail; 2 arquivos | 117 | 0.2s | [43582318468 / 132409471352](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582318468/job/132409471352) | 140 — falhou | 78 regras; 606 paths; 0 gate / 11 warn / 0 erros |
| W4 | [43582881542 / 132411172526](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582881542/job/132411172526) | 1 pass / 0 fail; 1 arquivos | 5 | 0.286s | [43582884753 / 132411182186](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582884753/job/132411182186) | 139 — falhou | 78 regras; 607 paths; 0 gate / 11 warn / 0 erros |
| W5 | [43584174407 / 132415011849](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584174407/job/132415011849) | 39 pass / 0 fail; 6 arquivos | 556 | 75.47s | [43584178239 / 132415023095](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584178239/job/132415023095) | 141 — falhou | 78 regras; 608 paths; 0 gate / 11 warn / 0 erros |
| W6 | Sem execução adicional | Herança qualificada abaixo | — | — | [43584536897 / 132416102283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584536897/job/132416102283) | 139 — falhou | 78 regras; 609 paths; 0 gate / 11 warn / 0 erros |

O parser canônico é `reference/ci/script/test-ci-request.ts`, SHA256 `4097286f73438bf767cf47561fc03e29338eef8ffd48149b2dcba0b3323fa4cc`. Ele exige um único nonce de job e um único verdict correspondente. Os checks não executam o runner de produto e não recebem verdict Omni inventado.

- **W1**, aceito pelo parser: `omni positive control: pass (declared: 3 test(s) in Sucafinav1/test/product/wp14/source-access-atlas.test.ts, Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts, Sucafinav1/test/product/wp10/atlas-business/scanner-probe.test.ts); 7 omni spawn(s), 0 delegated.`
- **W2**, aceito pelo parser: `omni positive control: pass (declared: 3 test(s) in Sucafinav1/test/product/wp14/source-access-atlas.test.ts, Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts, Sucafinav1/test/product/wp10/atlas-business/scanner-probe.test.ts); 7 omni spawn(s), 0 delegated.`
- **W3**, aceito pelo parser: `omni positive control: not applicable (focused: no declaring test ran); this run made no omni spawn and delegated none, so it proved nothing about omni.`
- **W4**, aceito pelo parser: `omni positive control: not applicable (focused: no declaring test ran); this run made no omni spawn and delegated none, so it proved nothing about omni.`
- **W5**, aceito pelo parser: `omni positive control: pass (declared: 2 test(s) in Sucafinav1/test/product/wp14/source-access-atlas.test.ts, Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts); 5 omni spawn(s), 0 delegated.`

## Falhas e alcance da correção

W1 falhou em Atlas por timeout de 180 s e em Procurement porque o emissor retornou `unavailable`. Ambos passaram em W2. W2 ainda falhou em recall: esperava apenas `source-version` e recebia também `source-content`. W3 corrigiu essa precisão e passou 14 testes nos dois arquivos afetados.

W1→W2 removeu os dois casts de fixtures WP14 TS2352. W2→W3 preservou os mesmos 140 diagnósticos. W4 executou Procurement e removeu exatamente TS2322 em `apps/cli/src/sucafina-product/business-services.ts:188:20`, que envolvia callable versus objeto `{ resolve }` na API WP14. Não apareceram novos diagnósticos em W4.

W5 passou 39 testes nos seis arquivos selecionados. Seu check adicionou dois TS2769 próprios em `test/product/wp14/atlas-projection.test.ts:135:40` e `:194:40`, referentes ao overload de `expect(...).toBe(...)` com valor `string | undefined`; os 139 diagnósticos anteriores permaneceram iguais. O pass de produto não transforma esse check em pass.

W6 publicou apenas os dois argumentos genéricos expect<string | undefined> no teste mapper e receipt 06. A prova de transformação de texto (sem avaliar produto) registra JavaScript byte-idêntico, SHA256 93befb2f040984bcf6ad193369da88646e1294dcf386e7cf7a2d9de21151f122. O check W6 removeu exatamente os dois TS2769 próprios: restam os mesmos 139 diagnósticos de W4, zero em paths WP14. Não há S6 nem novo run de produto; os 39 testes continuam sendo evidência do run W5, com essa equivalência explicitada.

### Atlas e reinício demonstrados

**W2 — receipt real, linha 845**: `sqlite-atlas-process-restart`; scanner `gitleaks`, `gitleaks version 8.30.1`, SHA256 `88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509`. Processo pai `4045` e filho `4096`. Commit `committed` e replay `already-committed` preservam evento `9a732d9f8a684588324081b02e4841c524fbd12e9373de19290af1633d75f2ef` e digest `43b967380fa071923e14572b80fcf46a979e4861398d23ea7ef0eb9a8368ebe7`. Recall autorizado `ok`, `1` match; outsider `unavailable` e revogado `unavailable`. `nativeSessionWitness: false`.

**W5 — receipt real, linha 841**: `sqlite-atlas-process-restart`; scanner `gitleaks`, `gitleaks version 8.30.1`, SHA256 `88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509`. Processo pai `4045` e filho `4095`. Commit `committed` e replay `already-committed` preservam evento `3373db39d643a7146deb7318c041027e2ab9f5208ed79add825c056ea9cd763e` e digest `723a8cfd4f715f5e6aa3ae63106effb7d394ec4ae5da4c5753cb490b0b476112`. Recall autorizado `ok`, `1` match; outsider `unavailable` e revogado `unavailable`. `nativeSessionWitness: false`.

São provas de persistência/reabertura, outro processo, scanner, replay e acesso no escopo executado. Não constituem SessionV2/MCP witness nativo, prova de UI, C16 ou aceite global. Os negativos de importação modelam resolução/incarnation na fronteira pura; não executam o importador real. Os negativos de AtlasTrace verificam provenance na fronteira com callbacks controlados e não substituem os receipts reais acima.

## Resultados por arquivo

| Arquivo | W1 | W2 | W3 | W4 | W5 | Última execução |
| --- | --- | --- | --- | --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts` | 1 pass / 0 fail | 1 pass / 0 fail | — | — | 1 pass / 0 fail | W5 / 43584174407 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-store.test.ts` | 2 pass / 0 fail | 2 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | 6 pass / 0 fail | 6 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/scanner-probe.test.ts` | 2 pass / 0 fail | 2 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | 4 pass / 0 fail | 4 pass / 0 fail | — | — | 9 pass / 0 fail | W5 / 43584174407 |
| `modules/sucafina/Sucafinav1/test/product/wp14/domain-outcome.test.ts` | 1 pass / 0 fail | 1 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | 4 pass / 0 fail | 5 pass / 0 fail | 5 pass / 0 fail | — | 7 pass / 0 fail | W5 / 43584174407 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | 10 pass / 0 fail | 11 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | 7 pass / 0 fail | 9 pass / 0 fail | — | — | 10 pass / 0 fail | W5 / 43584174407 |
| `modules/sucafina/Sucafinav1/test/product/wp14/planner-materiality.test.ts` | 2 pass / 0 fail | 2 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | 9 pass / 0 fail | 8 pass / 1 fail | 9 pass / 0 fail | — | 11 pass / 0 fail | W5 / 43584174407 |
| `modules/sucafina/Sucafinav1/test/product/wp14/signal-registry.test.ts` | 1 pass / 0 fail | 1 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts` | 0 pass / 1 fail | 1 pass / 0 fail | — | — | 1 pass / 0 fail | W5 / 43584174407 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-dashboard-record.test.ts` | 1 pass / 0 fail | 1 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-document.test.ts` | 1 pass / 0 fail | 1 pass / 0 fail | — | — | — | W2 / 43581868850 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-procurement.test.ts` | 0 pass / 1 fail | 1 pass / 0 fail | — | 1 pass / 0 fail | — | W4 / 43582881542 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access.test.ts` | 1 pass / 0 fail | 1 pass / 0 fail | — | — | — | W2 / 43581868850 |

## Nomes e resultados dos testes

### W1 — run 43580834753

| Arquivo | Teste | Resultado | Duração ms | Linha do log |
| --- | --- | --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/product/wp14/planner-materiality.test.ts` | C10 migration change uses current Planner calculations and preserves the original choice | pass | 470.6 | 831 |
| `modules/sucafina/Sucafinav1/test/product/wp14/planner-materiality.test.ts` | C10 training change uses current Planner calculations and preserves the original choice | pass | 353.88 | 832 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts` | protected Atlas original binds cross-principal continuity after store reopen | fail | 180025 | 835 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-procurement.test.ts` | Procurement evidence is read through current source and domain ports | fail | 31.24 | 852 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > preserves the original choice and reports the producer's changed comparison | pass | 0.85 | 855 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > re-reading the same material event does not reopen a signal | pass | 1.86 | 856 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > a conditioned choice becomes material when a missing cost resolves and breaks the criterion | pass | 0.32 | 857 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > coverage resolution names its supported category and component | pass | 1.01 | 858 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > coverage order is not material and duplicate categories are unavailable | pass | 1.01 | 859 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > refuses a mismatched saved baseline and ignores result metadata alone | pass | 0.51 | 860 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > a relevant deadline change has its own reason | pass | 0.42 | 861 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > does not reconsider for an unrelated field or period, and never treats unavailable data as valid | pass | 0.46 | 862 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | materiality access rechecks evidence and refuses a revoked result | pass | 2.45 | 863 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | materiality access distinguishes an advancing observation clock from a mutable financial result | pass | 3.17 | 864 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome comparison requires a compatible complete authorized basis | pass | 2.77 | 867 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | signal policy deduplicates, resolves and reopens without carrying revoked data | pass | 0.36 | 868 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | a complete label cannot promote a conditioned or mismatched recorded baseline | pass | 0.36 | 869 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access rechecks source authority before returning the comparison | pass | 1.74 | 870 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | review adapter returns only the reauthorized matching observation | pass | 1.31 | 871 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access tolerates an advancing clock but rejects changed values | pass | 1.78 | 872 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access snapshots reused producer objects and refuses foreign evidence | pass | 0.83 | 873 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access.test.ts` | current request reauthorizes another principal's source after the store is reopened without exposing private identity | pass | 188.4 | 876 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-dashboard-record.test.ts` | Dashboard record memory egress reauthorizes its exact current scoped reference | pass | 66.82 | 879 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-document.test.ts` | document memory egress requires the current confirmed candidate and access | pass | 21.71 | 882 |
| `modules/sucafina/Sucafinav1/test/product/wp14/domain-outcome.test.ts` | review outcome reads the actual closed Planner month and rechecks its C08 choice | pass | 1899.29 | 885 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > explains an Atlas candidate and rejects a different decision type | pass | 4.19 | 888 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > allows an authorized historical source without treating a changed version as current | pass | 1.59 | 889 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > binds recalled task content to the authorized ledger, not only to a self-consistent digest | pass | 2.71 | 890 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > rejects changed query features or candidate removal during authorization | pass | 5.87 | 891 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > host-only wrapper requires current continuity both before ranking and on egress | pass | 5.59 | 892 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > suppresses the entire candidate after revocation or a principal/source change | pass | 1.8 | 893 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | invalidation follows the envelope dependencies and fails closed on revocation | pass | 1.87 | 894 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | recall features require an authorized case and an unambiguous decision type | pass | 0.51 | 895 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | native recall keeps the bound case and uses one explicit scoped candidate bundle | pass | 4.98 | 896 |
| `modules/sucafina/Sucafinav1/test/product/wp14/signal-registry.test.ts` | C08 signal binding and state are host-owned and reauthorized against current source | pass | 12639.9 | 899 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | invalidation refuses a different source despite matching kind, version and incarnation | pass | 1.01 | 902 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | fresh resolutions cannot smuggle a changed projection behind the same source version | pass | 0.25 | 903 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | an authorized fresh reissue for another principal invalidates the prior scope without rejecting unchanged content | pass | 0.84 | 904 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | changed immutable calculation and policy identities invalidate their dependent envelope | pass | 1.4 | 905 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > maps a ledger event deterministically and preserves its dependencies | pass | 1.52 | 908 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > requires a reviewed policy bound to a native profile and its rule digest | pass | 0.36 | 909 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > rejects a nested foreign source even when every digest is valid | pass | 0.37 | 910 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > requires current case access and a real ledger event identity | pass | 0.32 | 911 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-store.test.ts` | snapshot store preserves ordered canonical events and deduplicates identical records | pass | 3.73 | 914 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-store.test.ts` | snapshot store reports tampered or duplicate event identities | pass | 1.75 | 915 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | over-budget evidence ancestry is refused before source IO | pass | 3.79 | 918 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | shared event dependencies resolve independently in sibling branches | pass | 1.12 | 919 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | duplicate evidence shares one pass without retaining authority for the next read | pass | 1.53 | 920 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | aggregate evidence budget is checked before deduplication or source IO | pass | 1.21 | 921 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | historical evidence keeps its original identity and requires authorized historical content | pass | 1.23 | 922 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | recall rejects forged source versions after current authorization | pass | 1.59 | 923 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts` | WP10 Atlas fences writes and recovers a durable receipt after reopen without a scanner | pass | 47275.8 | 926 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/scanner-probe.test.ts` | scanner probe pins an observed executable and version | pass | 2027.19 | 929 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/scanner-probe.test.ts` | an absent scanner fails closed | pass | 0.19 | 930 |

### W2 — run 43581868850

| Arquivo | Teste | Resultado | Duração ms | Linha do log |
| --- | --- | --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/product/wp14/planner-materiality.test.ts` | C10 migration change uses current Planner calculations and preserves the original choice | pass | 344.78 | 811 |
| `modules/sucafina/Sucafinav1/test/product/wp14/planner-materiality.test.ts` | C10 training change uses current Planner calculations and preserves the original choice | pass | 275.53 | 812 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts` | protected Atlas original binds cross-principal continuity after store reopen | pass | 60160.2 | 846 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-procurement.test.ts` | Procurement evidence is read through current source and domain ports | pass | 46.24 | 849 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > preserves the original choice and reports the producer's changed comparison | pass | 0.52 | 852 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > re-reading the same material event does not reopen a signal | pass | 0.98 | 853 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > a conditioned choice becomes material when a missing cost resolves and breaks the criterion | pass | 0.22 | 854 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > coverage resolution names its supported category and component | pass | 0.55 | 855 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > coverage order is not material and duplicate categories are unavailable | pass | 0.49 | 856 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > refuses a mismatched saved baseline and ignores result metadata alone | pass | 0.39 | 857 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > a relevant deadline change has its own reason | pass | 0.33 | 858 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | decision reconsideration > does not reconsider for an unrelated field or period, and never treats unavailable data as valid | pass | 0.36 | 859 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | materiality access rechecks evidence and refuses a revoked result | pass | 2.62 | 860 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | materiality access distinguishes an advancing observation clock from a mutable financial result | pass | 4.19 | 861 |
| `modules/sucafina/Sucafinav1/test/product/wp14/materiality.test.ts` | materiality egress rejects binding and retained evidence mutation during authorization | pass | 2.96 | 862 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome comparison requires a compatible complete authorized basis | pass | 0.47 | 865 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | signal policy deduplicates, resolves and reopens without carrying revoked data | pass | 0.22 | 866 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | a complete label cannot promote a conditioned or mismatched recorded baseline | pass | 0.23 | 867 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access rechecks source authority before returning the comparison | pass | 1.59 | 868 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | review adapter returns only the reauthorized matching observation | pass | 1.33 | 869 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access tolerates an advancing clock but rejects changed values | pass | 2.04 | 870 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access snapshots reused producer objects and refuses foreign evidence | pass | 0.93 | 871 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome egress rejects changes during its final authorization await | pass | 2.01 | 872 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome refuses a nonrepresentable delta even when both operands are finite | pass | 0.3 | 873 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access.test.ts` | current request reauthorizes another principal's source after the store is reopened without exposing private identity | pass | 121.18 | 876 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-dashboard-record.test.ts` | Dashboard record memory egress reauthorizes its exact current scoped reference | pass | 44.07 | 879 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-document.test.ts` | document memory egress requires the current confirmed candidate and access | pass | 11.53 | 882 |
| `modules/sucafina/Sucafinav1/test/product/wp14/domain-outcome.test.ts` | review outcome reads the actual closed Planner month and rechecks its C08 choice | pass | 5090.71 | 885 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > explains an Atlas candidate and rejects a different decision type | pass | 1.85 | 888 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > allows an authorized historical source without treating a changed version as current | pass | 1.02 | 889 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > binds recalled task content to the authorized ledger, not only to a self-consistent digest | pass | 1.97 | 890 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > rejects changed query features or candidate removal during authorization | pass | 4.15 | 891 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > host-only wrapper requires current continuity both before ranking and on egress | pass | 3.83 | 892 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > suppresses the entire candidate after revocation or a principal/source change | pass | 1.26 | 893 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | invalidation follows the envelope dependencies and fails closed on revocation | fail | 1.42 | 916 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | recall features require an authorized case and an unambiguous decision type | pass | 0.28 | 917 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | native recall keeps the bound case and uses one explicit scoped candidate bundle | pass | 3.13 | 918 |
| `modules/sucafina/Sucafinav1/test/product/wp14/signal-registry.test.ts` | C08 signal binding and state are host-owned and reauthorized against current source | pass | 19791 | 921 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | invalidation refuses a different source despite matching kind, version and incarnation | pass | 0.55 | 924 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | fresh resolutions cannot smuggle a changed projection behind the same source version | pass | 0.17 | 925 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | historical content changes invalidate even when numeric version and incarnation are unchanged | pass | 1.04 | 926 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | an authorized fresh reissue for another principal invalidates the prior scope without rejecting unchanged content | pass | 0.4 | 927 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | changed immutable calculation and policy identities invalidate their dependent envelope | pass | 0.77 | 928 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > maps a ledger event deterministically and preserves its dependencies | pass | 0.85 | 931 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > requires a reviewed policy bound to a native profile and its rule digest | pass | 0.3 | 932 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > rejects a nested foreign source even when every digest is valid | pass | 0.31 | 933 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > requires current case access and a real ledger event identity | pass | 0.22 | 934 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-store.test.ts` | snapshot store preserves ordered canonical events and deduplicates identical records | pass | 1.39 | 937 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-store.test.ts` | snapshot store reports tampered or duplicate event identities | pass | 0.52 | 938 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | over-budget evidence ancestry is refused before source IO | pass | 1.13 | 941 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | shared event dependencies resolve independently in sibling branches | pass | 0.91 | 942 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | duplicate evidence shares one pass without retaining authority for the next read | pass | 0.78 | 943 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | aggregate evidence budget is checked before deduplication or source IO | pass | 0.76 | 944 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | historical evidence keeps its original identity and requires authorized historical content | pass | 0.72 | 945 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/business-context.test.ts` | recall rejects forged source versions after current authorization | pass | 0.97 | 946 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts` | WP10 Atlas fences writes and recovers a durable receipt after reopen without a scanner | pass | 30494.2 | 949 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/scanner-probe.test.ts` | scanner probe pins an observed executable and version | pass | 1557.8 | 952 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/scanner-probe.test.ts` | an absent scanner fails closed | pass | 0.17 | 953 |

### W3 — run 43582306795

| Arquivo | Teste | Resultado | Duração ms | Linha do log |
| --- | --- | --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > explains an Atlas candidate and rejects a different decision type | pass | 5.95 | 811 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > allows an authorized historical source without treating a changed version as current | pass | 1.43 | 812 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > binds recalled task content to the authorized ledger, not only to a self-consistent digest | pass | 3.06 | 813 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > rejects changed query features or candidate removal during authorization | pass | 6.04 | 814 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > host-only wrapper requires current continuity both before ranking and on egress | pass | 5.98 | 815 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > suppresses the entire candidate after revocation or a principal/source change | pass | 1.66 | 816 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | invalidation follows the envelope dependencies and fails closed on revocation | pass | 1.57 | 817 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | recall features require an authorized case and an unambiguous decision type | pass | 1.33 | 818 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | native recall keeps the bound case and uses one explicit scoped candidate bundle | pass | 3.49 | 819 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | invalidation refuses a different source despite matching kind, version and incarnation | pass | 0.45 | 822 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | fresh resolutions cannot smuggle a changed projection behind the same source version | pass | 0.18 | 823 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | historical content changes invalidate even when numeric version and incarnation are unchanged | pass | 1 | 824 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | an authorized fresh reissue for another principal invalidates the prior scope without rejecting unchanged content | pass | 0.31 | 825 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | changed immutable calculation and policy identities invalidate their dependent envelope | pass | 0.85 | 826 |

### W4 — run 43582881542

| Arquivo | Teste | Resultado | Duração ms | Linha do log |
| --- | --- | --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-procurement.test.ts` | Procurement evidence is read through current source and domain ports | pass | 70.23 | 829 |

### W5 — run 43584174407

| Arquivo | Teste | Resultado | Duração ms | Linha do log |
| --- | --- | --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts` | protected Atlas original binds cross-principal continuity after store reopen | pass | 49899.8 | 842 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome comparison requires a compatible complete authorized basis | pass | 0.71 | 845 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome deltas preserve both directions and an explicit zero without changing the recorded choice | pass | 0.45 | 846 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | signal policy deduplicates, resolves and reopens without carrying revoked data | pass | 0.54 | 847 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | a complete label cannot promote a conditioned or mismatched recorded baseline | pass | 0.19 | 848 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access rechecks source authority before returning the comparison | pass | 1.86 | 849 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | review adapter returns only the reauthorized matching observation | pass | 4.5 | 850 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access tolerates an advancing clock but rejects changed values | pass | 1.96 | 851 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome access snapshots reused producer objects and refuses foreign evidence | pass | 0.74 | 852 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome egress rejects changes during its final authorization await | pass | 1.7 | 853 |
| `modules/sucafina/Sucafinav1/test/product/wp14/outcome-signals.test.ts` | outcome refuses a nonrepresentable delta even when both operands are finite | pass | 0.24 | 854 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > explains an Atlas candidate and rejects a different decision type | pass | 1.32 | 857 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > an empty memory stays empty and authorized candidates rank deterministically without mutating input | pass | 3.09 | 858 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > the authorized boundary refuses ledger-only or forged Atlas provenance | pass | 2.52 | 859 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > allows an authorized historical source without treating a changed version as current | pass | 0.74 | 860 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > binds recalled task content to the authorized ledger, not only to a self-consistent digest | pass | 1.39 | 861 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > rejects changed query features or candidate removal during authorization | pass | 2.7 | 862 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > host-only wrapper requires current continuity both before ranking and on egress | pass | 2.8 | 863 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | authorized recall > suppresses the entire candidate after revocation or a principal/source change | pass | 0.95 | 864 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | invalidation follows the envelope dependencies and fails closed on revocation | pass | 1.09 | 865 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | recall features require an authorized case and an unambiguous decision type | pass | 0.22 | 866 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | native recall keeps the bound case and uses one explicit scoped candidate bundle | pass | 2.03 | 867 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | invalidation refuses a different source despite matching kind, version and incarnation | pass | 0.97 | 870 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | fresh resolutions cannot smuggle a changed projection behind the same source version | pass | 0.13 | 871 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | historical content changes invalidate even when numeric version and incarnation are unchanged | pass | 0.72 | 872 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | an authorized fresh reissue for another principal invalidates the prior scope without rejecting unchanged content | pass | 0.23 | 873 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | changed immutable calculation and policy identities invalidate their dependent envelope | pass | 0.49 | 874 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | cache scope dimensions invalidate the pure envelope without granting reusable authority | pass | 0.77 | 875 |
| `modules/sucafina/Sucafinav1/test/product/wp14/invalidation.test.ts` | a substitutive import invalidates its source while an unrelated replacement preserves the envelope | pass | 0.36 | 876 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > maps a ledger event deterministically and preserves its dependencies | pass | 0.46 | 879 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > requires a reviewed policy bound to a native profile and its rule digest | pass | 0.2 | 880 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > rejects a nested foreign source even when every digest is valid | pass | 0.17 | 881 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > requires current case access and a real ledger event identity | pass | 0.13 | 882 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > uses the real closed Atlas templates for mapped entries and rejects raw evidence and extra keys | pass | 0.41 | 883 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > refuses unsupported kinds and missing owner context while ignoring forged owner and PR fields | pass | 1.58 | 884 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > maps a coherent new case incarnation to a different owner reference and projection digest | pass | 0.4 | 885 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > refuses omitted or malformed review metadata incompatible policy versions and unreviewed preferences | pass | 0.92 | 886 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | Atlas translation > shares a reviewed profile namespace across actors without granting case access and versions reviewed policies | pass | 0.31 | 887 |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts` | WP10 Atlas fences writes and recovers a durable receipt after reopen without a scanner | pass | 25257.4 | 890 |

## TypeScript: origem, ownership e acoplamento

Ownership vem de `campaign.json` imutável, SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. O path do diagnóstico não determina o commit causador. Os sete diagnósticos em interface sem ownership publicado permanecem `UNMAPPED_IN_IMMUTABLE_OWNERSHIP` para coordenação S0/WP10.

| Owner do path | W1 | W2 | W3 | W4 | W5 | W6 |
| --- | --- | --- | --- | --- | --- | --- |
| UNMAPPED_IN_IMMUTABLE_OWNERSHIP | 7 | 7 | 7 | 7 | 7 | 7 |
| WP00 | 1 | 1 | 1 | 1 | 1 | 1 |
| WP01 | 5 | 5 | 5 | 5 | 5 | 5 |
| WP02 | 9 | 9 | 9 | 9 | 9 | 9 |
| WP03 | 8 | 8 | 8 | 8 | 8 | 8 |
| WP04 | 3 | 3 | 3 | 3 | 3 | 3 |
| WP06 | 33 | 33 | 33 | 33 | 33 | 33 |
| WP07 | 3 | 3 | 3 | 3 | 3 | 3 |
| WP08 | 12 | 12 | 12 | 12 | 12 | 12 |
| WP10 | 26 | 26 | 26 | 25 | 25 | 25 |
| WP11 | 16 | 16 | 16 | 16 | 16 | 16 |
| WP12 | 1 | 1 | 1 | 1 | 1 | 1 |
| WP13 | 16 | 16 | 16 | 16 | 16 | 16 |
| WP14 | 2 | 0 | 0 | 0 | 2 | 0 |

### Localizações TS por path

| Path | Owner | W1 / W2 / W3 / W4 / W5 / W6 | Localizações no último check que incluiu o path |
| --- | --- | --- | --- |
| `apps/cli/src/sucafina-product/business-services.ts` | WP10 | 4 / 4 / 4 / 3 / 3 / 3 | 85:30 TS7006; 85:40 TS7006; 102:40 TS2741 |
| `apps/cli/src/sucafina-product/host-context.ts` | WP10 | 7 / 7 / 7 / 7 / 7 / 7 | 158:128 TS2345; 185:136 TS2322; 217:138 TS2322; 273:138 TS2322; 396:5 TS2322; 412:5 TS2322; 551:5 TS2322 |
| `apps/cli/src/sucafina-product/import-services.ts` | WP10 | 2 / 2 / 2 / 2 / 2 / 2 | 85:101 TS2304; 115:21 TS2304 |
| `modules/sucafina/Sucafinav1/product/collaboration/confirmation.ts` | WP08 | 2 / 2 / 2 / 2 / 2 / 2 | 79:34 TS2322; 91:34 TS2322 |
| `modules/sucafina/Sucafinav1/product/collaboration/hot-topic-host.ts` | WP08 | 1 / 1 / 1 / 1 / 1 / 1 | 16:9 TS2322 |
| `modules/sucafina/Sucafinav1/product/collaboration/recipient-actions.ts` | WP08 | 1 / 1 / 1 / 1 / 1 / 1 | 50:32 TS2322 |
| `modules/sucafina/Sucafinav1/product/collaboration/relations.ts` | WP08 | 3 / 3 / 3 / 3 / 3 / 3 | 70:66 TS2322; 116:35 TS2322; 127:35 TS2322 |
| `modules/sucafina/Sucafinav1/product/collaboration/threads.ts` | WP08 | 4 / 4 / 4 / 4 / 4 / 4 | 57:34 TS2322; 68:33 TS2322; 86:31 TS2322; 101:32 TS2322 |
| `modules/sucafina/Sucafinav1/product/contracts/host-context.ts` | WP00 | 1 / 1 / 1 / 1 / 1 / 1 | 14:45 TS2307 |
| `modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts` | WP02 | 9 / 9 / 9 / 9 / 9 / 9 | 66:474 TS7006; 104:41 TS2345; 118:16 TS2339; 118:52 TS2339; 119:16 TS2339; 120:77 TS2339; 121:163 TS2339; 123:61 TS2339; 128:126 TS2339 |
| `modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts` | WP11 | 8 / 8 / 8 / 8 / 8 / 8 | 46:5 TS2322; 71:446 TS2345; 95:75 TS2638; 97:185 TS2740; 100:74 TS2638; 101:81 TS2638; 101:112 TS2638; 102:183 TS2740 |
| `modules/sucafina/Sucafinav1/product/decisions/proposals.ts` | WP11 | 1 / 1 / 1 / 1 / 1 / 1 | 92:26 TS2367 |
| `modules/sucafina/Sucafinav1/product/documents/capabilities.ts` | WP06 | 1 / 1 / 1 / 1 / 1 / 1 | 71:172 TS2339 |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | WP10 | 1 / 1 / 1 / 1 / 1 / 1 | 210:55 TS2307 |
| `modules/sucafina/Sucafinav1/product/imports/dashboard-preview.ts` | WP06 | 17 / 17 / 17 / 17 / 17 / 17 | 38:75 TS2345; 60:17 TS2339; 60:71 TS2339; 60:119 TS2339; 62:29 TS2638; 74:251 TS2339; 74:306 TS2339; 74:353 TS2339; 74:457 TS2339; 75:297 TS2322; 75:445 TS2322; 75:469 TS2322; 75:545 TS2339; 75:573 TS2339; 75:592 TS2322; 75:674 TS2339; 75:848 TS2339 |
| `modules/sucafina/Sucafinav1/product/interface/analysis-http.ts` | UNMAPPED_IN_IMMUTABLE_OWNERSHIP | 4 / 4 / 4 / 4 / 4 / 4 | 30:114 TS2339; 30:171 TS2339; 30:197 TS2339; 30:235 TS2339 |
| `modules/sucafina/Sucafinav1/product/interface/http.ts` | UNMAPPED_IN_IMMUTABLE_OWNERSHIP | 2 / 2 / 2 / 2 / 2 / 2 | 148:82 TS7006; 148:87 TS7006 |
| `modules/sucafina/Sucafinav1/product/interface/import-http.ts` | UNMAPPED_IN_IMMUTABLE_OWNERSHIP | 1 / 1 / 1 / 1 / 1 / 1 | 54:249 TS2345 |
| `modules/sucafina/Sucafinav1/product/planner/headcount.ts` | WP03 | 2 / 2 / 2 / 2 / 2 / 2 | 27:73 TS2339; 39:66 TS2339 |
| `modules/sucafina/Sucafinav1/product/planner/monthly-host.ts` | WP03 | 1 / 1 / 1 / 1 / 1 / 1 | 58:598 TS7006 |
| `modules/sucafina/Sucafinav1/product/planner/persistence.ts` | WP03 | 2 / 2 / 2 / 2 / 2 / 2 | 33:19 TS2367; 38:22 TS2367 |
| `modules/sucafina/Sucafinav1/product/planner/prepared.ts` | WP03 | 1 / 1 / 1 / 1 / 1 / 1 | 54:5 TS2322 |
| `modules/sucafina/Sucafinav1/product/portfolio/catalog.ts` | WP13 | 1 / 1 / 1 / 1 / 1 / 1 | 13:20 TS2367 |
| `modules/sucafina/Sucafinav1/product/portfolio/handoff.ts` | WP13 | 2 / 2 / 2 / 2 / 2 / 2 | 41:18 TS2367; 78:18 TS2367 |
| `modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts` | WP13 | 2 / 2 / 2 / 2 / 2 / 2 | 80:106 TS2339; 80:171 TS2339 |
| `modules/sucafina/Sucafinav1/product/portfolio/port.ts` | WP13 | 1 / 1 / 1 / 1 / 1 / 1 | 36:20 TS2367 |
| `modules/sucafina/Sucafinav1/product/portfolio/sensitivity-store.ts` | WP13 | 1 / 1 / 1 / 1 / 1 / 1 | 25:19 TS2367 |
| `modules/sucafina/Sucafinav1/product/portfolio/verification.ts` | WP13 | 2 / 2 / 2 / 2 / 2 / 2 | 119:106 TS2339; 119:171 TS2339 |
| `modules/sucafina/Sucafinav1/product/procurement/prepared.ts` | WP04 | 1 / 1 / 1 / 1 / 1 / 1 | 69:5 TS2322 |
| `modules/sucafina/Sucafinav1/product/ui/components.ts` | WP01 | 1 / 1 / 1 / 1 / 1 / 1 | 49:9 TS2741 |
| `modules/sucafina/Sucafinav1/product/ui/contribution-body.ts` | WP01 | 1 / 1 / 1 / 1 / 1 / 1 | 7:65 TS2366 |
| `modules/sucafina/Sucafinav1/test/product/wp01/http.test.ts` | WP01 | 1 / 1 / 1 / 1 / 1 / 1 | 36:40 TS2741 |
| `modules/sucafina/Sucafinav1/test/product/wp01/personal-views.test.ts` | WP01 | 1 / 1 / 1 / 1 / 1 / 1 | 35:137 TS2322 |
| `modules/sucafina/Sucafinav1/test/product/wp01/workbench-analysis.test.ts` | WP01 | 1 / 1 / 1 / 1 / 1 / 1 | 6:38 TS2307 |
| `modules/sucafina/Sucafinav1/test/product/wp03/parity-matrix.test.ts` | WP03 | 1 / 1 / 1 / 1 / 1 / 1 | 106:68 TS2339 |
| `modules/sucafina/Sucafinav1/test/product/wp03/persistence.test.ts` | WP03 | 1 / 1 / 1 / 1 / 1 / 1 | 33:42 TS2741 |
| `modules/sucafina/Sucafinav1/test/product/wp04/prepared-production.test.ts` | WP04 | 2 / 2 / 2 / 2 / 2 / 2 | 208:41 TS2554; 220:107 TS2554 |
| `modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts` | WP06 | 9 / 9 / 9 / 9 / 9 / 9 | 25:40 TS2307; 101:227 TS7006; 101:230 TS7006; 114:229 TS7006; 114:232 TS7006; 253:225 TS7006; 253:228 TS7006; 263:227 TS7006; 263:230 TS7006 |
| `modules/sucafina/Sucafinav1/test/product/wp06/imports/end-to-end.test.ts` | WP06 | 2 / 2 / 2 / 2 / 2 / 2 | 56:72 TS2345; 65:590 TS2322 |
| `modules/sucafina/Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts` | WP06 | 4 / 4 / 4 / 4 / 4 / 4 | 41:76 TS2322; 42:12 TS18046; 46:74 TS2322; 47:12 TS18046 |
| `modules/sucafina/Sucafinav1/test/product/wp07/review-port.test.ts` | WP07 | 3 / 3 / 3 / 3 / 3 / 3 | 106:64 TS2769; 113:122 TS2769; 124:64 TS2769 |
| `modules/sucafina/Sucafinav1/test/product/wp08/confirmation-integration.test.ts` | WP08 | 1 / 1 / 1 / 1 / 1 / 1 | 63:289 TS2739 |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/blob-generations.test.ts` | WP10 | 10 / 10 / 10 / 10 / 10 / 10 | 13:112 TS7006; 13:122 TS7006; 31:58 TS7006; 31:68 TS7006; 40:63 TS7006; 40:73 TS7006; 51:49 TS7006; 51:60 TS7006; 68:69 TS7006; 68:80 TS7006 |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/product-authority.test.ts` | WP10 | 2 / 2 / 2 / 2 / 2 / 2 | 24:47 TS7006; 24:57 TS7006 |
| `modules/sucafina/Sucafinav1/test/product/wp11/analysis-acceptance-adversarial.test.ts` | WP11 | 1 / 1 / 1 / 1 / 1 / 1 | 73:60 TS2345 |
| `modules/sucafina/Sucafinav1/test/product/wp11/case-port.test.ts` | WP11 | 3 / 3 / 3 / 3 / 3 / 3 | 25:42 TS2741; 178:42 TS2741; 273:42 TS2741 |
| `modules/sucafina/Sucafinav1/test/product/wp11/coverage-access.test.ts` | WP11 | 3 / 3 / 3 / 3 / 3 / 3 | 39:127 TS2322; 48:127 TS2322; 77:63 TS2322 |
| `modules/sucafina/Sucafinav1/test/product/wp12/author-reader.test.ts` | WP12 | 1 / 1 / 1 / 1 / 1 / 1 | 32:26 TS2352 |
| `modules/sucafina/Sucafinav1/test/product/wp13/candidates-store.test.ts` | WP13 | 1 / 1 / 1 / 1 / 1 / 1 | 27:42 TS2741 |
| `modules/sucafina/Sucafinav1/test/product/wp13/production.test.ts` | WP13 | 1 / 1 / 1 / 1 / 1 / 1 | 41:42 TS2741 |
| `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-units-boundary.test.ts` | WP13 | 4 / 4 / 4 / 4 / 4 / 4 | 117:42 TS2741; 218:211 TS2722; 230:25 TS2722; 230:25 TS18048 |
| `modules/sucafina/Sucafinav1/test/product/wp13/stored-store.test.ts` | WP13 | 1 / 1 / 1 / 1 / 1 / 1 | 32:42 TS2741 |
| `modules/sucafina/Sucafinav1/test/product/wp14/atlas-projection.test.ts` | WP14 | 0 / 0 / 0 / 0 / 2 / 0 | 135:40 TS2769; 194:40 TS2769 |
| `modules/sucafina/Sucafinav1/test/product/wp14/recall.test.ts` | WP14 | 1 / 0 / 0 / 0 / 0 / 0 | 128:65 TS2352 |
| `modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts` | WP14 | 1 / 0 / 0 / 0 / 0 / 0 | 100:71 TS2352 |

Mensagens completas e continuações estão no JSON, com linhas de log. O check é do package Sucafina e inclui imports CLI percorridos pelo compilador; não se atribui PASS a um gate CLI separado.

## Integridade dos logs

| Versão / job | Bytes | Linhas | SHA256 |
| --- | --- | --- | --- |
| W1 / [132405026618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580834753/job/132405026618) | 81043 | 964 | `c815df92f494b301bb067ec3edb7cf9fbc3bf4d56e0bf6f7644e5a96d00eb526` |
| W1 / [132405069162](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580850502/job/132405069162) | 142150 | 999 | `791a5a245a1dae46770a3c691744383e710b40937a7d66f55f88b9a7f2dfa7b9` |
| W2 / [132408115499](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581868850/job/132408115499) | 84411 | 985 | `572c3c02943879d738ab5ec0e35d3e9da7d9b9ebf56277acd293c4fdc58df71b` |
| W2 / [132408235781](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581908400/job/132408235781) | 138727 | 977 | `6808efd24c8a8ba5e3f7e82063dd552e2e99b8990a8e731723a8b3225022b8e4` |
| W3 / [132409435524](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582306795/job/132409435524) | 70746 | 861 | `81d4059ec6b2b58f83ccff3cc1b36970be814d66632cc9909ff7f43ad167e128` |
| W3 / [132409471352](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582318468/job/132409471352) | 138486 | 975 | `2425ea49a293f45b8bd21e85556b711970fd24a61bf7a355674dc2243d26ad0d` |
| W4 / [132411172526](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582881542/job/132411172526) | 69997 | 864 | `bab1ebb9e3cf7f6f0e1c94662daff0736da2dc62e92dc5e46d1198cb0f5a0781` |
| W4 / [132411182186](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582884753/job/132411182186) | 137891 | 974 | `88249547ada676afa8ed04451b7c94a4d2cbfdf797d0f820ae8ee2de5c0ac05b` |
| W5 / [132415011849](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584174407/job/132415011849) | 79153 | 925 | `8ec3f4fc415ad12ecae9112faf4f0ff985831f4c0d9a05936589634036dea015` |
| W5 / [132415023095](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584178239/job/132415023095) | 138416 | 981 | `70babaf94f55d61cb97713f2a6ad092bafda136ed2ef90b72b19b9d00aa1c4b1` |
| W6 / [132416102283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584536897/job/132416102283) | 138088 | 977 | `a260a8f82af8b2fc87690d11d0c241c4bc13b23df9a6426c67c0cab341563557` |

## Pendências e limites de aceite

- W3 is 14 tests in 2 files, not a rerun or pass of the complete 17-file selection.
- W2 Atlas receipt explicitly says nativeSessionWitness:false; the fresh-process scanner/SQLite proof is real but is not a SessionV2/MCP native witness.
- ControlVerdict passes are separate from product success; W1 and W2 product jobs fail despite a passing Omni control.
- W3 control is accepted as not applicable and supplies no Omni spawn evidence.
- No diagnostics at a WP14 file path in W2/W3 does not mean no WP14 coupling: business-services.ts:188 TS2322 is the WP10 caller of a WP14 Procurement API.
- The package typecheck remains failed in all six checks; guards success does not waive those errors.
- Source path ownership does not identify the introducing commit. Missing dependencies and incompatible consumer signatures require coordinated pinned input review.
- W4 runs one Procurement test in one file, not the earlier 17-file selection.
- W4 removes the observed WP10 caller / WP14 Procurement API TS2322; the package check still fails with 139 other diagnostics.
- W4 canonical Omni control is not applicable and supplies no spawn evidence.
- W5 passed 39 tests in six selected files, not the complete earlier 17-file selection.
- W5 real Atlas receipt also explicitly has nativeSessionWitness:false; fresh-process/scanner/replay evidence does not imply native workflow acceptance.
- W5 import-substitution cases exercise the pure historical-resolution/incarnation boundary, not an actual importer; malformed AtlasTrace cases exercise the boundary with controlled callbacks.
- W5 package typing failed with 141 diagnostics; W6 check-only type correction removed the two own TS2769 diagnostics, leaving the identical 139 diagnostic keys from W4.
- No product tests ran on W6. W5 evidence is inherited only under the recorded type-only source change and byte-identical JavaScript proof; the W5 run retains its original SHA and IDs.
- Zero current WP14 diagnostic locations does not prove all cross-owner contracts correct or make the package check pass.
