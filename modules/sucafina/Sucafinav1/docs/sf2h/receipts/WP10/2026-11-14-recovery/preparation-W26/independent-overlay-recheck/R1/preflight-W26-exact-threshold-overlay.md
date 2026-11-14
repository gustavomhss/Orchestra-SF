# R1 — Recheck focal do overlay `exactThreshold` W26

**SOURCE_FIXED_IN_SEALED_OVERLAY / HOSTED_RECHECK_PENDING.** A ligação ausente identificada por `R1-W26-HOST-EXACT-THRESHOLD-01` foi corrigida nos bytes propostos. Não encontrei novo defeito concreto no wiring nem contradição estática que impeça o teste focal de percorrer o produtor canônico. O aceite funcional permanece **HOLD**.

Este documento não é parecer final: `finalForCandidate: false`, sem autoria de produto ou testes. Corte: **2026-11-14T16:54:22Z**. Não executei produto/import/teste/build/typecheck local nem mutação remota. O relatório `intake-W26-pr36` permanece inalterado.

## Bytes examinados

| Arquivo | Git blob | SHA256 |
|---|---|---|
| `apps/cli/src/sucafina-product/decision-domain-services.ts` | `e8a931a3d0788d0c6899e9550fbe069a4a5dc7de` | `2b782fb131707f8f3aceb3bec37c84f2ccff7a2d6970456e9812d8f471acf01a` |
| `apps/cli/src/sucafina-product/portfolio-services.ts` | `881ce4672d9d0e641d1cc849663c0980c118774d` | `94427fe5eaae8f348e574bbade36fa34a386d5180c423139f4687078e0fa8342` |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-exact-threshold.test.ts` | `e526fffa28318367b9180b419509949c93abb273` | `33faf5709c5465b99c6c18658eda6d80088af63dc6d3f596a08a8033caea0ee0` |

Os oito membros do selo de composição e os seis membros do selo do teste conferem em bytes/hashes. Os sete imports relativos do novo teste resolvem na árvore W25 ou no overlay próprio. Isso não substitui typecheck. A base é W25 `3d59829e5d9e438cbb443428a9479d7f63b5bf31`, árvore `ee95a2e3d0f02efabe6a4442fcf59479265a9f61`; nenhum commit final W26 é certificado por esta leitura.

## Wiring

Nos dois pontos — `portfolio-services` e fallback `decision-domain-services` — a fábrica canônica `createPlannerExactThreshold({ units, preview })` usa os inputs de produção já existentes. O adaptador encaminha `binding.baselineRef` e o mesmo contexto tanto para o cálculo quanto para a verificação persistida. Não há callback numérico de fixture, unidade sintética ou nova concessão de autoridade. No caminho primário, a ausência de cenários continua deixando o produto indisponível.

## O que o novo teste exige

O teste compõe SQLite/C08, autoridade UI, Business Services e Portfolio reais. Emite duas fontes Planner, simula seus cenários e os persiste. Registra a regra com admissão humana real. O caso e a associação dos resultados reais às alternativas são preparação explícita de fixture; a cobertura de treinamento continua pendente.

A chamada `product.http.sensitivity` não recebe substituto de limiar, engine ou avaliador. As asserções exigem três amostras reais, um limiar exato fora delas e uma fronteira entre 320 e 321 compatível com a aritmética IEEE do produtor. Mantêm `comparisonStatus: conditioned`, treinamento pendente e divulgação de subtotal conhecido. O coveragePreview real permanece conectado; o caminho canonical admite sua indisponibilidade por seleção ausente sem declarar completude.

A segunda composição cria produto e verifier distintos sobre o mesmo store aberto. Sua primeira operação é a leitura persistida, que deve reproduzir o resultado. O retry mantém a mesma operação e exige igualdade dos registros e da versão de storage: dois cenários de origem, três amostras e um resultado de sensitivity. A escolha humana e os preparativos devem permanecer iguais.

A contraprova entra no mesmo caso válido, confirma o Request e então revoga o autenticador real. Leitura e retry devem devolver denied sem value, com binding e input mantidos. O contador de ambiente testemunha novas chamadas reais; não mede diretamente replays nem prova uma meta de tempo.

## Limites que permanecem

- São chamadas diretas aos métodos HTTP do produto. O handler montado Request→Response, JSON/origin e sua admissão humana de transporte não são exercitados.
- O fallback `decision-domain-services` tem correção examinada em fonte, sem segunda prova funcional neste arquivo.
- Recomposição de serviços sobre o mesmo store/autoridade não é reabertura de store nem reinício de processo.
- A revogação é anterior à chamada do consumidor e pode ser recusada pelo `authorized()` externo. Não prova revogação durante o último await interno.
- Fixtures de caso/cobertura não demonstram promoção humana, C10 completo, native/Task, MCP/browser, runtime residente ou gates globais.
- Budget novo: Bun 300000 ms, deadline cooperativo 285000 ms. Nenhum budget existente foi ampliado; a suficiência temporal só será conhecida no CI.

## Próxima prova necessária

Publicar o candidato com estes bytes, verificar árvore/pins, executar check hospedado e o arquivo novo completo junto das seleções WP13 afetadas. O fechamento funcional depende de terminar cálculo, leitura recomposta, retry e revogação no SHA atual. Preservar os 171 critérios e sete tasks sem promoção por esta inspeção. Os três pareceres finais independentes devem ser pedidos com o candidato e os terminais atuais.

## Artefatos

- JSON: `preflight-W26-exact-threshold-overlay.json`, SHA256 `a484df8db13e3e88fa59e2dfe59225170553fa781160fbebf6417574f01b7f33`.
- Auditoria: `audit-W26-exact-threshold-overlay.json`, SHA256 `205a14a8dbb2f7652bfdadc04b465339112785a200e19d62c07d6f9dac1f9a4c`.
