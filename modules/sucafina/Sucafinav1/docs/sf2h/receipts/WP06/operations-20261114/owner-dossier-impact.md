# WP06 — impacto do consumidor de dossiê publicado pelo owner

Base de prova nativa: W3 `d7d343ecb2ef4b4ccff925f50a5a60324d22b371`, árvore `a3ebf675545fadcd3124b387b15f396550652df8`, run **43580976466**, snapshot `c2ad4cb308ffa6e4b8d1a0cf5ed031bf1a304a01`. Consumo do owner `4306b310e4d6dac77f9beab461adad4e8e924849`: `dossier-services.ts` blob `0a89225f73bfe1c458ac5530918609a063ae385d` e `dossier-workbench.ts` blob `aca602b5d5ea02c6cea88897c4c2110c6c9afe39`.

## Reuso nativo neste delta

`native/import-analysis.test.ts` chama `withNativeWp06`. Sua composição instancia diretamente document, import e business services; não inicializa o bootstrap HTTP/CLI nem importa os dois consumidores alterados. Business services referencia o produtor canônico `product/routines/dossier.ts`, que permanece intacto neste delta, e seus descriptors não mudam.

O HTML das prévias segue `import-http` → `renderSfImportWorkbench` → `documentHtml`/`pageMain`, `importWorkbenchScript` e `importAnalysisMarkup/Script`. O dossiê possui HTML próprio; seu script não é anexado ao shell ou às prévias. A CSP das prévias é calculada somente a partir do HTML de importação. Os dois consumidores alterados exportam factories, sem registro global ou efeito de inicialização.

Logo o PASS nativo W3 é reutilizável para estes dois consumidores e seus testes de dossiê isolados, sujeito à conferência do diff final W3→W4 para excluir outro delta material. A falha W1 continua registrada; não se atribui causa específica à lentidão anterior. O resultado não é uma prova Omni/modelo, humana ou global.

## Identidade da fonte na releitura

`createProcurementSourcingEvidence` retorna exatamente `stage`, `offers`, `submittedBaseCurrency`, `submittedFx`, `weights`, `evidence`, `context` e `comparison`. Offers usam a versão persistida do pedido; FX usa o snapshot submetido. Comparação e seleção humana vêm do produtor WP04. Não há timestamp transitório nesses valores.

`business-services.contextFor` retorna identidade da instalação/projeto/principal, revisões de acesso/política, superfície, período selecionado, moeda, refs e capabilities. Os resolvers retornam a referência já emitida e a versão atual, sem gerar outro refId durante a releitura. A expiração de cinco minutos usa `Date.now()` como guarda externa e não integra o payload. A projeção do Request possui `ageDays`, derivado do relógio do ambiente, e a identidade do consumidor já exclui seus valores, mantendo versão, engine, contexto, IDs/refs, comparação, sourcing e limitações. Assim, o digest integral de sourcing não falha apenas pela passagem do relógio em uma seleção ainda válida.

## Validação mínima nova

- Bun: `Sucafinav1/test/product/wp06/documents/dossier-runtime.test.ts` (3 formatos mantidos +2 interleavings reais: mudança de fonte/logout na segunda leitura de sourcing).
- Browser: `e2e/sucafina/wp06/documents.spec.ts` (8 casos mantidos; os 4 de dossiê ganham comparação, ranking, escolha registrada, termos/FX, rejeitado, próximos passos e limpeza após recusa; 1 PNG após asserções).

Os novos resultados ficam pendentes de Actions. Browser mantém HTTP sintético explícito; parser, SQLite e autoridade são exercitados nos testes reais. Nenhum produto foi executado localmente. `owner-dossier-impact.json` registra hashes dos arquivos inspecionados.
