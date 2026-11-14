# Finance resume — handoff revisável para S0

## Estado da entrega

PR [#42](https://github.com/gustavomhss/Orchestra-SF/pull/42), `finance-resume → sf2-stack`. A retomada preserva a PR #35 e reconcilia os inputs #22/#24/#40/#37 nos heads fixados. O último produto/teste é R5, `4f82cf10ae6766c56e9bf1862fc5198a5246cb5c`, tree `67af8927297fa12ca7d84077e0450833a9738c52`. O commit que contém este handoff acrescenta somente receipts; seu SHA/tree são publicados no corpo da PR após criação. Nenhum merge, fechamento de PR anterior ou aceite global foi feito.

A entrega contém implementações próprias e provas cirúrgicas novas, o inventário integral de **371 critérios / 18 tarefas / 87 checks**, reconciliação de nove consumidores, sete deltas encaminhados a owners e todas as falhas preservadas. Persistem cinco jornadas longas com timeout, uma falha do guard de grant privado que depende da composição do provider, pendências de contrato/ligação e checks compartilhados. **Resultado revisável não equivale a aceite global.**

## Pins, autoria e preservação

- Origem #35: `ec052c2c3bef96f492512f3d5f663919580f25c8`; handoff integral consumido antes de editar.
- #22/WP03: `90c467cea436daa24987ad68a588a7d80f91064e`; #24/WP05: `0881fee21f07bf8a9a1153d7d55727837cdf497a`. Já presentes na Finance; sem aplicação duplicada.
- #40/WP11: `e8949be0e31952d5be4987c099003cd0b46e2add`. Quatro commits posteriores ao consumo anterior reconciliados, preservando correções Finance e arquivos históricos.
- #37/WP13: `7defe5c9930774c6aa5a15a5f677b4406d08683c`, W20 real; não foi usado o W19 desatualizado do corpo da PR.
- Plano imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; restart `c208200cb39529ba09c1f3bbc5594a1ff579d385`; packs/handoffs/CI `a3d29d011ba3607a57914701300f09117a3e2de9`.
- PR39 avançou de `812f8427423dc143cefc2731edc3485eeb8d1f04` para `5d9842da32066f92016b0ef82bf2cf605c71822f`. O suplemento compara cinco commits,39 documentos e4 testes,sem produto/config; o consumidor `decision-access.ts` é idêntico. Nenhuma importação automática. Implementações posteriores relatadas de PR29 ficam como candidatas para reconciliação pelos owners.
- O segundo avanço de PR39, para `ba27411a7cda9301aa162680a94153a5e643be4d`, acrescenta apenas três documentos. O [suplemento terminal](consumer-reconciliation-wp12-refresh-2-20261114.json) conserva o run43619631569 em seu W28 `f2cbdb30c1673bc89426db6618d19cb65601c8ef` / S28 `b5eb330f9b914953bf19fa7e265e9db11762cfd2`: 3 pass,0 fail,1 filtered,367 assertions. Forecast KPI auxiliar, BI público BI01 e Question Work passam no recorte UI/domínio; `GNATIVE=false`. Isso não prova Finance R5, BI09/BI10 ou os sete deltas. A [última observação conjunta](source-publication-observation.json) fixa os heads às17:39:59 UTC.

O [registro de proveniência](provenance-final.json) contém trees, parents, autoria original, paths selecionados e limites. Os inputs arquivados, branches anteriores e workspace dirty original foram preservados. Produto foi alterado apenas nos quatro WPs próprios. O único suporte fora deles é o workflow isolado de checks previsto pela rota de CI.md, introduzido em R2. Host, contratos, artifact-store, UI geral e IA permaneceram com seus owners.

| Marco | Commit | Tree |
|---|---|---|
| R1 | `3c20b46b4aa97bced6fb3f13c2f9c891cf8cf3b5` | `de5d3f65d6d262c05a6447aa21f26c63dfbbf1c1` |
| R2 | `88b9b6bff53a4f64d37d04ddc868f1443cecf5b3` | `e7e471f64dfd7a34c9d4143968d76b711b0a2966` |
| R3 | `9de58454924b072b6e571b5b4ebcd70f95e596df` | `6f2cb4d131ba5437f70d7700e3274cc26a22630c` |
| R4 | `229d66fa59ceebbc4b3683565670698f2cf3aa65` | `1fd989023150ac85fd9bd48e7196eddce2c49607` |
| R5 | `4f82cf10ae6766c56e9bf1862fc5198a5246cb5c` | `67af8927297fa12ca7d84077e0450833a9738c52` |

## O que mudou e o que está demonstrado

### Planner e BI — WP03/WP05

R1/R2 corrigem a normalização de cenários e a identidade de taxa numérica explícita, preservando ausência versus zero, moeda/FX, fontes, privacidade e a separação actual/forecast. A fixture de fonte captura o baseline depois das admissões legítimas; S3 confirma o arquivo corrigido sem reduzir as 64 assertions.

R4 acrescenta o produtor pareado `createPlannerScenarioBiHost`: baseline e candidato C08 pertencem ao mesmo caso, são lidos com suas fontes e passam pelas cercas de freshness/lease/snapshot. A apresentação usa os resultados canônicos existentes de comparação e waterfall. BI09 mantém subtotal conhecido e total completo separados; BI10 usa períodos explícitos dos componentes. O adiamento de45000 de novembro para dezembro conserva delta anual zero e não inventa pagamento, data ou juros.

O caso positivo com cobertura real N-A/shared calcula **240000 → 235000**, com **delta completo−5000**. A cobertura e o total não são atribuídos manualmente pela fixture. Esse caso passou em S8, embora a seleção S8 inteira tenha falhado por quatro inicializações de fonte. R5 usa o bootstrap canônico de dashboard/procurement; S12 passa4/0/77, incluindo zero/ausência/FX e os contraprovas de escrita aninhada, troca do par e lease final. O host de composição ainda precisa conectar `projectedScenario` BI09/BI10; o resultado instalado não está aceito.

### Decisões — WP11

Os deltas finais de #40 foram consumidos seletivamente, conservando a verificação Finance de renovação. R2/R3 retêm o Request original até depois do último callback externo em leitura, choice preview, aplicação, status, draft, mutações e stores de resultado. S7 passa19/0/487, com16 variantes de revogação tardia em C08/UI e controles positivos.

S9 passa a jornada humana de escolha→aplicação preparada→receipts/histórico com71 assertions. Alternativas, análise C10, premissas, pergunta, escolha, proposta, receipt, períodos e versões do ledger ficam vinculados. A evidência posterior à aplicação usa um adapter explícito de evidência arquivada; isso demonstra a projeção e não substitui a autorização histórica instalada nem um restart de C17.

### Portfólio, thresholds e histórico — WP13

W20 foi incorporado com seus inputs e provas. As leituras próprias de histórico/proof/reconciliação usam snapshot readonly coerente, mantêm Request e rejeitam escrita aninhada mesmo quando um callback tenta engolir a falha. Os cinco leitores de campanha e o ramo ausente revalidam a autoridade final;12 casos de lease passaram em S5. Thresholds, sensibilidade e condições continuam apoiados no cálculo e nas fontes canônicas. O full replay ainda tem os limites de desempenho abaixo; não foi substituído por recusa conservadora ou solver isolado.

S5 confirma individualmente histórico/proveniência, reconciliação, mudança real de fonte/preço e quatro casos de persistência com `dispose → openLocalStore`. Sua conclusão agregada permanece failure. S13 passa a aplicação confirmada de dois domínios e a reserva durável depois de falha real de precommit. A correção R5 reconhece somente o incremento global de aggregateRevision devido à reserva de cases; compara todo o restante do envelope original. StorageVersion, incarnation, receipts, provas e ausência de redispatch ficam exigidos, inclusive depois de reconstruir o executor.

### Limite exato das provas C17

S10 passa o replay de pedidos canônicos persistidos de pai e filho, reabrindo por uma segunda conexão SQLite e serviços reconstruídos, verificando ancestrais e rejeitando mudança CAS da fonte. O handle original do produtor permanece aberto: **não é restart do processo/runtime**. Os quatro casos de storage WP13 em S5 fazem descarte e reabertura reais do LocalStore, mas são provas de componente. Reconstrução de serviços W20, segunda conexão S10, reabertura LocalStore e aceite instalado são registrados separadamente.

## Critérios e consumidores

O [índice integral](criteria-index-final.json) preserva IDs,textos,status canônicos e todas as18tarefas, além das19 relações canônicas pertinentes. Cada critério aponta com JSON Pointer/digest para seu mapa e suplemento. Inventário:WP03=112/5tarefas;WP05=108/5;WP11=83/4;WP13=68/4. As371 entradas NOT_RUN e18 tarefas PLANNED pertencem ao plano imutável; disposições e provas posteriores ficam em campos separados. **N-A classifica custo com suporte; nunca dispensa um critério.**

O [mapa de consumidores](consumer-reconciliation.json) verifica37 arquivos em pins exatos e nove relações. Confirma no código os consumidores C02/C08/C10/C17, escolha humana, preparação e review onde descrito. Não declara instalação funcional. O [refresh de WP12](consumer-reconciliation-wp12-refresh-20261114.json) acrescenta13 arquivos verificados e mantém a evidência W/S original. BI público nessa origem é BI01, sem crédito para a nova ligação BI09/BI10.

Sete deltas seguem para composição: snapshot privado de source fences; ligação BI09/BI10; BI08 sem data já corrigido pela Interface; provider de campanha já corrigido por WP10; ligação de campanha/proposta histórica com IA; leitor histórico de candidato no review; e host de reconciliação nas duas factories de portfólio. A ausência de rotas/factories foi constatada apenas nos arquivos/roots examinados nos pins documentados.

## GitHub Actions — registro terminal

Produto somente em Actions, remoto somente GitHub MCP. Cada snapshot S contém apenas `.ci-run.json` sobre seu W; a comparação remota e o hash do request estão no [ledger canônico](ci-ledger-final.json). Budgets e oráculos foram conservados; nenhum epic de grupo, teste local ou repetição vazia. S6 não foi despachado. Os controles Omni registram `not applicable`.

Pass/fail/assertions são contagens de cada seleção, sem soma como cobertura. Falhas repetidas no resumo Bun de S5 são preservadas como emissões repetidas e contam apenas uma vez.

| Seleção | Produto W | Snapshot S | Run / job | Pass / fail / assertions | Duração |
|---|---|---|---|---:|---:|
| S1 | `3c20b46b4aa97bced6fb3f13c2f9c891cf8cf3b5` | `1ee667356ad01f211e7473d2ad5e2fae4b670a9d` | [43615424219](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615424219) / 132509297971 | 8 / 1 / 254 | 1.62s |
| S2 | `3c20b46b4aa97bced6fb3f13c2f9c891cf8cf3b5` | `4c84847a885f09bdb1fee936244b73d7129f764a` | [43615428441](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615428441) / 132509311266 | 6 / 4 / 147 | 2580.75s |
| S3 | `88b9b6bff53a4f64d37d04ddc868f1443cecf5b3` | `4d9eded5fd40d496861d65b7eab093fd5de88d9d` | [43616600555](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43616600555) / 132512903901 | 2 / 0 / 64 | 285.00ms |
| S4 | `88b9b6bff53a4f64d37d04ddc868f1443cecf5b3` | `e3c1070024883ce6ea63a71e2401f1e49914de9d` | [43616603779](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43616603779) / 132512914754 | 32 / 0 / 393 | 113.59s |
| S5 | `229d66fa59ceebbc4b3683565670698f2cf3aa65` | `07f905d3a309b9752525ef34aeafbc5d870bd54a` | [43619812123](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619812123) / 132522704978 | 56 / 3 / 582 | 281.99s |
| S7 | `9de58454924b072b6e571b5b4ebcd70f95e596df` | `f74733ed5c2ef77b53c3a40948a1b9c509bf7ac9` | [43618462688](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618462688) / 132518604113 | 19 / 0 / 487 | 11.73s |
| S8 | `229d66fa59ceebbc4b3683565670698f2cf3aa65` | `f004a08d124a43f67bfc2bd41debe06ecad7b13e` | [43619817826](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619817826) / 132522722250 | 2 / 4 / 23 | 51.73s |
| S9 | `229d66fa59ceebbc4b3683565670698f2cf3aa65` | `711f156d6995fa02f5e15043638bef9847a7f845` | [43619824316](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619824316) / 132522741789 | 1 / 0 / 71 | 5.51s |
| S10 | `229d66fa59ceebbc4b3683565670698f2cf3aa65` | `47f13c881ae8ad52ba0703efe60e2b011a3292c8` | [43620049903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620049903) / 132523487634 | 1 / 0 / 20 | 128.02s |
| S11 | `229d66fa59ceebbc4b3683565670698f2cf3aa65` | `c7a0956f850525a03ccd28b26cb8d90808f4d83f` | [43620619049](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620619049) / 132525249982 | 0 / 1 / 10 | 180.18s |
| S12 | `4f82cf10ae6766c56e9bf1862fc5198a5246cb5c` | `a646c3009b0a348517ee2d2b551fbe0c8e0bc63e` | [43620858830](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620858830) / 132525991986 | 4 / 0 / 77 | 59.16s |
| S13 | `4f82cf10ae6766c56e9bf1862fc5198a5246cb5c` | `4d998e9e8cd22af9e8c475ee5dcb4081336f3d82` | [43621178540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621178540) / 132526990338 | 2 / 0 / 133 | 3.08s |

S1, S2, S5, S8 e S11 permanecem failures. S3, S12 e S13 verificam correções materiais específicas; não reescrevem as conclusões anteriores. S8 possui o caso positivo completo240000→235000. S5 possui quatro positivos de descarte/reabertura, mesmo com sua falha agregada.

## Checks de pacote e guards

[CHECK-R5](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620788510), job132525772062, executa `bun typecheck` e guards sobre R5. Typecheck: **0 diagnósticos próprios /115 externos**, lista idêntica à R3. Guards: **78 regras,1471 paths,43 gates,15 warnings,0 erros do motor**. A conclusão é failure.

Os43gates apontam logs históricos WP11 de PR40. Foram preservados conforme instrução, sem delete/rename/ignore/waiver. A skill `guardrail-usage` requer disposição S0/Maestro; este handoff não a fabrica. Os15warnings incluem dependências herdadas, receipts antigos grandes, declarações antigas de timeout e o audit binário arquivado. O [receipt CHECK-R5](CHECK-R5-result-final.json) contém todos os paths e mensagens, base `a1d37698a7bb097c1578f827eba6a19b9917ef07` e merge-base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`, observados no log.

Artefato14123654958, digest informado pela API `sha256:c8c05cb3151bfcdf1f8e8dab5d30e9c9c3393733c6f805a12df006e1b5af7099`, upload/download MCP confirmados. ZIP não foi extraído ou independentemente hashado localmente. CHECK-R3/R4 também estão arquivados. O check do commit final de receipts será identificado na PR após publicação, sem relabelar esses runs.

## Lacunas exatas e encaminhamento

O [registro de lacunas](remaining-gaps-final.json) é a lista operacional; conserva owners, evidência, ação necessária e estados distintos.

1. **Cinco jornadas longas abertas:** três persist/replay com budget300s; escolha humana com budget180s novamente falha emS11; source-scenario mesmo caso escolhido com budget180s falha emS5. A análise estática aponta custo de clones/replays, mas a atribuição é inferência. Cada observação/autorização continua exigida. A seam transactionAll da composição não causou os timeouts das fixtures S2/S11.
2. **Grant privado de campanha:** S5 observou `ok` onde exigia `unavailable`. É falha compartilhada observada, não contraprova bem-sucedida. O provider correto já existe no pin de PR32 e deve ser composto pelo owner.
3. **Contrato de snapshot:** `FIN-R2-REV-01` permanece aberto paraWP10/S0. Separadamente, no código PR32 examinado, `readPortfolioSnapshot → cases.read → scenario-operation-access → readSourceFences → transactionAll` contamina a raiz readonly. Conectar um callback sem autorização ou pular fences não seria correção válida.
4. **Sete deltas de consumidores:** fixes já implementados emPR31/PR32/PR36 distinguem-se de wiring ausente. Uma mudança posterior de qualquer origem exige reconciliação. O relato de adapters posteriores dePR29 não fecha automaticamente o pinPR32 analisado.
5. **115 diagnósticos externos e43gates de arquivo histórico:** os owners corrigem os tipos; S0/Maestro dispõe o conflito de arquivo histórico. O pacote não está verde.
6. **Provas instaladas e aceite final:** UI/mount/focus/eight charts, NativeMCP, Atlas C17 instalado, AM01–06/C-G7/D-G8 e bundle epic/S0 continuam com seus owners e sem aceite global.

O próximo consumo deve usar os pins e blobs acima, compor os deltas compartilhados e executar somente seleções justificadas por mudança material ou evidência faltante. Preserve cálculo completo, escolha humana, fontes/autorização, moeda/FX, ausência versus zero e todo o histórico de resultados.
