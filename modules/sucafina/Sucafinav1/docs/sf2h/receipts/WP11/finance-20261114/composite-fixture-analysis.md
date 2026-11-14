# Cobertura composta: preparação de fixture limitada ao consumo

**Estado: alteração em dois arquivos próprios, conferida estaticamente; Actions e revisão independente ainda pendentes.**

## Evidência e causa delimitada

S14, run `43589528126`, job `132431103700`, executou W22 `cfbf7c824d4351431d35533dbe2572de11084b9d` no snapshot `ee53236037e82ab79227b5ed43874f68dc539e19`. O primeiro caso de `composite-coverage.test.ts` passou em 61.629,59 ms. O segundo, que mantém as quatro variantes no mesmo teste, terminou em 204.791,75 ms contra o limite original de 180.000 ms.

O arquivo criava cinco fixtures completas de sensibilidade: uma para shared/N/A e quatro para omitted/null/zero/confirmed. Cada construção executava `persistent.evaluateAndStore`, mas nenhum dos dois testes consumia `saved`, `persistent` ou `exactCalls`. A avaliação e persistência prévias de sensibilidade eram trabalho adicional ao propósito desses testes. Essa atribuição é demonstrável pelo código; não mede quanto dos 204 segundos pertence a essa operação e não demonstra melhoria de duração por si só.

## Mudança

`createWp05ComparisonFixture` preserva toda a preparação canônica existente: armazenamento real, admissões controladas, fontes e componentes Planner, duas simulações, alternativas/resultados C10 persistidos, C08, cobertura, verificação de operações, unidades de sensibilidade, regra de critério, comparação real e seu vínculo persistido. Também preserva os ports reais de threshold, preview e sensibilidade para quem os usa. Ela termina após essa preparação, sem calcular uma sensibilidade que o consumidor não pediu.

`createWp05SensitivityFixture` permanece disponível com o contrato anterior. Agora chama a factory compartilhada, executa a mesma chamada `persistent.evaluateAndStore` com os mesmos request, caseRef e contexto, e retorna `saved` obrigatório. Se essa etapa falhar, chama `fixture.cleanup()` antes de propagar o erro. Os consumidores anteriores continuam usando essa factory; não houve opção booleana que tornasse `saved` indefinido.

Somente `composite-coverage.test.ts` passa a usar a factory de comparação. A comparação textual comprova que os únicos bytes alterados nesse teste são as três ocorrências do nome da factory, incluindo o import. Permanecem dois casos, 29 linhas de assertions, o loop sequencial completo e os dois limites de 180.000 ms. Não se dividiram testes para redistribuir o orçamento.

## Oráculos preservados

Permanecem os valores reais 210000/250000 e as diferenças −30000/10000. Os thresholds continuam sendo calculados pelo produtor canônico em 55000 e 15000; os limites do parâmetro continuam 10000–70000. O primeiro caso continua produzindo a prova estrutural, o certificado de cobertura composta e a chamada explícita de threshold. O segundo continua distinguindo ausência, null, zero explícito e cotação40000, e chama o threshold real nos estados zero e confirmado.

Todas as negativas anteriores permanecem: fonte revogada, classificação N/A sem suporte, componente duplicado, treinamento ausente, justificativa que inventa zero, falta de evidência N/A, referência duplicada e componente canônico duplicado. Nenhum produtor financeiro, regra de autorização, source fence, grant, fórmula ou estado persistido foi substituído por um resultado de fixture.

## Pins

| Arquivo | Blob anterior | Blob candidato |
| --- | --- | --- |
| `test/product/wp05/engine-fixture.ts` | `0ccf287ecd225ddcae99a1490f255b4c2b4358ed` | `608b1a95b491740041f8689a41b4a064c7254b24` |
| `test/product/wp11/composite-coverage.test.ts` | `3196d7885a6cecbc4afff9b3044857400753280a` | `27e0580d6c9ba7b4c549bc33e5d252a7ce74ae66` |

O preflight confirmou os dois arquivos locais iguais aos blobs publicados de `remote-state.json` antes de escrever. Não houve alteração em terceiros nem em recibos publicados. `composite-fixture-changes.json` congela conteúdo, SHA e previousBlob; `composite-fixture-files-ready.json` e `composite-fixture-validation.json` registram os hashes e as conferências.

## Consumidores e validação

Os consumidores anteriores de `createWp05SensitivityFixture` continuam com a preparação e a propriedade `saved` completas: cenários e thresholds WP03; cobertura e integração de sensibilidade WP05; persistência da escolha, import/incarnation, cotação de implementação e current-choice WP11. Os usos apenas de tipo em `renewal-coverage-fixture` e `engine-revision-fixture` mantêm o contrato estrutural. A relação exata consta no JSON.

A seleção cirúrgica recomendada é o arquivo `test/product/wp11/composite-coverage.test.ts` inteiro, sem filtragem de variantes. Um consumidor completo já presente na próxima seleção pode verificar o wrapper, evitando repetir batches sem mudança. O root executará `bun typecheck` e guards pelo protocolo hospedado.

Foram feitas somente leituras, edição desses dois arquivos e verificações de metadados/bytes/import paths. Não houve importação ou execução de produto, Bun, teste local, typecheck local, CI, browser ou escrita remota. A revisão desta frente é autoral; não substitui revisão independente. Nenhuma melhoria de duração, critério aceito ou estado READY/DONE é declarado.
