# CI120 — Checkpoint após C56 e qualificação W102

- **Autoridade:** missão120, branch `sf-ci-validation`, PR106, lease `product-ci-browser120`. ACK `f29dd5a...`. Persistido via CAS; somente recibos e snapshots `.ci-run.json`; sem testes locais, fontes/workflows/merge/deploy.
- **Composição:** C54 `3f4643d...` HTTP 96+111, C55 `8b2a3ef...` tipos116, C56 `a832bd5...` leitura histórica115, C57 `9dddec6...` matcher117 composto. 118 ainda em elaboração na observação; a114 é a única integradora.
- **C54 HTTP:** 43724650284 / job132843869765 = 2 PASS, 0 FAIL, 66 asserts. **C54 browser:** 43724652351 / job132843876161 = 1 PASS, 3 FAIL, WP01 finalizer executed before consumers; owners96/111/114 notified.
- **C56 native115:** 43725299343 / job132845809441 = **183 PASS**, 0 FAIL, 976 asserts; original historical positive oracle unchanged and PASS. Native installed C15/Task remains NOT PROVEN.
- **W102 XLSX source:** layout 43724653941 / job132843881607 = **4 PASS**, 0 FAIL, 522 asserts, nine original XLSX SHA in RUNS; reader partial 43724656327 FAIL due 5 missing required source IDs; expanded distinct selection 43725105940 / job132845224624 = **9 PASS**, 0 FAIL, 1713 asserts, reader COMPLETED 12 required, 12 PDF, 121 PNG, originals unchanged, artifact 14166480115. Planner 21→8p, Members 6→2p, OPEX 2→1p; independent visual/worksheet mapping + four scenario PDF remains NOT PROVEN. Only source W102 qualified; not composed C.
- **Dedup:** source W/tree, exact ordered requests, Bun/Linux workflow/config/fixtures, one Git child S with only `.ci-run.json`; `[skip ci]` initial S attempts produced no Actions runs and were not counted as pass/fail.
- **NEXT:** await 114 adoption118, issue focused type-fixed test requests on new material C; 119 owns typechecks; 95/110 host gates; 99 causal P03; 91/93 visual and R1 independent; no final/epic/global release.

Full W/S/parent/log/run/job/attempt/artifact matrix is in `RUNS-120.json`. Owners notified via PR105/103/109/65 issue comments; `FAILURE-QUEUE-120.json` records exact failures and gates. `GLOBAL_RELEASE=false`.

## Adendo C58 — 117/118 e consumidores116

- C58 material `422f1ed7b549021d7c62c834c9d9041279112af4` tree `647b024075265fc76d6253c99bec00a82618f816`; **6 novos runs** a partir de 6 snapshots, cada S=filho W + diff único `.ci-run.json`, sem fonte/workflow edit.
- 116 consumidores: [43726381302](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43726381302) job132849102144 **18PASS/0FAIL**,296 asserções; registrado PR112.
- 117/118 exports: [43726378502](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43726378502) job132849093415 **9PASS/0FAIL**,1713 asserts, `SF88_READER COMPLETED 12/12`, artifact14166341968 sha256 44bf585bbd508c21c2a8bbe962f72e03b4ff90b2d3b5f63ad478de3d04023a77; registrado PR113.
- 118A corrigido: [43726458847](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43726458847) job132849340798 **83PASS/1FAIL**,1228 asserts; `source-observation.test.ts:86` esperado revalidate=1, recebido0. Primeiro request 43726373599 selecionou 11/13 specs por duas paths incorretas; ele **executou** 57PASS/1FAIL o mesmo ponto, não deve ser chamado validator-only. Não repetir.
- 118B: [43726376680](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43726376680) job132849088063 **42PASS/8FAIL**,1061 asserts; WP00 source oracle, WP08 timeout+unavailable, WP01 browser startup, WP10 3x security/authority lifecycle, WP06 persisted preview link. PR114 e65 avisadas; sem enfraquecer oráculos.
- 117 restante 15 arquivos: [43726371640](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43726371640), job132849072764 **IN_PROGRESS (snapshot original)**; não disparar em paralelo, coletar resultado quando terminal. Não inferir PASS.
- 119 compiler/guards ainda responsável exclusivo; Task95/110 ainda sem installed, XLSX102 ainda só fonte e revisão visual independente, P03 depende99, WP01 browser C54 original ainda fail. `GLOBAL_RELEASE=false`.

