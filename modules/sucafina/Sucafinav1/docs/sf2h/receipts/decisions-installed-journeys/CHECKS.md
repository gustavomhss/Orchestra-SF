# Missão52 — segundo check da source

O run **43676572309 terminou com FAIL**: `bun typecheck` saiu com código **2** e os guards com código **1**. Os resultados são exatamente herdados dos checks01 e44: **130 diagnósticos TypeScript em 44 arquivos, 43 GATE e 18 WARN**, sem achados novos, removidos ou com texto diferente. Essa comparação não concede waiver, PASS de critérios ou aceitação global.

## Identidade da execução

| Campo | Evidência |
| --- | --- |
| Run | [43676572309](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43676572309) |
| Job | [132697917208](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43676572309/job/132697917208) |
| Branch | `astra-check-wp11` |
| Source efetivamente verificada | `ea8003b703bae61f9a4452261a7780cc38f0c754` |
| Árvore efetivamente verificada | `739adbafb5b5c95c878895ae1007e685a43fe197` |
| Pai/source52 preservada | `554e4e692318c952fdd1b365eb233d7c1b6d8cf5` |
| Único delta do commit de check | `docs/sf2h/receipts/decisions-installed-journeys/checks/source-02-request.json` |
| Workflow | `.github/workflows/astra-wp11-check.yml`, blob `3b361b6b22c7c5628d6b149321f73934ea5f9a84` |
| Guard base | `a1d37698a7bb097c1578f827eba6a19b9917ef07` |
| Merge base | `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` |
| Artefato | `14146885018`, 8.510 bytes, três membros |
| ZIP SHA256 | `cc0c42cfb32cef274ad33e2a171fee7dfed7440060ca72741049c527bbfbf0ce` |

O ZIP foi obtido pelo GitHub MCP e hidratado pela referência de arquivo emitida pelo conector. Tamanho e SHA256 coincidem com os metadados do GitHub. `source.json` coincide com o JSON emitido no job, linha359. O workflow, guard base e merge base são os mesmos dos dois baselines.

## Comparação exata

| Medida | Baseline44 | Checks01 | Checks02 | Novos/removidos no02 |
| --- | ---: | ---: | ---: | ---: |
| Diagnósticos TypeScript | 130 | 130 | 130 | 0 / 0 |
| Arquivos com diagnósticos | 44 | 44 | 44 | 0 / 0 |
| Guard GATE | 43 | 43 | 43 | 0 / 0 |
| Guard WARN | 18 | 18 | 18 | 0 / 0 |

Referências: baseline44 run`43650398020`/job`132617339891`/source`ff0bd96d1303ef55204d498f286ba0da8543419d`; checks01 run`43661892542`/job`132652817225`/source`14360372153592d944aa10e42bcac1b6d86680f5`.

O arquivo inteiro `typecheck.log` é **idêntico em bytes** aos dois baselines, SHA256 `5a7e2134901935a8a940e1d907c4d1e667c20379309769972657a72fbb799ef4`. Os130 registros também foram comparados por path normalizado, linha, coluna, código, mensagem e todas as continuações. Não houve substituição por “mesmo tipo de erro” nem tolerância de deslocamento de linha.

Os61 registros de guards coincidem por nível, localização, regra e mensagem. O único delta textual de `guards.log` em relação ao01 é o resumo de alcance: **1.173 → 1.364 paths alterados**. Permanecem78 regras,43 gates,18 warnings e0 erros do motor de guards. Isso explica o SHA diferente do log de guards e não representa novo finding.

## Ownership e limites dos achados

Todos os130 diagnósticos estão fora dos paths próprios literais da missão52 e fora dos paths de código alterados desde os checks01 e44. A comparação GitHub01→02 lista200 paths:198 de documentação e os dois helpers próprios P8, `closure-response.ts` e `journey.ts`. Os stats zerados do formato compacto do conector não foram interpretados como ausência de edição.

Os43 gates continuam sendo `agent-scratch` dos recibos históricos `WP11/final-20261114/evidence/`, fora do escopo de escrita52. Os18 warnings são1`binary-added`,10`dep-new-added` e7`test-timeout-raised`.

Cinco warnings de timeout pertencem ao spec Decisões. O blob verificado continua `b6f63bfa1b8eacb5bf37a5c5b0d508fd658d70cf`, igual ao checks01: as cinco linhas13,22,36,88,136 continuam exatamente `test.setTimeout(180_000)`. As advertências já existiam no baseline44 em relação a `origin/dev`; nenhuma duração foi aumentada pela missão52.

O índice normalizado conserva cada diagnóstico/finding e seus apontadores de linha no artefato, job atual e baselines. Arrays de novos, removidos e variações permanecem explicitamente vazios. Nenhum erro herdado foi reclassificado como corrigido.

## Alcance da prova

O workflow executou `bun typecheck` em `modules/sucafina`, expandido para `bun --cwd Sucafinav1 typecheck` e `tsgo --noEmit`, e depois `bun run check:guards --base origin/dev`. Os diagnósticos CLI transversais vêm do grafo de imports de Sucafina; esta execução não é um typecheck independente de todo CLI, app-shell ou E2E.

Este resultado pertence à source `ea8003…`, **não à composição isolada P9 sobreC41**. Os módulos compartilhados de métrica, captura histórica e seus testes inertes não foram promovidos a código ativo na source52 por este check. Logo este run não compila nem qualifica por transferência o W/S de P9, não substitui as cinco jornadas UI e não constitui prova de native, restart, AM ou aprovação financeira.

**Disposição: FAIL herdado permanece aberto; acceptance NOT_GRANTED; GLOBAL_RELEASE false.** O revisor realizou apenas leituras MCP e processamento estático de bytes/ZIP/JSON. Nenhum produto, teste, compiler, guard, dispatch ou rerun foi executado localmente.

## Arquivos e integridade

- `checks02-normalized.json`:130 diagnósticos,61 findings, diferenças vazias, identidades e limitações completas.
- `parsed-diagnostics.json` e `parsed-guards.json`: índices extraídos dos dois logs do artefato.
- `compare01.json`, `jobs.json`, `artifacts.json`, `workflow.json`, `spec.json` e `head_commit.json`: respostas primárias de leitura do GitHub MCP.
- `artifact.zip`, `extracted/` e `job-132697917208.log`: evidência bruta retida em scratch; não se propõe adicioná-la como logs brutos à source.
- `normalize_checks02.py`: processamento de dados reproduzível, sem invocar produto ou testes.

SHA256 dos membros: `source.json`=`4df5718c3848091cb12a78c3a6e15845c4d66e4127f6369d2d0248001aa97398`; `guards.log`=`ebecf5136bc61233e974964bf489e7a954a52bcdd86f1303adebfdbf232192f3`; `typecheck.log`=`5a7e2134901935a8a940e1d907c4d1e667c20379309769972657a72fbb799ef4`.

SHA256 do job completo: `8097c5514a4fb4f8233f63151d53dce569427e8bbab28b82f326d244210abb72`. Typecheck exit2 na linha864; guard exit1 na linha997; resumo dos guards na linha934.
