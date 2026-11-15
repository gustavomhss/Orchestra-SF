# A09 — Equivalência de campos / fonte / acesso

**Contrato congelado:** `execution/contract-catalog.json` + `CONTRACTS.md §5.4`; fonte `product/contracts/ports.ts` (`BusinessPorts`/`PortResult`), `product/contracts/context.ts` (`RoutineResult`), `product/contracts/outputs.ts` (`SfOperationOutputMap["sf_routine_status"]`), `product/contracts/schema-admission.ts`.  
**Schema público único:** `packages/schema/src/sucafina/routines.ts`. Não exporta `TrustedDomainContext`, authorizer, snapshot nem input privado de engine.

| Operação | Entrada exata/versão | Proveniência e saída |
|---|---|---|
| `projection.routine` | `{runRef}` via query fechada GET | `SfOperationInputMap.sf_routine_status` → `runtime.ui sf_routine_status` → `runtime.dispatch` → `decodeSfOperationOutput` → `PortResult<RoutineResult>` |
| `routines.catalog` | `{caseRef:{id,incarnation,version},input:{purpose}}` | `BusinessPorts.routines.catalog` → `PortResult<readonly {documentId,publishedVersion,planRevisionId,writeScope,title}[]>` |
| `routines.prepare-admission` | caso + `{publishedRecipeRef,planRevisionId,writeScope,inputRefs,parameters:Record<string,JsonValue>}` | `BusinessPorts.routines.prepareAdmission` → `PortResult<RoutineResult>` |
| `routines.read-admission` | caso + `{admissionRef}` | `BusinessPorts.routines.readAdmission` → `PortResult<RoutineResult>` |
| `routines.read-run` | caso + `{runRef}` | `BusinessPorts.routines.readRun` → `PortResult<RoutineResult>` |
| `routines.run` | caso + `{admissionRef,expectedAdmissionVersion,caseRef}`, caseRefs idênticos | `BusinessPorts.routines.run` → `PortResult<RoutineResult>` |
| `schedules.create` | `{conditionRef,recipeRef,recurrence,timezone}` | `BusinessPorts.schedules.create` → `PortResult<{scheduleRef,version,state:"needs-review"\|"active"\|"paused"}>` |
| `schedules.list` | `{}` | `BusinessPorts.schedules.list` → `PortResult<readonly {scheduleRef,version,state}[]>` (não fornece detalhe para editar) |
| `schedules.pause` | `{scheduleRef,expectedVersion}` | `BusinessPorts.schedules.pause` → `PortResult<{scheduleRef,version,state:"paused"}>` |
| `schedules.read` | `{scheduleRef}` | nova porta privada **opcional** `nativeUiProducts.scheduleDetails.read` → `{scheduleRef,version,state,conditionRef,recipeRef,recurrence,timezone}` ou `not-found` autorizado |
| `schedules.read-run` | `{runRef}` | `BusinessPorts.schedules.readRun` → `PortResult<RoutineResult>` |
| `schedules.update` | `{scheduleRef,expectedVersion,recurrence,timezone}` | detalhe atual autorizado com o mesmo `scheduleRef` e `version`, depois `BusinessPorts.schedules.update` com CAS original |

## Subcampos de RoutineResult (todos originais)

`{documentId,publishedVersion,principalRef,projectId,correlationId,sourceRefs,pending,admission}`; opcionais `runRef,resultRef,authorizationId,armRef,childSessionId`.  
Para `admission:"admitted"`, `admissionRef` e `admissionVersion` são obrigatórios. Para `preparing,needs-review,denied,unavailable,stale`, ambos são opcionais (ausência é ausência, não zero).  
`sourceRefs` preserva cada `{surface,type,id,incarnation,version,fields,period:{start,end},observedAt}`. `parameters` é JSON, permitindo `null`, `0`, `false` sem coerção ou default. Campos extras no envelope ou resultado são rejeitados, não encaminhados.

## Resultados e estados

`PortResult<T>` da fonte é **somente** `{status:"ok",value:T}` ou `{status:"needs-input"|"stale"|"denied"|"unavailable"|"conflict"|"provider-conflict"|"failed",reason:string}`; sem campo `success` sintético. `scheduleDetails.read` também admite somente `{status:"not-found",reason:"schedule-not-found"}`, e não infere not-found de rota HTTP 404.  
Status HTTP: ok200, not-found404, denied403, stale/conflict/provider-conflict409, needs-input422, unavailable503, failed500. Erro de envelope HTTP retorna 400 invalid ou 413 tamanho excedido, antes de admissão. Capacidade não instalada é `unavailable`, não `ok:[]`.

## Provas negativas designadas a 120/119

1. Payload com chave adicional, method/query errados, idempotency-key inválida ou Origin diferente é recusado; sem generic RPC.
2. Principal sem grant explícito `schedules.read` é recusado **antes** de consulta de inventário; nenhum BasicAuth/admin supre esse grant.
3. Ausência de `nativeUiProducts.schedules` implica 503 indisponível em create/list/pause/read-run; ausência de `scheduleDetails` implica 503 indisponível em read/update.
4. `routines.run` com duas `caseRef` diferentes falha **antes da admissão**. `withCase` legado verifica case/versão/principal/lease e revalida ao final.
5. Leitura do detalhe version `V2` não pode autorizar update com expectedVersion `V1`; refresh/revogação/owner-change invalida a revisão e o produtor reexecuta CAS.
6. O teste autoral sob `test/native-ui-contract/routines.test.ts` usa mocks **somente para observar recusa/unavailable**; nenhuma aprovação do gate operacional, fixture de inventário ou teste local foi realizado.

**Release/integração:** alterações compartilhadas pertencem exclusivamente a 114/I00; compiler a 119; Actions a 120; HOLD externo Native41/Relay/Schedule inalterado.
