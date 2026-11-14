# Missão41 — handoff terminal do owner registry nativo

**Implementação independente entregue; ligação produtiva Request → Maestro e aceite integrado permanecem em HOLD.** O trabalho continua na mesma `astra-wp09` / [PR30](https://github.com/gustavomhss/Orchestra-SF/pull/30). O destino original era a sessão33; a autoridade publicada posteriormente nomeia a **sessão42/S0** como sucessora exclusiva de integração. A sessão41 encerra aqui sua lease de fonte `routine-owner-browser41`.

## Produto e entrega

| Referência | SHA |
|---|---|
| Head recebido da missão30 | `d9e1aca275bd04b2066ca84a605c7c315ea14c77` |
| Planning imutável | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Claim da missão41 | `e4ccf93df3e5d3ad0e8c2de0d0b07111902b62ef` |
| W1, fontes privadas finais | `99d225ba024b4de910753d0fce34bf1b9a43281f` |
| **W final, com fixtures corrigidas** | **`86e6a650b2b0a7417f0f8bcbdfdadfe679c8d1df`** |
| Tree W | `294407df8b80276a9f80737fd12531635eccc078` |
| Integração observada mais recentemente | `36521bb47f1d10de8d8bb5d376fdb5d5fa7bc8e1` |

D é o commit que contém este handoff, filho direto de W, com alterações somente neste diretório de recibos. O SHA/tree exato de D é informado no readback da PR e na resposta final; não é inserido de forma circular no próprio commit. Não há alteração de código/teste após W. Consulte [file-manifest.json](file-manifest.json) para os oito paths e blobs, [input-provenance.json](input-provenance.json) para pins de leitura e [selective-intake.json](assembly/selective-intake.json) para o alvo de integração vigente.

## O que foi implementado

Os dois módulos novos são `routine-native-owner.ts` e `routine-native-registry.ts`. O primeiro exige o frame core/root de uma chamada Task nativa, o registro real e vigente do TaskTool e a correspondência com SessionStore, sessão Maestro, projeto, Location, diretório do projeto, mensagem assistant, tool call, modelo, plano, parâmetros, write scope e cadeia canônica de revisão/aprovação/autorização. Usa a avaliação real de Permission sem responder perguntas ou persistir concessões. Mudança nos recibos canônicos invalida o witness.

O registry associa esse witness a um escopo privado contendo a **Request real autenticada** e o contexto SF vigente. `ownerPort.resolve` devolve o mesmo objeto congelado enquanto o vínculo está vivo. Revalida principal, instalação, projeto, Location, Request/headers, policyVersion, accessRevision, identidades de binding/lease/resources e providerGeneration antes e depois de operações assíncronas. Mantém revogação, abort, descarte, fencing de geração, duplicidade concorrente e replay. A lease vence no menor prazo entre o contexto e cinco minutos, também cercado por relógio monotônico e timer.

O cancelamento usa o helper privado já existente `withSfRoutineNativeAbort`. Ele interrompe somente o Effect que pertence àquele escopo; não interrompe sessões por ID. Isso não representa rollback de fatos nativos já confirmados.

As três alterações de suporte conectam o observador ao wrapper privado de ToolSafety já existente, capturam Permission no runtime real e fazem o adapter respeitar a disponibilidade concreta do registry. **Não foi criado outro adapter.** O registry não chama `governance.bind`: a lease mais forte que verifica caso, fontes e publicação continua independente e obrigatória. Não foram criados ledger, run IDs, mensagens de tool, aprovações ou concessões amplas.

## Montagem completa e limite real

A montagem está em [assembly/host-context.patch](assembly/host-context.patch), acompanhada de [preimage](assembly/host-context.preimage.txt), [postimage](assembly/host-context.postimage.txt) e [manifesto](assembly/manifest.json).

| Artefato | Git blob |
|---|---|
| Preimage do host | `2bf1e6e66c13dd099029ec16b1f1ddf1f698dae6` |
| Postimage proposto | `ce3081f75ec97fd3daa7ef4073c51963bdff606f` |
| Patch | `a7b92ff4b0c4a35504d3f3a7872bdf4285ea6f1a` |

O patch modifica o callsite existente `createSfHostRuntime → createSfHostRuntimeWithRoutineNative`, instancia o registry, monta seu observador de ToolSafety, fornece o port ao adapter e descarta os owners antes do shutdown assíncrono. O shared host permanece readonly na PR30; **o patch não foi aplicado nem executado como candidato integrado**. Seus cinco hunks foram reconstruídos contra o preimage e conferidos por hash, sem execução local de produto.

Ainda falta uma capability específica: **a origem de admissão autenticada que possui simultaneamente a Request SF, a autoridade C07/caso/fontes/publicação e a sessão real Maestro/chamada Task já registrada, com continuação que respeite a exclusividade do coordenador**. O frame Task existente não carrega a Request SF. O host residente SF cria a sessão do perfil selecionado, como `sf_maestro`; isso não estabelece ownership sobre o agente nativo `maestro`. Os registros nativos inspecionados não oferecem uma associação de principal SF que possa ser inferida legitimamente.

A capability exata e o owner estão em [assembly/missing-capability.json](assembly/missing-capability.json). `withRequest` é a fronteira privada de consumo, **sem caller produtivo inventado**. O owner precisa fornecer admissão/continuação legítimas e resolver a instalação de descriptors antes da materialização do provider. Uma Task já ativa ocupa a exclusividade que o dispatcher existente também exige; não é válido remover esse guard, reentrar o dispatch ou conservar um frame vencido.

O postimage atual, por isso, anuncia **zero descriptors de rotina**. As cinco operações Task aguardam essa origem legítima. `sf_watch_prepare` também depende de admissão Schedule real. Não se declara disponibilidade porque existe código.

## GitHub Actions e atribuição exata

| Seleção | W / snapshot S | Run | Resultado |
|---|---|---|---|
| Primeira seleção: 2 arquivos novos + 2 anteriores | W1 `99d225ba` / S `3cd1633adb8d08abfc39d18deead854704a318ed` | [43649747094](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649747094) | **14 pass; 2 fail / 2 errors** de carregamento dos arquivos novos |
| Primeiro typecheck + guards | W1 / S `69ad7930e5ae676463f8bd25faeffbd2f2bc71f6` | [43649765609](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43649765609) | Typecheck **84 diagnósticos: 78 externos + 6 próprios de teste**; guards PASS |
| Dois arquivos novos corrigidos | W `86e6a650` / S `f1ec557494f0c20159bbac937cc628071c08b074` | [43650122594](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43650122594) | **87 pass, 0 fail; 368 assertions; 10,72 s** |
| Typecheck + guards finais | W / S `b333525a854cf64099ea8c6601d4da9bb52c8c1e` | [43650142544](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43650142544) | Typecheck **FAIL: 78 externos, 0 próprios**; guards **PASS** |

A correção W1→W alterou somente os três arquivos novos de teste e três recibos: removeu o import direto de uma dependência não declarada, usando o SQL parametrizado do Database existente, e tratou corretamente o Scope de serviços com finalizer. Assertions, timeouts e fontes privadas não foram alterados.

Os 14 testes anteriores passaram em W1; seus arquivos e as fontes privadas são idênticos em W. Não há claim de uma suíte única de 101 testes no mesmo head. Os 78 cabeçalhos finais de diagnóstico são exatamente os da baseline `43644025753` / job `132597678493`, com remoção somente do timestamp/prefixo GitHub para comparação. Eles continuam uma falha real do gate de pacote. Guards finais: **78 regras, 703 paths, 0 gate, 13 warnings, 0 errors**.

Cada S tem W como primeiro parent e difere dele somente pelo envelope CI permitido. O check conserva o head anterior como segundo parent para CAS sem force. Não houve repetição da mesma combinação W/request; a segunda seleção foi reduzida aos arquivos que ainda não tinham executado. [ci-evidence.json](ci-evidence.json), [ci-attempts/01.json](ci-attempts/01.json), [ci-attempts/02.json](ci-attempts/02.json), [hosted-tests.json](hosted-tests.json) e [typecheck-comparison.json](typecheck-comparison.json) preservam os detalhes.

O artefato final de check é **14135224329**, digest **`sha256:0c27488e5836ed59f225128eca53b5dca7bd89b6e66626f20f86321b66f631e2`**, com expiração em **2026-11-28T22:51:28Z**. Metadados e logs foram lidos; o ZIP não foi baixado. O controle Omni foi N/A, sem spawn, e não comprova Omni.

## Serviços reais e fixtures declaradas

São reais Database/SQLite, EventV2, SessionStore, AgentV2, PermissionSaved, PermissionV2, ToolRegistry, AuthoringStore, RelayWorkflowBinding e os leitores nativos. O positivo consulta a publicação real pelo adapter existente e verifica identidade estável. Os negativos exercitam IDs forjados, troca de actor/projeto/Location, cadeia governada, Permission, revogação, headers, policy/access, lease, geração, concorrência, replay e interrupção.

São **sintéticos e explicitamente identificados** o histórico de sessões/mensagens/Task, os registros governados e arm, a emissão da lease Request e o frame core injetado. O Task registrado não executa; a fixture falha se ele for chamado. O predicado de instalação de governança da fixture permite somente a consulta do adapter. Não se exercitaram produtor autenticado real, modelo, revisor, dispatch Task, Relay, Schedule ou consumidor final.

## Intake e pendências preservadas

Esta entrega libera explicitamente os oito paths do manifesto e os artefatos de montagem para **intake seletivo de um resultado parcial** pela sessão42/S0. Não autoriza copiar toda a árvore de PR30. Os contratos e dependências integrados atuais devem ser preservados; quaisquer diferenças estão discriminadas no recibo de intake. O consumidor deve comparar o preimage atual antes de aplicar o patch. Uma mudança integrada material exige candidato próprio; resultados de fonte não se transferem.

O ledger [criteria.json](criteria.json) conserva os **98 IDs/textos exatos do S0-B**: **13 PARTIAL e 85 NOT_REASSESSED**, além das sete cláusulas da missão41. **AM02 e AM06 permanecem NOT_PROVEN**, assim como o aceite global. A origem nativa, continuação/exclusividade, readiness de descriptors, admissão Schedule e prova integrada com consumidor permanecem no owner indicado. A proibição de CI da integradora42 não altera a autoridade cirúrgica usada pela fonte41; S0 conserva dispatcher e aceite finais.

Nenhum teste/typecheck local de produto, servidor, provider real, credencial, restart, full/epic suite, engine edit, controller novo, force, merge em dev, deploy, Azure ou mensagem externa foi realizado. A [revisão de fonte](source-review.json) documenta autoria, críticas resolvidas e os limites da revisão; não substitui revisão/aceite independentes do candidato integrado.

