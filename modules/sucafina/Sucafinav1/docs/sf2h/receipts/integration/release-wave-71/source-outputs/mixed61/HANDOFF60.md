# Missão61 — handoff terminal de Planner/Procurement

## Resultado e escopo

A implementação delimitada está entregue em **mixed-source-proof / PR draft73**, com três produtores corrigidos e seis arquivos de testes/fixtures. **Os 33 testes novos passaram.** A seleção final registrou **43 PASS / 13 FAIL, 56 testes e 588 assertions**; o workflow permanece **FAIL** porque os 13 cenários herdados param no pré-requisito financeiro M31. Nenhuma dessas assertions foi removida, filtrada ou convertida em um negativo conveniente.

Esta é uma release de fonte para preparar um candidato coerente. Não constitui qualificação do stack, prova nativa, jornada instalada, aprovação financeira ou fechamento global. O positivo histórico C17 de Procurement e sua variante de original privado após recriação continuam ausentes.

## Identidades verificáveis

| Identidade | Valor |
|---|---|
| PR draft / destino | [73](https://github.com/gustavomhss/Orchestra-SF/pull/73) → sf2-stack |
| Base material | `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85` |
| ACK61 | `2b22b080b2673c7942351b8f05c2655a038aeebb` |
| Lease 61 | `mixed-contracts-browser61` |
| Produto final W3 | `cb0343be4ad2bb8cf9b68e9db746176ab551c955` |
| Árvore W3 | `fd41730c4c056cd79a339fe978adf78d9de632e9` |
| Snapshot de execução S3 | `7dc844027be65913de226178f2b11a9f682d5396` |
| Árvore S3 | `dfd4d27cbcf7053ace16d9053a4a24f022fe0e51` |
| Run / job de testes | [43668842101](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668842101) /132674151887 |
| Cleanup | job132675184074, success; branch temporária removida e ausência confirmada |
| Commit terminal desta entrega | O commit que contém este arquivo e TERMINAL-AUTHORITY.json; sua identidade é confirmada no corpo da PR73 |

S3 é filho direto de W3 e altera somente `.ci-run.json`, blob `d0e890453415092636f1f692b05ddc08dac3a9b2`. Todos os blobs de produto/testes/fixtures/configuração são os mesmos. A adição documental terminal preserva W3 e não é apresentada como candidato global D/G8.

## Correções nos produtores autorizados

**scenario-operation-access.ts** conserva o Request original, método, URL, headers e binding durante as leituras e após a revalidação final. Também corrige uma incompatibilidade já existente no baseline: o leitor C17 canônico devolve `context.sourceRefs: []` e `components: []`, enquanto os valores públicos carregam sua evidência. O consumidor agora valida a forma real `procurement-v1`, todos os campos públicos selecionados, tipos, valor original único, referência e drilldown exatos, período, versão, moeda e autoridade. Cada SourceRef que existir continua coberto. O teste aceita a observação real, recusa 21 corrupções de cópias depois de leituras genuínas e mantém um positivo real com estimativa ausente.

**recorded-planner-operation-access.ts** observa e compara Procurement antes e depois dos awaits que leem os originais Planner. As observações são clonadas e seus digests materiais comparados, juntamente com a releitura C08 e as cercas de autoridade. A normalização elimina somente `checkedAt` e, em observações fresh, `SourceRef.observedAt`. Projeções históricas, valores e referências continuam integrais.

**procurement-composite-planner.ts** verifica novamente o Request e binding depois de seu último await antes de devolver o preview. Os testes inspecionam a saída interna do produtor antes da proteção externa do caso; esta não consegue esconder um resultado indevido.

O arquivo `product/procurement/decision-host.ts` foi lido e permaneceu inalterado. Não foi encontrado fundamento para modificar um ramo histórico inalcançável nem para antecipar sua captura antes da preparação financeira.

## Provas observadas

| Finding original | Qualificação desta fonte | Limite preservado |
|---|---|---|
| Q57-C17-HISTORICAL-SCOPE-ROTATION | Recusa real do pré-requisito e provas independentes de fonte/grant | **HELD:** falta o original Procurement efetivamente arquivado |
| Q57-MIXED-RECORDED-PLANNER-FALLBACK | **PASS de contrato em W3:** fallback acionado com captura Planner committed, originais preservados e Procurement reautorizado | Procurement externo permanece atual; não representa seu histórico C17 |
| Q57-MIXED-TOMBSTONE-RECREATE | **PARCIAL:** original Planner recusado após recriação; fonte e grant Procurement antigos recusados | Original privado arquivado de Procurement ainda não existe |
| Q57-MIXED-REVOKE-BETWEEN-READS | **PASS de contrato em W3:** eventos entre leituras e após último await foram provocados e recusados | Não equivale à qualificação nativa/instalada ou de todos os consumidores globais |

A captura Planner usou `emitFromLedger` e **gitleaks 8.30.1** reais e retornou `committed`. O testemunho principal registra fallbackCount: 1, duas leituras históricas de cada original Planner e seis observações Procurement fresh. As assertions preservam a projeção original, a alternativa e o valor 80, apesar de atualizações posteriores. O teste do verificador registrado direto altera Procurement durante a leitura Planner e termina em recusa, sem depender da cerca externa.

Os quatro eventos após o último await foram medidos na observação 176 e produziram `stale`, sem projeção, dentro do próprio produtor. Também passaram alterações de ator, revogação, política, revisão de acesso, Request/headers, lease, abort, fonte, membership C08 e substituições de binding/lease.

Procurement usa exclusão canônica, seguida de **replay sintético explícito apenas da linha com o mesmo ID**; o lifecycle real gera as novas encarnações. Isso não afirma que o comando de criação comercial reutiliza IDs. Grants e fontes são sempre produzidos pelas funções canônicas. O antigo grant é recusado e o novo aceito.

Identidades, membership, evento/outbox C08 e dados de negócio são fixtures declaradas. SQLite, admissões/grants, emissores de fonte, cenários, scanner e captura são reais. Nenhum arquivo histórico, digest de original ou grant positivo foi semeado. Os defeitos das 21 cópias são exclusivamente probes negativos.

A comparação de efeitos dos testes mistos cobre `data` e `versions` das três superfícies, incluindo C08; não se amplia essa observação para telemetria integral de todo metadado de lifecycle. Os testes Procurement e de pré-requisito comparam snapshots completos e, quando aplicável, contadores de escrita. As alterações intencionais são feitas antes do checkpoint usado para exigir ausência de efeitos posteriores.

## Histórico de execução preservado

| Execução | PASS | FAIL | Testes | Disposição |
|---|---:|---:|---:|---|
| W1 — [43667290771](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667290771) | 23 | 34 | 57 | Falhas de montagem dos fixtures, 14 falhas herdadas e uma falha adicional do controle Omni |
| Baseline 7e1 — [43667860058](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667860058) | 9 | 14 | 23 | Reproduz exatamente as falhas herdadas sem mudanças de produto/fixture |
| W2 — [43668099377](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668099377) | 24 | 32 | 56 | Admissões corrigidas; incompatibilidade canônica efetivamente exercitada; Omni PASS |
| W3 — [43668842101](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668842101) | 43 | 13 | 56 | 33 testes próprios e 4/4 casos mistos passam; 13 pré-requisitos M31 permanecem FAIL |

Em W3: 12 lifecycle, 1 pré-requisito, 17 authority-egress e 3 recorded-fallback passam. Os 21 probes negativos fazem parte de um teste e não são contados como 21 testes adicionais. O consumidor misto herdado tem 4/4 PASS; scenario-operation-access tem 6 PASS / 13 FAIL. Omni PASS com nonce `b2c561381e0fe447094f42e73c8065bc`, seis spawns e zero delegados. Tempo: 188,95 s; Bun 1.3.14 no runner Ubuntu 24.04.

A última seleção repete todos os casos que falharam. Os dois testes puros de histórico Planner passaram em W2 e não foram repetidos após a correção restrita ao formato externo Procurement; esse resultado permanece vinculado exclusivamente a W2. Requests, logs completos, contagens e hashes estão em [ci/LEDGER.json](ci/LEDGER.json). Todos os quatro runs terminaram e as quatro refs temporárias foram removidas pelo workflow, com ausência confirmada via MCP.

## Pré-requisito financeiro ainda obrigatório

O produtor `prepareDomainCommands` e o adapter HTTP efetivamente retornaram `needs-input / financial-approval-command-unavailable`, HTTP 400. O arquivo Procurement ficou **0→0**, sem mudança preparada e com snapshots/caso/recibos intactos. O teste passou por provar essa recusa; ele não substitui o positivo histórico.

Os13 testes herdados falham no mesmo setup do baseline, antes de seus eventos de corrida ou histórico. Não se qualificam os cenários que não chegaram a executar.

A decisão de contrato pertence a S0/WP00 e ao owner canônico autorizado. Continua exigida a cadeia original: valor 100, escolha 150, preparação canônica `ok` com exatamente um comando, captura protegida real antes de editar e posterior leitura do original sob autoridade atual. Aprovar o registro persistido ou escolher uma alternativa não aprova a substituição ainda não escrita. [M31-S0.json](checks/M31-S0.json) preserva a lacuna, M31 e MI07 abertos e o próximo ato exato, sem propor alteração de alçadas sob 61.

## Estado atual do target e intake

Na reconciliação final, `sf2-stack` estava em `faa30fddb7e7b61696b66fd069f51cf18c51125f`, tree `b3b4f89ddd6a3ca5d570681f91098214b5ce935d`. Esse avanço é somente documental sobre C28 `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, tree `8b07ebf53f492a20ce3381a8b4ec50bd21ec1c6d`.

O [terminal 60](https://github.com/gustavomhss/Orchestra-SF/blob/faa30fddb7e7b61696b66fd069f51cf18c51125f/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/after-c27-60/AUTHORITY.json), blob `83e9c35441aa09e8d81e35bfb8e1a711322e8bf9`, **encerrou sua lease** e proíbe retomada automática. Este handoff é disponibilizado ao intake 60, ou à retomada/sucessor com autorização explícita. **ACK60 não foi observado**, e 61 não assume o stack.

A release permite preparar um candidato com a unidade completa de nove arquivos depois de reconciliar autoridade e preimages. O target não alterou os três paths de produtor da unidade, mas C28 alterou a dependência consumida `product/integration/product-authority.ts`: o blob fonte `2c82d60d220d8d5365da8322bad648a64bbb62d2` difere do target `8d563561be19d4f50a68033d4ba4ac2bf8cb3ea0`. Preserve esse avanço, que propaga incerteza de identidade nas operações de leitura, e requalifique a combinação. Source PASS não se transfere a C28.

1. Confirmar o terminal 61, o HEAD e a autorização explícita de retomada/sucessão após 60.
2. Conferir todos os pre/postimages/modes e aplicar a unidade funcional inteira, preservando alterações mais novas do target.
3. Conferir a closure e criar um novo candidato identificado, com testes dos consumidores afetados na combinação.
4. Registrar ACK com fonte/árvore recebida, decisão de intake e novo candidato; a publicação desta release não é um ACK.
5. Encaminhar a 45 os checks de pacote e guards; preservar M31/C17/MI07 e todas as obrigações globais.

## Entrega completa e checks

- [SOURCE-RELEASE.json](SOURCE-RELEASE.json): autorização delimitada de consumo como candidato e seus HOLDs.
- [FILES.json](source-release/FILES.json), [complete.patch](source-release/complete.patch), `source-release/pre/` e `post/`: nove postimages completos, três preimages, modos, Git blobs, SHA-256 e patch integral.
- [DEPENDENCIES.json](source-release/DEPENDENCIES.json) e [IMPORT-CLOSURE.json](source-release/IMPORT-CLOSURE.json): árvore imutável completa e 92 imports diretos, 44 destinos de repositório, zero não resolvidos no inventário estático. Não são compilação nem enumeração transitiva.
- [CRITERIA.json](CRITERIA.json): quatro findings e 13 IDs de critérios herdados, sem promoção dos critérios globais completos.
- [RUNTIME-REVIEW-W3.json](reviews/RUNTIME-REVIEW-W3.json): revisão independente do binding, dos nove blobs remotos e das provas reais.
- [REQUEST-45.json](checks/REQUEST-45.json): `bun typecheck` em `modules/sucafina` e `apps/cli`, e `bun run check:guards --base origin/dev` na raiz, com base efetivamente resolvida no Actions. **NOT_RUN**, sem inventar aprovação Maestro ou interface de workflow.
- [TERMINAL-AUTHORITY.json](TERMINAL-AUTHORITY.json): encerramento do writer 61 no sucesso da publicação, zero runs próprios em voo e condições de continuidade.

Os 15 WPs, 74 tasks, 17 contracts e 1610 critérios originais, oito seleções finais, AM01–AM06, três revisões FINAL, C/G7 e D/G8 permanecem exigidos no candidato integrado correto. **GLOBAL_RELEASE=false.**
