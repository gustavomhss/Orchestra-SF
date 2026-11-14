# WP06 — deltas de consumidores e limites das provas

Este documento identifica os pontos concretos de composição que a continuação WP06 encontrou. Não é um recibo de aprovação. O mapa de critérios conserva os 140 IDs e textos do pack; seus estados dependem de observações no candidato publicado e de seus runs hospedados.

Esta atualização final foi observada em **2026-11-13T23:19:21Z**, após o término do U5. Identifica o produto W5 `1b9e2ee13b5b297ef48bcde509d615c24c14acee` e preserva o histórico W1–W4/B4. O backend U5 registra **175 pass, 1 fail, 1 error**, sem falha de asserção observada; o módulo de dossiê ausente impediu as asserções desse arquivo. O navegador B5 passou os dez casos selecionados, incluindo os dois documentais. O check C5 continua failure nos typechecks completos, com guards aprovados e nenhum diagnóstico de produção WP06. Não há aprovação global.

## Revisões consultadas

| Revisão | SHA | Uso nesta auditoria |
| --- | --- | --- |
| Handoff | `6074055e46116d770c6673449ec8c5da6dc74933` | WP06, protocolo CI e pack vinculado |
| Planejamento | `dbf9547211d9b0fade619790de7c19c0869b7c7d` | Critérios, contratos, COMMON, WORKFLOW e apêndices obrigatórios |
| Seed recuperado | `95faa3e66a5640ca37407b072c65eaf731d0ca1f` | Implementação inicialmente disponível em `astra-wp06` |
| Produtor de rotinas | `b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8` | `sf2-relay-ready`: dossiê WP09 real |
| Produtor host | `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f` | `sf2-host-ready`: composição de análise de importação e BCS |
| Produtor AI | `574841e2409a9523000c4c1976c81804c9a86fde` | `sf2-ai-ready`: host de análise e vínculo de recibos nativos |

Todas as leituras remotas foram feitas pelo GitHub MCP. A ausência de branches `astra-wp09`, `astra-wp10` e `astra-wp12` não é usada para alegar que seus produtores não existem.

## 1. WP09: dossiê de sourcing

O seed não contém `product/routines`. O produtor real existe em [`product/routines/dossier.ts` no SHA do produtor de rotinas](https://github.com/gustavomhss/Orchestra-SF/blob/b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8/modules/sucafina/Sucafinav1/product/routines/dossier.ts).

O ponto de entrada `prepareSourcingDossier` recebe `prepareProcurement`, `selectedDocuments`, `reader`, `context`, `revalidate` e `revalidateProcurement`. Ele consulta a seleção documental novamente e compara `refId`/`refDigest`. `prepareDossierEvidence` usa `resolveSfDocumentEvidence`: uma extração atual permanece pendente; confirmação atual passa a confirmada; fonte indisponível não é promovida a evidência válida.

WP06 entrega `product/documents/request-evidence.ts::createSfRequestDocumentEvidence` como implementação de `selectedDocuments`. A função recebe o resolver autorizado de Request, o catálogo documental real e a listagem de candidatos do host WP06. Seleciona apenas anexos quote/signed-po da Request autorizada; conserva os refs que o resolver WP06 reconhece. O leitor do dossiê deve ser a mesma instância `documents.documents.reader` usada pelo host instalado.

**Delta de composição para S0/WP09:** incorporar o produtor de rotinas e conectar essa seleção e esse leitor no ponto de composição do dossiê. Não criar outro parser, catálogo, formato de ref ou confirmação. O resolver de Request deve vir do produtor Procurement/Request, com ACL e versão atuais. Esta continuação não modifica a área de produto WP09.

**Prova ainda necessária:** anexar um documento à Request autorizada; extrair um candidato; demonstrar que o dossiê fica pendente; confirmar explicitamente o mesmo campo; demonstrar que o mesmo `evidenceRef` passa a confirmado; alterar/revogar a fonte e demonstrar recusa sem metadados, trecho ou link residuais. Um teste direto de `resolveSfDocumentEvidence` não substitui esse consumidor.

Critério direto: `WP06.T05.CHK.20`; critérios compostos que exigem dossiê continuam vinculados à mesma obrigação.

## 2. Análise de importação e importPreviewRef

O seed contém `product/planner/import-analysis.ts`, que refaz a simulação pelo comando Planner real e revalida manifest, arquivo, fonte e autoridade. O host do produtor [`apps/cli/src/sucafina-product/host-context.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f/apps/cli/src/sucafina-product/host-context.ts) acrescenta a composição `createSfImportForecastAnalysis`, implementada em [`import-analysis.ts`](https://github.com/gustavomhss/Orchestra-SF/blob/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f/apps/cli/src/sucafina-product/import-analysis.ts). Essa composição não consta do host-context do seed.

WP06 acrescenta uma leitura pública autorizada `readPreviewReference` e o endpoint `import-reference`. A página `?sf=imports&importPreviewRef=...` consome o C04 persistido, conserva a separação entre simulação e aplicação e exige ação humana explícita para Apply. O manifest público não contém o comando privado. O teste HTTP/SQLite verifica a identidade entre a leitura por referência e o manifest do preview existente.

**Delta para S0/WP03/WP10:** integrar a composição real de análise de importação do produtor host e verificar que uma análise admitida publica esse mesmo `importPreviewRef`. A UI que abre um ref manual não prova que uma skill nativa o produziu.

**Prova ainda necessária:** run nativo realmente admitido, skill carregada com recibo genuíno, análise ligada ao mesmo C04, abertura na UI e recusa de interpretação/aplicação após alteração de arquivo/base/autoridade. Os testes determinísticos do parser, domínio, HTTP e UI cobrem partes desse caminho, sem substituir o run nativo.

Critérios diretos: famílias `WP06.T02.*.60` e `WP06.T03.*.60`.

## 3. BusinessContext: consumidor real exercitado nos três formatos

Há composição real no seed:

1. `apps/cli/src/sucafina-product/host-context.ts` cria os serviços documentais e passa `documents.documents.reader` a `createSfBusinessServices`.
2. `apps/cli/src/sucafina-product/business-services.ts::initializeAtlas` passa esse leitor a `createSfAtlasBusiness`.
3. `product/host-binding/business-context.ts` constrói `createSfDocumentSourceAccess` e o instala no roteador de evidências.
4. `product/decision-memory/source-access.ts` chama o resolver documental WP06 duas vezes e verifica a consistência do resultado.

O teste `test/product/wp06/documents/request-selection.test.ts` exercita os três formatos no mesmo percurso composto. Cada caso usa bytes reais, o parser privado real, SQLite, credenciais locais persistidas e autoridade real. A seleção de Request e de anexo passa pelo HTTP, a extração e a busca passam pelo dispatch compartilhado e o consumidor é `createSfBusinessContext` com `createSfDocumentSourceAccess` e o leitor documental instalado no fixture.

O percurso verifica:

1. seleção opaca restrita à Request e ao principal, recusa do token de outro principal e recusa de admissão após mudança da Request;
2. registro de schema ligado ao documento e extração de `Price: 42` com unidade USD; o candidato extraído resolve como evidência, mas BCS não o aceita como premissa confirmada;
3. confirmação humana explícita, preservação de `refId` e segmento, resolução do ref original como confirmado e aceitação pelo BCS do ref confirmado atual;
4. apresentação do trecho exato `42`, localização da fonte e busca lexical pelo mesmo serviço;
5. recusa de data, número e moeda ambíguos, sem criar candidatos adicionais; recusa de chamada direta com contexto forjado e de refs com algoritmos ou valores SHA256/BLAKE3 trocados, mesmo após recálculo do checksum externo;
6. remoção do anexo, seguida de recusa da apresentação e da premissa BCS e ausência de resultado de busca. O texto externo que manda aprovar pagamento não altera a Request, que permanece em sourcing.

O fixture `format-fixtures.ts` produz DOCX mínimo e PDF digital determinísticos; não fornece texto extraído artificialmente ao consumidor. O teste dedicado `pdf-digital.test.ts` também usa o extrator RAG real.

**Observação final U5:** produto `1b9e2ee13b5b297ef48bcde509d615c24c14acee`, snapshot unitário `d87f2c19f9d97edb90591ac1f5fd58a1fffd1e4b`, [run `43525466970`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43525466970), job `132230001270`. Os três percursos passaram novamente no candidato final, incluindo os negativos de ambiguidade e troca de hashes.

O histórico W4 permanece identificado pelo produto `a33fa24809bf8c52f92b910bcde45c708e2107de`, snapshot `5b6ebf3765bff51dd0d5ddd06cc2058ced5f33b8`, [run `43523089034`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523089034), job `132221958726`. O W3 já havia exercitado os três formatos no [run `43521334753`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43521334753), produto `4798112115825a2a3f8cc5f2217c674ce8437efc`, snapshot `888d7860b9a94962e5388417697561c9801c6deb`.

| Caso em `request-selection.test.ts` | W3: resultado e duração | W4: resultado e duração | W5: resultado e duração |
| --- | --- | --- | --- |
| TXT: Request → dispatch → confirmação → BCS | PASS · 1329,94 ms | PASS · 1641,63 ms | PASS · 1550,90 ms |
| DOCX: Request → dispatch → confirmação → BCS | PASS · 2372,62 ms | PASS · 3211,44 ms | PASS · 3077,40 ms |
| PDF digital: Request → dispatch → confirmação → BCS | PASS · 2593,36 ms | PASS · 3522,03 ms | PASS · 3375,26 ms |

O W4 acrescentou e executou os negativos explícitos de número/moeda ambíguos e troca SHA256/BLAKE3; o U5 os revalidou no produto final. Para cada formato, `1,234` e `USD 42 / EUR 39` exigem `needs-input`; a listagem preserva somente o candidato Price já confirmado. A busca real produz um ref lexical sem candidato, cuja resolução original é fresh. Os refs mutados recebem `digestSfEvidenceRef` recalculado: algoritmos invertidos são invalid e troca dos valores entre o hash SHA256 do blob e o hash BLAKE3 RAG é stale. Assim, a recusa não depende apenas de um checksum externo incorreto nem de divergência com uma cópia de candidato. Essas asserções observadas fortalecem `WP06.T05.CMP.01`, `WP06.T05.CHK.19` e `WP06.T05.CMP.19`.

Esses resultados qualificam o percurso acima no W5. O run agregado falhou, conforme a seção 9. O teste compõe o BCS real diretamente; ele não executa a inicialização completa de Atlas, publicação/indexação pelo scanner instalado, Session nativa ou recibo de skill. Esses testemunhos continuam separados. O fixture declara essas limitações e não publica uma evidência Atlas fictícia. Os negativos adicionais foram observados nos W4 e W5; o histórico W3 não é apresentado como sua prova.

## 4. UI, native e MCP compartilham contrato; identidade nativa precisa ser observada

O serviço WP06 entrega o descriptor `sf_import_preview` com `handlerExport: previewImport`. A continuação liga o HTTP de preview ao `dispatchSfCapability` com schemas e validação de autoridade atuais. Os descriptors de importação e documentos são registrados como `extraDescriptors` pelo host instalado do seed.

Os testes HTTP/SQLite usam credenciais locais persistidas, ACL e estado reais. O fixture declara deliberadamente `inspectSession` sem Session e validação de seleção/skill sempre negativa. Isso permite testar a via humana e recusas; não fornece sucesso nativo. O callback scanner do fixture também não qualifica o scanner instalado.

**Delta de qualificação para S0/WP10/WP12:** executar `sf_import_preview`, `sf_document_extract` e `sf_knowledge_search` por SessionV2 e pelo MCP privado realmente admitidos, com recibos de skill genuínos. Registrar os IDs de Session, run, call e recibo, o SHA do candidato, a seleção de ferramentas e a igualdade de resultado/versão com o handler humano. Demonstrar recusas para chamada direta, skill ausente e revogação. Não substituir esses validadores por `true` nem converter uma recusa universal em entrega funcional.

Critérios diretos: famílias `.18` de T02/T05, critérios nativos compostos e os vínculos integrados indicados pelo pack. O green cirúrgico WP06 não substitui AM01–AM06 nem a qualificação final do bundle.

## 5. Escopo exato do navegador

Os dois specs usam os renderers, JavaScript e CSP reais de produção, com fronteira HTTP sintética. Ambos executaram em Chromium no B5 e seus dez casos passaram. O relatório distingue dois casos documentais e oito de importação.

`packages/app-shell/e2e/sucafina/wp06/imports.spec.ts` importa `renderSfImportWorkbench`. Suas asserções cobrem cancelamento, preservação de arquivo/opções, apresentação textual de conteúdo HTML, stale seguido de novo preview explícito, bloqueio de Apply quando o detalhe falha, recuperação somente de leitura do recibo, apresentação de resultados applied/unchanged/rejected e recusa de apresentação de um ref stale como aplicado. Os bytes do arquivo são sintéticos.

`packages/app-shell/e2e/sucafina/wp06/documents.spec.ts` importa `sfDocumentWorkbench`. Suas asserções cobrem seleção de fonte pela Request, registro de schema com o documento correto, candidato/trecho/link apresentados como dados, ausência de confirmação automática e confirmação somente pelo clique explícito. O caso de confirmação stale exige remoção imediata do candidato, trecho, link e botão de confirmação, campos de revisão ocultos e Open desabilitado, preservando os valores locais Price/USD e a mensagem de recusa. Refresh seguido de reabertura de uma fonte ainda stale deve manter a recusa sem restaurar o conteúdo antigo. O spec não usa parser, SQLite, ACL ou BCS reais; esses percursos têm os testes de serviço separados descritos acima.

Os números `72000`, `84000`, `590000` e `602000` exibidos pelo spec de importação não constituem prova da aritmética. A aritmética pertence aos testes do comando/projeção Planner e ao teste financeiro dedicado. O teste HTTP/SQLite qualifica separadamente o transporte real, a ausência de escrita em preview, Apply, recibo e revogação.

Seleção Playwright efetivamente executada no B5 pelo validador existente:

```json
{
  "package": "app",
  "directory": "packages/app-shell",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": [
    "e2e/sucafina/wp06/imports.spec.ts",
    "e2e/sucafina/wp06/documents.spec.ts"
  ],
  "env": {"ORCHESTRA_CHANNEL": "prod"}
}
```

`packages/app-shell/e2e/tsconfig.json` usa uma lista explícita de includes que, no seed, não contém esses specs. Um green de `typecheck:e2e` não é atribuído aos specs por associação. A prova aqui é sua seleção e execução Playwright observada no produto W5.

**B4 preservado:** o [run `43523765526`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523765526), snapshot `e7ec13ba4dd9d6815d799c92e354736d617f8cd4`, produto W4 `a33fa24809bf8c52f92b910bcde45c708e2107de`, falhou nos dez casos. O match exato do nome acessível não encontrava selects cujas labels aninhadas incorporavam texto de opções. Os destinos e o DOM estavam presentes; as asserções principais de revisão/extração ainda não tinham sido alcançadas. Artefato [14084686955](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523765526/artifacts/14084686955), digest `sha256:e09c415be376494571f46b5dc18a7669eef645c02c540eda3ca85dde466caa25`.

O W5 mudou somente as labels dos dois workbenches de produto para associações explícitas `for`/`id`, incluindo Type no documento. Os dois specs e suas asserções permaneceram byte a byte iguais ao W4: documento blob `d6d5f049041cb609a4a2bb0d2d803e6610344970`, importação blob `d17f1489d9329b5c2ce5b72d6ce9f933d0792905`.

**B5 observado:** produto `1b9e2ee13b5b297ef48bcde509d615c24c14acee`, snapshot `417b7f11e6a8c3f3e02093868ce733f65fb60674`, [run `43524990304`](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524990304), job `132228409185`. O relatório registra **10 passed, 0 skipped, 0 unexpected, 0 flaky, 0 retries**, duração total de 48,521 s.

| Grupo/caso observado no B5 | Resultado | Duração |
| --- | --- | --- |
| Documento: candidato e fonte como dados até confirmação explícita | PASS | 968 ms |
| Documento: recusa stale preservada e conteúdo inutilizável removido imediatamente | PASS | 1117 ms |
| Importação: os oito casos descritos acima | 8 PASS | Sem retries |

Artefato [14085011660](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524990304/artifacts/14085011660), digest `sha256:1288b4bdd7c9ca5e127378fe91987942408388a536fd66017532fb1630fc32df`. SHA256 do relatório runtime: `1a5816a48568acf6e60206efe7e33c0e28b44232a3c4ed59ca2c8eec3d663414`; seleção observada: `cb9850369e949606233a3e6d7dac496c1242e74abf290454b3ab3e7088459d5d`; request normalizada: `47a5201cc8efa3dd2145cd115d4214b6731979367804a98cb936450361df9df5`. A comparação GitHub MCP W5 → B5 confirmou apenas `.ci-run.json`, blob `aa2607a1dc9c3f95ce15632a4f3593ff69cfa0b2`, com produto/testes/configuração/fixtures idênticos. Esse PASS qualifica o comportamento de navegador descrito; mantém as limitações de HTTP sintético e não prova Session/skill, parser, domínio ou dossiê. O controle omni não é aplicável pelo runner Playwright e não representa qualificação nativa.

## Critério para atualizar os recibos

Cada observação deve apontar W (produto), S (snapshot), run/check, seleção normalizada, conclusão e log/artefato correspondente. A árvore de S deve diferir de W apenas pelo request do envelope. Uma mudança material posterior exige sua revalidação afetada. Os 140 critérios não são promovidos em conjunto por um único green; cada requisito composto conserva as partes sem testemunho como pendentes.

## 6. Delta exato WP12: extração nativa

mount native extraction using the existing authority

Owner paths: `apps/cli/src/sucafina-product/analysis-verifier-documents.ts` and `apps/cli/src/sucafina-product/host-context.ts`.

WP06 now exposes the exact composed `DocumentEvidenceHost` as `documents.documents.evidenceHost`. It contains the same byte port, private parser, schema resolver, state port, reader and human-confirmation authority used by the UI and capability descriptors. Do not construct a second parser or substitute a test context.

The current `verifiers` array in `host-context.ts` does not register `createSfDocumentExtractionVerifier`. Import it and add a guarded initializer when `documents` exists:

```ts
verifiers.push(createSfDocumentExtractionVerifier({
  ...analysisDependencies,
  documentHost: documents.documents.evidenceHost,
  documentLimits: {
    formats: ["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    maxBytes: sfDocumentLimits.maxBytes,
    maxPages: sfDocumentLimits.maxPages,
    maxTextLength: sfDocumentLimits.maxTextLength,
    maxXmlBytes: sfDocumentLimits.maxXmlBytes,
    maxZipEntries: sfDocumentLimits.maxZipEntries,
    timeoutMs: sfDocumentLimits.timeoutMs,
  },
}))
```

Use the runtime constants in `product/documents/limits.ts`; omit its `version` property because the frozen skill input schema does not accept that additional property. The initializer remains within the real native Session/MCP/skill admission pipeline.

The verifier currently passes a raw schema ID and omits the document argument. Its source must change as follows:

```diff
-const schema = await dependencies.documentHost.resolveFieldSchema(value.targetFieldSchema.id, currentCall)
+const schema = await dependencies.documentHost.resolveFieldSchema(
+  `schema:${value.targetFieldSchema.id}:${value.targetFieldSchema.version}`,
+  currentCall,
+  value.authorizedFileRef,
+)
```

`createSfDocumentSchemas.resolve` requires `schema:<id>:<version>` and binds it to `documentRef`. Bypassing either check is not a permissible fix.

The extraction verifier also requires `output.payload.status === "extracted"` and then asks BCS to treat that candidate as a confirmed premise. `createSfDocumentSourceAccess` intentionally rejects an extracted candidate. Fix the verifier's output resolution, preserving BCS's confirmed-only behavior:

```diff
+import { resolveSfDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/evidence-resolver.ts"
...
-const source = await dependencies.context.resolve(output.payload.ref, currentCall)
-if (source.state !== "fresh" || !source.authorizedProjection || !source.currentRef || digestSfValue(source.ref) !== digestSfValue(output.payload.ref) || digestSfValue(source.currentRef) !== digestSfValue(source.ref) || !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
+const reader = dependencies.documentHost.reader
+if (!reader) return { status: "unavailable", reason: "analysis-output-unverified" }
+const source = await resolveSfDocumentEvidence(output.payload.ref, currentCall, reader)
+if (source.state !== "fresh" || source.accessRevision !== currentCall.binding.accessRevision ||
+  digestSfValue(source.ref) !== digestSfValue(output.payload.ref) ||
+  digestSfValue(source.authorizedProjection) !== digestSfValue(output.payload) ||
+  !await read(currentCall)) return { status: "unavailable", reason: "analysis-output-unverified" }
```

The preceding stored-candidate/schema/document checks stay in place. `resolveSfDocumentEvidence` checks SHA256 blob/span identity, BLAKE3 RAG identity, source incarnation/revision, citation proof and current authorized reader. It intentionally does not manufacture the BCS `currentRef` field.

Acceptance evidence still required: real native Session, admitted matching selection, actual `sf-extrair-evidencias` skill receipt, same private `sf_document_extract` descriptor, and source changes during execution. The WP06 HTTP/SQLite fixture sets `inspectSession` to unavailable and verification callbacks to false; its passing assertions cannot close this native witness.

## 7. Complemento exato WP09: resolver de Request

O ponto de composição deve expor o closure `resolveProcurement` que já existe em `createSfBusinessServices`, junto de `registry`/`individual`. Esse resolver tenta primeiro a coleção autorizada e só usa o resolver individual para o resultado preciso `Request unavailable`. Conectar `createSfRequestDocumentEvidence({ host: authority.host, state: authority.state, services: input.assets.services, resolveRequest: business.resolveProcurement, list: documents.documents.list })`. Não reinterpretar o token opaco da UI como selector Procurement e não duplicar o resolver.

`prepareProcurement` deve compor `business.procurement.read({ requestRef }, call)` e `business.sourcingEvidence(requestRef, call)`, preservando `comparison: null` quando a comparação não existe. `revalidateProcurement` relê e compara o mesmo material. `revalidate` relê a mesma seleção Request e exige identidade do conjunto `(refId, refDigest)` sob autoridade atual.

O caso `Request document evidence uses the actual Request resolver and fences an asset changed after list`, em `documents/egress-fences.test.ts`, usa o registry WP04 real e `createSfRequestDocumentEvidence`. Primeiro observa a seleção do ref do candidato; depois altera apenas a identidade/revisão do arquivo após a listagem real e exige `stale` sem devolver refs, comprovando também que a identidade da Request não mudou. Esse caso passou no run W3 `43521334753` (315,79 ms) e foi revalidado no W4 `43523089034` (300,93 ms). Também passaram no W4 as recusas de discovery após uma mudança entre leituras de superfícies (26,16 ms) e de busca quando a leitura de um segundo documento invalida o primeiro match (312,25 ms). No U5 `43525466970`, os mesmos três casos passaram: seleção Request com mudança somente de arquivo em 286,29 ms, discovery em 23,24 ms e busca em 306,65 ms. Isso qualifica as barreiras finais desses ports no candidato W5. Não monta o consumidor de dossiê ausente nem encerra `WP06.T05.CHK.20`.

## 8. Delta exato WP04: projeção individual

individual Request projection field mismatch

At the WP06 seed, `product/procurement/sources.ts` includes `"approvalStage"` in the individual Request resolver's exact field list. `product/integration/procurement-projections.ts` omits it in `procurement-record-v1`, which compares that array with `digestSfValue`. Individual selection therefore fails before projection. Align the producer's source contract and projector, keeping the exact allowlist; do not remove the equality check. The collection resolver used by the new document bridge test does not have this mismatch.

## 9. Execuções hospedadas: resultados e falhas preservados

| Produto | SHA W | Snapshot unitário S | Run unitário | Resultado agregado |
| --- | --- | --- | --- | --- |
| W1 | `30c162f381c87fee68591ce13f5680daaf94a0f9` | `c6ddf483ab11e59385ed0f1ce8f746cb40162337` | [43518279709](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43518279709) | 152 pass, 6 fail, 1 error; failure |
| W2 | `d45906128038fa47e8aea4dfce0233337b00a550` | `2ad51ef80833109364c6a26fe199ec19bc2b24d6` | [43519897663](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43519897663) | 161 pass, 3 fail, 1 error; failure |
| W3 | `4798112115825a2a3f8cc5f2217c674ce8437efc` | `888d7860b9a94962e5388417697561c9801c6deb` | [43521334753](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43521334753) | 170 pass, 2 fail, 1 error; failure |
| W4 | `a33fa24809bf8c52f92b910bcde45c708e2107de` | `5b6ebf3765bff51dd0d5ddd06cc2058ced5f33b8` | [43523089034](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523089034) | 175 pass, 1 fail, 1 error; failure |
| W5 | `1b9e2ee13b5b297ef48bcde509d615c24c14acee` | `d87f2c19f9d97edb90591ac1f5fd58a1fffd1e4b` | [43525466970](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43525466970) | 175 pass, 1 fail, 1 error; failure |

O arquivo `documents/runtime-e2e.test.ts` falha no import de `product/routines/dossier.ts`, ausente do candidato. Suas asserções não executaram. A seleção original foi mantida nas continuações, acrescida dos testes novos; a dependência não foi escondida por omissão. O produtor real identificado na seção 1 permanece um delta de integração para S0/WP09.

No W2, o caso BCS em texto passou. A corrida com dois documentos falhou antes de sua asserção de segurança porque o segundo upload reutilizava a versão zero da Request. O fixture W3 passou a obter a versão atual no snapshot da transação, preservando o contrato real de upload. No W3, os três casos Request/BCS, os três casos de barreira final de egress e o caso de roster pelo host CLI passaram. Persistiram o erro de import do dossiê e a falha própria `legacy XLS removeMissing removes only supplied OPEX and a subsequent no-op has an unchanged receipt`. O total agregado continua sendo o reportado por Bun, sem subtrair a dependência para apresentar green.

No W4, o log registra **175 pass, 1 fail, 1 error**, 2004 chamadas de `expect` e 176 testes em 46 arquivos. Não há falha de asserção observada; a falha restante corresponde ao import do módulo de dossiê ausente. As três variantes documentais executaram também os negativos finais descritos na seção 3. O total continua failure e não é reclassificado como aprovação da suíte.

O produto W4 tem árvore `d0aead7ff949e1244f72f0e0b69ebe2872132044`; seu snapshot unitário tem árvore `173dd2ac47e5a8e6a3d61107ce74780bafdc0aac`. O request seleciona os 46 arquivos do run Bun, com SHA256 `b6188b844f6e699806b2faf21af98280eb80fa383e8318e60e9f5688901889ed`. A comparação GitHub MCP entre W4 e S confirmou somente a adição de `.ci-run.json` (blob `4d9dd4f4c3c74c579a6d7bced5f541ef4477a156`); produto, testes, configuração e fixtures permanecem idênticos entre essas duas árvores.

No U5 final, job `132230001270`, o log registra **175 pass, 1 fail, 1 error**, 2004 chamadas de `expect`, 176 testes em 46 arquivos e duração de 173,22 s. Não há falha de asserção observada. A única falha permanece o import de `product/routines/dossier.ts`, e nenhuma asserção desse arquivo executou. As três variantes Request/BCS, os negativos finais e os três casos de egress passaram no W5, sem reaproveitar o resultado W4 como prova substituta.

A comparação GitHub MCP W5 → U5 foi observada: um commit à frente, merge-base igual a W5 e somente `.ci-run.json` adicionado, blob `4d9dd4f4c3c74c579a6d7bced5f541ef4477a156`. Produto, testes, configuração e fixtures são idênticos. A request mantém SHA256 `b6188b844f6e699806b2faf21af98280eb80fa383e8318e60e9f5688901889ed`. SHA256 do log de job baixado: `c6e80f6c87cbe5233d6d15848247806c8540c24127e5f022bc776a330b5e3422`; SHA256 da projeção local de casos/erros observados: `a1b04d21976de3eb555440fce3bbe4abf12c10f3c194168d5a14dae12c30c9c3`. Esses checksums identificam as leituras de evidência; não são um PASS adicional nem recibo de consumidor.

O check hospedado W3 [43521336884](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43521336884), snapshot `13c7932dd01d2e36d1a1631e95db5e29e90c87d5`, concluiu failure: typechecks Sucafina e CLI falharam; guards passaram. A classificação local do log registra 117 diagnósticos únicos, 116 em áreas de outros owners e um em `documents/runtime-e2e.test.ts`, pelo módulo WP09 ausente. Não houve diagnóstico de produção WP06 nesse check. Essa distinção identifica o trabalho restante e não converte o check em aprovado. O artefato hospedado é [14084045031](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43521336884/artifacts/14084045031), digest `sha256:2daf262bc77edc2bb8c24ad9c51867879e07decbe355d8d74e7a090c0c26063d`.

O check W4 [43523094310](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523094310), job `132221978089`, usa o snapshot `42963a3a1b1c42e19265cecd60f548bb3e4008d3` e concluiu failure: os dois typechecks completos falharam e os guards passaram. A classificação registra novamente 117 diagnósticos únicos: 116 em outros owners e um no teste de dossiê, sem diagnóstico de produção WP06. O artefato é [14083867624](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523094310/artifacts/14083867624), digest `sha256:ff8b2645b58694a34657a09324d358aaa4ac8bdd13ddcc31bbc7b52cd1288a1f`. A comparação W4 → snapshot do check confirmou somente `.astra-wp06-check.json` (blob `f145ce48cf30c99a6459aad4d25789616408103f`). Os diagnósticos externos e a dependência ausente continuam deltas explícitos de integração, não supressões.

O check W5 [43524992830](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524992830), job `132228417938`, snapshot `d57e2a7cc9881bee7bfd3dbbc7e140a343f9050c`, também concluiu failure nos dois typechecks, com guards aprovados. Foram classificados 117 diagnósticos únicos: 116 de outros owners e o import de dossiê ausente, sem diagnóstico de produção WP06. Artefato [14083594380](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524992830/artifacts/14083594380), digest `sha256:a95600c3028fe849406ae18cbb9f888f3f489bd8e365204d0219e342e35002e2`. A comparação W5 → snapshot do check confirmou apenas `.astra-wp06-check.json`, blob `e349e2863693645e56a900d73bb9e5d2cd51dea3`. O produto W5 tem árvore `be543a7c5b48d697573bf905b9d9793bdb53f45a`; a árvore de seu snapshot unitário final é `ddec64eeb282ecabfc59f5472c79bc8a2bdbd8e8`.

O controle omni do primeiro run existe e informa exatamente `not applicable (focused: no declaring test ran)`, nonce `1a082562ccc30ce09e5e1d73aad873ce`. O controle W3 também registra `not applicable`, nonce `7dd6894dbe0de877c0287463114fe138`. No W4, o mesmo resultado tem nonce `8dab9ba839cae6d9f5bdfb2e416e29fd`. No U5 final, nonce `a24834b574ee72ef15bd904384b02631`, o log novamente declara que não houve teste declarante, spawn ou delegação omni. A validade desse controle não transforma as execuções unitárias falhas em green e não prova a cadeia nativa.

As correções e os negativos adicionais posteriores ao W3 foram observados nos backends hospedados W4 e W5. O W5 corrigiu as associações de labels e obteve o PASS Playwright B5. O U5 final e o check C5 continuam failure pelos motivos documentados, enquanto os casos documentais próprios descritos passaram. As dependências de outros owners, os consumidores nativos/dossiê, os prazos e aceites históricos e a qualificação final de S0 permanecem obrigações explícitas; não há declaração de READY ou GLOBAL_RELEASE. Nenhum teste local de produto, suíte epic, merge ou deploy integra as provas descritas aqui.
