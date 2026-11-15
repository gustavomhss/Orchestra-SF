# CI129 — checkpoint e handoff verificável

**Autoridade:** `product-ci-e2-browser129`; predecessor 120 revogado por S0-FENCE; ACK129 CAS `ee2e3bfb755d7dacac4f0d8e6f0ee474ab254ce1` (GitHub, readback verificado). **Branch:** `sf-ci-validation` / PR106. Nenhum teste local, edição de produto/workflow, reset/force, merge em dev, deploy, Goal ou epic.

## Matéria e reconciliação

C62 W `ea8eae1d371a20032b29807a41bca0528ea9c13e` tree `5f405450ffc16a2bcd99c01e85a81fb7b2f7b3e5`; C64 W `8f933d3249f49e1234b745036672d7c7a6aabcd4` tree `3ff9cda9d0e2bf45a379cc580341031787c3c815`. C64 permanece `COMPOSED_UNQUALIFIED`; 125 integra na PR65, 128 compila, 129 despacha exclusivamente Actions. Cada uma das seis snapshots deriva do W exato e altera **somente `.ci-run.json`**, com request_blob, S/tree e argumentos em `REQUESTS-129.json`; não houve duplicação do W/S/config/selection anterior. Os 12 W/S/runs da120 foram restaurados de `ci-after-c53-120/RUNS-120.json` em `RUNS-129.json`; o run43726371640 foi reconciliado de IN_PROGRESS para terminal FAILURE: **119PASS/5FAIL/3100 asserts**, três cooperative deadline165s e dois timeouts Bun180s, PR113 notificada.

## Execuções Actions — Linux/Bun, attempt1

- **C62-CREATION-HTTP121** W `ea8eae1d371a` S `e35a701571949660a3b54bce462fce686c5026ec`; [run43737725978](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43737725978), job `132883920656`, cleanup `132884449539`: **SUCCESS**, 2 pass / 0 fail / 0 errors / 66 expects, 2 testes em 2 arquivos; Omni `NOT_APPLICABLE_FOCUSED`.
- **C62-REPORTS122** W `ea8eae1d371a` S `ac781faf2c9f4b5982179eae5a9aa73a02022562`; [run43737735283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43737735283), job `132883948490`, cleanup `132884451563`: **SUCCESS**, 11 pass / 0 fail / 0 errors / 54 expects, 11 testes em 2 arquivos; Omni `NOT_APPLICABLE_FOCUSED`.
- **C64-NATIVE-ADAPTERS** W `8f933d3249f4` S `3eec4c810a2a8d0c03e28d4abf60e1f582fe335f`; [run43738115971](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738115971), job `132885115197`, cleanup `132885628197`: **FAILURE**, 17 pass / 5 fail / 2 errors / 143 expects, 22 testes em 5 arquivos; Omni `MISSING_POSITIVE_VERDICT`.
- **C64-EXPORTS122** W `8f933d3249f4` S `599fe4e482d19dc0907e420937f81a015a6b7f2f`; [run43738222564](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738222564), job `132885441997`, cleanup `132886826588`: **SUCCESS**, 14 pass / 0 fail / 0 errors / 1756 expects, 14 testes em 5 arquivos; Omni `NOT_APPLICABLE_FOCUSED`. SF88 reader COMPLETED 12/12, artifact 14171406739.
- **C64-APP-SHELL-BAD-FILTER** W `8f933d3249f4` S `daa98eb65669b9ff6449596de697d618d91229b3`; [run43738654236](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738654236), job `132886763986`, cleanup `132887243961`: **FAILURE**, 0 testes selecionados (invocação inválida); Omni `NO_TEST_EXECUTED`.
- **C64-APP-SHELL-PATHFIX** W `8f933d3249f4` S `45d23ab943fed842ce470cb0df8914f48696a46a`; [run43738907064](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738907064), job `132887516559`, cleanup `132887958488`: **FAILURE**, 23 pass / 8 fail / 0 errors / 177 expects, 31 testes em 8 arquivos; Omni `NOT_APPLICABLE_FOCUSED`.

**C64 erros de produto/fonte:** A02 Schema.isBetweenLength inexistente, A04 parse Unexpected >, A05 três recusas não estritas; PR116, PR135, PR134 notificadas. UI F03 (provider) PR129, S01 JSX index.tsx:240 PR125, S02 range anchor PR124, S05 provider PR119 notificadas. Runner UI primeira tentativa erro de filtro, segunda seleção reparada via `./test-browser`, sem tocar código. Oito falhas no run principal app-shell, com subtests internos; **não somar contagens internas como se fossem casos externos**. C64 exports teve 14PASS, 1756 asserts, reader SF88 COMPLETED cases12 missing[], artifact real 14171406739 (ZIP de 16.190.546B); não significa FINAL nem prova visual.

**WP01 browser121:** HOLD. Histórico C54 de mesma ordem de argumentos colocou lifecycle antes dos consumidores em runtime Bun. Sem mecanismo deterministicamente provado, não reexecutar à cegas nem alterar fixture/Omni/oráculo; PR117 foi notificada. **Q01/Q02 instalado:** HOLD até codecs, montagens, origem autenticada e 2 atores, PR65/126/127. `GLOBAL_RELEASE=false`.

## Critérios de handoff

A 125 pode usar `REQUESTS-129.json` + `RUNS-129.json` + `FINDINGS-129.json` para atribuir correções com W/S/job exatos. Cada correção requer origem, novo material árvore e seleção nova/legítima; resultados de C62 não provam C64; C64 export SUCCESS não suprime falhas de contratos/UI. Runtime de compiler128/run43738074189 é externo à lane129. Nenhuma autoridade de release ou merge foi delegada à129.
