# W15/A02 — preflight e desenho de integração (sem autorização de escrita de produto)

**Estado documental: BLOCKED_OWNER / ADMISSION_REQUESTED.** Este registro não é código instalado, nem prova de teste. O ACK remoto anterior é `73c7824`. Não se inferiu GO da 114.

## Interfaces congeladas e fontes

- **39** operações A02, distribuídas em **7 GETs** de projeção CAP17–CAP23, **29** comandos POST de domínio e **3** operações do Planner (`planner.monthly.preview`, `planner.monthly.apply`, `planner.forecast.prepare`). IDs completos e `schemaExport` constam do JSON de preflight, extraídos do catálogo `31dbec1`.
- Schema leaf: `SfPlanner.operations[operationId]`, input/output Schema canônicos; factory `createSfPlannerClient(transport)` delega o descriptor imutável a `transport.execute`. Não criar `execute(action:string)`.
- Host leaf: `createSfPlannerProjectionHandlers(deps)` apenas para CAP17–CAP23. Originais JSON mantêm o `Request`, admissão, status e campos do produtor.
- Para todos os GETs: contexto autorizado atual `readContext(request)`, `application.authenticate(request,` superfície Planner `) ` sob a transação atual, `plannerKeys`, `Domain.view` sobre `publicSfData`. Projeções explícitas sem `snapshot.data` inteiro, `actor`/grants, salário indevido, `roleMap`, headers, cookie, session ou metadados privados. Retornar somente CAS dos recursos autorizados efetivamente expostos.
- CAP18/CAP19 usam `product/planner/monthly-grid.ts::projectMonthlyGrid` para valores e flags já calculados; o frontend não chama `calculated`, `spread`, `usdAmount`, `outlookMonth` ou parser financeiro.
- O produtor de domínio é `runtime/planner.ts`, o HTTP original `runtime/application.ts`; manter a autenticação, filtros, variantes `closed` / `split` OPEX e permissões do próprio produtor.

## Fluxo TSV obrigatório

1. O componente S02 envia células com `monthId:0..11`, medida `budget|actual|forecast`, `text` original e `revision` da linha.
2. A02 valida o índice inteiro 0..11 e faz **uma única conversão** para `MonthlyDraft.cells.month:1..12`. Recusa índice fora da faixa, sem wrap nem corte silencioso. Não converte texto em Number; `""`, `"0"` e `null` nunca são confundidos. Se a célula não foi editada, não inventar draft.
3. Preview envia `{action:"preview",input:{page,versionId,drafts}}` ao **`planner-http.ts` existente**, preservando `rowId`, `revision` e `text`. `monthly-edit.ts` e `monthly-host.ts` continuam donos da validação, CAS e simulação.
4. Apply somente por ação humana após preview admitido para a mesma base; envia `{action:"apply",input:{...}}` original. Em `rows[]`, resultado `ok` daquela linha pode fechar apenas essa linha; falhas e conflitos preservam texto/revision. Resposta perdida = outcome unknown, refetch autorizado, sem replay automático.
5. Produtor `planner-http.ts` atual não publica os braços `operation`/`entity` do `monthly-host.ts`; **não os expor** como endpoint nativo ou sucesso fictício. Mês zero-based de `values.month` no comando legado é outro contrato e não deve receber a conversão TSV novamente.

## Matriz de provas a publicar no spec exclusivo W15

- **A02-AC01:** sete páginas com identidade, seleção/ano/version, cada campo autorizado, zero vs null/ausente, CAS e redaction de HR/rates para papéis sem permissão.
- **A02-AC02:** operation/action/payload extra e página/owner trocados rejeitados; nenhuma leitura de HTML ou snapshot inteiro; no generic dispatcher.
- **A02-AC03:** retorno após revogação, isolamento de instalação, context stamp incompatível, status real, idempotência e original `Request`.
- **A02-TSV:** índices 0 e11→meses1 e12 exatamente uma vez; rejeição de -1/12; linhas vazias finais; `"0"` e `""`; versões diferentes por linha, conflito 409, falha de campo 422, edição de mês fechado negada; parcial com um sucesso e outra falha; perda de resposta não aciona retry. Sem stub para prova instalada.

## Dependências e handoff ao integrador

114 deve registrar o **GO por output A02** (ou impedimento causal) com lease, fonte/catálogo e exclusividade. F01/F02 necessários para compor; índices, export maps em `packages/schema/package.json` e `packages/client/package.json`, `operation-registry.ts`, `SfNativeOperationBindings` e montagem no `native-ui/router.ts` são exclusivamente da 114, após o leaf do autor. 120 executa apenas Actions seletivas no C composto; 119 typecheck/guards. Não há teste, build ou código de produto alegado neste preflight; o protocolo proíbe escrita antes da admissão.

**Fontes auditadas sem alteração:** `runtime/application.ts` C58 tem deltas de asset/download Procurement e revalidação de export, sem alteração de comando/preview/apply Planner. `planner-http.ts`, `forecast-http.ts`, `runtime/planner.ts`, `monthly-edit.ts`, `monthly-host.ts` preservam os blobs pinados. Nunca restaurar snapshot antigo.
