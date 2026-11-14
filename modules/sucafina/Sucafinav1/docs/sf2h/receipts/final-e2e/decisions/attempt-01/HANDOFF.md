# S4-A — Decisions E2E — handoff terminal da tentativa 01

## Resultado

**PARTIAL / BLOCKED. A seleção final CI-UI-DECISIONS não está aceita nem completa.**

O spec obrigatório agora existe em `packages/app-shell/e2e/sucafina/decisions.spec.ts`, com dois helpers exclusivamente em `decisions-support/`. A execução nominal em Actions coletou exatamente os três testes e falhou nos três durante o bootstrap real, antes de qualquer ação na UI. A presença do arquivo e a coleta correta não equivalem à jornada.

Branch/PR preservados: `astra-wp11`, [PR40](https://github.com/gustavomhss/Orchestra-SF/pull/40), base `sf2-stack`. Nenhum produto, runtime, configuração ou fixture compartilhada foi alterado; não houve importação de correções Finance/WP10, outra PR de produto ou merge.

## Identidade da prova

| Identificador | Valor |
| --- | --- |
| Input/head preservado | `e8949be0e31952d5be4987c099003cd0b46e2add` |
| Produto anterior W19 preservado | `a3b57d475e7b564fa7b05932d3a81c5836e3e3c1` |
| W — spec e recibos de preparação | `3e1a8ec84ae334b7c7320c86d6b93bd5730ba469` |
| Tree W | `6d38dfcbfc0c83879d3b97f7f11b79c57f2d2612` |
| S — snapshot de Actions | `7b3cc91ec088bdc527e1af1207ef8d66f5c45a2c` |
| Tree S | `01161c0f9ae6b4e0c68f41464450de995f572f6e` |
| Request blob / SHA256 | `0362cd22163485e31b3cb07fca74db449f5bd516` / `2fbc638a0215c7370007f9656507193df5a45cdb51a2dcae615ca04996f81b3c` |
| Run nominal | [43632217395](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632217395), job `132561137773` |
| Run de checks W | [43632969810](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632969810), job `132563427643` |

O compare remoto W→S mostrou somente a adição de `.ci-run.json`; todos os blobs de produto, testes, fixtures e configuração são iguais. W contém sete arquivos novos nos paths autorizados. Este handoff acrescenta somente recibos sobre W; não altera os testes executados. `publication.json` conserva os blobs e a equivalência.

O request normalizado está em `actions-request.json`: package app, diretório packages/app-shell, runner Playwright, config `e2e/playwright.production.config.ts`, env `ORCHESTRA_CHANNEL=prod`, arquivo nominal único. O relatório confirma Chromium, um worker, retry 0 e repetição 1. O controle omni é **not applicable** por esse runner no workflow existente.

## O que foi implementado

1. Entrada pelo Dashboard/Workbench real, criação humana, vínculo exato de id/encarnação, horizonte/moeda/critérios, edição e reabertura da revisão corrente.
2. Descoberta de catálogo vinculada ao caso criado pela UI, exigindo JSON/status de domínio, payload e identidade exatos. Caso vazio deve continuar vazio; isso não simula alternativas positivas.
3. Perda da resposta original da criação via CDP, sem nova requisição ou corpo sintético; formulário preservado e recuperação por links/leitura/reload com um único submit.

Essas assertions foram coletadas, mas **não foram alcançadas**. O helper de perda de resposta também não foi exercitado. Os testes não usam skip, expected-failure, sleep, API POST como substituto de ação humana ou retry automático de mutação.

## Resultado observado em Actions

| Teste | Resultado | Primeiro limite observado |
| --- | --- | --- |
| Criar, editar e reabrir caso | FAIL | CLI encerra com código 1 antes do Dashboard |
| Consumir catálogo real | FAIL | Mesmo erro de bootstrap, antes de Find decisions |
| Recuperar confirmação perdida de criação | FAIL | Mesmo erro, antes de instalar a interceptação CDP |

**0 PASS, 3 FAIL, 0 SKIP, 0 FLAKY; 0 ações UI concluídas.** O relatório de runtime está em `actions-runtime.json`; `actions-selection.json` preserva a coleta. O ZIP original foi baixado e seu SHA256 conferido: `4bdc5962ab41f527447b97658305b785bf1c7dd3feddab37e4c37107299f0e79`.

A fixture existente iniciou a instalação real e recusou readiness: esperava `local-operator`, recebeu `CLI exited: 1`. Os três attachments `wp03-real-cli.log` mostram:

```text
Profile policy mismatch: sf_portfolio
at createResidentAiBundle (.../product/ai/resident.ts:50:108)
at .../apps/cli/src/sucafina-product/host-context.ts:62:24
```

A imagem de falha inspecionada está em branco, antes da navegação. Ela não é evidência da jornada. Não houve observação do Workbench, caso, escolha, Apply ou histórico. Provider **NOT_OBSERVED**; crítica independente **NOT_RUN**.

## Dependência observada: D-BOOT-PROFILE

No W, a política normativa exige oito saídas de `sf_portfolio`, incluindo `AlternativeDraft`. Manifesto e perfil distribuído contêm sete e omitem essa saída. O loader executa a comparação estrita `sameSet(profile.outputTypes, expected.output_types)` antes de verificar o digest do perfil, descobrir provider ou publicar o host HTTP.

| Fonte instalada | Blob |
| --- | --- |
| Loader residente | `3e025a1395511af4f09de903b35d6b1cf20198ac` |
| Manifesto residente | `6c2a9a7084379a91995842d9e8577f710f687465` |
| Perfil sf_portfolio | `1aabebe2ea6effa98dc1869ebcaf947092d7c4ba` |
| Política normativa | `a59ecb7ea7315504cb78ced5c6b6dd828e238730` |
| Caller do host | `81f07b9d68a85811cef3aa4d3b4615475486f04f` |

A norma atribui o perfil a **WP12.T01** e o registro a **WP10.T06**. A composição deve seguir por **S0/WP10**, coordenando o owner residente. A PR29 no head consultado `6cf5d78ba412f97aa4dd8648bfec340a27060d3b` já publica perfil `744918076fa510339a3216487da8f59b06fe45e8` e manifesto `453c6f3a5b48c081223909af8293f854ad31d7c8` com AlternativeDraft, mantendo a política e o check estrito. Esses blobs **não estão instalados em W** e sua leitura não concede prova de execução daquela branch.

`bootstrap-dependency.json` contém todos os pins, a cadeia produtor/caller e a condição de retomada. Não reduzir manifesto, remover perfil, relaxar política/digest, alterar a fixture ou fabricar readiness.

## Dependências estáticas posteriores — não reproduzidas por este run

| ID | Dependência exata | Fronteira |
| --- | --- | --- |
| D-CASE-READ | business-services `54cb9612…` omite verifyScenarioOperations requerido por case-port `206271d3…` | Caller WP10; contrato de produtor Finance |
| D-HOST-HTTP | host-context `81f07b9d…` não monta os handlers decision-* / portfolio | WP10 |
| D-INITIAL-ALTERNATIVES | Falta caminho humano para anexar fontes e criar as primeiras duas alternativas | Produto/composição WP10; sem seed/direct POST |
| D-APPLY-DIGEST | UI Apply `3bee0f43…` omite reviewDigest exigido pelo HTTP `596512b4…` | Consumer de Decisions/WP10 e produtores Finance |
| D-PROVIDER | Provider real e reviewer nativo independente ainda não observados | Host/provider |
| D-HISTORY | Ainda falta produzir escolha, recibo financeiro e replay C17 reais | Produtores e consumidores montados |

Os pins completos e a comparação com PR29/PR42 estão em `static-audit.json`. Corrigir bootstrap não aceita essas etapas automaticamente.

## Critérios e cobertura ainda ausente

`criteria.json` preserva literalmente os **83 critérios WP11**, seus bindings e mapa de prova do pack completo S4-A. É a matriz de preparação, independente do resultado terminal em `execution.json`:

- **8** critérios têm fragmentos escritos no spec, todos sem prova funcional nesta tentativa.
- **46** estão BLOCKED_NOT_IMPLEMENTED neste delta.
- **29** são OUTSIDE_E2E_DELTA, sem dispensa das obrigações.
- **0** critérios foram aceitos por este run.

Ainda faltam implementação e observação E2E de alternativas positivas/C10, escolha humana e revisões append-only, proposta/preview, aprovação financeira explícita/Apply, efeitos parciais verdadeiros, recibo durável, perda/retry de Apply e histórico persistido C17. A perda de confirmação da criação não substitui C12/AM04; leitura da revisão atual não prova histórico. **Escolha não é aprovação financeira.** Ausência/pendência de cobertura não pode virar zero confirmado. Crítica exige provider real, reviewer próprio e vínculo persistido; não houve saída IA fabricada.

O histórico W19 anterior continua preservado e separado; seus resultados cirúrgicos não são reapresentados como E2E final ou aceite integrado.

## Typecheck e guards

O check existente executou exatamente W e registrou origin/dev `a1d37698a7bb097c1578f827eba6a19b9917ef07`, merge-base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.

- `bun typecheck` em modules/sucafina: **FAILURE, 130 diagnósticos**.
- `bun run check:guards --base origin/dev`: **FAILURE, 78 regras, 1018 paths, 43 gates, 16 warnings, 0 erros internos**.
- Os **43 gates agent-scratch** apontam para logs anteriores em `receipts/WP11/final-20261114/evidence/`, fora do delta; preservados conforme a missão. Não houve ignore ou aprovação.
- **3 warnings próprios** test-timeout-raised em decisions.spec.ts:15/67/115. Os 180 s foram declarados antes do run, seguem WP03 e acomodam setup/readiness/enrollment/cleanup reais. Não foram aumentados para esconder a falha; o aviso permanece.
- App, E2E e Decisions typecheck: **NOT_RUN**. Nenhum workflow disponível oferece essa seleção sem mudar config/workflow; o tsconfig E2E também omite sucafina. Coleta Playwright não substitui typecheck.

`checks-evidence.json` preserva o source.json e os logs integrais dos checks, mais a classificação por delta. `typecheck-gap.json` explica a lacuna. Nenhuma evidência anterior foi removida para zerar guard.

## Consumidor e próxima ação

**Consumidor: S0 / integração, com WP10 e owners Finance/WP12.** Primeiro reconciliar a composição já publicada do perfil/manifesto e os demais produtores/callers reais. Depois completar a mesma seleção com o caminho humano disponível para alternativas, escolha, preview/Apply e recuperação/histórico; revalidar apenas o recorte nominal no novo snapshot composto.

Sem mudança material de produto não há justificativa para repetir esta tentativa. Não houve testes locais, servidor local, epic, full suite, execução concorrente de runs desta missão ou nova implementação de correções alheias. Revisões desta entrega são estáticas e independentes da autoria do spec; não substituem aprovação final de um candidato C integrado.
