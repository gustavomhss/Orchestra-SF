# WP07 — Bloqueio externo do typecheck para S0

## Veredito e evidência

**Gate de typecheck: FAIL.** O check hospedado **43530862046**, sobre o produto **`c5143e6ad6d8dca61b09572c60f5a6ed64093f74`**, terminou com **exit code 2**. O log registra **137 diagnostics TypeScript, todos fora do ownership WP07, distribuídos por 46 arquivos; zero diagnostics próprios**. A ausência de erros próprios não transforma o comando integral em PASS.

| Campo | Evidência |
| --- | --- |
| Run | [43530862046](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530862046) |
| Job | [132247907151](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530862046/job/132247907151) |
| Produto examinado | `c5143e6ad6d8dca61b09572c60f5a6ed64093f74` |
| Árvore de produto informada pelo publicador | `889fe8f2c5dfc25ba9d8c25962e984454a12bd81` |
| Comando observado | `bun typecheck`, cujo script chama `bun --cwd Sucafinav1 typecheck` e `tsgo --noEmit` |
| Artefato | [wp07-check-c5143e6ad6d8dca61b09572c60f5a6ed64093f74-1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530862046/artifacts/14086898379), ID `14086898379` |
| SHA-256 do ZIP do artefato informado pelo publicador | `694d23b69f97ecab2537211281f52475be75db4ed1bdf0d1cce0807779a3286b` |
| Log bruto analisado | `wp07-context/check-9.log`, 834 linhas |
| SHA-256 do log bruto | `109de25d1ed5a755fe5606e833101f7aaec13a144a197eb630c2979e90da2bfa` |
| Localização da execução no log | Checkout do SHA: linhas 197–226; comando: 422–428; diagnostics: 429–750; exit code 2: 752; artefato: 810–812 |
| Resultado | 137 diagnostics; 137 externos; 0 próprios; processo com código 2 |

### Reconciliação com os checkpoints anteriores

Os **137 externos do check9 são idênticos aos do check8**, incluindo path, linha, coluna, código TS, texto completo do diagnostic primário e ordem de emissão. Os checks 8 e 7 já tinham o mesmo conjunto externo dos checks 4 e 3. A tabela mantém os resultados históricos sem promover um candidato intermediário falho a aprovado:

| Checkpoint | Produto | Diagnostics externos | Próprios | Gate |
| --- | --- | ---: | ---: | --- |
| [Check3 — 43524911748](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524911748) | `495e690bdd5440734de81de6f6017f5a11ba6ebe` | 137 | 2 | FAIL |
| [Check4 — 43526207659](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43526207659) | `798c096c105bc68870cec6c5a10269f1457e2f18` | 137 | 0 | FAIL |
| [Check6 — 43528388078](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528388078) | `d89084bb0f8e0f88ba09317e8b655178f575e5ad` | 137 | 1 | FAIL |
| [Check7 — 43528915475](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528915475) | `fc59841cec4691a0520eabcf2c24c0bbf9c4ddc1` | 137 | 0 | FAIL |
| [Check8 — 43530154275](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530154275) | `7664de39a5675cff81ac963c0fa51eb77621e74a` | 137 | 0 | FAIL |
| [Check9 — 43530862046](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530862046) | `c5143e6ad6d8dca61b09572c60f5a6ed64093f74` | 137 | 0 | FAIL |

Os dois próprios do check3 eram **TS2559**, em `product/reviews/report-layout.ts:77:136` e `:80:128`, por `fill` string em vez de `ShapeFillProps`; desapareceram no check4. O próprio do check6 era **TS2322** em `test/product/wp07/services.test.ts:37:5`: a fixture omitia o campo obrigatório `drilldown` dos valores de projeção. O log exato do check6, linha 708 e continuação, registra essa falha. **O check7 comprova a correção desse erro de fixture; os checks 8 e 9 conservam zero diagnostics próprios após o ajuste do consumidor de comparação e o recorte mensal da fixture de UI.**

A reconciliação adicional com `check-2/typecheck.txt` confirma **177 = 137 externos + 40 próprios** naquele checkpoint. Os 137 externos de check2, check3, check4, check7, check8 e check9 têm exatamente as mesmas chaves **path, linha, coluna e código TS**. Entre check2 e check3, uma mensagem inferida de `prepared-apply.ts:46:5` perdeu o modificador `readonly`; isso não mudou a ocorrência nem a localização. O log bruto exato do **check9** é a fonte principal deste documento.

Logs anteriores conservados para rastreabilidade:

- Check3: SHA-256 `34cf7b37404e7736054331625ee967cb0d92162ebd3f56e2e2aad19e217ea38b`; artefato [14083933914](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524911748/artifacts/14083933914).
- Check4: SHA-256 `21feb7d11ab7fb74fc20656a2c2c978ad33f60f706853a658bc04bd8d3ea8882`; artefato [14085750673](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43526207659/artifacts/14085750673).
- Check6: SHA-256 `e566265be19d72fc8e6829922a571903303a214fa89835c6c8e4157ce33e8906`; artefato [14085912679](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528388078/artifacts/14085912679).
- Check7: SHA-256 `2e58035041901ce73ea0ca8c672eebc7e37cda66994baff2c10f4b11421b94a6`; artefato [14086811317](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528915475/artifacts/14086811317).
- Check8: SHA-256 `ba6cf572cdf7daa1b226821e60a1ab36cee51dbd4ef6383ad0d41391a35615a8`; artefato [14087181847](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530154275/artifacts/14087181847).

Outras etapas do check9 passaram: **guards — 78 regras, 608 paths alterados, 0 gate findings, 11 avisos e 0 erros**; geração dos quatro exports do corpus sintético concluída. Esses resultados são independentes e não substituem o typecheck integral, os testes cirúrgicos ou uma inspeção visual dos arquivos gerados.

O relatório complementar [INTEGRATION-DELTA.md](INTEGRATION-DELTA.md) descreve a política estreita C08 para relatórios privados de viewer, o corpo factual C07 imutável e os seams de composição nativa. São bloqueios de integração e autoridade separados desta contagem de diagnostics; não foram resolvidos por alterar fixtures ou por obter zero erros próprios.

## Escopo e atribuição

Para separar ownership, foram excluídos somente os prefixes `product/reviews/`, `test/product/wp07/` e os arquivos próprios `runtime/reports.ts`, `test/parity-reports.test.ts`, `test/reports-runtime.test.ts`, `product/reports/storage.ts`. O filtro foi usado para classificar o log; o typecheck executado não recebeu filtro, exclusão, supressão nem mudança de flags.

Os owners abaixo são os destinatários pelo módulo e pelo prefixo de testes da campanha. S0 deve coordenar mudanças que cruzem C08/C17 e confirmar a atribuição compartilhada antes da integração. **“Externo” significa fora do ownership WP07; não é uma afirmação de que uma base anterior tenha passado ou falhado, pois não foi usado um run independente da base para essa conclusão.** Um mesmo problema de contrato pode produzir vários diagnostics derivados.

| Owner de destino | Diagnostics | Arquivos | Problema principal |
| --- | ---: | ---: | --- |
| WP00 | 1 | 1 | Contrato de host importa factory C07 ausente; coordena também a discriminação C08 compartilhada. |
| WP01 | 9 | 5 | HTTP mistura run e contribution; contexto UI/domain, surface e resolução de módulo de teste. |
| WP02 | 9 | 1 | Inferência do resultado da confirmação/observação e fields sem tipo contextual. |
| WP03 | 8 | 6 | Headcount, callbacks, retorno JSON e narrowings de falha já inferidos. |
| WP04 | 3 | 2 | Retorno de mutation e fixtures de factory com assinatura antiga. |
| WP06 | 33 | 5 | Inferência de preview/import, leitura de state, módulo dossier ausente e callbacks de testes. |
| WP08 | 12 | 6 | Conversão C08→PortResult, host de Hot Topic e fixture de observação incompleta. |
| WP10 | 28 | 6 | Composição CLI/host, contratos source/Atlas/native, imports e assinatura transacional de blobs. |
| WP11 | 13 | 4 | Prepared apply, narrowing de falha e fixtures de caso/evidência/cobertura. |
| WP12 | 1 | 1 | Fixture parcial convertida para DecisionCase completo. |
| WP13 | 12 | 7 | Narrowing de result kind/falha e transactionAll opcional em teste. |
| WP14 | 8 | 2 | Consumer de resolver Procurement ainda callable e teste com API anterior. |

WP09 não recebe uma linha de contagem própria porque os erros de seus módulos ausentes aparecem nos arquivos importadores WP00/WP06. Ele continua sendo o owner necessário para entregar as factories/dossier reais; os mesmos diagnostics não foram contados duas vezes.

## Deltas concretos de integração

### 1. C08: separar estado de armazenamento e resultado de domínio

O contrato em `product/contracts/state.ts` define o ramo com payload como `{ status: "ok" | "preview"; ...; value: T }`. `PortResult<T>` tem outra semântica: `preview` de uma transação que não confirmou a escrita não equivale a sucesso de uma porta. Além disso, agrupar dois valores de `status` no mesmo membro da união prejudica o narrowing quando um consumidor exclui `preview` e depois retorna o objeto inteiro. O log mostra esse descompasso em confirmações, threads, relações, ações e admissão/leitura de runs.

Exemplos verificáveis do check9:

- `product/collaboration/confirmation.ts:79:34` e `:91:34` — **TS2322**: `SfStateResult<... | null/undefined>` não é o `PortResult` final de confirmação.
- `product/collaboration/threads.ts:57:34`, `:68:33`, `:86:31`, `:101:32` — o retorno cru conserva `preview`, `null` ou `unknown`.
- `apps/cli/src/sucafina-product/host-context.ts:185:136`, `:217:138`, `:273:138`, `:396:5`, `:412:5` — o estado de armazenamento é encaminhado como resultado de run de outra forma.
- `product/documents/capabilities.ts:71:172` — **TS2339**: leitura de `reason` ainda admite o membro com payload.

**Delta pedido a WP00/WP10 e consumidores:** fechar o contrato C08 como união realmente discriminada ou tipos distintos de leitura/transação, preservando os significados atuais. Se a leitura nunca produz `preview`, essa garantia deve ser expressa pelo produtor, não presumida pelo consumidor. Em cada porta, tratar explicitamente `preview`, falhas e ausência de payload; reconstruir o envelope de domínio válido depois das verificações. Não encaminhar `SfStateResult<T>` bruto para uma porta de outro `T`, e não transformar uma transação sem commit em `ok` para satisfazer o compilador.

Este diagnóstico explica uma família importante, mas não todos os 137 casos. Os guards TS2367 descritos adiante têm outra causa.

### 2. C07, imports e composição do host incompletos

- `product/contracts/host-context.ts:14:45` — **TS2307**, falta `../routines/factory.ts`.
- `test/product/wp06/documents/runtime-e2e.test.ts:25:40` — **TS2307**, falta `product/routines/dossier.ts`. Oito parâmetros sem tipo contextual aparecem depois no mesmo teste; podem ser cascata desse import ausente.
- `test/product/wp01/workbench-analysis.test.ts:6:38` — **TS2307**, `@orchestra/server/routes` não resolve no workspace examinado.
- `apps/cli/src/sucafina-product/host-context.ts:158:128` — o factory de análise exige `imports` e `selectedPreviewRef`, ausentes no objeto de composição.
- `apps/cli/src/sucafina-product/import-services.ts:85:101` e `:115:21` — **TS2304**, `Period` e `isSfPeriod` não foram importados.

**Delta pedido:** WP09 deve integrar seus módulos de produção reais, com dependências e exports compatíveis com o candidato; WP00/WP10 atualizam o contrato e a composição correspondente. WP01/S0 devem conferir a dependência de workspace e o export canônico de rotas, em vez de declarar um módulo vazio. WP10 deve fornecer as portas de importação e o lookup de preview exigidos pelo factory de análise, e importar o tipo/validador de período dos contratos existentes. Não substituir rotina, dossier ou servidor por stubs para obter verde.

### 3. Procurement: resolver passou de callable para objeto com ciclo de vida de escopo

O produtor atual `createProcurementSourceResolver` recebe **`scopedSources` obrigatório** e retorna um objeto com `issue`, `resolve`, `resolveForPreparation`, `issueForActor`, `prepareReissueScope` e `isCurrent`. Há consumidores e fixtures ainda escritos para a forma anterior de função simples.

- `apps/cli/src/sucafina-product/business-services.ts:188:20` — **TS2322**, função passada onde se espera o objeto completo do resolver.
- `product/decision-memory/source-access.ts:216:35` e `:222:33` — **TS2349**, `input.resolve(...)` tenta chamar o objeto diretamente. O tipo do parâmetro usa `ReturnType<typeof createProcurementSourceResolver>`, que já é objeto.
- `test/product/wp14/source-access-procurement.test.ts:10:43` e `:11:33` — imports de `procurementSourceSelector` e `isCurrentProcurementSource` não existem nessa API.
- Mesmo teste, `:31:54`, `:32:51`, `:32:83`, `:33:25` — falta `scopedSources`; objeto/função são trocados; a fixture invoca o objeto como callable.

**Delta pedido a WP04/WP10/WP14:** escolher a forma canônica já implementada, compor o `SfScopedSourcePort` real e migrar os pontos de chamada de forma coerente. Um consumidor que precisa só de leitura deve declarar uma porta tipada com `resolve`, ou receber a função `resolver.resolve` explicitamente; o host que também precisa de emissão/reemissão deve conservar o objeto completo. Atualizar testes para emitir e resolver referências pelo ciclo de vida real, mantendo escopo, encarnação, campos, período e revalidação. Não recriar seletores por nome ou reintroduzir exports legados artificiais.

### 4. Resultados genéricos de transação e narrowing de uniões

Há inferência estreita em callbacks que retornam variantes diferentes, deixando resultados posteriores como `{}` ou `unknown`:

- `product/imports/dashboard-preview.ts:38:75` — **TS2345**, o tipo inferido por um ramo não inclui todos os resultados de preview. Os outros 16 diagnostics desse arquivo são usos de `result`, `format`, `before`, `after` e `impactDigest` que perderam o tipo correto.
- `product/decisions/prepared-apply.ts:71:446` — **TS2345**, os ramos de inexistência/falha/recibo não formam o tipo inferido esperado. `:95:75` e `:100–102` acessam o resultado como objeto/recibo sem uma união adequada.
- `product/dashboard/confirmation.ts:104:41` — **TS2345**, `transactionAll` não recebe um resultado comum explícito para os ramos de observação. Depois, `state/index/fingerprints/physicalIncarnations` aparecem como campos de `{}`.
- `product/portfolio/planner-sensitivity.ts:80:106/171` e `product/portfolio/verification.ts:119:106/171` — **TS2339**, `costCoverage` é acessado numa união que ainda inclui portfolio/comparison/sensitivity dentro de callback.

**Delta pedido aos owners:** definir a união discriminada real de cada operação e o argumento genérico/retorno do callback. Decodificar ou estreitar a variante antes de acessar campos. Para cenários usados em closures, capturar uma constante comprovadamente `kind: "scenario"` depois da validação, ou repetir o narrowing no ponto de uso. Os ramos de recusa, ausência, substituição e falha devem permanecer representados; não preencher campos financeiros/recibos para tornar o tipo conveniente.

Há também **nove TS2367** em Planner/Decisions/Portfolio após `array.find(item => item.status !== "ok")`. O compilador já estreita o elemento encontrado para falha, portanto o segundo `failure.status !== "ok"` é redundante e impossível segundo o tipo inferido. O delta é usar o elemento de falha já estreitado, por exemplo verificar sua existência e devolvê-lo, ou declarar um predicate de falha apropriado. Não alargar novamente `status` ou desativar a verificação.

### 5. Contratos de contexto, memória e dados de apresentação

- `product/interface/analysis-http.ts:30:114/171/197/235` — **TS2339**. O teste `"state" in result.value` não prova que o objeto é `SfNativeRunRecord`: `ContributionEnvelope` também tem estado. Separar o dispatch por ação/resultado tipado, ou usar discriminante canônico completo antes de ler `runRef`, `version` e `outputRef`.
- `product/host-binding/business-context.ts:170:71` — **TS2353**. `createSfCaseEventSourceAccess` aceita `{ host, cases }`, mas o host envia `state`, `authorizeCase` e `authorizeEvidence` da forma antiga. Compor o `DecisionCasePort` real; não abandonar sua autorização para acomodar o objeto antigo.
- Mesmo arquivo, `:212:5` — **TS2322**, `MemoryEntry` mais amplo diverge das variantes esperadas por recall. Alinhar contrato e projeção validada às variantes de memória admitidas; conservar proveniência/escopo e rejeitar espécies incompatíveis em vez de convertê-las por cast.
- `apps/cli/.../host-context.ts:551:5`, `test/product/wp01/personal-views.test.ts:35:137`, `test/product/wp11/analysis-acceptance-adversarial.test.ts:73:60` — `TrustedUiContext` e `TrustedDomainContext` não são intercambiáveis. Fazer dispatch pelo `kind` e aplicar o mecanismo de autoridade real da superfície, ou restringir formalmente a API que é apenas UI.
- `product/interface/import-http.ts:54:249` — **TS2345**, `surface` continua `string`; validar e preservar a união `dashboard/planner` no limite HTTP.
- `product/planner/headcount.ts:27:73` e `:39:66` — **TS2339**, a transformação com spread infere apenas `state`; a forma da posição deve conservar seus campos tipados antes de consultar `domain`.
- `product/planner/prepared.ts:54:5` e `product/procurement/prepared.ts:69:5` — **TS2322**, resultados de mutation inferem propriedades opcionais com `undefined`, incompatíveis com `JsonValue`. Definir retornos JSON válidos por variante, sem adicionar chaves de valor `undefined` e sem mudar a semântica de commit.

### 6. Fixtures e contrato transacional do driver

`runtime/local-contract.ts` combina `Persistence & AssetPersistence`. Ambos definem `transaction`, mas o segundo callback recebe também `BlobTransaction`. Essa interseção de assinaturas não fornece o tipo contextual esperado a diversos callbacks de testes, resultando em **12 TS7006** nos testes WP10 de blobs/autoridade. WP10 deve fechar explicitamente a assinatura pública do store local, compatível com as portas necessárias, ou tipar os callbacks pela assinatura real do driver. Não trocar SQLite por fixture simplificada para esconder o problema de API.

Outros ajustes de fixture precisam acompanhar contratos válidos:

- WP08 `confirmation-integration.test.ts:63:289`: uma observação `available` deve ter `evidence` e `projection` reais, não só fingerprints.
- WP11 `coverage-access.test.ts:39:127`, `:48:127`, `:77:63`: declarar fixtures contra `SourceRef`/`ScenarioComparison` mantém os literais `surface`/`comparisonStatus` precisos e valida o corpo completo.
- WP12 `author-reader.test.ts:32:26`: o objeto parcial não é um `DecisionCase`. Criar a fixture completa por schema/factory válido; a sugestão automática de conversão via `unknown` no diagnostic não deve ser aplicada como solução.
- WP13 `sensitivity-units-boundary.test.ts:218:211` e `:230:25`: exigir e estreitar a capacidade `transactionAll` do driver real antes de invocá-la. Ausência deve continuar erro/indisponibilidade, não confirmação fictícia.
- WP03 `parity-matrix.test.ts:106:68`: validar `kind: "record"` antes de ler `target.recordId`.
- WP04 `prepared-production.test.ts:208:41` e `:220:107`: alinhar as duas chamadas à assinatura atual da factory. O log só demonstra incompatibilidade de aridade; este relatório não presume a semântica do argumento sem a revisão do owner.

## Inventário externo completo por owner e path

Os locais abaixo são **linha:coluna do código no SHA examinado**, não intervalos de linhas do log. A soma da coluna de ocorrências é 137. Um arquivo pode conter uma causa primária e diversos diagnostics derivados. Os links apontam para a primeira ocorrência do arquivo no candidato exato.

| Owner | Path no repositório | Ocorrências | Locais e códigos | Problema |
| --- | --- | ---: | --- | --- |
| WP00 | [modules/sucafina/Sucafinav1/product/contracts/host-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/contracts/host-context.ts#L14) | 1 | 14:45 TS2307 | Import de product/routines/factory.ts não resolvido. |
| WP01 | [modules/sucafina/Sucafinav1/product/interface/analysis-http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/interface/analysis-http.ts#L30) | 4 | 30:114 TS2339; 30:171 TS2339; 30:197 TS2339; 30:235 TS2339 | Teste de state não diferencia SfNativeRunRecord de ContributionEnvelope. |
| WP01 | [modules/sucafina/Sucafinav1/product/interface/http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/interface/http.ts#L148) | 2 | 148:82 TS7006; 148:87 TS7006 | Callbacks run/index perderam tipo contextual na composição de rotinas. |
| WP01 | [modules/sucafina/Sucafinav1/product/interface/import-http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/interface/import-http.ts#L54) | 1 | 54:249 TS2345 | surface string não foi estreitada para dashboard/planner após validação. |
| WP01 | [modules/sucafina/Sucafinav1/test/product/wp01/personal-views.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp01/personal-views.test.ts#L35) | 1 | 35:137 TS2322 | Fixture fornece callback TrustedUiContext onde API aceita TrustedDomainContext. |
| WP01 | [modules/sucafina/Sucafinav1/test/product/wp01/workbench-analysis.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp01/workbench-analysis.test.ts#L6) | 1 | 6:38 TS2307 | Import @orchestra/server/routes não resolvido no workspace testado. |
| WP02 | [modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/dashboard/confirmation.ts#L66) | 9 | 66:474 TS7006; 104:41 TS2345; 118:16 TS2339; 118:52 TS2339; 119:16 TS2339; 120:77 TS2339; 121:163 TS2339; 123:61 TS2339; 128:126 TS2339 | Callback transactionAll tem variantes incompatíveis para inferência; usos posteriores viram {}. |
| WP03 | [modules/sucafina/Sucafinav1/product/planner/headcount.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/planner/headcount.ts#L27) | 2 | 27:73 TS2339; 39:66 TS2339 | Objeto com spread de Record perde a informação de domain na inferência; linha/estado precisam de tipo preciso. |
| WP03 | [modules/sucafina/Sucafinav1/product/planner/monthly-host.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/planner/monthly-host.ts#L58) | 1 | 58:598 TS7006 | Callback cell sem tipo contextual. |
| WP03 | [modules/sucafina/Sucafinav1/product/planner/persistence.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/planner/persistence.ts#L33) | 2 | 33:19 TS2367; 38:22 TS2367 | find de falha já exclui ok; guard redundante TS2367. |
| WP03 | [modules/sucafina/Sucafinav1/product/planner/prepared.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/planner/prepared.ts#L54) | 1 | 54:5 TS2322 | Execute retorna união com campos opcionais undefined, incompatível com JsonValue. |
| WP03 | [modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts#L40) | 1 | 40:18 TS2367 | Guard redundante depois de find já estreitado para falha. |
| WP03 | [modules/sucafina/Sucafinav1/test/product/wp03/parity-matrix.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp03/parity-matrix.test.ts#L106) | 1 | 106:68 TS2339 | target.recordId usado antes de verificar evidence.kind record. |
| WP04 | [modules/sucafina/Sucafinav1/product/procurement/prepared.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/procurement/prepared.ts#L69) | 1 | 69:5 TS2322 | Execute da mutation não fecha JsonValue sem undefined. |
| WP04 | [modules/sucafina/Sucafinav1/test/product/wp04/prepared-production.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp04/prepared-production.test.ts#L208) | 2 | 208:41 TS2554; 220:107 TS2554 | Duas chamadas de fixture passam argumento a função atualmente sem argumentos. |
| WP06 | [modules/sucafina/Sucafinav1/product/documents/capabilities.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/documents/capabilities.ts#L71) | 1 | 71:172 TS2339 | Acesso a reason sem excluir ramo ok/preview de SfStateResult. |
| WP06 | [modules/sucafina/Sucafinav1/product/imports/dashboard-preview.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/imports/dashboard-preview.ts#L38) | 17 | 38:75 TS2345; 60:17 TS2339; 60:71 TS2339; 60:119 TS2339; 62:29 TS2638; 74:251 TS2339; 74:306 TS2339; 74:353 TS2339; 74:457 TS2339; 75:297 TS2322; 75:445 TS2322; 75:469 TS2322; 75:545 TS2339; 75:573 TS2339; 75:592 TS2322; 75:674 TS2339; 75:848 TS2339 | Callback de preview/import inferido por um ramo estreito; campos result/format/before/after viram desconhecidos. |
| WP06 | [modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp06/documents/runtime-e2e.test.ts#L25) | 9 | 25:40 TS2307; 101:227 TS7006; 101:230 TS7006; 114:229 TS7006; 114:232 TS7006; 253:225 TS7006; 253:228 TS7006; 263:227 TS7006; 263:230 TS7006 | Import routines/dossier.ts ausente e oito parâmetros sem tipo contextual. |
| WP06 | [modules/sucafina/Sucafinav1/test/product/wp06/imports/end-to-end.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp06/imports/end-to-end.test.ts#L56) | 2 | 56:72 TS2345; 65:590 TS2322 | Callback genérico inferido pelo ramo unavailable; producer passa a retornar unknown. |
| WP06 | [modules/sucafina/Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts#L41) | 4 | 41:76 TS2322; 42:12 TS18046; 46:74 TS2322; 47:12 TS18046 | Resultados applied/unchanged/falha não têm união explícita; resultado inferido unknown. |
| WP08 | [modules/sucafina/Sucafinav1/product/collaboration/confirmation.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/collaboration/confirmation.ts#L79) | 2 | 79:34 TS2322; 91:34 TS2322 | Retornos SfStateResult ainda admitem preview/null/undefined em portas tipadas de confirmação. |
| WP08 | [modules/sucafina/Sucafinav1/product/collaboration/hot-topic-host.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/collaboration/hot-topic-host.ts#L16) | 1 | 16:9 TS2322 | Host transacional não fecha o resultado genérico esperado pela porta HotTopic. |
| WP08 | [modules/sucafina/Sucafinav1/product/collaboration/recipient-actions.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/collaboration/recipient-actions.ts#L50) | 1 | 50:32 TS2322 | SfStateResult<boolean> cru não é PortResult<RecipientThread>. |
| WP08 | [modules/sucafina/Sucafinav1/product/collaboration/relations.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/collaboration/relations.ts#L70) | 3 | 70:66 TS2322; 116:35 TS2322; 127:35 TS2322 | Retornos de state têm preview e itens opcionais; precisam virar envelopes de relação explicitamente válidos. |
| WP08 | [modules/sucafina/Sucafinav1/product/collaboration/threads.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/collaboration/threads.ts#L57) | 4 | 57:34 TS2322; 68:33 TS2322; 86:31 TS2322; 101:32 TS2322 | State results null/unknown/preview retornam diretamente como thread de domínio. |
| WP08 | [modules/sucafina/Sucafinav1/test/product/wp08/confirmation-integration.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp08/confirmation-integration.test.ts#L63) | 1 | 63:289 TS2739 | Observação available da fixture omite evidence e projection obrigatórios. |
| WP10 | [apps/cli/src/sucafina-product/business-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/apps/cli/src/sucafina-product/business-services.ts#L85) | 3 | 85:30 TS7006; 85:40 TS7006; 188:20 TS2322 | Contextual typing dos callbacks; função simples passada onde o contrato pede o resolver Procurement completo. |
| WP10 | [apps/cli/src/sucafina-product/host-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/apps/cli/src/sucafina-product/host-context.ts#L158) | 7 | 158:128 TS2345; 185:136 TS2322; 217:138 TS2322; 273:138 TS2322; 396:5 TS2322; 412:5 TS2322; 551:5 TS2322 | Dependências imports/selectedPreviewRef ausentes, SfStateResult encaminhado como PortResult e callback UI estreito demais. |
| WP10 | [apps/cli/src/sucafina-product/import-services.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/apps/cli/src/sucafina-product/import-services.ts#L85) | 2 | 85:101 TS2304; 115:21 TS2304 | Imports canônicos de Period e isSfPeriod ausentes. |
| WP10 | [modules/sucafina/Sucafinav1/product/host-binding/business-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts#L170) | 4 | 170:71 TS2353; 170:153 TS7006; 170:159 TS7006; 212:5 TS2322 | Factory de case-event mudou de parâmetros; retorno Atlas MemoryEntry diverge do contrato de recall. |
| WP10 | [modules/sucafina/Sucafinav1/test/product/wp10/integration/blob-generations.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp10/integration/blob-generations.test.ts#L13) | 10 | 13:112 TS7006; 13:122 TS7006; 31:58 TS7006; 31:68 TS7006; 40:63 TS7006; 40:73 TS7006; 51:49 TS7006; 51:60 TS7006; 68:69 TS7006; 68:80 TS7006 | Assinaturas transaction sobrepostas não contextualizam snapshot/blobs dos callbacks. |
| WP10 | [modules/sucafina/Sucafinav1/test/product/wp10/integration/product-authority.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp10/integration/product-authority.test.ts#L24) | 2 | 24:47 TS7006; 24:57 TS7006 | Mesmo problema de contextual typing da transaction com blobs. |
| WP11 | [modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts#L46) | 8 | 46:5 TS2322; 71:446 TS2345; 95:75 TS2638; 97:185 TS2740; 100:74 TS2638; 101:81 TS2638; 101:112 TS2638; 102:183 TS2740 | União de resultados da transação não explicitada; {} chega a in e CommandReceipt. |
| WP11 | [modules/sucafina/Sucafinav1/product/decisions/proposals.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/decisions/proposals.ts#L92) | 1 | 92:26 TS2367 | find já estreita para falha; nova comparação com ok é impossível. |
| WP11 | [modules/sucafina/Sucafinav1/test/product/wp11/analysis-acceptance-adversarial.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp11/analysis-acceptance-adversarial.test.ts#L73) | 1 | 73:60 TS2345 | TrustedDomainContext passado a operação que exige TrustedUiContext. |
| WP11 | [modules/sucafina/Sucafinav1/test/product/wp11/coverage-access.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp11/coverage-access.test.ts#L39) | 3 | 39:127 TS2322; 48:127 TS2322; 77:63 TS2322 | Literais surface e comparisonStatus alargados para string nas fixtures. |
| WP12 | [modules/sucafina/Sucafinav1/test/product/wp12/author-reader.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp12/author-reader.test.ts#L32) | 1 | 32:26 TS2352 | Objeto parcial não satisfaz DecisionCase; preencher fixture/schema real. |
| WP13 | [modules/sucafina/Sucafinav1/product/portfolio/catalog.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/portfolio/catalog.ts#L13) | 1 | 13:20 TS2367 | Guard redundante depois de find já estreitado para falha. |
| WP13 | [modules/sucafina/Sucafinav1/product/portfolio/handoff.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/portfolio/handoff.ts#L41) | 2 | 41:18 TS2367; 78:18 TS2367 | Dois guards redundantes depois de find já estreitado para falha. |
| WP13 | [modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts#L80) | 2 | 80:106 TS2339; 80:171 TS2339 | Acesso costCoverage em result não estreitado ao kind scenario dentro de callback. |
| WP13 | [modules/sucafina/Sucafinav1/product/portfolio/port.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/portfolio/port.ts#L36) | 1 | 36:20 TS2367 | Guard redundante depois de find já estreitado para falha. |
| WP13 | [modules/sucafina/Sucafinav1/product/portfolio/sensitivity-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/portfolio/sensitivity-store.ts#L25) | 1 | 25:19 TS2367 | Guard redundante depois de find já estreitado para falha. |
| WP13 | [modules/sucafina/Sucafinav1/product/portfolio/verification.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/portfolio/verification.ts#L119) | 2 | 119:106 TS2339; 119:171 TS2339 | Acesso costCoverage em união de results sem narrowing estável no callback. |
| WP13 | [modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-units-boundary.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-units-boundary.test.ts#L218) | 3 | 218:211 TS2722; 230:25 TS2722; 230:25 TS18048 | transactionAll opcional invocado sem prova/narrowing da capacidade. |
| WP14 | [modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts#L216) | 2 | 216:35 TS2349; 222:33 TS2349 | Resolver Procurement é objeto e está sendo invocado como função. |
| WP14 | [modules/sucafina/Sucafinav1/test/product/wp14/source-access-procurement.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/c5143e6ad6d8dca61b09572c60f5a6ed64093f74/modules/sucafina/Sucafinav1/test/product/wp14/source-access-procurement.test.ts#L10) | 6 | 10:43 TS2305; 11:33 TS2724; 31:54 TS2741; 32:51 TS2322; 32:83 TS2322; 33:25 TS2349 | Exports removidos, scopedSources obrigatório ausente e resolver objeto usado como função. |

## Sequência de fechamento para S0

1. Integrar um conjunto coerente dos owners C08/C07/C17 e host: contrato de state, factories de rotina e resolver Procurement precisam corresponder aos consumidores presentes no mesmo candidato.
2. Corrigir os adaptadores de domínio/HTTP para retornarem envelopes explicitamente tipados e preservarem `denied`, `unavailable`, `conflict`, `preview`, ausência e autoridade de cada superfície.
3. Ajustar as uniões dos callbacks e as fixtures aos contratos reais. Reavaliar diagnostics em cascata somente depois das correções estruturais; não presumir que todas as ocorrências são independentes.
4. Rodar o `bun typecheck` oficial do package no runner hospedado, no SHA integrado exato, com a configuração existente. Anexar artefato e exit status. O check9 comprova zero diagnostics próprios no candidato atual; a integração deve conservar esse resultado enquanto elimina os 137 externos.
5. Executar os checks cirúrgicos dos owners afetados e os gates de integração aplicáveis no processo S0, preservando os requisitos de autoridade, persistência e consumidores nativos. Um typecheck limpo sozinho não comprova esses percursos.

WP07 não modificou arquivos estrangeiros para produzir este relatório e não sugere excluir módulos, mudar flags, adicionar supressões, usar casts duplos ou substituir produtores reais. **O gate integral permanece FAIL até existir evidência hospedada do candidato integrado com saída bem-sucedida.** Nenhum teste de produto local foi executado para esta análise; contagem, agrupamento e hash são processamento estático do log já produzido pelo GitHub Actions.
