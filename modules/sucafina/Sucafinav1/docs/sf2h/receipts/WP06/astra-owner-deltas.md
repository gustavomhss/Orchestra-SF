# WP06 — deltas de consumidores e limites das provas

Este documento identifica os pontos concretos de composição que a continuação WP06 encontrou. Não é um recibo de aprovação. O mapa `astra-criterion-map-v2.json` conserva os 140 IDs e textos do pack; seus estados dependem de observações no candidato publicado e de seus runs hospedados.

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

## 3. BusinessContext: consumidor implementado, testemunho separado

Há composição real no seed, e não um export sem consumidor:

1. `apps/cli/src/sucafina-product/host-context.ts` cria os serviços documentais e passa `documents.documents.reader` a `createSfBusinessServices`.
2. `apps/cli/src/sucafina-product/business-services.ts::initializeAtlas` passa esse leitor a `createSfAtlasBusiness`.
3. `product/host-binding/business-context.ts` constrói `createSfDocumentSourceAccess` e o instala no roteador de evidências.
4. `product/decision-memory/source-access.ts` chama o resolver documental WP06 duas vezes e verifica a consistência do resultado.

**Obrigação de prova:** exercitar esse consumidor real com texto, DOCX e PDF digital, mantendo identidade do ref, offsets/localização, hash do blob/trecho separado do hash de texto RAG e revalidação de ACL/revisão. O teste de PDF digital prova extração de texto pelo parser real; o teste HTTP de Request prova extração/confirmação e revogação via serviço. Eles não são automaticamente o teste composto BCS dos três formatos.

A continuação W2 acrescenta ao teste `request-selection.test.ts` o consumidor real `createSfBusinessContext` + `createSfDocumentSourceAccess` contra o leitor documental e SQLite reais: o candidato extraído não vira premissa, o mesmo ref confirmado resolve como fresh e a remoção revoga a leitura. Esse caso de texto aguarda CI W2; não substitui a cobertura composta de DOCX/PDF nem a qualificação nativa/Atlas. A simples existência da composição não é PASS de execução.

## 4. UI, native e MCP compartilham contrato; identidade nativa precisa ser observada

O serviço WP06 entrega o descriptor `sf_import_preview` com `handlerExport: previewImport`. A continuação liga o HTTP de preview ao `dispatchSfCapability` com schemas e validação de autoridade atuais. Os descriptors de importação e documentos são registrados como `extraDescriptors` pelo host instalado do seed.

Os testes HTTP/SQLite usam credenciais locais persistidas, ACL e estado reais. O fixture declara deliberadamente `inspectSession` sem Session e validação de seleção/skill sempre negativa. Isso permite testar a via humana e recusas; não fornece sucesso nativo. O callback scanner do fixture também não qualifica o scanner instalado.

**Delta de qualificação para S0/WP10/WP12:** executar `sf_import_preview`, `sf_document_extract` e `sf_knowledge_search` por SessionV2 e pelo MCP privado realmente admitidos, com recibos de skill genuínos. Registrar os IDs de Session, run, call e recibo, o SHA do candidato, a seleção de ferramentas e a igualdade de resultado/versão com o handler humano. Demonstrar recusas para chamada direta, skill ausente e revogação. Não substituir esses validadores por `true` nem converter uma recusa universal em entrega funcional.

Critérios diretos: famílias `.18` de T02/T05, critérios nativos compostos e os vínculos integrados indicados pelo pack. O green cirúrgico WP06 não substitui AM01–AM06 nem a qualificação final do bundle.

## 5. Escopo exato do navegador

`packages/app-shell/e2e/sucafina/wp06/imports.spec.ts` importa `renderSfImportWorkbench`; o HTML, JavaScript e CSP são os de produção. Apenas a fronteira HTTP e os bytes do arquivo são sintéticos. O navegador cobre cancelamento, preservação de arquivo/opções, apresentação textual de conteúdo HTML, stale seguido de novo preview explícito, bloqueio de Apply quando o detalhe falha, recuperação somente de leitura do recibo e apresentação de resultados applied/unchanged/rejected e recusa de apresentação de um ref stale como aplicado.

Os números `72000`, `84000`, `590000` e `602000` exibidos pelo navegador não constituem prova da aritmética. A aritmética pertence aos testes do comando/projeção Planner e ao teste financeiro dedicado. O teste HTTP/SQLite qualifica separadamente o transporte real, a ausência de escrita em preview, Apply, recibo e revogação.

Seleção Playwright proposta ao validador existente:

```json
{
  "package": "app",
  "directory": "packages/app-shell",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": ["e2e/sucafina/wp06/imports.spec.ts"],
  "env": {"ORCHESTRA_CHANNEL": "prod"}
}
```

`packages/app-shell/e2e/tsconfig.json` usa uma lista explícita de includes que, no seed, não contém esse spec. Um green de `typecheck:e2e` não deve ser atribuído ao spec sem inclusão efetiva. O run Playwright deve comprovar sua seleção e execução.

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

`prepareProcurement` deve compor `business.procurement.read({ requestRef }, call)` e `business.sourcingEvidence(requestRef, call)`, preservando `comparison: null` quando a comparação não existe. `revalidateProcurement` relê e compara o mesmo material. `revalidate` relê a mesma seleção Request e exige identidade do conjunto `(refId, refDigest)` sob autoridade atual. O novo teste W2 usa o registry WP04 real e cobre mudança somente do arquivo após a listagem, sem alteração da Request.

## 8. Delta exato WP04: projeção individual

individual Request projection field mismatch

At the WP06 seed, `product/procurement/sources.ts` includes `"approvalStage"` in the individual Request resolver's exact field list. `product/integration/procurement-projections.ts` omits it in `procurement-record-v1`, which compares that array with `digestSfValue`. Individual selection therefore fails before projection. Align the producer's source contract and projector, keeping the exact allowlist; do not remove the equality check. The collection resolver used by the new document bridge test does not have this mismatch.

## 9. Primeira execução hospedada: falha preservada

Run `43518279709`, check `43518322865`, produto W1 `30c162f381c87fee68591ce13f5680daaf94a0f9`: o log observado registra **152 pass, 6 fail**. O arquivo `documents/runtime-e2e.test.ts` falha no import de `product/routines/dossier.ts`; suas asserções não executaram. A seleção original é mantida na continuação W2, acrescida dos testes novos; a dependência não é escondida por omissão. Os casos novos de BCS/egress/roster, as correções do produto e o navegador aguardam seus runs no novo candidato.

O controle omni desse primeiro run existe e informa exatamente `not applicable (focused: no declaring test ran)`, nonce `1a082562ccc30ce09e5e1d73aad873ce`. O log explica que não houve spawn/delegação omni e, portanto, ele não qualifica omni. Esse resultado válido do controle não converte a execução unitária falha em green.
