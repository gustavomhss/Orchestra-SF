# Typecheck externo — diagnóstico e encaminhamento W6

Estado: **BLOCKED_EXTERNAL / NOT_APPLIED**. O typecheck completo continua falhando; os 132 diagnósticos não são convertidos em um gate verde. WP03 não alterou os arquivos externos enumerados neste handoff.

## Evidência e limite da comparação

O [run 43523298505 / job 132222684910](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523298505/job/132222684910) executou o typecheck hospedado no candidato `6f004731e7848bf540434a3ee050cd0f28f342cb`, árvore `12403d54bf5713096a30647d45791d4a4431c857`, e, no mesmo job, no seed `73ee7fd812d233f898ef79a9378014d4339d9875`. Foram **141 diagnósticos no seed e 132 no candidato**; `remainingOwned` ficou vazio para `product/planner`, `test/product/wp03`, `runtime/planner.ts` e `src/planner-*`. Nove diagnósticos próprios presentes no seed foram resolvidos. O resultado do typecheck do candidato permanece `failure`.

O diferencial literal não é vazio: registra **4 introduced e 13 resolved**, dos quais nove são os reparos WP03 e quatro são versões antigas das mensagens nos mesmos locais e códigos externos. O comparador hospedado remove somente `(linha,coluna)` antes de comparar as linhas completas; não normaliza a ordem, os modificadores ou a apresentação resumida dos campos de tipos inferidos. Portanto, não se deve declarar que todos os textos dos 132 erros são idênticos aos do seed, nem interpretar o contador literal sozinho como quatro novas localizações de falha.

A comparação independente dos logs primários por `(caminho, linha, coluna, código)` encontrou **zero localizações novas e nove localizações próprias resolvidas**. As quatro mensagens alteradas estão discriminadas abaixo. Leituras GitHub MCP independentes no seed e no candidato W6 retornaram o mesmo Git blob em cada um dos três arquivos.

| Local e código | Mudança literal observada | Git blob igual no seed e W6 |
| --- | --- | --- |
| `product/imports/dashboard-preview.ts:38:75`, TS2345 | Resumo da união inferida passa de campos `warnings?/commandDigest?` para `baseDigest?/reason`. | `1ef975cc87f5ee31b3b8c742cd073035fa0b7ed9` |
| `test/product/wp06/imports/end-to-end.test.ts:56:72`, TS2345 | O membro opcional aparece como `readonly value?`, e o resumo do outro braço da união é abreviado. | `a52f968be176a250436e89eb19f61ec7728cba5c` |
| `test/product/wp06/imports/sqlite-planner.test.ts:41:76`, TS2322 | A apresentação dos campos `status/reason` e `changedFields?/warnings?` muda de ordem. | `ba67bc847bb2294a53c48ec3f142f296568c20f1` |
| `test/product/wp06/imports/sqlite-planner.test.ts:46:74`, TS2322 | A mesma mudança de apresentação ocorre no segundo callback. | `ba67bc847bb2294a53c48ec3f142f296568c20f1` |

Essa evidência sustenta atribuição estrutural a incompatibilidades já existentes de callbacks de transação, em posições e fontes inalteradas. Não prova equivalência semântica de cada tipo inferido, não justifica suprimir erros e não altera o gate. Tanto o diferencial literal quanto a comparação estrutural estão preservados em [external-typecheck-errors.json](./external-typecheck-errors.json), com as 132 mensagens exatas, linhas, colunas, roteamento por owner e os quatro pares de mensagens seed/candidato.

O [artefato 14084411733](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523298505/artifacts/14084411733) contém `source.json`, `seed-typecheck.log`, `typecheck.log`, `typecheck-differential.json` e `guards.log`. O ZIP foi baixado por GitHub MCP e seu SHA-256 foi conferido antes de extrair: `98612bdfdda3763c5f27a0ca863fafb7be1ca0c148ac5c09d9f3ee1b964b5d94`. Todas as 132 linhas de diagnóstico do artefato foram também localizadas no log do job. O passo de guards do mesmo run concluiu sucesso com **78 regras, 606 caminhos, 0 gates, 12 warnings e 0 erros**, contra `origin/dev` fixado em `a1d37698a7bb097c1578f827eba6a19b9917ef07`; o merge base registrado foi `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. A passagem dos guards não altera a falha do typecheck.

## Roteamento por owner

O agrupamento abaixo é encaminhamento lógico para revisão. Não reatribui propriedade nem concede autorização a WP03 para editar caminhos externos. Onde o contrato e o consumidor pertencem a equipes diferentes, a correção precisa ser coordenada.

| Owner sugerido | Diagnósticos |
| --- | ---: |
| WP00/WP09 | 1 |
| WP01 | 9 |
| WP02 | 9 |
| WP04 | 3 |
| WP06 | 35 |
| WP07 | 3 |
| WP08 | 12 |
| WP10 | 22 |
| WP10/WP14 | 4 |
| WP11 | 13 |
| WP12 | 1 |
| WP13 | 12 |
| WP14 | 8 |
| **Total** | **132** |

## Correções concretas prioritárias

### 1. Resultados de estado e retornos de domínio — WP00, WP08, WP10 e consumidores

`product/contracts/state.ts` combina `status: "ok" | "preview"` num único braço de `SfStateResult`; falhas usam outro braço com `reason`. Os consumidores retornam esses valores como `PortResult`, cujo sucesso aceita somente `ok`. Alguns ramos testam `preview` e depois retornam a união inteira; o TypeScript ainda pode preservar o braço combinado. Isso aparece em colaboração, host e documents.

A correção local do consumidor deve mapear o resultado explicitamente: tratar `preview`, reconhecer o braço com `reason`, construir o `PortResult` correspondente e produzir sucesso somente depois de validar `value`. Alternativamente, o owner do contrato pode separar os braços `ok` e `preview` de forma discriminada, com revisão dos consumidores. Não declarar `preview` como sucesso nem introduzir `as any`. Teste discriminante: `preview` não pode emitir um resultado de domínio confirmado e um erro `denied` deve preservar a recusa e sua razão.

### 2. Inferência de transações com resultados heterogêneos — WP02, WP06 e WP11

Em `product/dashboard/confirmation.ts`, `product/imports/dashboard-preview.ts` e `product/decisions/prepared-apply.ts`, o primeiro ramo do callback genérico define um tipo estreito demais para os demais retornos. Os erros de `{}`, campos ausentes e spreads inválidos posteriores são consequências, não motivos para acrescentar casts nos pontos de uso.

Declare a união de saída da transação antes do callback e passe o parâmetro de tipo explícito. Em confirmation, a observação precisa distinguir `same` de `replaced/unavailable`, incluindo `index`, `fingerprints` e `physicalIncarnations` somente onde disponíveis. No preview de importação, discrimine indisponível, rejeição validada e preview com `before`, `after` e `impactDigest`; estreite o resultado antes de ler esses campos. Em prepared-apply, represente explicitamente receipt novo, receipt existente, failure e ausência, preservando a transação atômica e o idempotency key. A correção deve manter recusas, rollback e stale rejection; executar um caso de sucesso, um preview rejeitado e uma falha tardia que não persista a primeira mudança.

### 3. API C17 antiga no consumidor — WP14 e WP10

`product/decision-memory/source-access.ts` declara `resolve` como o objeto retornado por `createProcurementSourceResolver`, mas o chama como uma função. Alinhar o contrato ao membro `ReturnType<typeof createProcurementSourceResolver>["resolve"]` quando a entrada é a função; ou manter o objeto e chamar `.resolve` consistentemente. A composição em `apps/cli/src/sucafina-product/business-services.ts` deve passar a mesma forma e usar os tipos reais de snapshot/evidence.

`test/product/wp14/source-access-procurement.test.ts` ainda importa exports antigos e omite `scopedSources`. Migrar a fixture para o resolver real (`issue`, `resolve`, `isCurrent`) com a persistência de fontes inicializada. Manter testes de revogação, reincarnação, fonte stale e tentativa de leitura fora de autoridade; não recriar as funções antigas como wrappers permissivos.

### 4. Factory de eventos e contexto de negócio divergentes — WP10/WP14

`product/host-binding/business-context.ts` chama `createSfCaseEventSourceAccess` com `state`, `authorizeCase` e `authorizeEvidence`; o factory atual recebe `host` e `cases`. Conectar `{ host: input.host, cases: input.cases }` ao factory vigente, que relê o ledger autorizado e seus digests. Para os erros de memória, mapear a entrada real para o envelope de negócio requerido em vez de devolver um `MemoryEntry` bruto. Confirmar alteração de case/evidence entre emissão e leitura; não restaurar uma assinatura antiga que ignore esse recheck.

### 5. Imports ausentes e produtor de rotinas — WP06 e WP00/WP09

`apps/cli/src/sucafina-product/import-services.ts` usa `Period` e `isSfPeriod` sem importar seus símbolos. Importar os contratos e o validador existentes e manter a validação antes da operação.

`product/contracts/host-context.ts` depende de `../routines/factory.ts`, e `test/product/wp06/documents/runtime-e2e.test.ts` depende de `routines/dossier.ts`. Resolver com o produtor de rotinas/export correto conforme o pack, sem stubs vazios ou remoção das chamadas. O segundo arquivo concentra os erros `any` decorrentes desse contrato ausente; reavaliá-los depois da dependência materializada.

### 6. Narrowing de cenários e estados impossíveis — WP13 e WP11

Em `product/portfolio/planner-sensitivity.ts` e `verification.ts`, o resultado é estreitado para cenário e depois acessado dentro de callbacks. Capture constantes do resultado cenário imediatamente após o guard e use essas constantes nas closures; elas preservam o narrowing sem tornar outras variantes de resultado aceitáveis.

Em portfolio (`catalog`, `handoff`, `port`, `sensitivity-store`) e `decisions/proposals.ts`, remover comparações impossíveis `status === "ok"` dentro de um ramo já comprovado `status !== "ok"`; propagar a falha existente ou construir o retorno correto. Isso não é autorização para promover `needs-input`, `stale` ou `unavailable` a sucesso.

### 7. União HTTP e contexto UI — WP01/WP10

`product/interface/analysis-http.ts` mistura o retorno de `analyses.read` com o envelope de contribuição, ambos com propriedades compatíveis em parte. Separar os ramos de ação antes de mapear `runRef`, `version` e `outputRef`, usando o tipo correto para cada resultado; a mera presença de `state` não identifica uma execução nativa.

O callback `operationIdentity` de views pessoais espera `TrustedUiContext`, enquanto o contrato consumidor aceita contexto de domínio mais amplo. Validar `context.kind === "ui"` antes de chamar a identidade UI e recusar outros tipos conforme o contrato; não fazer cast de autoridade nativa para UI. Tipar os callbacks HTTP hoje implícitos usando os contratos de request/response existentes.

### 8. Prepared procurement e fixtures restantes — owners das pastas

`product/procurement/prepared.ts` precisa retornar um `JsonValue` fechado: construir os objetos com `status` literal e campos efetivamente presentes, sem propriedades opcionais `undefined` vazando de uma união inferida. Preservar o mesmo mecanismo de domínio e as mesmas recusas.

Nas fixtures WP04/WP07, ajustar a chamada para a aridade/overload atual em vez de relaxar a API. WP08 deve fornecer `evidence` e `projection` produzidos pelo observador real. WP10 deve anotar `Snapshot` e a transação de blobs conforme `Persistence`, mantendo as provas de geração/autoridade. WP11 deve construir `SourceRef` e comparison status com literals/satisfies, e usar contexto UI real onde o serviço exige UI. WP12 precisa de um `DecisionCase` válido, não um cast de objeto incompleto. WP13 deve capturar e validar `transactionAll` uma vez antes do uso opcional. WP01 deve resolver o import de rota pelo export público vigente. Esses ajustes continuam pendentes de execução pelos respectivos owners.

## Inventário completo por arquivo

Os caminhos seguem a saída de `tsc` a partir de `modules/sucafina/Sucafinav1`. O prefixo `../../../apps` aponta para a árvore raiz de CLI. Linhas, colunas e mensagens exatas estão no JSON vinculado.

| Arquivo | Quantidade | Owner sugerido | Códigos |
| --- | ---: | --- | --- |
| `../../../apps/cli/src/sucafina-product/business-services.ts` | 3 | WP10 | TS2322, TS7006 |
| `../../../apps/cli/src/sucafina-product/host-context.ts` | 7 | WP10 | TS2322, TS2345 |
| `../../../apps/cli/src/sucafina-product/import-services.ts` | 2 | WP06 | TS2304 |
| `product/collaboration/confirmation.ts` | 2 | WP08 | TS2322 |
| `product/collaboration/hot-topic-host.ts` | 1 | WP08 | TS2322 |
| `product/collaboration/recipient-actions.ts` | 1 | WP08 | TS2322 |
| `product/collaboration/relations.ts` | 3 | WP08 | TS2322 |
| `product/collaboration/threads.ts` | 4 | WP08 | TS2322 |
| `product/contracts/host-context.ts` | 1 | WP00/WP09 | TS2307 |
| `product/dashboard/confirmation.ts` | 9 | WP02 | TS2339, TS2345, TS7006 |
| `product/decision-memory/source-access.ts` | 2 | WP14 | TS2349 |
| `product/decisions/prepared-apply.ts` | 8 | WP11 | TS2322, TS2345, TS2638, TS2740 |
| `product/decisions/proposals.ts` | 1 | WP11 | TS2367 |
| `product/documents/capabilities.ts` | 1 | WP06 | TS2339 |
| `product/host-binding/business-context.ts` | 4 | WP10/WP14 | TS2322, TS2353, TS7006 |
| `product/imports/dashboard-preview.ts` | 17 | WP06 | TS2322, TS2339, TS2345, TS2638 |
| `product/interface/analysis-http.ts` | 4 | WP01 | TS2339 |
| `product/interface/http.ts` | 2 | WP01 | TS7006 |
| `product/interface/import-http.ts` | 1 | WP01 | TS2345 |
| `product/portfolio/catalog.ts` | 1 | WP13 | TS2367 |
| `product/portfolio/handoff.ts` | 2 | WP13 | TS2367 |
| `product/portfolio/planner-sensitivity.ts` | 2 | WP13 | TS2339 |
| `product/portfolio/port.ts` | 1 | WP13 | TS2367 |
| `product/portfolio/sensitivity-store.ts` | 1 | WP13 | TS2367 |
| `product/portfolio/verification.ts` | 2 | WP13 | TS2339 |
| `product/procurement/prepared.ts` | 1 | WP04 | TS2322 |
| `test/product/wp01/personal-views.test.ts` | 1 | WP01 | TS2322 |
| `test/product/wp01/workbench-analysis.test.ts` | 1 | WP01 | TS2307 |
| `test/product/wp04/prepared-production.test.ts` | 2 | WP04 | TS2554 |
| `test/product/wp06/documents/runtime-e2e.test.ts` | 9 | WP06 | TS2307, TS7006 |
| `test/product/wp06/imports/end-to-end.test.ts` | 2 | WP06 | TS2322, TS2345 |
| `test/product/wp06/imports/sqlite-planner.test.ts` | 4 | WP06 | TS18046, TS2322 |
| `test/product/wp07/review-port.test.ts` | 3 | WP07 | TS2769 |
| `test/product/wp08/confirmation-integration.test.ts` | 1 | WP08 | TS2739 |
| `test/product/wp10/integration/blob-generations.test.ts` | 10 | WP10 | TS7006 |
| `test/product/wp10/integration/product-authority.test.ts` | 2 | WP10 | TS7006 |
| `test/product/wp11/analysis-acceptance-adversarial.test.ts` | 1 | WP11 | TS2345 |
| `test/product/wp11/coverage-access.test.ts` | 3 | WP11 | TS2322 |
| `test/product/wp12/author-reader.test.ts` | 1 | WP12 | TS2352 |
| `test/product/wp13/sensitivity-units-boundary.test.ts` | 3 | WP13 | TS18048, TS2722 |
| `test/product/wp14/source-access-procurement.test.ts` | 6 | WP14 | TS2305, TS2322, TS2349, TS2724, TS2741 |

## Próxima validação

Após cada correção material, executar a seleção cirúrgica dos consumidores realmente afetados e o mesmo typecheck hospedado. Preservar o gate vermelho até todos os erros serem resolvidos ou houver uma decisão formal do controlador sobre a dependência. O diferencial W6 serve à atribuição e ao handoff; não é uma baseline permissiva nem uma alteração do contrato de CI. Nenhum teste, compilação ou typecheck local foi executado para produzir este documento.
