# WP00 — entrega após reabertura das lacunas próprias

**Estado: DRAFT/BLOCKED.** A reabertura implementou e executou cobertura que faltava ao WP00. O mapa mantém os 85 textos canônicos: **39 PASS / 26 PARTIAL / 19 BLOCKED / 1 NOT_PROVEN**, antes 32/33/19/1. Contratos/corpus têm 85 testes aprovados; o zoom real foi corrigido e comprovado. Consumidores, bootstrap de negócio, typecheck herdado e cadeia nativa continuam com seus impedimentos observados. Não há READY_FOR_REVIEW, GNATIVE aprovado ou GLOBAL_RELEASE.

- PR [#20](https://github.com/gustavomhss/Orchestra-SF/pull/20): `astra-wp00` → `sf2-stack`.
- Candidato de código W10: [`181953e9cee36166558c5f429cbe11e0dd5105d1`](https://github.com/gustavomhss/Orchestra-SF/commit/181953e9cee36166558c5f429cbe11e0dd5105d1), tree `43527d9e4444d57dc77696a15f2cd425ceb7ca2b`.
- Seed `7631b186e4249abd0fc24c7d10beb62355db3f3b`; base preparada `sf2-stack@6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`.
- Guards contra `origin/dev@a1d37698a7bb097c1578f827eba6a19b9917ef07`.
- Plano normativo `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA-256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.

O commit que contém esta consolidação altera somente documentação/evidência sobre W10. A PR registra o SHA/tree publicado, a comparação de todos os paths e o check exato desse commit documental após sua publicação. Cada run abaixo conserva seu próprio produto W e snapshot S, sem receber retrospectivamente o SHA da entrega documental.

## O que foi completado

O freeze revisão 7 mantém C01–C17, 20 artefatos e a matriz 5 perfis / 18 skills / 8 packs / 39 operações / 6 provas. O baseline registra 28 entradas antigas, 41 requisitos e 18 capacidades de IA, com ownership dos 15 WPs. A nova [matriz de estado/formatos](../../../product-campaign/wp00/state-consumer-matrix.md) auditou 281 fontes pinadas: 46 famílias de estado e 14 formatos, incluindo oito lacunas de pares produtor/consumidor explicitamente atribuídas aos owners.

Os testes de consumidores passaram a executar **39 verificações independentes de exports e seis fences independentes de campos**. Migração, retry, CAS e autorização capturam callbacks, versões e estado antes da assertion agregada. Assim a primeira falha não oculta os demais resultados.

O corpus agora atravessa XLSX real, parser, comando, preview/apply, projeção, persistência SQLite e reabertura: reimportação exata, recusa de preview obsoleto/digest divergente, preservação de identidades e dados não relacionados, novos totais esperados e retry observado. Casos distintos cobrem ausência, zero, orçamento herdado, meses/exercícios, restrição e concorrência. DOCX/PPTX reais preservam 25 projetos com notas longas e autoria, sem aceitar comentário de outra encarnação. Isso comprova conteúdo do corpus; não certifica aparência visual nem a jornada nativa J05 completa.

O harness implementa sete fluxos: filtro Dashboard, volume Procurement, comparação Planner, ranking sourcing, busca/exportação DOCX, busca/exportação PPTX e preview/reimportação exata. O plano é 320/768/1440 pixels × zoom real 100%/200% × 30 repetições, totalizando 42 configurações/1.260 tentativas. Mediana/p95 usam apenas sucessos, com falhas/cancelamentos explícitos. O harness implementa avaliação conservadora do limite de resposta perceptível de 200 ms; não há medição de negócio observada nem aceite desse limite. Não se inventa indicador anterior ou latência para tentativa não observada. O agregador recusa matrizes incompletas/incompatíveis e baseline ausente.

O scanner ganhou uma falha controlada de subprocesso real, passando pelo classificador canônico, adapter e porta de escrita. O executável é Bun com script inexistente, explicitamente **não um scanner instalado**. O teste cobre a recusa `could-not-run`/`scanner-unavailable` com zero registros/eventos, sem transformar essa prova negativa em C17 ou GNATIVE.

## CI cirúrgico observado

| Gate | W | S | Run | Resultado |
| --- | --- | --- | --- | --- |
| Contratos, corpus, negativos, ownership e agregador | [`d456bdd9`](https://github.com/gustavomhss/Orchestra-SF/commit/d456bdd9cb4c8d921648b8c885d49cf71e592402) | [`e01e84a6`](https://github.com/gustavomhss/Orchestra-SF/commit/e01e84a6f213b981de60489811383112736ba3f6) | [43537536421](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537536421) | 85 PASS / 0 FAIL; 12 arquivos; 2.239 assertions |
| Consumidores C07/C08/C15, SDK/authority e Atlas | [`d456bdd9`](https://github.com/gustavomhss/Orchestra-SF/commit/d456bdd9cb4c8d921648b8c885d49cf71e592402) | [`8e85876f`](https://github.com/gustavomhss/Orchestra-SF/commit/8e85876ff0243dbfd83782e7014b16672f9426ca) | [43538370444](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43538370444) | 44 PASS / 16 FAIL; 60 testes; 4 arquivos; 125 assertions |
| Bootstrap/fluxos de negócio e primeira tentativa de zoom | [`d456bdd9`](https://github.com/gustavomhss/Orchestra-SF/commit/d456bdd9cb4c8d921648b8c885d49cf71e592402) | [`f07b9684`](https://github.com/gustavomhss/Orchestra-SF/commit/f07b9684dfc410d3a822586c7f2f39d0c43c227d) | [43537760359](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537760359) | 2 FAIL; zero retries; C15 antes de autenticação; 0 medições; 1.260 cancelamentos |
| Capacidade de zoom corrigida | [`181953e9`](https://github.com/gustavomhss/Orchestra-SF/commit/181953e9cee36166558c5f429cbe11e0dd5105d1) | [`d6a434da`](https://github.com/gustavomhss/Orchestra-SF/commit/d6a434da6cf93de2a8eef071b3e6b52def8a3b14) | [43539552540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43539552540) | 1 PASS; zero retries; 100% → 200% → 100% observado |
| Typecheck e guards do código W10 | [`181953e9`](https://github.com/gustavomhss/Orchestra-SF/commit/181953e9cee36166558c5f429cbe11e0dd5105d1) | [`899be75b`](https://github.com/gustavomhss/Orchestra-SF/commit/899be75b46bd6ba4c292bf836e630bdf1a6a0aee) | [43539548039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43539548039) | Sucafina FAIL:144 herdados; UI6 PASS; guards 0 gate / 11 warn / 0 errors |

O [recibo completo de CI](ci-execution-evidence.json) conserva **23 execuções até W10**, inclusive tentativas falhas e o check W6 anteriormente registrado só na PR. Todos os requests, jobs/etapas, SHAs/trees, artefatos/digests e comparações W→S estão vinculados. Cada snapshot difere do produto apenas pelo envelope `.ci-run.json` ou `.astra-wp00-check.json`. A sequência mantém no máximo um `test-ci` em voo por WP; o workflow existente não foi alterado.

O run verde W8 é a prova atual dos 12 arquivos Bun. Os deltas W8→W9→W10 alteram somente `browser.ts` e `zoom-capability.spec.ts`; todos os testes, fixtures e implementações selecionados pelo Bun permanecem idênticos. A falha de bootstrap de negócio continua pertencendo a W8: o trecho de browser alterado não foi alcançado nesse run, e o código C15/CLI não mudou. Não se apresenta o zoom isolado como nova execução da matriz de negócio.

Os runs de contratos W7/W8 obtiveram **PASS no controle Omni canônico**, com nonce validado, um spawn declarado e zero delegações. O consumidor W8 retornou `not applicable`, sem spawn/delegação declarados. O runner Playwright não invoca esse gate Bun; registra contadores próprios de AppProcess. Esses resultados não qualificam a cadeia nativa.

### Correções próprias comprovadas

W7 passou 84 testes, mas o typecheck revelou cinco diagnósticos novos nos testes próprios. W8 corrigiu acesso ao nome da operação e expectativas tipadas, mantendo os checks de dados; passou 85 testes/2.239 assertions e voltou aos 144 diagnósticos herdados. O [review independente](typecheck-review.md) verificou os mesmos 144 IDs em 50 arquivos em W6/W8/W9/W10, zero novos/removidos, e zero diagnósticos nos testes WP00 após W8. Há um diagnóstico herdado no contrato `host-context.ts(14,45) TS2307`, pelo produtor `../routines/factory.ts` ausente; não se afirma que toda a pasta de contratos está sem erros.

O zoom falhou em W8 e W9. W10 identifica o worker exato e verifica manifesto, versão, identidade e permissão efetiva, mantendo uma única aba correspondente à URL medida. O CI observou Chromium `147.0.7727.15`, zoom 100→200→100, DPR 1→2→1, viewport CSS 1440×900→720×450→1440×900 e `visualViewportScale=1`. O recibo contém a extensão observada e um spawn/zero delegações. O teste usa o servidor de produção existente; não prova autenticação, layout ou jornada Sucafina.

### Artefatos atuais verificados

- [Typecheck/guards W10 — 14091490266](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43539548039/artifacts/14091490266): 15752 bytes; `sha256:be429640206ef87b614f946a37502690a706d65ff61c15db41e93b504074c6aa`; expiração GitHub `2026-11-28T01:17:19Z`. Download e SHA-256 conferidos.
- [Zoom W10 — 14090464342](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43539552540/artifacts/14090464342): 204159 bytes; `sha256:d4076d0e80fc09068d3bcaff5f73ed7e4e338969d3ac0438ff77706403a17497`; expiração GitHub `2026-11-21T01:18:41Z`. Download e SHA-256 conferidos.
- [Bootstrap e UI W8 — 14089977719](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537760359/artifacts/14089977719): 713288 bytes; `sha256:efb6b2ec3dd465d1317da9ab7044e01bd87627459c92391dd41506673a8a13e9`; expiração GitHub `2026-11-21T01:02:34Z`. Download e SHA-256 conferidos.

As observações relevantes permanecem em JSON versionado, além dos artefatos temporários do GitHub. O [recibo UI](ui-bootstrap-observations.json) mantém `authenticated:false`, browser/cache null, corpus 1000/200/100 com digest `786ffcdaf98ce795cfc22f5eec3989bf7386db0a8d0143118cf9d5fa941db3ac`, todas as 42 configurações canceladas e medianas/p95 null. O recibo de zoom aprovado está separado no mesmo arquivo.

## Impedimentos e trabalho ainda necessário

| Frente | Observação e próxima ação |
| --- | --- |
| C07 — WP09/WP10/S0 | Seis exports de rotina faltam; a composição atual fornece operações indisponíveis. Integrar produtor/dependências e admissão real. A presença de outros 33 exports não significa invocação de 33 operações. |
| C08 — WP10/S0 | Namespace BI, migração/retry, stale-read, read authority e leitura negada falham. Fences de `claimBindings`, `commandProposals`, `compositeScenarios` e `biArtifacts` falham; `decisionResults` e `nativeRuns` passam. Reconciliar provider e repetir os gates positivos. |
| C15 — WP12/S0 | `Profile policy mismatch: sf_portfolio` falha no consumidor e encerra o CLI antes de autenticação. Integrar perfil/skill/manifesto como conjunto, preservando `AlternativeDraft`. |
| Typecheck — owners/S0 | 144 diagnósticos herdados; 11 warnings de guards preservados. Corrigir nos produtores e repetir os scripts oficiais. |
| C17 — WP10.T07/S0 | Scanner instalado não encontrado. Ausência e falha de invocação são recusadas corretamente; instalação/pin, clean/hit e transação durável continuam HOLD. |
| GNATIVE — WP10/qualifier/S0 | Falta cadeia real de Session/provider/modelo/caso/SkillLoadReceipt/MCP/consumidor no host autorizado. Fixtures e agentes de revisão não são essa prova. |
| UI30/jornadas — WP00 após composição | Executar os sete fluxos reais, atores restritos, 30 repetições por configuração, timings e comparações após o bootstrap funcionar. O zoom já tem prova própria; a UX de negócio ainda não. |
| Baseline temporal — WP00/S0 | Identificar/pinar host histórico compatível ou declarar uma composição de dupla proveniência, preservar transitivos e estabelecer outcomes comparáveis; depois medir. Nenhum baseline temporal foi executado. |

O [recibo de consumidores](consumer-coverage-observations.json) discrimina 60 testes e as 16 falhas. A ampliação torna falhas independentes visíveis; não são 16 regressões novas. O [delta e patch para os owners](../../../product-campaign/wp00/consumer-deltas.md) permanecem não aplicados em seus arquivos.

A [auditoria histórica](historical-baseline-compatibility.md) corrigiu uma premissa: B não chama C15. O CLI do próprio `9e4f3d…` não tem `--installation`, e o launcher aponta para um host externo sem SHA. Planner/DOCX têm oportunidades de comparação; sourcing, PPTX/import e outros outcomes divergem. Host W8 + módulo B é tecnicamente possível pela assinatura, mas não foi executado nem equivale ao checkout B exato. Não se afirma impossibilidade universal nem se atribui a C15 o impedimento histórico.

## Critérios, um a um

O [mapa normativo](../../../product-campaign/wp00/criterion-map.json) contém texto, consumidor, fonte, prova, limite e próxima ação por ID. Os sete PASS adicionais têm evidência de corpus ou dos requisitos textuais de registrar impedimento/recusar scanner indisponível; não promovem a tarefa inteira. T03 continua PARTIAL por medições/jornadas; T04 continua BLOCKED. `WP00.T04.SUC.10` permanece NOT_PROVEN, sem reconstrução retroativa do checkpoint T20.

| Escopo | PASS | PARTIAL | BLOCKED | NOT_PROVEN |
| --- | ---: | ---: | ---: | ---: |
| WP00 | 9 | 8 | 3 | 0 |
| WP00.T01 | 7 | 0 | 0 | 0 |
| WP00.T02 | 8 | 7 | 8 | 0 |
| WP00.T03 | 9 | 0 | 0 | 0 |
| WP00.T04 | 6 | 11 | 8 | 1 |
| **Total** | **39** | **26** | **19** | **1** |

| Critério | Estado | Próximos owners |
| --- | --- | --- |
| WP00.DOD.01 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.DOD.02 | PASS | — |
| WP00.DOD.10 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.DOD.40 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.INV.01 | PASS | — |
| WP00.INV.02 | PARTIAL | S0 |
| WP00.INV.10 | PASS | — |
| WP00.INV.40 | PASS | — |
| WP00.QLT.01 | PARTIAL | WP12, WP10, S0, WP00 |
| WP00.QLT.02 | PASS | — |
| WP00.QLT.10 | PASS | — |
| WP00.QLT.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.CMP.01 | PASS | — |
| WP00.CMP.02 | PASS | — |
| WP00.CMP.10 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.CMP.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.SUC.01 | PARTIAL | S0 |
| WP00.SUC.02 | PASS | — |
| WP00.SUC.10 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.SUC.40 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T01.DOD.01 | PASS | — |
| WP00.T01.INV.01 | PASS | — |
| WP00.T01.QLT.01 | PASS | — |
| WP00.T01.CMP.01 | PASS | — |
| WP00.T01.SUC.01 | PASS | — |
| WP00.T01.CHK.01 | PASS | — |
| WP00.T01.CHK.02 | PASS | — |
| WP00.T02.DOD.01 | PASS | — |
| WP00.T02.DOD.10 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.DOD.60 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.INV.01 | PASS | — |
| WP00.T02.INV.10 | PASS | — |
| WP00.T02.INV.60 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.QLT.01 | PASS | — |
| WP00.T02.QLT.10 | PASS | — |
| WP00.T02.QLT.60 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.CMP.01 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.CMP.02 | PASS | — |
| WP00.T02.CMP.10 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.CMP.60 | PARTIAL | WP00 qualifier independente, WP10, WP09, WP06 |
| WP00.T02.SUC.01 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.SUC.10 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.SUC.60 | BLOCKED | WP00, WP09, WP10, WP12, S0 |
| WP00.T02.CHK.01 | BLOCKED | S0, WP09, owners dos diagnósticos de typecheck |
| WP00.T02.CHK.02 | PASS | — |
| WP00.T02.CHK.03 | PARTIAL | WP11, WP10, WP05, WP09, S0 |
| WP00.T02.CHK.10 | PASS | — |
| WP00.T02.CHK.11 | BLOCKED | WP12, WP10 |
| WP00.T02.CHK.12 | PARTIAL | WP10, WP14 |
| WP00.T02.CHK.60 | PARTIAL | WP00, WP09, WP10, WP12, S0 |
| WP00.T03.DOD.01 | PASS | — |
| WP00.T03.INV.01 | PASS | — |
| WP00.T03.QLT.01 | PASS | — |
| WP00.T03.QLT.02 | PASS | — |
| WP00.T03.CMP.01 | PASS | — |
| WP00.T03.SUC.01 | PASS | — |
| WP00.T03.CHK.01 | PASS | — |
| WP00.T03.CHK.02 | PASS | — |
| WP00.T03.CHK.03 | PASS | — |
| WP00.T04.DOD.01 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.DOD.02 | PASS | — |
| WP00.T04.DOD.10 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.DOD.40 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.INV.01 | PASS | — |
| WP00.T04.INV.10 | PASS | — |
| WP00.T04.INV.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.QLT.01 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.QLT.10 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.QLT.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CMP.01 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CMP.10 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CMP.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.SUC.01 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.SUC.10 | NOT_PROVEN | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.SUC.40 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.01 | PASS | — |
| WP00.T04.CHK.02 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.03 | PASS | — |
| WP00.T04.CHK.04 | BLOCKED | WP10, WP00 |
| WP00.T04.CHK.10 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.11 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.12 | PASS | — |
| WP00.T04.CHK.40 | BLOCKED | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.41 | PARTIAL | WP00 qualifier independente, WP10 host, WP09 admissão, WP12 bundle, S0 integração |
| WP00.T04.CHK.42 | BLOCKED | WP10.T07, WP00 qualifier independente |

## Publicação e limites de execução

O inventário completo dos paths frente ao seed está no recibo CI; só foram editados prefixos próprios e o workflow de check expressamente autorizado. Esta consolidação é documental. Testes de produto, servidores, browser e typechecks rodaram somente no GitHub Actions. A publicação e as operações remotas usaram GitHub MCP, sem merge, deploy, credencial nova, engine substituído ou runtime de outro WP editado. Os 46 critérios não-PASS permanecem abertos com as ações acima; a PR continua draft para integração/revisão de S0.
