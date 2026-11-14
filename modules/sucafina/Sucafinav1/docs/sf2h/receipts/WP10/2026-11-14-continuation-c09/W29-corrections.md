# W29 — correções das provas novas após C28/CHECK28

C28 permanece **FAIL: 8 pass / 1 fail, 136 expects, 9 testes / 3 arquivos, 16,27s**; cleanup success. Os dois testes prioritários C09→C17 passaram integralmente (6.577,14ms e 9.035,97ms), assim como os cinco casos de autoridade e o abort de fonte. Esses resultados conservam W28 `90f2c4f81f74edc26a1783bfda7891638b429fa6`, S `8dedb1fa71a0805505e50eda8c0a038de79276a8`, run `43627315630`, job `132546009522`, cleanup `132546614709`. Não são apresentados como um green integral.

A única assertion falha era a contagem da próxima chamada depois de revogar a autoridade. A última revalidação real apagou a admissão em `ui-authority.ts`, blob `502fb1ab3a4116a62aeb504a4bb26040c66d81b2`. Consequentemente `requestFor` devolve undefined e o resolver retorna denied antes de outro await. O teste acrescenta uma assertion explícita desse Request ausente e exige zero revalidações subsequentes, além de continuar exigindo zero transações/autenticações e ausência de payload. Nenhum guard de produto foi relaxado.

CHECK28 permanece **FAIL**, run `43627330840`, job `132546056147`: 13 diagnósticos estrangeiros anteriores mais 3 próprios de testes. As duas annotations explícitas `Snapshot` e `BlobTransaction` resolvem o callback genérico implicit-any. A fixture do forecast passa a declarar `const services: Pick<SfHostServices, ...>`, em vez de preservar a inferência Promise<never> com satisfies; o mesmo cast de fronteira e os mesmos métodos que lançam permanecem, sem unknown/any. CLI, Atlas generate/check/diff/typecheck, spawn guard e guards passaram; isso não muda o terminal failure.

Os dois arquivos de produto da PR59, C09, autoridade e os demais blobs W28 permanecem idênticos. Não há hipótese para repetir os casos C09/autoridade aprovados. O próximo corte seleciona somente o teste estrutural corrigido e o novo teste de UI, com startup/finalizador publicados WP01. Source fences seguem como gate separado antes de X.

## Ordem de arquivos e request preservada

C28 usou as mesmas paths completas sem `./` presentes nas requests herdadas. O validador aceitou a seleção, e o log confirma exatamente os três arquivos e nove testes esperados, porém na ordem calculation → authority → C09. Não se afirma a ordem originalmente listada como ordem executada. A leitura de `script/test-ci-paths.ts`, blob `b6977405d4dd8b2db95f3926f2a0322fd511357e`, confirma que o uploader normal acrescenta `./` a arquivos explícitos. As novas requests reproduzem esse formato e colocam timeout após os arquivos, preservando o runner e workflow existentes. Isso é necessário para o pool de browser que exige startup primeiro/finalizador último. As requests W28 e seus hashes não foram reescritos; F28/U28 não foram disparados.

## Limites preservados

O preflight de tipos não foi typecheck; CHECK29 deverá confirmar os reparos. C09 valida reabertura de driver/serviços, não um reinício de processo com recall/UI. O UI usa HTTP explicitamente sintético, sem crédito nativo/AM05. O novo oracle 4→2 não comprova p95, 30 repetições ou a cauda financeira X. O finding `R1-W23-C17-BETWEEN-OBSERVATIONS` incide sobre `calculationProof` estrangeiro **instalado** em business-context, blob `5cca27ce239c92a8e3c9f9f92f816f5224562904`, pin WP00/PR32 `35b9fd4f532abeb1058f00281d4ad8885ca9966f`: continua OPEN / STATIC_BOUNDARY_LIMIT_NOT_EXECUTED_BREACH; os negativos intraobservação e o novo C09 não cobrem a janela entre as duas observações externas. O cohort CurrentChoice retido é uma pendência distinta.

Mapa literal focal e terminais/logs completos estão preservados em `runs/W28/`. Os 171 critérios, sete tasks, 80 obrigações e demais pendências do handoff não são redefinidos.
