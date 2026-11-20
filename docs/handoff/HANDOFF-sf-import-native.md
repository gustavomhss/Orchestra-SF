# HANDOFF — sf-import-native

## SHA e estado

- Estado: **PARTIAL**. Migração de Import e reparo mínimo de proveniência preparados; nenhum gate foi executado sobre estes commits.
- Branch de trabalho: `sf-import-native`.
- Base congelada: `sf-sourcing-json@5856483ee09bcb6b3511aa2d70276dc44b3aa0e5`.
- Reparo de produto separado: `4e010ab6d554a046c2bf03461bb5c7a9a63513b9`, parent igual à base; tree `1adf00099495e787ed75ea44cc57a9a395c28f86`.
- Migração inicial do helper: `6b0883ae1df9d6580b69707d1405d3f11500853d`, parent `4e010ab6d554a046c2bf03461bb5c7a9a63513b9`.
- Reparo compartilhado adicional de recuperação: `d21d431e54e8aa981354793c87392589d3ea7980`, parent `6b0883ae1df9d6580b69707d1405d3f11500853d`; altera somente o callback do painel de estado.
- Helper exercitando esse callback: `343e0e38937763fb56fd87cb951cdb9875fdf33e`, parent `d21d431e54e8aa981354793c87392589d3ea7980`.
- Helper final, com as duas fronteiras reais de revogação: `64d96d475b38f308bea2d468f2d1c33617002a35`, parent documental `831d05246e427d2b29631b8728715831b15e7918`; tree de código `9536ca30075ec8db4f3f8e25e280007d0bf1c444`.
- O commit deste handoff é somente documental e posterior ao código.
- Nenhum PR, merge, workflow dispatch ou execução de produto foi feito por este recorte.

## Arquivos e separação para integração

| Recorte | Caminho | Blob final |
| --- | --- | --- |
| Produto compartilhado | `packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx` | `9a81d5415505725c7ae15b7daad3eb2f1855a238` |
| Copy EN/PT-BR do mesmo reparo | `packages/app-shell/src/i18n/orchestra-chapters/sf-u23.ts` | `239fb68e76bac84e165b15a56124e38caec1fe0e` |
| Helper de Operations | `packages/app-shell/e2e/sucafina/operations-support/imports.ts` | `88f5915f8ac2f8f26fbffb1b95035ab870299289` |

Os dois primeiros arquivos estão isolados no commit `4e010ab6` para revisão/PR `shared:` posterior; `d21d431e` contém somente o complemento causal do callback de recuperação. Os commits `6b0883ae`, `343e0e38` e `64d96d47` alteram somente o helper. Não se deve mergear esta branch de composição inteira: ela herda a composição de Operations, inclusive os blobs de qualificação de Files #393, ainda aberto. Reconciliar os deltas mínimos com os donos e a árvore integrada.

## Falha original e causas concretas

- Run de produto original: `44662419134`, snapshot `9ea42e72f6aebed5685cd5b2b48df993a1e8f33d`, parent `69340e89c46825b6556d36e8d6a09dce2122c901`.
- Resultado original preservado: **1 passou / 4 falharam**; este recorte não reclassifica o resultado.
- Primeira asserção de Import: `packages/app-shell/e2e/sucafina/operations-support/imports.ts:155`, contagem esperada 1 para o container legado `[data-import-workbench]`, encontrado 0.
- O registry nativo da base, `route-registry.ts:129–144`, atribui `/orchestra/sf-imports` a UI57/history e `/orchestra/sf-imports/new` a UI55. O helper antigo entrava no histórico e buscava controles do workbench legado.
- O produtor de UI55 já usa `selectionRef` como valor de opção, botão `Generate preview`, e sequência admit → preview → reference (`imports/index.tsx:274–317,611–641` na base). Não emite o GET import-detail esperado pelo helper antigo.
- Apply faz primeiro uma releitura da referência. Após perda de entrega, mantém outcome-unknown e exige reconciliação explícita (`index.tsx:324–382,808–813`). Uma espera de referência criada antes do clique podia confundir a prévia pré-Apply com recuperação.
- A revisão da raiz identificou outro defeito real: o botão `sf.common.pending` do painel outcome-unknown chama `onRetryRead`; para UI55 o callback anterior encaminhava para discover(), cujo editLocked() retorna em phase unknown. O resultado já enviado não era reconciliado por esse botão. Há também um botão **externo** Refresh receipt em `index.tsx:808–813` da base; ele sempre foi preservado. A causa corrigida é o callback do painel, não ausência total de recuperação.
- UI57 tem rota canônica de recibo e leitura explícita; UI55 não restaura seleção/manifesto após reload (`index.tsx:229–238,511–538,667–677,745–753`).
- O bloco nativo de recibo exibia id, outcome, timestamp, status e versão, mas omitia manifesto e ator (`index.tsx:728–733`). A migração conserva as afirmações de proveniência por um pequeno reparo de exibição autorizado, em vez de removê-las.
- A revisão independente também identificou a fronteira nativa de revogação: `packages/client/src/sucafina/transport.ts:317–321,957–994` faz ctx.context antes de qualquer files.*. Depois do logout o contexto real é unauthenticated/401; o transporte retorna contract-unavailable sem emitir o GET import-reference. O helper precisa observar essa recusa anterior e conservar o 403 do produtor como oráculo separado, sem fingir que a UI enviou o GET.

## Produto: proveniência original, somente leitura

O reparo de `4e010ab6` acrescenta, dentro do mesmo `Show` de recibo e dos mesmos fences de proprietário:

- `Manifest: receipt().manifestId`, da summary já autorizada e carregada.
- `Actor: item.principalRef · Version: item.version`, de cada recibo original em `state.manifest.receipts`.
- Duas chaves novas de copy, `sf.u23.manifest` e `sf.u23.actor`, em inglês e pt-BR. Usa a chave de versão já existente e preserva as linhas anteriores.

Autoridade e contrato conferidos na base:

1. `packages/schema/src/sucafina/files/structures.ts:144–155,211–217,233–238` define principalRef/version do recibo, manifestId da summary e a referência original.
2. `modules/sucafina/Sucafinav1/product/imports/store.ts:21–35` liga a summary ao recibo real e valida principal, incarnation, commandDigest e idempotencyKey na mesma transação C08.
3. `store.ts:87–102` confere digest armazenado, proprietário/projeto/instalação/accessRevision/policyVersion, autorização atual do destino e coerência da summary antes de permitir leitura.
4. `product/imports/host.ts:73–78` exige autoridade humana UI e revalida antes/depois da leitura da referência.
5. `product/interface/import-http.ts`, branch import-reference, conserva admissão/validate/finish originais e recusa HTTP 403.
6. `imports/index.tsx:97–145,214–227,511–538` conserva Request/owner-generation, recusas e remoção de estado privado. O reparo não acrescenta fetch, mutação, grant, cache ou inferência de ator pela sessão atual.

### Recuperação do painel de estado

O complemento `d21d431e` encaminha `onRetryRead` para o `reconcile()` já existente quando phase é unknown ou existe applyIntent. Esse caminho usa a mesma referência/intent original, `fence()`, permissões atuais, refreshReference e `current()`; apenas lê. Não chama Apply nem cria outra idempotency key. As demais ações de leitura permanecem no dispatch anterior. O botão externo Refresh receipt não foi removido nem modificado. O helper final clica **Checking the outcome…**, texto exato de `sf.common.pending` em inglês, dentro do painel outcome-unknown, e continua exigindo único POST/recibo/CAS.

## Helper: jornada nativa e afirmações preservadas

| Fase | Observação/assert real |
| --- | --- |
| Entrada | UI55 em `/new`, root u23 único, estado ready e source Planner; controle seguinte precisa estar habilitado. |
| Descoberta | Resposta original de import-targets, exatamente um destino com o nome recém-criado e seleção pelo selectionRef autorizado; checkbox newVersion/removeMissing continuam desmarcados. |
| Admissão e prévia | XLSX real, mesma sondagem inválida 400, admissão original 200/ok, POST preview exato e referência cujo manifesto é igual à prévia; digest presente. |
| Revisão | Phase reviewing/ready, simulação sem efeitos, seis categorias com contagens da detail original, alteração Jan 72000 → 84000 visível e origem OPEX/F2/linha2/coluna6. Apply precisa estar habilitado; export e CAS continuam iguais antes do clique. |
| Apply | Um clique e um `route.fetch({ maxRetries: 0 })` do comando real; só a entrega é abortada. O GET pré-Apply é capturado e deve ser igual à referência original ainda não aplicada. O POST abortado não é alvo do retainer. |
| Perda e recuperação | Phase unknown/outcome-unknown e nenhum Apply disponível; o waiter de recuperação só é criado depois da falha de entrega do POST. O usuário aciona Checking the outcome… explicitamente no painel; esse callback reconcilia por leitura. |
| Recibo | Manifesto recuperado igual ao retorno real do Apply, um recibo, vínculo exato de commandDigest/idempotencyKey/incarnation/principal/surface, changedFields > 0; detail preservada e digest atualizado. Manifesto, ator e versão são também assertados no DOM nativo. |
| Reload/reentrada | Refresh continua read-only; link View result tem a rota canônica baseada na referência original. UI57 exige leitura explícita após entrada e reload. Reentrar em UI55 deixa destino/arquivo vazios e nenhuma ação Apply; reabrir UI57 lê o mesmo recibo original. |
| Recusa e privacidade | Viewer autenticado distinto recebe 403/denied para a referência do autor. Após logout do autor, um GET do APIRequestContext com a mesma sessão revogada prova 403/denied do produtor separadamente. O refresh da UI faz ctx.context original, cujo status/body devem ser 401/unauthenticated, e envia ZERO GET import-reference. UI fica unavailable, sem seções privadas, recibo ou Apply; applies continua 1 e o export fresco do viewer é permitido e igual ao OPEX confirmado. |

As precondições Planner e todo o bloco final de comparação financeira foram preservados byte a byte. Permanecem:

- Renewal 72000 → 84000 e registro distinto 518000 intacto.
- Exatamente seis linhas OPEX para os dois registros, identidades/medidas preservadas, todas as demais linhas/abas idênticas.
- Fórmula original preservada e resultado 84000.
- Hash SHA-256 dos bytes XLSX reais, C02 planner-runtime-v1, valores before/after, baseIdentity, comando/digest/receipt originais.
- CAS do registro alterado +1, CAS do registro não alterado igual.
- Exatamente um Apply mesmo após reconciliação, refresh, reload, reentrada e revogação.

A mensagem antiga de status de prévia foi substituída por afirmações do estado reviewing/ready, simulação visível, categorias reais, valores/fontes renderizados e Apply explícito, mantendo a prova de nenhum efeito prévio. A antiga asserção de containers vazios inexistentes foi substituída pela recusa estrita do produtor e do preflight nativo, zero pedido de referência pela UI após o preflight e ausência dos elementos privados nativos. A UI unavailable não é chamada de denied.

### Limite explícito da classificação de revogação

`product/integration/product-authority.ts:271–279` devolve unauthenticated quando a sessão original já não está autenticada. `apps/cli/src/sucafina-product/native-ui/context.ts:31–45,70–85,103–112` valida a tupla instalada e devolve HTTP 401 com `{ status: "unauthenticated" }`. O helper captura esse ctx.context original, exige query installationId/projectId e exatamente as chaves hostId/installationId/projectId, preserva status/body e conta zero GET import-reference de navegador até a UI concluir a tentativa.

O transporte atualmente reduz essa recusa a contract-unavailable; `SfImportsView.unpack` a apresenta como unavailable. O helper afirma exatamente isso. `SfStatePanel` desmonta o conteúdo privado nesse estado, mas essa prova de DOM **não afirma** que o manifesto já foi apagado da memória do componente. Nenhum transporte, schema, grant ou política foi alterado para ocultar essa limitação. O GET direto 403 é um oráculo separado com o mesmo APIRequestContext revogado, nunca uma resposta substituta do refresh da UI nem replay de Apply.

## Dependências obrigatórias da composição

1. **Retainer de resposta original**: `packages/app-shell/e2e/sucafina/reports-support/retained-response.ts`, blob exato `5b4c067dca7af31cdb2dd6c6b6a5005fd23be339`, origem `sf-reports-retained@18e995771879cb67c144c87b61e7d17c6df9e917`. O helper importa esse arquivo; ele não foi copiado nem alterado neste recorte. O integrador deve incluí-lo antes de typecheck/gate. A branch isolada não é uma composição executável completa sem essa dependência.
2. **Observers Files/Import**: PR #431, HEAD completo `92dd01c6d69c0ce2b5fdeb44b7db4e754a9fe8f8`, merge `295c2bdca05c2373f821d50aab5d3ee3d3fb218b`; gate `44666552454` success, snapshot `5038302de56e1dc4c4a255eace3ab5210d6ae535`. Não estão nesta base antiga; devem ser compostos pela raiz sem sobrescrever produtores atuais.
3. **Files #393, dependência já presente na base de qualificação**: `packages/client/src/sucafina/bindings.ts` blob `dcf4229af5745da305906a2c1f7ce42427fd62bd` e `packages/client/test/sucafina/files-transport226/source-codecs.test.ts` blob `072a58358f4057526a932d0a22981194e7786612`. PR #393 ainda está open/unmerged na consulta. Não foram editados e este handoff não alega integração.
4. Preservar o hunk de Sourcing já presente em `5856483` e o host real 4174/ClamD da composição Operations. Não executar Reports/WP04 junto com Operations.

O retainer mantém status/headers/request do Response original e captura bytes no mesmo request pausado, sem fulfill, refetch ou replay. Aqui seus alvos são GETs originais, incluindo o ctx.context pós-logout, e o POST JSON de preview. **Admissão multipart permanece no Response original com leitura imediata**, sem alegar garantia contra eviction; o retainer não é aplicado à admissão com payload de arquivo nem ao Apply deliberadamente abortado. Se a admissão apresentar eviction no gate, preservar a falha como limitação concreta do harness; não substituir o retorno por outro request ou por dados da prévia.

## Verificação, limites e como retomar

- Leitura completa do helper, UI55/UI57, estados compartilhados, copy, AGENTS e guias oficiais de Playwright pelo GitHub.
- Readback GitHub confirmou os três blobs publicados; comparação de código desde a base contém somente os três caminhos acima; este handoff é o quarto caminho documental.
- Nenhuma execução local/shell, nenhum gate adicional, nenhum aumento de timeout, retry, skip ou enfraquecimento de assert financeiro/autoritativo.
- Revisão primária da raiz identificou o callback incorreto e conferiu a distinção entre o botão do painel e o Refresh receipt externo; o patch foi corrigido antes de gate. A revisão independente de Reports confirmou valores/receipt/CAS/applies e o dispatch para reconcile, sem conflito estático de identidade entre o retainer e o Apply abortado; a coexistência dinâmica de Fetch/page.route continua pendente de Actions. A mesma revisão encontrou o preflight nativo pós-logout, adaptado em `64d96d47` sob autorização da raiz. Reports concluiu também a leitura final de `64d96d47`: confirmou o oráculo separado 403, preflight original 401/unauthenticated, query fechada, zero GET reference, estado unavailable e privacidade/Apply/CAS/export preservados; não identificou outro bloqueio concreto por leitura. Ainda faltam typecheck e execução por Actions. Este documento não é uma qualificação complete.
- A única seleção de produto proposta, depois de composição e revisão pela raiz, é a mesma seleção Operations já existente:

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/operations.spec.ts"]}
```

- Root deve congelar a árvore composta, conferir as dependências exatas e executar uma única vez o gate afetado, sob o limite global de dois gates. Nenhum ci-run foi criado por este agente.
- Até esse resultado, manter Import **unbound** na asserção original `operations-support/imports.ts:155`; não declarar o caso verde pela leitura do código.
- DOC e PROC02/PROC03 permanecem causas separadas; este helper não os qualifica. O Sourcing herdado continua documentado no handoff da base.
- Este recorte não altera `runtime/application.ts`, listener, grants, `Schema.Never`, manifestos de baseline, `sf/ci/suites.json`, coverage, pacote ou caminhos proibidos.
- Guards finais, único sf-ci final e pacote congelado continuam sob responsabilidade da sessão integradora. Sem GO, deploy ou `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`.
