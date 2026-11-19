# Handoff — finish-filecodecs-20261119

SHA: 8c30b5859ebb3ce1c51bf53efb85e5da30924f87 (código qualificado)
Data: 2026-11-19
Estado: complete

## Feito

- Ligados ao `SfNativeOperationBindings` os 27 codecs Files originais que faltavam; o agregado usado pelo owner agora contém as mesmas 28 instâncias de `SfFilesOperationBindings`.
- Preservado o guard específico de Members. Cada ligação valida ID, rota original, método e modo de saída; bytes continuam nos codecs dedicados, sem conversão JSON.
- O teste de contratos agora atravessa o agregado usado pelo owner, prova identidade dos 28 codecs e mantém todas as recusas originais de URL, cabeçalhos, MIME, tamanho, campos extras e slots de upload.
- Causa observada: Operations9 44630165380 retornava `contract-unavailable` antes de `refreshSfFileAuthority`; o owner recebe somente `SfNativeOperationBindings`, que incluía apenas `files.export.members`.

## Pendente

- `packages/app-shell/e2e/sucafina/operations-support/documents.ts:103`: a jornada instalada de upload ainda precisa do próximo gate Operations composto; este gate Bun não qualifica scanner, bytes recebidos pelo servidor, autorizações nem persistência.
- `packages/app-shell/e2e/sucafina/operations-support/imports.ts:196`: retomar a leitura nativa de destinos no próximo gate composto com os codecs presentes.
- Nenhum GO, pacote ou sf-ci final é declarado.

## Decisões e justificativas

- Nenhuma asserção removida, pulada ou enfraquecida; nenhum timeout ampliado.
- Codec disponível não concede permissão nem afirma readiness. O contexto e o produtor continuam responsáveis por autenticação, autorização, CAS e serviço instalado.
- `reviews.export.docx/pptx` continuam `Schema.Never`; download real permanece no binding dedicado Files, inclusive GET `?sf=review-download`.
- O teste de Members usa transporte sintético e chunks delimitados; não é prova de um documento Office real.
- Para integração, transplantar somente os dois arquivos deste commit sobre main; a branch de trabalho descende da composição de Operations, não deve carregar essa composição inteira em PR.

## Como retomar

1. Usar os blobs de código 8c30b5859ebb3ce1c51bf53efb85e5da30924f87 para `packages/client/src/sucafina/bindings.ts` e `packages/client/test/sucafina/files-transport226/source-codecs.test.ts`.
2. Compor com os outros deltas de Operations já autorizados e executar o gate nativo definido pelo integrador.
3. Se houver recusa posterior, ler a resposta/estágio original; não fabricar grants nem relaxar o codec.

## Comandos e resultados

- GitHub Actions test-ci run [44632446497](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44632446497): **SUCCESS**, test job 135942329775; **7 pass / 0 fail / 194 expect**, 275 ms. Cleanup 135943214018 **SUCCESS**.
- Snapshot df9280a8126d40ff4d60e6cbf2f1400fa682c2f8; código 8c30b5859ebb3ce1c51bf53efb85e5da30924f87.
- Pedido: `{"package":"client","runner":"bun","args":["test/sucafina/files-transport226/source-codecs.test.ts","test/sucafina/files-transport226/talent-members.test.ts"]}`.
- CLI/app-shell/SF E2E typecheck, browser, guards, sf-ci e pacote: não executados neste gate. Toda execução ocorreu em Actions; nenhum shell local.
