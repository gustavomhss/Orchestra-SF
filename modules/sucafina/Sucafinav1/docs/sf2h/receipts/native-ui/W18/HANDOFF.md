# W18 / A06 — preparado para admissão, SEM mutação de produto

## Autoridade e estado

- Branch original precriada: `sf-ux-w18`; cohort `f8e442616c96651f3b26013b34b8ce697860e3e2` / produto C58 `422f1ed7b549021d7c62c834c9d9041279112af4`.
- ACK remoto anterior a qualquer material: `db9a83f40a7d2fa0da8362a0a72ad66d10eec597`.
- Lease solicitada `ux-native-w18-e1`, **não admitida** pela única integradora 114 (`sf2-stack`, PR65). Sem Go implícito.
- Este commit altera **somente** `receipts/native-ui/W18/**`. Os sete arquivos em `prepared/` são conteúdo de patch completo para destino futuro, **não** arquivos de produto instalados. Não compilar/qualificar a árvore atual como A06.

## Patches exatos (usar os blobs, não copiar snapshots antigos)

- Destino `packages/schema/src/sucafina/files/structures.ts` — blob `72859baa8ae358038274edd14bb20d9a3334a031`; preimage `absent`; tipo `author-prepared`; cópia em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W18/prepared/packages/schema/src/sucafina/files/structures.ts`.
- Destino `packages/schema/src/sucafina/files.ts` — blob `e211b2f6ff6cfa4131ace51d3fa1f6e803b7e35c`; preimage `absent`; tipo `author-prepared`; cópia em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W18/prepared/packages/schema/src/sucafina/files.ts`.
- Destino `packages/client/src/sucafina/files.ts` — blob `18d0e2f143fffc965d3b0a632c87f2aa59f7b302`; preimage `absent`; tipo `author-prepared`; cópia em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W18/prepared/packages/client/src/sucafina/files.ts`.
- Destino `apps/cli/src/sucafina-product/native-ui/files.ts` — blob `a2e1041871a553498b92f159ef9b28c874a3cfb6`; preimage `absent`; tipo `author-prepared`; cópia em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W18/prepared/apps/cli/src/sucafina-product/native-ui/files.ts`.
- Destino `modules/sucafina/Sucafinav1/test/native-ui-contract/files.test.ts` — blob `1c4d58aaf184a277ca2dd04b263ce0ad500a66d6`; preimage `absent`; tipo `component-spec-prepared`; cópia em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W18/prepared/modules/sucafina/Sucafinav1/test/native-ui-contract/files.test.ts`.
- Destino `packages/schema/package.json` — blob `3831ae4dc0dc1a059f19b96846039f6761252611`; preimage `adc53ecfa8f4ac83fee37854db2dc0ec2bb9136a`; tipo `shared-postimage-only`; cópia em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W18/prepared/packages/schema/package.json`.
- Destino `packages/client/package.json` — blob `f000a7aa621e725e90ed6cd5e6bd128e68a91475`; preimage `4cd0244e98ff18b5e65d3c2808196705095b6691`; tipo `shared-postimage-only`; cópia em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W18/prepared/packages/client/package.json`.

Os arquivos compartilhados `packages/schema/package.json` e `packages/client/package.json` têm **postimages integrais**, calculados sobre os preimages C58 exatos. A 114 deve reconciliar mudanças concorrentes antes de aplicar, com CAS; NÃO usar whole-branch merge nem sobrescrever additions de outros autores.

## Mapeamento funcional A06

- **25 IDs catalogados** exatamente em `SfFiles.operations` e 25 métodos literais em `createSfFilesClient`; não há execute livre nem segundo dispatcher.
- Import: `import-targets/reference/detail` GET; `import-admit` POST multipart com `file,surface,selectionRef,options`, máximo 16 MiB de arquivo + 64 KiB envelope; formatos xlsx/xls/json; `import-preview` POST schema canônico; `import-apply` CAS de manifest/version, resultado real. Preview não se torna apply, nem cria receipt local.
- Documents: `document-requests/sources/schemas/candidates/open` GET e `document-search/admit/schema/extract/confirm` POST; `confirm` precisa receber a evidência EXTRACTED inteira, não o ID. Campo de schema tem máximo 100, IDs únicos, version CAS, seleção revalidada no produtor. `document-open` exige a referência completa e recebe somente link assinado do host.
- Scenario: `targets` GET com document ref e candidate; `preview` POST {documentRef,baseRef,targetRef,period}, sem cálculo de cenário ou alteração de domínio no browser.
- Assets: `asset.link` obtém HMAC curto e actor-bound do produtor; `asset.download` usa exatamente asset/expires/signature na rota original; `asset.upload` é bytes crus, versão record CAS, limite de contrato 25 MiB, outro limite é DINÂMICO do produtor. O scanner é autoritativo e falha/ausência retorna recusa/unavailable, nunca 'clean'.
- Exports: json (dashboard admin), xlsx (planner), register/suppliers (procurement). Bytes e Content-Type/Disposition originais; C58 reautoriza após gerar o export e compara digest do público e versões, devolve 403/409 quando mudou.
- Host server-only leaf apenas delega para `createSfImportHttp`, `createSfDocumentHttp`, `createSfDocumentScenarioHttp` e o handler original `createApplication` (injetados). Não cria outro backend, request de rede, permission ou renderer iframe. Produtor ausente retorna HTTP 503 sem falso sucesso.

## Exigências de integração da 114/F02/D01

1. Confirmar **admissão A06 por output** e ausência de colisão/owner change; somente então escrever destinos leaf com source hashes exatos via CAS.
2. Aplicar os dois package.json postimages somente se os preimages ainda coincidirem; caso contrário gerar patch equivalente no HEAD vigente preservando demais famílias.
3. Registrar metadata para os 25 IDs de `files.*` no registry único I00 e codecs em bindings admitidos; F02 compartilha Schema/Client e rejeita chaves extras, inputs inválidos, unknown operation e binding não instalado **antes de rede**.
4. Mapear os campos `surface` exclusivamente ao path `/mount/{surface}` ou query `import-targets`; NÃO incluí-los em corpos POST onde o produtor espera apenas payload. `document-confirm` envia somente a evidência completa; `document-schema` envia somente `{documentRef,fields,id?,expectedVersion?}`; `document-scenario-preview` envia somente `{documentRef,baseRef,targetRef,period}`.
5. **Seam binário indispensável:** `import-admit` serializa File do input de bytes para multipart com forma fechada e limite, `asset.upload` envia bytes crus e MIME original, transfers nunca trafegam como JSON nem path arbitrário; conexão desktop usa `SfDesktopInvocation.upload`/Session isolada e response-download chunk/backpressure existente; não fingir que o Schema da folha sozinho instala o encoder/stream.
6. GET `document-open`/`scenario-targets` serializa `ref` como JSON canônico no query, com bound original; `asset.link` usa query `asset-link` e `asset.download` usa somente query HMAC do produtor. Nunca seguir URL externa ou confiar no link como acesso permanente.
7. Não importar arquivos `product/*`, `runtime/*`, Core/Server no Client/renderer; server usa adapters e handlers existentes. Não escrever código gerado ou gerador, pacote, registry, router ou global index por W18.
8. Import preview/domain projection e scenario/request campos complexos marcados `Schema.Json` são **opacos nesta preparação** e ainda precisam de revisão formal de schema source-locked por 119/114; nenhuma concessão de autorização, cálculo ou claim de prova decorre deles. O schema/transport não deve aceitá-los permissivamente como payload de comando.

## Testes e evidência

- `test/native-ui-contract/files.test.ts` incluso como **spec de componente**, NÃO_RUN; nunca afirmar prova instalada com mocks. Cobre 25 IDs, seleção de transport única, negativos de upload/limites/extensões/idempotency/zero-byte, preview/apply separados, período, CAS de schema, confirm extraído, query HMAC, erro 503 e passthrough de Response.
- Solicitar somente à 120, DEPOIS de composição pela114, teste cirúrgico via `test:ci/request`: spec A06, scanner falso/lança/ausente, ACL contrato/Procurement, aquisição de signed asset link, expires/actor/role, download com reauth 403/409, imports reais xlsx/xls/json, documento parser/preview/extract/confirm, timeout/stale e byte streaming.
- Solicitar somente à 119 typecheck/guards/geração/Schema & transport quando sources A06 forem admitidos. Todos os runs/jobs/resultados atualmente **NOT_RUN**.

## Critérios / blockers

- AC01 shapes ausente/null/zero, formato e CAS: trabalho de esquema preparado, precisa proof com produtor real.
- AC02 negative invalid/unknown payload: parte de componente especificada; exige codecs rígidos F02/D01 e testes Actions instalados.
- AC03 version/source drift: pinos e deltas C58 confrontados; live stale/timeout/provenance exige Actions.
- Gates de entrega ainda pendentes: admissão114, composição SDK/host F02/I00, binary seam, scanner real, 120/119; **nenhum INTEGRATED/QUALIFIED/ARTIFACT_READY/GLOBAL_RELEASE declarado**.

## Lease terminal deste recorte

Condição `BLOCKED_OWNER_ADMISSION`, não por silêncio ou inferência de falha de 114. Material completo preparado e endereçável por SHA, mas nenhum produto alterado. A 114 segue único integrador; 120/119 únicos owners de provas. Sem testes locais, merge, deploy, Azure ou mensagens externas.
