# R3 — preflight independente da fronteira nativa W26

**Conclusão preliminar: o bloqueio de composição nativa permanece.** Não identifiquei um caminho legítimo que implemente as nove operações de `SfRoutineNativePort` e os cinco callables C07 usando somente os paths próprios e as fronteiras públicas examinadas. A justificativa precisa, porém, é mais estreita que “faltam IDs em TrustedDomainContext”: **o contexto real existe num ponto próprio; ele pertence à chamada SF, e não à chamada Task canônica exigida pelo produtor.**

Este documento é uma leitura focal **PRELIMINAR**, sem autoria de produto. **Não conta como uma das três revisões FINAL**, não aprova critérios, não transfere resultados antigos e não declara execução nativa ou aceite global.

## Candidato e integridade

| Item | Pin |
| --- | --- |
| Produto W26 | `a1434e7ea7340aa1d1c8ce6bb48958b724218170` |
| Tree | `a9398de38c9e684d28c27b0188ab653e75bf3305` |
| Parent W25 | `3d59829e5d9e438cbb443428a9479d7f63b5bf31` |
| Audit desafiado | `agents/c17/W25-native-boundary` |
| Revisor | `/root/independent_r3`, sem alterações de produto |

Conferi independentemente as 47 fontes do audit contra a árvore W26: **47/47 blobs permanecem idênticos**. Os 87 arquivos do seal e os quatro arquivos de owners também conferem. Isso valida os bytes, sem converter a inspeção do builder em revisão independente.

Para desafiar a conclusão, fiz nova leitura focal de 27 dessas fontes, consultei 12 arquivos públicos adicionais por MCP no commit exato e examinei cinco fontes próprias/contratuais adicionais. O inventário registra o limite de leitura de cada arquivo; não afirmo ter relido integralmente os 47.

## 1. Existe um ponto próprio de captura do Tool.Context

Em [contribution.ts](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/apps/cli/src/sucafina-product/contribution.ts), linhas 40–49, o callback `Tool.dynamic.execute(payload, context)` recebe o contexto canônico e o entrega a `bridge.call`. O blob é `8d44320acedc4afec9ffc100f5f6a171cdf26993`, confirmado diretamente por MCP.

É tecnicamente possível conservar esse objeto ou sua identidade em uma associação privada limitada à invocação, em código próprio, sem receber IDs do modelo nem mudar contratos estrangeiros. Portanto, a ausência de `assistantMessageID/toolCallID` no `TrustedDomainContext` **não prova uma impossibilidade técnica de captura**.

Isso não fecha `native.start`. Em [task.ts](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/packages/core/src/tool/task.ts), linhas 425–456, `requireParent` recupera:

- o parent real e sua Location;
- a mensagem assistant real, pertencente ao parent e ao mesmo agent;
- a parte de ferramenta com o mesmo call ID **e nome literal `task`**;
- o input gravado, decodificável e **não `pending`**, igual ao input que o executor recebeu.

O contexto capturado em uma execução de `sf_routine_run` aponta para uma parte `sf_routine_run`. Passá-lo a `ToolRegistry.Materialization.settle` como `task` não muda a história gravada e falha nessa guarda. Criar ou relabelar uma parte para fazê-la passar seria fabricar a proveniência que a guarda exige.

A precisão histórica permanece: o código não exige isoladamente `status === "running"`. Não afirmo que um retry concluído seja recusado somente pelo estado da parte; a exigência é identidade canônica e igualdade do input, além das demais verificações atuais.

Uma captura futura precisaria provar isolamento de operação/digest/Request/lease/generation, recusa de reúso cruzado, cleanup no fim/erro/abort e preservação da recusa ao tentar transformar a chamada SF em Task. Ela seria uma melhoria de transporte de proveniência, sem completar C07 sozinha.

## 2. APIs públicas adicionais existem, mas não entregam a cadeia inteira

O audit não deve ser lido como ausência de toda API pública nativa. Examinei também estas alternativas:

| Superfície | O que efetivamente oferece | Por que não fecha as nove operações |
| --- | --- | --- |
| `ToolRegistry.materialize/settle` | Invoca a ferramenta canônica capturada e fornece o contexto real ao leaf | Não cria a parte Task gravada; o próprio leaf exige sua proveniência |
| `TaskGovernance.Interface` | Hooks `admit`, `beforeTurn`, `settle` dentro de Task | Invocar `admit` isoladamente não executa as verificações externas de parent, placement, modelo, permissão e releitura |
| `Host.Contribution.replacements` | Mecanismo público de composição de serviços | Substituir governança por um serviço próprio permissivo mudaria a autoridade; o mecanismo não emite recibos C07 |
| `Relay.Service.create/rebind/holder/currentStep` | Primitivas reais de arm, holder e posição | Um arm criado não é a admissão governada de uma Task nem a correlação SF autenticada |
| `Relay.Service.transition` | Liquidação sob o avaliador/lock nativo, recebendo binding, settlement, revalidation e checks | O chamador precisa fornecer os fatos autoritativos; inventá-los ou fornecer revalidação vazia contornaria o produtor |
| `RelayWorkflowSession.current/reconcile/settle` | Leitura e liquidação de workflow já ligado por evento nativo `WorkflowBound` | A projeção pública instalada expõe `current/settle`; não fornece `admit`, plano/aprovação C07 ou índice de runs SF |
| `SessionStore`, `SessionAuthority` | História real e ancestry da Session | Presença e ancestry não demonstram os vínculos completos de admissão/run/input SF |
| `governed-task`, `approval`, `UpstreamResult` | Schemas, verificações de fatos fornecidos e parsing de claims | Não produzem a aprovação, a atribuição upstream nem o recibo terminal nativo |

Em [relay.ts](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/packages/core/src/relay.ts), linhas 490–500, `evaluate` recusa arms ligados a workflow com `WORKFLOW_NATIVE_SETTLEMENT_REQUIRED`. O método público `transition` existe, mas a validação de binding e os checks globais vêm do host canônico.

[WorkflowAdmissionV2.before/admit](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/maestro/coordination/src/v2/governance/workflow-admission.ts) exige aprovação/authorization reais, arm da mesma sessão/placement, revisão atual exata, parâmetros e write paths na ordem aprovada, atribuição upstream e identidade real da chamada. [MaestroWorkflowHostV2](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/maestro/coordination/src/v2/workflow/host.ts) conserva esses vínculos, materializa os checks e grava a adoção durável.

Esses produtores não são exports públicos de `@orchestra/maestro`. Usar primitivas públicas para reconstruir seus fatos não elimina a obrigação de preservar sua governança. Copiar algoritmos ou publicar eventos substitutos no CLI tampouco constitui composição da fronteira existente.

Os perfis residentes SF ainda terminam em default deny, liberando apenas skills selecionadas e operações SF. O inventário congelado tem 39 operações, todas `sf_*`; `task` não é uma concessão dessas rotas. Pedir ao modelo que faça uma Task separada não resolve o handoff autorizado nem a correlação de C07.

## 3. Mapa das nove operações

| Operação | Parcela disponível | Fato canônico ainda necessário |
| --- | --- | --- |
| `resolvePlan` | Catálogo publicado e materialização Relay | Revisão de plano autorizada, publicação exata, parâmetros/writeScope e digest completo do input SF |
| `resolveRecipe` | Leitura da publicação selecionada | Associação autoritativa da referência àquela revisão, sem inferir autoridade do modelo |
| `prepare` | Hooks da Task e produtores internos de aprovação/arm | Admissão governada durável associada ao owner, caso, fontes e input SF |
| `readAdmission` | Session/história e schemas públicos | Leitor autenticado de admissão/versão/aprovação/arm/input C07 |
| `readRun` | Workflow corrente de uma Session já ligada | Correlação canônica de run, child, admissão, input e proprietário SF |
| `start` | Task canônica real | Handoff autorizado para uma invocação Task real e retry estável, com revalidação SF no dispatch |
| `listRunRefs` | Infraestrutura de leitura nativa | Índice autorizado de runs C07; varrer Sessions arbitrárias não satisfaz o contrato |
| `readExecution` | Posição/estado do workflow | Recibo terminal imutável com revisão, resultRef e outputDigest emitido na conclusão |
| `readArtifact` | Armazenamento e validador de resultado SF | Artefato real, autenticado e correlacionado ao recibo/input/proprietário/fontes |

A view de `currentStep` contém posição, estado, instruções, pending checkpoint e tools; ela não é o `RoutineExecutionSnapshot` com o digest terminal do artefato. O produtor [result-access.ts](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/routines/result-access.ts) exige essas identidades e releituras antes da liberação do conteúdo.

Não encontrei uma implementação completa somente própria. Isso é uma conclusão limitada às APIs e fontes examinadas, não uma afirmação de impossibilidade de um futuro desenho upstream.

## 4. Knowledge: bloqueio condicional com duas lacunas

[RelayWorkflowBinding.acquire](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/packages/core/src/relay-workflow-binding.ts), linhas 81–99, exige autor e resolvedor **quando o sprint cita referências de knowledge**. Catálogo readonly e materialização sem anchors não devem ser descritos como universalmente bloqueados pela falta de Archie.

Para workflows com anchors, o resolvedor canônico exige um autor Archie real do mesmo projeto, seat nativo, chamada `atlas_context` única/concluída/não executada pelo provider, identidade e input exatos, digests e releitura atual dos units Atlas. O provider próprio hoje devolve explicitamente `SF_ROUTINE_KNOWLEDGE_PORT_UNAVAILABLE`.

Além do export ausente, `authorSession` retorna a Session do binding SF e exige que seu agent seja o perfil SF. Nenhum dos cinco perfis é `archie`; UI não fornece Session. **Exportar a função sozinha não resolve a autoria.** Falta a associação canônica derivada do plano/upstream à Session Archie real. Um ID recebido do modelo, uma busca por qualquer Session Archie ou a troca de actor não satisfazem essa associação.

## 5. Watch: ausência de registro e ausência de implementação positiva

O W26 cria `routineServices` sem `native` e não incorpora seus descriptors ao array anunciado, em [host-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/apps/cli/src/sucafina-product/host-context.ts), linhas 279–283. O callback `memory.prepareWatch` está conectado, mas isso não demonstra o callable.

Há uma lacuna adicional inequívoca em [memory-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/apps/cli/src/sucafina-product/memory-services.ts), linhas 218–228: após resolver o caso, conferir a condição/recipient e revalidar a materialidade real, o caminho termina em:

```ts
return unavailable("native-watch-admission-port-unavailable")
```

**Blob:** `85c3021dec21ab942a8fab04524d48295fd918f7`.  
**SHA256:** `f08c39347bfb9998af6e6a1fea8acfe02e4ab02eed6d5b19d83b5c3057d0d171`.

Registrar só esse descriptor exporia uma recusa determinística. Ainda faltam admissão nativa e vínculos reais de schedule, ocorrência e proprietário. Watch continua separado da contagem de **cinco callables C07**.

## 6. Registro, capabilities e MCP não são execução Relay

`createRoutineCapabilities` produz os cinco descriptors C07 e um de watch. Eles não são incorporados pelo host W26. A contribution nativa registra apenas `input.descriptors`; a bridge privada lista e chama somente esses descriptors sob leases de operação/digest, perfil/skill e autoridade atual.

Um recibo da bridge atesta a operação SF capturada. Ele não se transforma em aprovação governada, arm ou recibo terminal C07. A publicação readonly já usa `AuthoringStore.get/version/documents` e `SkillV2` reais, com identidade de Location/provider e releitura; essa parte tem valor próprio e permanece distinta de admissão/execução.

De modo equivalente, o schedule preserva `started` como admissão durável de prompt. A promoção para resultado exige mapeamento C07, execução e artefato autenticados. Modelo disponível, Session criada, skills carregadas, catálogo publicado ou testes de adapter não demonstram o ciclo Relay completo.

## 7. Próximo contrato e prova necessários

S0 e os owners Maestro/Core precisam fornecer um handoff suportado que conserve uma Task efetivamente gravada, além dos leitores tipados de plano/aprovação/arm/admissão/run/índice/terminal/artefato. WP09 precisa fixar a correlação com `RoutineAdmittedInput`, owner/projeto/caso/fontes, publicação, parâmetros, versão, retry e digest de conclusão. Para anchors, Maestro/Atlas também precisa fornecer resolvedor público e autoria upstream canônica.

Com essas fronteiras publicadas, WP10 poderá compor o adapter nos paths próprios, manter as releituras de autoridade e somente então anunciar os callables operacionais. Watch requer seu vínculo nativo adicional. Nenhum desses nomes de fronteira é apresentado aqui como uma API nova já existente.

A prova posterior deve incluir ciclo nativo instalado positivo até conclusão e consumo após reload, além de contexto/parte/input falsos, placement errado, revogação durante awaits/dispatch, retry exato, cancelamento/falha, mismatch de digests, drift Atlas e isolamento entre owners. Os três pareceres FINAL precisam julgar o candidato final e seus resultados terminais.

## Evidências e limites

- [preflight-W26-native.json](preflight-W26-native.json): decisão, adendos aos IDs históricos, mapa das nove operações e 16 âncoras com blobs/hashes.
- [preflight-W26-native.sources.json](preflight-W26-native.sources.json): integridade e limites da leitura.
- [preflight-W26-native.extra-manifest.json](preflight-W26-native.extra-manifest.json): 12 fontes públicas adicionais obtidas em W26 por MCP.
- [preflight-W26-native.remote.json](preflight-W26-native.remote.json): confirmação remota dos anchors próprios/publicação.

Os 171 critérios e sete tasks permanecem integrais. Nenhum input dos 128 arquivados ou 131 readonly, fonte de produto, parecer anterior, branch alheia ou sf2-stack foi alterado. Essas contagens são restrições preservadas da tarefa, sem uma nova recontagem de inventário neste preflight.

Não executei teste local, import executável, build, typecheck, inferência nativa, navegador ou mutação remota. Nenhum resultado W26 em curso foi aceito por este documento. Os critérios de nove operações/cinco callables e de 5/18/8/39 continuam pendentes onde falta implementação/prova real.

