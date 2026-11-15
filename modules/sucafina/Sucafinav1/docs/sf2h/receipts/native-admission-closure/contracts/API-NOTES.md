# Missão64 — origem autenticada e continuidade nativa

## Resultado e responsabilidade

O consumidor64 implementa a ligação entre uma **origem autenticada já existente** e o settlement original de uma Task nativa. Ele reutiliza o registry41, valida a Request e a intenção humana `routines.run`, confere o witness nativo e mantém a autorização de caso, fontes e publicação durante a governança e a execução. A composição examinada ainda não fornece o produtor legítimo dessa origem nem seu ciclo completo de C15, resposta humana, readiness e reload. O default permanece sem origem e sem anúncio de operações de rotina/watch. Instalar apenas o hook não produz admissão nativa. [Consumidor64][admission64] · [host base][host]

As interfaces públicas de SessionV2, Maestro, Task, Permission, Relay e Schedule existem. A entrega exigida do owner externo é uma implementação privada e verificável que una essas interfaces à autoridade SF, respeitando seus próprios controles. Um callback que devolve um owner a partir de IDs, um mapa preenchido por fixture ou um grant sintético não satisfaz essa entrega. O [contrato estruturado](capability-contract.json) define as obrigações e as provas; [source-pins.json](source-pins.json) identifica as fontes imutáveis e os bytes do consumidor64 analisados, verificados por GitHub MCP no source W `0846710321afab84e0c0a3a79653f41df8a284a0`.

O owner semântico da origem nativa e de C15 deve ser designado por S0 para os pontos de composição em `native-host.ts`, `token-gate.ts` e autoridade SF. A rota prevista de integração seletiva é a missão60/PR65, inclusive para o patch inerte de `host-context.ts` e a montagem dos registros. A lease60 encerrou explicitamente em `faa30fddb7e7b61696b66fd069f51cf18c51125f`; um novo intake requer autoridade reativada ou sucessora, conforme [reconciliação atual](../TARGET-AUTHORITY.json). Essa responsabilidade de integração não concede, por si só, permissão para mudar auth compartilhada ou engines. O pacote64 e o ACK64 continuam definindo o escopo; a referência histórica41 a outros integradores não substitui a sucessão para60. [Pacote64][mission] · [ACK64](../ACK64.json) · [capability41][missing41]

## Porta mínima, com os nomes atuais

Os tipos abaixo são os exportados por `routine-native-admission.ts`. `authoritySessionID`, `intent.caseRef`, `signal` e `current` fazem parte do contrato; não são extensões opcionais. [Consumidor64][admission64]

```ts
type SfRoutineNativeAdmissionIntent = Readonly<{
  planRevisionId: string
  authorizationId: string
  inputDigest: string
  caseRef: Readonly<{ id: string; incarnation: string; version: number }>
}>

type SfRoutineNativeAdmissionBinding = Readonly<{
  request: Request
  context: TrustedUiContext
  authoritySessionID: SessionSchema.ID
  intent: SfRoutineNativeAdmissionIntent
  signal: AbortSignal
  current: () => Promise<boolean>
}>

type SfRoutineNativeAdmissionOrigin = {
  ready: () => boolean
  resolve: (invocation: ToolSafety.Invocation) =>
    Promise<SfRoutineNativeAdmissionBinding | undefined>
}
```

O produtor recebe a `ToolSafety.Invocation` real durante o settlement já iniciado pelo core. Ele deve ter conservado, desde a admissão legítima, a relação entre a Request autenticada, o principal e a Session Maestro. Os IDs servem para conferir essa relação previamente estabelecida; conhecer `sessionID`, `messageID`, `callID` ou `SF_ROUTINE_INPUT.owner` não a cria. `sf_maestro` permanece um perfil residente distinto do Maestro nativo. A captura41 exige o frame `CapabilityInvocation` com issuer `core`, raiz Task, lineage apropriada, Session/agent/Location/model atuais e tool part realmente persistido e ainda running. [Runner][runner] · [captura41][owner] · [host residente][nativehost]

`resolve` deve ser uma consulta rápida, limitada e somente de leitura. Ele não inicia provider, cria Session, responde Permission, espera input humano, publica plano/grant ou chama dispatcher. Para a mesma invocação, retorna **a mesma referência de binding** durante sua vida autorizada, conservando as identidades de Request, contexto, signal e callback. Binding, intent e caseRef devem ser imutáveis; os fatos do contexto e os headers da Request não podem ser alterados. `current()` revalida a autoridade nativa, C15 e a continuação humana efetivamente admitida. Após encerramento ou revogação, não pode voltar a `true`. Essas são obrigações do produtor consumidas pelas comparações e fences implementados64. [Consumidor64][admission64]

A montagem deve usar `authority.host.requestFor(context)` e `authority.human.authorize(context, "routines.run", intent)`. O último exige o payload completo, incluindo `caseRef`, admitido para a ação exata. `routines.admit`, um lease de leitura ou uma autorização de outro payload não basta. A criação/preparação inicial ocorre antes de existirem plan revision e authorization; ela precisa de sua própria admissão autêntica. A Request final de run contém aqueles fatos canônicos depois de produzidos pelo fluxo nativo. [Autoridade humana][human] · [tipos de autoridade][sfexecution]

## Ordem efetivamente implementada

O `ToolRegistry.settleWith` nativo chama `ToolSafety.run` diretamente; nesse caminho não existe uma chamada anterior de `ToolSafety.before`. A composição de governança põe o owner hook fora do effect `guarded`, que executa `protectPlan`. Isso permite estabelecer a lease antes da verificação de governança, sem alterar ou ignorar essa verificação. [ToolRegistry][toolregistry] · [governança64][governance64]

O caminho64 tem a seguinte ordem, incluindo as duas verificações diferentes do registry:

1. Identificar a Task/workflow e o plano SF canônico. Resolver a origem sob o signal de vida do admission. Conferir contexto UI, método POST, signals e igualdade exata `requestFor(context) === request`.
2. Entrar em `registry41.withRequest(context, request, ...)`, sob o signal combinado da Request e da origem. A aquisição do registry valida vida, autoridade, geração e prazo **antes** da captura64.
3. Dentro desse escopo, capturar o owner nativo real. Comparar `authoritySessionID`, plano, authorization, digest, caseRef e metadados retidos. Revalidar caso/incarnação/versão, SourceRefs, publicação e `RelayWorkflowBinding.revalidate`, com uma nova conferência de identidade e autoridade após esses awaits.
4. Executar `registry41.run(invocation, guarded)`. Ele recaptura a evidência nativa e estabelece a trava de replay/Request duplicada antes de deixar `guarded` adquirir a lease.
5. Adquirir `governance.tryBind`. Uma lease já existente é recusada sem ser substituída. Revalidar, executar **uma vez o effect original**, revalidar antes do retorno e liberar apenas a lease adquirida.
6. Fechar entry e escopo da Request em qualquer saída. O runner continua responsável por registrar o término do tool call. [Consumidor64][admission64] · [registry64][registry64] · [governança64][governance64]

Portanto, `withRequest` precede a primeira captura, e o replay claim de `registry.run` precede `tryBind`. Não se afirma que `registry.run` precede aquela primeira captura. Essa distinção impede que um replay recusado substitua ou revogue a lease de outra chamada ativa, inclusive quando o replay usa outra Request.

**Na rota64, o hook é o único dono de `withRequest` durante esse settlement.** O produtor não deve envolver o runner inteiro no mesmo `withRequest`: o registry41 recusa `CurrentRequest` aninhado. Ele entrega a associação autenticada; o hook abre o escopo. Também não deve chamar `dispatchSfRoutineNativeTask`, `exclusive` ou `resume` a partir da Task que o coordenador já está executando. [Registry64][registry64] · [dispatcher41][dispatcher]

## Cancelamento e duração da autoridade

O admission possui um signal de vida que interrompe a espera de `origin.resolve` quando é descartado. Depois da resolução, o signal combinado da Request e da origem protege também a aquisição e os awaits anteriores ao corpo Task. O registry inicia uma aquisição cancelável antes de esperar geração/autoridade, aplica o vencimento da Request com relógios civil e monotônico e limita o escopo a 300.000 ms. `revoke`, `invalidateGeneration` e `dispose` alcançam aquisições pendentes e escopos ativos. [Consumidor64][admission64] · [registry64][registry64]

O produtor deve abortar seu signal quando perde autoridade nativa, C15 ou continuidade. Retornar `false` apenas na próxima consulta não substitui esse signal durante uma operação em andamento. Da mesma forma, a interrupção de um Effect não cancela efeitos ocultos dentro de uma Promise; a obrigação de `resolve` ser rápida e somente de leitura evita trabalho independente que sobreviva ao caller. A montagem proposta descarta admission/registry antes do shutdown assíncrono da execução, sem selecionar uma Session alheia para interromper. [Patch inerte](../assembly/host-context.patch)

## APIs existentes e limites de composição

Os métodos abaixo pertencem às interfaces obtidas dos Services pelo Effect; a notação não representa chamadas estáticas nos tags.

| Fronteira | Interface pública existente | O que ela não comprova sozinha |
|---|---|---|
| Nova Session | `SessionV2.Service.create` | Associação da Session a um principal SF autenticado. |
| Prompt durável | `SessionV2.Service.prompt({sessionID, prompt, resume:false})` | Provider executado ou resposta realmente dada por uma pessoa. |
| Escopo restrito | `SessionStore.Service.narrow`, `SessionV2.Service.setPermission`, `SessionSubagentModels.Service.set` | Admissão C15 ou restrição automática de todos os filhos. |
| Execução | `SessionExecution.Service.exclusive/withRunner` | Autorização para adotar outro owner ou repetir dispatch durante uma Task ativa. |
| Plano e publicação | `maestro_record_admission`, `maestro_record_plan_revision`, `RelayWorkflowBinding.acquire/revalidate` | Permissão para inventar upstream Task, review, approval ou grant. |
| Aprovação de plano | `maestro_present_approval`, `maestro_record_approval`, `maestro_grant_authorization` | Existência de uma rota SF autenticada que mostre e transporte a resposta humana. |
| Pergunta Permission | `PermissionV2.Service.askExplicit/reply` | Aprovação do plano ou consentimento para responder automaticamente. |
| Watch | `CapabilitySchedule.make`, `schedule_manage`, `ScheduledTaskPort.Service` | Scheduler instalado e autoridade nova em cada ocorrência. |

Fontes da tabela: [Session][session], [scope][scope], [store][store], [modelos de filhos][childmodels], [execution][execution], [planejamento][planning], [publicação][publication], [approval][approval], [Permission][permission] e [Schedule][schedule].

O produtor autorizado pode criar uma Session com agente nativo, restringir tools/skills/budgets antes do primeiro prompt, preservar denies de Permission, admitir inbox com `resume:false` e executar pelo coordenador existente somente após C15 estar válido. Isso exige uma política delimitada: uma ação humana SF não concede todo o toolbox Maestro. `TaskPermission.inheritedPermissions` conserva denies e regras `external_directory` do pai e acrescenta denies de primary tools; não transmite todos os allows nem copia automaticamente `SessionScope`. Os filhos requerem tratamento concreto. [Scope][scope] · [permissões de filhos][childpermission] · [Task][task]

Há também um limite de contexto: o coordenador captura seu runtime com `FiberSet.makeRuntime`. Um `withRequest` exterior a `execution.resume` não transfere genericamente o `Context.Reference` para o drain. Essa observação descreve composições alternativas41; **não** é receita para a rota64, que abre o escopo dentro do hook da chamada real. O patch64 não troca coordenador nem usa o problema de propagação para justificar um segundo dispatcher. [Coordinator][coordinator] · [execution local][executionlocal]

## C15, perfis e provider

`createSfTokenGate.register` já existe e recebe `SfNativeAdmission`, `TrustedExecutionBinding`, modelo, Location, `revalidate` e `persistReceipt`. O tipo de admissão é residente: inclui selected/profile, manifest e recibos de skills reais. O registro verifica correspondência Session/profile/model/Location, run/case, montagens do guard e o budget mínimo das skills admitidas. A composição examinada não instala um produtor equivalente para o Maestro nativo. Citar a existência de `register` não elimina esse descompasso. [Token gate][c15] · [tipos de runtime][sfruntime]

O owner deve fornecer a política aprovada para Maestro e filhos reais, seus limites de contexto/resposta/tools/skills, recibos autênticos e ciclo de cancelamento/reautorização em cada continuação. `sfLineage` reconhece propriedade persistida/reservada, agentes SF, skills/operações SF no scope e ancestralidade. Retirar esses marcadores, reinterpretar `sf_maestro`, forjar skill receipts/tickets ou usar uma rota de provider sem o guard seria contornar C15. Após reload, um ticket process-local perdido precisa de readmissão genuína; não se recupera por copiar o ID da Session. [Token gate][c15]

Existe uma limitação adicional de compatibilidade. O caminho hospedado `ExecutionHost.turn.execute` registra calls de tools Orchestra com `provider.executed=true` e metadata `orchestra.executor = "orchestra"`. A captura41 e o adapter41 recusam esse flag. Isso não torna todo call hospedado sintético; significa que esse caminho não passa pelo contrato atual de witness. A prova inicial deve usar um caminho nativo aceito. Uma adaptação futura para hosted calls precisaria de contrato autorizado que conserve proveniência e guards; esta entrega não remove o check nem muda engine. [Runner][runner] · [captura41][owner] · [adapter41][adapter]

## Plano, apresentação e resposta humana

`SF_ROUTINE_INPUT` pode transportar fatos já autorizados de caso, fontes e publicação para o planejamento. Ele não produz autoridade: `maestro_record_plan_revision` exige a admissão nativa apropriada, evidência upstream real e aquisição de publicação por `RelayWorkflowBinding.acquire`. Não existe um método público chamado `RelayWorkflowBinding.materialize` nas fontes inspecionadas; materialização é o resultado de `acquire`. [Planejamento][planning] · [publicação][publication]

O fluxo de aprovação já exige plano/validação canônicos, contexto atual, revisão independente `APPROVE` e a apresentação exata concluída. O reply deve ser a primeira mensagem direta do usuário depois dessa apresentação e ainda ser o reply atual quando a autorização é concedida. A rota SF precisa mostrar a apresentação real e transportar a resposta efetiva do principal para a Session de origem. Uma mensagem sintética, saída Task ou `approve` inserido pelo adapter não é essa resposta. [Approval][approval]

Uma pergunta Permission pendente tem identidade, regras e resposta próprias. Sua resposta autorizada pode usar `PermissionV2.reply`, mas não substitui o aceite do plano, e o aceite do plano não autoriza responder `once`/`always` automaticamente. O hook64 não responde nenhuma das duas perguntas. A ausência da montagem humana é um blocker de integração verificável, não ausência das APIs nativas. [Permission][permission] · [consumidor64][admission64]

## Retorno, reload e leitura histórica

Os leitores nativos e o adapter41 já expõem admission/run/execution/artifact. Entretanto, o registry41 só emite owner durante o settlement vivo e original. Depois que essa chamada termina, o witness running não pode ser recriado para ler histórico. `SessionV2.CreateInput` contém `id`, `parentID`, `agent`, `model` e `location`; o `SessionStore` público inspecionado não oferece um escritor genérico de atestado SF de principal. Perder um mapa efêmero não autoriza reconstruí-lo usando `SF_ROUTINE_INPUT.owner`. [Session][session] · [store][store] · [adapter41][adapter] · [registry64][registry64]

O produtor deve fornecer evidência durável confiável da origem e resolução com Request recém-autenticada para um **escopo somente de leitura**. Esse escopo revalida principal/grants/policy/access, caso/incarnação/versão, fontes e publicação; não inicia dispatch. A prova exige Task/provider reais, terminal Task/Relay, referência e digest do artefato imutável e um consumidor factual depois do reload. A mera existência do artefato não prova consumo. Qualquer nova continuação de modelo também precisa de C15 revalidado. Esse contrato não propõe outro banco de runs/Tasks. [Adapter41][adapter] · [retorno Relay][relay]

## Readiness escopada e Schedule

`Tools.Service.register` é uma API pública com requisito `Scope.Scope`; `ToolRegistry` conserva a identidade do registro durante materialização. Porém `contribution.ts` registra uma vez o array de descriptors que existe naquele momento. Mudar esse array depois não registra tools novas. `origin.ready()` é somente uma leitura síncrona e não fornece subscription. O patch inerte64 não inventa eventos de readiness nem afirma resolver re-registro dinâmico. [Tools][tools] · [ToolRegistry][toolregistry] · [contribution][contribution]

A composição60/origem deve demonstrar uma fonte real de mudanças de lifecycle, abrir e fechar apenas seu Scope de registro e instalar descriptors antes da materialização relevante do provider. Readiness perdida deve remover anúncios e recusar calls antigas mesmo já capturadas. `ready:true`, um owner disponível apenas durante uma Task e um escopo histórico são coisas distintas; nenhum deles pode substituir os demais. Sem produtor instalado, o default continua com zero descriptors de rotina/watch. [Contrato](capability-contract.json) · [patch inerte](../assembly/README.md)

Schedule também tem APIs reais: `schedule_manage` exige `CapabilityInvocation` própria, owner/Location do frame, `CapabilityPolicy.authorize/commit` e scheduler existente. O owner não vem de um seletor de input. A montagem deve vincular ações humanas `schedules.create/update/pause`, Permission quando exigida, idempotência de revisão/run e autoridade SF/C15 nova por ocorrência. A Request expirada não é autorização permanente. `prepareWatch` continua unavailable e `sf_watch_prepare` deve permanecer oculto até a admissão real ser provada. [Schedule][schedule] · [porta scheduled task][scheduledport] · [serviços SF][services]

## Aceite e classificação das provas

O contrato usa oito critérios concretos `CAP64-*`: origem; política/C15; humano; Task/Relay; reload; lifecycle; readiness; Schedule quando habilitado. Cada um contém condição positiva e evidência inadmissível em [capability-contract.json](capability-contract.json). O recibo real deve identificar source W/tree e composição instalada, modelo/provider, Session/message/Task/Relay/job, revisões, artefato/digest e consumidor, sem tokens ou credenciais.

Este documento é análise de fontes e contrato de integração. Testes com frames, reviews, grants ou Tasks produzidos por fixture continuam prova de componente mesmo quando chamam serviços reais. Resultados hospedados pertencem aos recibos W/S/run/job da execução específica. Nenhum crédito de AM01, AM02, AM03, AM04, AM05 ou AM06 é concedido por este documento; o handoff64 precisa conservar as lacunas, e S0 retém o aceite instalado. [Pacote64][mission] · [handoff41][handoff41]

[admission64]: https://github.com/gustavomhss/Orchestra-SF/blob/0846710321afab84e0c0a3a79653f41df8a284a0/apps/cli/src/sucafina-product/routine-native-admission.ts
[registry64]: https://github.com/gustavomhss/Orchestra-SF/blob/0846710321afab84e0c0a3a79653f41df8a284a0/apps/cli/src/sucafina-product/routine-native-registry.ts
[governance64]: https://github.com/gustavomhss/Orchestra-SF/blob/0846710321afab84e0c0a3a79653f41df8a284a0/apps/cli/src/sucafina-product/routine-native-governance.ts
[host]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/host-context.ts
[nativehost]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/native-host.ts
[human]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/integration/human-authority.ts
[sfexecution]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts
[sfruntime]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/sucafina/Sucafinav1/product/contracts/runtime.ts
[owner]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/routine-native-owner.ts
[adapter]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/routine-native-adapter.ts
[dispatcher]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/routine-native-dispatch.ts
[runner]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/session/runner/llm.ts
[toolregistry]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/tool/registry.ts
[tools]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/tool/tools.ts
[session]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/session.ts
[scope]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/session/scope.ts
[store]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/session/store.ts
[childmodels]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/session/subagent-models.ts
[childpermission]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/tool/task-permission.ts
[task]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/tool/task.ts
[execution]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/session/execution.ts
[executionlocal]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/session/execution/local.ts
[coordinator]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/session/run-coordinator.ts
[planning]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/maestro/coordination/src/v2/tools/planning.ts
[publication]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/relay-workflow-binding.ts
[approval]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/modules/maestro/coordination/src/v2/tools/approval.ts
[permission]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/permission.ts
[c15]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/token-gate.ts
[relay]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/relay.ts
[contribution]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/contribution.ts
[schedule]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/capability/schedule/index.ts
[scheduledport]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/packages/core/src/scheduled-task/port.ts
[services]: https://github.com/gustavomhss/Orchestra-SF/blob/7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85/apps/cli/src/sucafina-product/routine-services.ts
[mission]: https://github.com/gustavomhss/Orchestra-SF/blob/173c3507e40579f1a1a2dfb068bda40084a678bc/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/native-admission-closure.json
[missing41]: https://github.com/gustavomhss/Orchestra-SF/blob/61af072c7385feba8c89ba6044ca09a90941213d/modules/sucafina/Sucafinav1/docs/sf2h/receipts/routine-native-owner-binding/assembly/missing-capability.json
[handoff41]: https://github.com/gustavomhss/Orchestra-SF/blob/61af072c7385feba8c89ba6044ca09a90941213d/modules/sucafina/Sucafinav1/docs/sf2h/receipts/routine-native-owner-binding/HANDOFF.md
