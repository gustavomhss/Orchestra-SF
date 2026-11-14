# WP14 — entrega para revisão de S0

## Estado da entrega

**Implementação própria publicada e verificada cirurgicamente; aceite integral de WP14 permanece bloqueado.** A matriz literal cobre os 91 critérios dos cinco tasks: 52 têm evidência delimitada de componente e 39 conservam pendências de integração, pureza ou prova histórica/nativa. VERIFIED_COMPONENT não significa aprovação integral do critério, do task ou do bundle.

PR: [#38, astra-wp14 → sf2-stack](https://github.com/gustavomhss/Orchestra-SF/pull/38). S0 mantém a revisão e a integração. A PR continua draft; não houve merge, epic ou deploy.

| Identidade | Commit | Tree |
| --- | --- | --- |
| Base preservada | `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` | `acf3b722ad55c090bef8e9dc2b3fac2d9ad570af` |
| Produto executado em 39 testes, W5 | `1240efef88be380c82b29ec422a13c54b42c7b62` | `1ebec1428d581c36c706ddbca97ea2b84d9daa0c` |
| Produto final, W6 | `302332e2d30ecb3426265aac3adaa518b81a5ea3` | `f176fd9024d2dd93ad5a40f5e898c3760b7eb10e` |

W6 altera somente dois argumentos genéricos de `expect` no teste do mapper e acrescenta seu recibo. A transformação TypeScript dos arquivos anterior/posterior gera JavaScript byte a byte idêntico, SHA256 `93befb2f040984bcf6ad193369da88646e1294dcf386e7cf7a2d9de21151f122`. Nenhum run equivalente de produto foi repetido. O commit documental que contém esta entrega mantém os blobs de produto/testes/config/fixtures de W6; seu head/tree e o compare exato estão registrados no corpo da PR.

## Fonte e recuperação

O plano aprovado é [sf2h-plan no commit imutável](https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan). SHA256 de campaign.json conferido: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. AGENTS, START, WORKFLOW, COMMON, S4 completo, WP14 em S0-C, anexos e todos os cinco tasks foram lidos. A divisão histórica de atores não limitou o trabalho.

A recuperação seletiva preserva a base `sf2-stack`, os inputs arquivados e as fontes de outros owners. [Recibo inicial](astra-recovery-01.json) e [pins completos](astra-wp14-input-pins.json) distinguem recuperação própria, inputs publicados e mudanças autorais. Há 44 inputs externos pinados; 43 paths diferem da base e são exatamente os blobs publicados dos produtores. O teste WP10 atlas-store já era idêntico na base. Não houve edição autoral em fonte externa nem merge de snapshot antigo.

## O que foi implementado

| Task | Entrega própria e evidência | Limite de integração |
| --- | --- | --- |
| T01 — materialidade | Fingerprint ignora somente relógio de observação válido, conserva conteúdo, campo, período, versão/incarnação e base da escolha. Cálculos/comparações reais do Planner alimentam o classificador; fontes indisponíveis e mudanças durante awaits recusam. Testes de Planner/materialidade executados em W2. | O host publicado ainda exige evidência original fresh/igual para registrar/listar; a troca material real de fonte pode retornar indisponível antes de produzir before/after. |
| T02 — recall | Conteúdo task é reconstruído pelo mapper e ligado ao ledger autorizado, não apenas a um digest autoconsistente. Ranking explica correspondência e limites; seleção, query, fontes, ancestry, principal e continuidade são reconferidos. Bundle opcional de candidatos mantém o caso nativo corrente intacto. W5 executa 11 testes de recall e os leitores Atlas reais. | Features Planner do host e produtor nativo de candidateAccess precisam ser compostos por WP10/WP11. A seam não concede autoridade por argumento MCP. |
| T03 — outcomes | Observação é comparada à escolha registrada e à mesma base, unidade, moeda, período e cobertura. Ausência/parcial/incompatível não viram zero; delta não finito recusa. Leituras são copiadas e novamente autorizadas após a última espera; resultado não atribui causalidade. W2 exercita seleção e Planner/SQLite reais; W5 cobre ambos os sinais do delta e zero explícito. | Há adapters reais de review/portfólio, mas não há prova de outcome WP14 não vazio salvo/retomado em reunião com revogação no consumidor final. |
| T04 — sinais/invalidação | Dedupe, resolução/reabertura e envelopes conservam dependências e exigem reautorização. Registries herdadas foram protegidas contra troca de binding, seleção, callbacks, aliases, aborto e source fence. W5 cobre 11 dimensões de escopo e dependência irrelevante. | Falta ligação workSignals/ref opaca no C16 e reconciliação explícita de invalidação no consumidor. Os dois writers ainda residem em WP14; ver pendência de pureza abaixo. |
| T05 — Atlas | Tradutor puro chama memoryKindOf/validate reais; os validators reais recusam raw refs e chaves extras nas entries. O mapper recusa pr/logbook, metadados omitidos/malformados e política sem revisão. Owner deriva de identidade empresarial, não de um nome técnico nem de ACL. Nova encarnação/política muda owner/ref/digest. W5 executa nove testes do mapper e dois consumidores Atlas reais. | Política persistida e recall com SessionV2/SkillLoad/MCP privados reais continuam fora da prova apresentada. |

A compatibilidade Procurement reportada pelo WP12 foi corrigida em W4: o adapter recebe exatamente o método callable `ReturnType<typeof createProcurementSourceResolver>["resolve"]`, aceitando o callback simples e o callable enriquecido do WP10. O teste com o produtor WP04 real passou e o TS2322 do caller `business-services.ts:188` desapareceu. [Handoff ao WP12](https://github.com/gustavomhss/Orchestra-SF/pull/39#issuecomment-6875602499).

## CI executado e limites

| Gate | Identidade executada | Resultado |
| --- | --- | --- |
| Seis arquivos explícitos de produto | [43584174407 / 132415011849](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584174407/job/132415011849), W5, S=`7376413d8d6b07dd9e86f3f1fc8e1e1a495fe6f1` | **39 PASS, 0 FAIL, 556 assertions, 75,47 s** |
| Compatibilidade Procurement | [43582881542 / 132411172526](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582881542/job/132411172526), W4 | **1 PASS, 0 FAIL**; controle Omni not applicable |
| Package typecheck e guards finais | [43584536897 / 132416102283](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584536897/job/132416102283), W6, C=`760cf0549a5432819f3a3d4a42f87fdbedfb1ece` | **Typecheck FAIL: 139 diagnósticos, zero em paths WP14. Guards PASS: 78 regras, 609 paths, 0 gates, 11 avisos, 0 erros** |

O controle Omni de W5 passou: nonce `9e17f5aea604f4749dddda65fe88795b`, dois testes declarantes, cinco spawns e zero delegados. Request SHA256 `85d617de1af4bf379ffb65c7f26808844292a9588edb4161b6c14482c45cf5f4`. Cada snapshot é filho direto do produto declarado e difere somente por seu envelope, conferido via GitHub MCP compare. Os validadores canônicos de request/location foram preservados; nenhuma seleção vazia, suite global ou epic foi usada.

[Histórico legível e nomes dos testes](ci/wp14-ci-analysis.md), [diagnósticos atuais e hashes](ci/wp14-ci-current.json) e [todos os requests, runs, snapshots e artefatos](astra-wp14-evidence.json) conservam as falhas anteriores. W2 teve 57/58 e não é renomeado como green; a precisão de invalidação foi corrigida e passou em W3/W5. W5 teve dois erros de tipo no teste, removidos por W6. Não se somam esses runs para inventar uma execução final dos 17 arquivos.

Os 139 diagnósticos restantes pertencem a 52 paths e são idênticos aos de W4. Localização/ownership não estabelece origem causal: contratos pinados podem expor incompatibilidades em callers. O conjunto completo é entregue aos owners/S0, sem arrastar uma composição inteira para apagar o FAIL. Os 11 avisos de guards são dez dependências em manifests preservados da base e um double-cast preservado em decisions/analysis-acceptance; nenhum ignore ou aprovação Maestro foi introduzido.

Artefato do check final: `14110035678`, SHA256 informado pelo GitHub `d07f060138fc5b169964f62a0087d27247389eacef334df3663ad22703a19c83`. Os logs decodificados foram lidos e hasheados; os ZIPs não foram baixados nem declarados verificados.

## Prova de memória durável

O teste W5 grava pelo caminho real C08/Atlas, executa scanner real, repete a emissão sem duplicar o evento, fecha/reabre SQLite e lê em outro processo. Não substitui o registro Atlas por catálogo ou fixture de memória.

- Scanner: gitleaks 8.30.1; SHA256 `88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509`.
- Escrita `committed` e replay `already-committed`: evento `3373db39d643a7146deb7318c041027e2ab9f5208ed79add825c056ea9cd763e`.
- Digest do registro preservado: `723a8cfd4f715f5e6aa3ae63106effb7d394ec4ae5da4c5753cb490b0b476112`.
- Processo pai 4045; processo filho 4095; recall autorizado com exatamente um match; outsider e principal revogado retornam unavailable.

O receipt declara **nativeSessionWitness:false**. É prova executada de SQLite/Atlas/scanner/replay/reautorização em integração com contexto controlado. Não é execução nativa SessionV2/MCP nem aprovação AM05/GNATIVE/G7/G8.

## Reconciliação do finding Planner do WP10

O run [43580252381](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580252381), snapshot `dd648c423ab97fbe6e806b620057a328a5816b5f` sobre `f075e9824b7d8aed50b7f42c597528ef198177db`, terminou com **198 PASS, 12 FAIL e 2 SKIP em 212 testes**. Os 16 testes Planner passaram. Os dois fluxos que antes excediam 105 s passaram em 45,206 s e 45,544 s, mantendo os limites de 105/120 s.

Isso reconcilia a latência do recall direto UI em `reopened.atlas.memory.recall` naquele pin. O resultado não corrige por si as features do ranking WP14 nem cria acesso nativo a precedentes. Também não é prova do head posterior `0cf10879`. As falhas restantes do run são Dashboard, ordem da fixture shell-recovery e quatro deadlines de alternative-selection, discriminadas no [adendo final](owner-findings/consumer-audit/0cf10879/ADDENDUM.md) e no [resumo executado](owner-findings/consumer-audit/0cf10879/product-final-summary.json).

## Pendências concretas e ownership

1. **WP10/WP11 — reavaliação após mudança real da fonte.** Compor autorização da fonte atual e comparação before/after sem exigir que a evidência antiga continue fresh/igual. Ligar a revisão/materialidade existente ao fluxo real; manter a escolha original e exigir nova justificativa humana para mantê-la.
2. **WP10/WP08/WP14 — C16/Meu Trabalho.** Ligar workSignals, emissão durável de refs opacas e destino autorizado. O host possui colaboração real, mas ainda omite esse callback; não usar lista fixture.
3. **WP10 — features de recall Planner.** Consumir deriveAuthorizedRecallFeatures após a releitura autorizada. Patch0001 foi entregue; o inferidor local ainda ignora casos suportados por calculation/costCoverageBasis.
4. **WP10/WP11 — candidatos nativos.** Produzir o bundle autorizado por invocação com caso, capture Atlas, fontes, ancestry e continuidade. Patch0002 fornece propagação da seam, não o produtor completo. Não reescrever o binding nativo para fingir que o precedente é o caso corrente.
5. **WP10 — invalidação no consumidor.** Demonstrar consumo dos envelopes/reautorização na composição ou a política equivalente sem cache entre invocações. O scope lexical UI observado é reconhecido; ausência de chamada ao helper, isoladamente, não é prova de vazamento.
6. **WP07/WP10/WP13 — revisão e portfólio.** Demonstrar outcome WP14 não vazio em material/reunião/histórico após reinício e negativa de revogação. Os leitores históricos e adapters existem; teste genérico/coleção vazia não fecha esse critério.
7. **WP10/WP14/S0 — pureza global não atendida.** signal-registry e outcome-selection ainda escrevem C08; source-access contém I/O concreto sob WP14. Patch0003 propõe mover os dois writers ao host com contratos/imports e formatos preservados. Está **NOT_APPLIED**, sem CI, e não resolve sozinho o I/O restante. Essa violação não é reclassificada como PASS por herança.
8. **WP10/WP09 — C07/watch.** A composição atual declara a porta nativa indisponível. Não foi criado scheduler substituto.
9. **Owners dos paths/S0 — typecheck e qualificação integrada.** Reconciliar os 139 diagnósticos, compor os outputs por pins e executar as provas nativas/globais e o epic somente no bundle final. Os prazos/leases históricos T+20/43/68/75 não foram retrodeclarados cumpridos.

Os três [patches para revisão](owner-findings/recall/README.md) não alteram branches alheias. Os mapas de consumidores distinguem código observado, teste de componente e execução efetivamente demonstrada.

## Índice de evidência

- [91 critérios — Markdown](astra-wp14-criteria.md) e [JSON literal completo](astra-wp14-criteria.json).
- [Manifesto dos arquivos próprios](astra-wp14-product-manifest.json) e [inputs publicados com pins](astra-wp14-input-pins.json).
- [Requests, W/S/C, runs e artefatos](astra-wp14-evidence.json).
- [Integridade dos arquivos documentais e equivalência literal dos critérios](astra-wp14-publication-integrity.json).
- [CI legível](ci/wp14-ci-analysis.md) e [139 diagnósticos atuais](ci/wp14-ci-current.json).
- [Auditoria inicial de consumidores](owner-findings/README.md), [adendo f075](owner-findings/consumer-audit/f075e982/ADDENDUM.md) e [adendo 0cf com resultado final](owner-findings/consumer-audit/0cf10879/ADDENDUM.md).
- [Propostas de integração e de transferência dos writers](owner-findings/recall/README.md).

Operações remotas foram exclusivamente GitHub MCP. Os únicos cálculos locais foram leitura, hashing, validação de requests/recibos, parsing de logs e transformação estática de tipos. Não houve testes locais de produto, alterações em engines/Azure/identidade/políticas financeiras, restart de desktop/server, reativação de workers antigos ou merge em dev/deploy.
