# A09 — Handoff para 114 / I00 / 120 / 119

**Owner:** A09 / UX-A09 (branch `sf-ux-a09`, lease `ux-native-a09-e1`)  
**Base verificada:** `f8e442616c96651f3b26013b34b8ce697860e3e2`  
**Estado:** ARTIFACT_READY — aguardando composição e verificação central. NÃO é prova Native41/Schedule operacional.  
**ACK:** `ACK.json` publicado antes da autoria.

## Deltas exclusivos

| Arquivo | Conteúdo |
|---|---|
| `packages/schema/src/sucafina/routines.ts` | 12 schemas exportados, namespace `SfRoutines.operations`, entradas fechadas, `PortResult` e `SfScheduleDetailResult` original |
| `packages/client/src/sucafina/routines.ts` | `createSfRoutinesClient(transport)`: doze métodos exatos, sem retry, sem endpoint livre |
| `apps/cli/src/sucafina-product/native-ui/routines.ts` | `createSfRoutinesHandlers(deps)`: um GET e onze POST; source admission, bounded JSON, origem, idempotency-key, case fence, tratamento de indisponibilidade |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/routines.test.ts` | Especificações unitárias estritas de entrada/saída, sem alegar produtor instalado |

## Contrato das 12 operações

| ID | Método e path relativos a `{mount}` | Admissão / produtor | Gate preservado |
|---|---|---|---|
| `projection.routine` | GET `/api/ui/projections/routine?runRef=...` | `ui sf_routine_status` + `dispatch` e `decodeSfOperationOutput` | saída pública somente, query fechada |
| `routines.catalog` | POST `/api/ui/routines/catalog` | `ui sf_routine_catalog`; `withCase`; `routines.catalog` | publication real |
| `routines.prepare-admission` | POST `/api/ui/routines/prepare-admission` | `human routines.admit`; `withCase`; `routines.prepareAdmission` | native e parâmetros do produtor |
| `routines.read-admission` | POST `/api/ui/routines/read-admission` | `ui sf_routine_status`; `withCase`; `routines.readAdmission` | record real |
| `routines.read-run` | POST `/api/ui/routines/read-run` | `ui sf_routine_status`; `withCase`; `routines.readRun` | run real/admitted |
| `routines.run` | POST `/api/ui/routines/run` | `human routines.run`; `withCase`; `routines.run` | caseRef interno == externo, sem retry |
| `schedules.create` | POST `/api/ui/schedules/create` | `human schedules.create`; `schedules.create` | native Schedule port |
| `schedules.list` | POST `/api/ui/schedules/list` | `human schedules.read`; `schedules.list` | native Schedule port |
| `schedules.pause` | POST `/api/ui/schedules/pause` | `human schedules.pause`; `schedules.pause` | expectedVersion do produtor |
| `schedules.read` | POST `/api/ui/schedules/read` | `human schedules.read`; `scheduleDetails.read` | reader autorizado opcional |
| `schedules.read-run` | POST `/api/ui/schedules/read-run` | `human schedules.read`; `schedules.readRun` | native Schedule port |
| `schedules.update` | POST `/api/ui/schedules/update` | `human schedules.update`; `scheduleDetails.read`; `schedules.update` | detalhe atual ref/versão e CAS |

Todos os POSTs têm body JSON, Origin obrigatório, Idempotency-Key no formato congelado, até 65536 bytes e sem query. Original `Request` vai para admissão; finish é sempre chamado; `no-store`, sem cookies, campos privados ou raw HTML na saída. Schema rejeita chaves extras. Os resultados dos produtores passam por decoder da operação antes de egress. Em falta de porta nativa Schedule, status `503 unavailable/native-schedule-port-unavailable`. Em falta de reader, status `503 unavailable/schedule-detail-port-unavailable`. Um not-found legítimo do reader tem `404` somente na operação `schedules.read`; update não fabrica `not-found` em um PortResult legado que não possui esse braço.

## Composição SHARED exclusiva 114 / I00 (não aplicada por A09)

1. Em `product/contracts/host-context.ts`, adicionar o contrato privado `SfScheduleDetailsPort<TrustedDomainContext>` conforme `host-signatures.ts`; estender `SfHostServices.nativeUiProducts` com `routines:BusinessPorts["routines"]`, `schedules?:BusinessPorts["schedules"]`, `scheduleDetails?` e `withCase` genérico. Unificar com os campos F01 `currentBinding` e `readContext` (não substituir).
2. Em `apps/cli/src/sucafina-product/host-context.ts`, passar SOMENTE as referências reais `routineServices.routines` e `business.withCase`; `schedules` e `scheduleDetails` **não devem ser atribuídos enquanto produtores legítimos e autorizados não existirem**. Não montar mock Schedule/Task/Relay; disponibilidade real lida da mesma geração.
3. Em `product/integration/human-authority.ts`, adicionar `"schedules.read"` na lista fechada `sfHumanReadActions`, mantendo a exigência de grant explícito por instalação. Não reutilizar permissionamento de `Core ScheduledTask`, BasicAuth, admin ou outros comandos. A porta `scheduleDetails.read` deve proteger identidade/autorizações próprias e não projetar dados externos sem grant. Prova negativa de principal sem `schedules.read` pertence ao pipeline central.
4. Montar `createSfRoutinesHandlers(deps)` com F02 `mountSfNativeProjections` antes da application legada, com o Request original. Usar `SfRoutines.operations` no index estático e `SfNativeOperationBindings` reais (12 codecs), `SfOperationRegistry` exatamente conforme catalog; criar package exports explícitos `./sucafina/routines` em Schema e Client (sem wildcard).
5. Publicar `SfContext.availability` SOMENTE com prova de readiness `routineNative+publication` e `Schedule` por operação. `read` e `update` têm gate independente do restante de Schedule. UI66 deve obter list + detail corrente sob owner/accessRevision antes de revisão, invalidar review em mudança e não inventar prefill.
6. 120: CI cirúrgico com specs e oráculos de revogação/ausência/no-retry; 119: compiler/guards; 114 integra todos os patches shared. **A09 não executou testes locais e não atestou CI.**

## Compatibilidade e limites

- Sources repinadas: `ports.ts` e `routine-services.ts` coincidem com origem congelada; o delta C58 de `host-context.ts` adiciona `caseCreationRecovery` (independente), e o de `product/interface/http.ts` altera o body limit de comandos e escopo de criação de decisão; nenhum altera o producer `sf_routine_status` no delta inspecionado.
- Casos: nenhuma criação fictícia de caseRef. `withCase` reautoriza seleção existente/versão e vincula a mesma intenção; `routines.run` verifica também o caseRef interno antes da admissão.
- Schedule: `update` nunca é liberado por summary list; reader atual opcional garante scheduleRef/expectedVersion, produtor continua CAS; detalhe ausente/erro mantém bloqueio, não transforma indisponibilidade em lista vazia.
- Disponibilidade: a entrega de adapters não declara Native41, Relay, Schedule, resident inventory ou Goal operacional. `projection.residents` pertence a A15, não é saída A09.
- Limites de ownership: nenhum engine, schema fonte, host-context shared, registry, AGENTS, pacote, lockfile ou app-shell foi alterado. Nenhum teste local, merge, force/reset, deploy, Azure ou Goal restart.

## Aceite e verificação

- **A09-AC01 — mapeamento de campos autorizados, null/zero/ausência e versões:** implementado com codecs de fonte e sem snapshot privado; qualificação CI pendente de 120.
- **A09-AC02 — rejeição de ação/payload desconhecido, sem despacho opaco:** implementado com operação fixa e decoder estrito; qualificação central pendente.
- **A09-AC03 — chaves de operação/versão, invalidar fonte e acesso mudados:** implementação preserva as chaves, ref/versão, revalidação e CAS do produtor; prova de source-change/owner-change e checks centralizados ainda pendente.
- **Gate externo não é AC04:** native Schedule e ScheduleDetails só ficam operacionais após produtor/readiness/grant reais; integram 114/I00, 119/120 validam e S0 decide os gates.

Registro principal de evidência: commits exclusivos da branch e ACK.json. Os testes autorais são especificações **não executadas**.
