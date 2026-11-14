# WP07 — reinspeção C11, C07 e readers históricos

Data da inspeção: 2026-11-14. Todas as leituras remotas abaixo foram realizadas pelo GitHub MCP em commits fixos. A confirmação dos heads retornou os mesmos SHAs. Nenhum arquivo de outro proprietário foi copiado para a branch WP07 ou alterado.

Esta reinspeção complementa [INTEGRATION-DELTA.md](INTEGRATION-DELTA.md). Cada resultado fica vinculado ao produto e ao snapshot efetivamente executados; os resultados intermediários permanecem históricos.

## 1. Bases inspecionadas

| Branch | Commit | Tree |
| --- | --- | --- |
| astra-wp07, base desta retomada | `2ec9946a764cf0cc4769bc14f89ac4adade35a5e` | `d95337f60b7a941d35c53c7f20a9811aea1bdf57` |
| astra-wp09 | `f18d5819bec7848664772c77d7501e7c25d578bf` | `11d99fa29eb54f11e6985d3a9a9626bcc5f9979f` |
| astra-wp10 | `d41ea01b8d9aa068301c1643c1ec3dc088900533` | `696cab500cc5356836a6ab9b3a526e0f97e54b85` |
| astra-wp11 | `ff99e4b4de56bbf6e7ef36daf5d3eb749779017a` | `a4745675a30a2cff3577b02eea6ab14bfb9ae58a` |
| sf2-portfolio-ready | `27375325788fa571d39137728ec7f0666e89f22c` | `c1fe6dbf117cb0570b0911a438d269be6e2edad8` |
| sf2-memory-ready | `02ac8172c17ad57e830bfb23d3ff1d1b1191852b` | `088cef30ce6aef86ae532935e78edcbe3bb46b51` |

## 2. Incompatibilidade própria encontrada em DecisionBrief

O [verificador executivo atual de WP10](https://github.com/gustavomhss/Orchestra-SF/blob/d41ea01b8d9aa068301c1643c1ec3dc088900533/apps/cli/src/sucafina-product/analysis-verifier-routines.ts#L69) valida o corpo do brief contra o caso e a seleção autorizados. Na linha 98 ele exige `brief.caseRef === encodeCaseRef(request.caseRef)`, a versão atual, objetivo do caso, ausência de `orderedResultRefs`, `runRef` e `resultRef`. Os arrays de referências podem estar vazios no schema público: `DecisionBrief_28` declara um array de strings sem `minItems`.

O consumidor WP07 em `product/reviews/contribution.ts` fazia duas exigências incompatíveis: comparava o campo com o ID cru do caso e recusava todo array vazio. Assim, recusava o formato positivo aceito pelo produtor inspecionado.

Correção própria:

- Usar o mesmo `encodeCaseRef` do produtor, preservando a encarnação física no identificador.
- Aceitar um brief autenticado sem resultados vinculados, devolvendo listas de resultados e links vazias.
- Continuar recusando autorreferências, duplicatas, referências vazias e, no formato sem links, campos `runRef` ou `resultRef` não resolvidos.
- Manter schema, envelope, identidade do caso, digest, releitura e autorização atual antes de entregar qualquer corpo.

Esse formato contém objetivo, condições e eventual escolha já verificada pelo produtor. Não cria resultados financeiros, vínculos de rotina ou evidências que o produtor não forneceu.

### Semântica de runRef e resultRef

A [regra normativa C11](https://github.com/gustavomhss/Orchestra-SF/blob/d41ea01b8d9aa068301c1643c1ec3dc088900533/modules/sucafina/Sucafinav1/product/contracts/normative-contracts.json#L338) exige que o brief de rotina preserve o run e o resultado factual C07. A [skill de revisão executiva](https://github.com/gustavomhss/Orchestra-SF/blob/d41ea01b8d9aa068301c1643c1ec3dc088900533/modules/sucafina/Sucafinav1/product/ai/skills/sf-preparar-revisao-executiva/SKILL.md#L24) descreve a leitura desses fatos por sf_routine_status/sf_routine_result. Esses campos não representam necessariamente uma contribuição C11 nem um resultado determinístico C09.

O [tipo público DecisionBrief](https://github.com/gustavomhss/Orchestra-SF/blob/d41ea01b8d9aa068301c1643c1ec3dc088900533/modules/sucafina/Sucafinav1/product/contracts/outputs.ts#L14) e o schema declaram strings opcionais; não estabelecem que runRef/resultRef pertençam a orderedResultRefs. Não foi criada essa restrição. A relação C07 deve ser verificada pelo reader/produtor real. O verificador concreto atual recusa qualquer runRef/resultRef e qualquer orderedResultRefs não vazio, portanto não há, nesse pin, uma prova positiva desse ramo de rotina. O consumidor não transforma os campos C07 em navegação de contribuição ou de decisão; sua preservação no envelope não é um recibo de consumo factual C07.

O [reader C11 de produção](https://github.com/gustavomhss/Orchestra-SF/blob/d41ea01b8d9aa068301c1643c1ec3dc088900533/modules/sucafina/Sucafinav1/product/ai/contribution-reader.ts#L10) já oferece leitura persistida por `outputRef` e `caseRef`, valida o run e a proveniência, exige a verificação semântica fornecida pelo host, relê corpo/run e revalida a autoridade. O WP07 mantém essa fronteira.

### Provas acrescentadas — PASS hospedado no candidato intermediário

As quatro provas abaixo passaram no [run 43535396085, job 132263036863](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535396085/job/132263036863), produto `46781943bf93bad698233b995354d15c90c4821c`, snapshot CI `c3fb1b6c0515baecd692c02a60cdd35a2b317f65`. As linhas 893–896 do log retido registram os resultados individuais. O run completo teve 78 PASS, 0 FAIL, 921 assertions em 20 arquivos. O [recibo histórico](hosted-test-43535396085.json) conserva nomes, linhas e hash do log. Esse é um candidato intermediário; não qualifica alterações posteriores.

Arquivo: `test/product/wp07/contribution.test.ts`.

1. `review consumer reopens a producer-format DecisionBrief from SQLite after reload without inventing result links`
2. `review consumer rejects another case and inconsistent persisted brief references`
3. `review consumer with the production C11 reader denies semantic and mid-read authority revocation`
4. `meeting material consumer preserves artifact order and refuses inconsistent coverage or mixed selections`

Esses testes usam `openLocalStore`, C08, `createSfUiAuthority`, `createSfRunStore.read` e `createSfContributionReader` reais. O positivo fecha e reabre o SQLite antes do consumo. Os negativos cobrem outra encarnação, ID sem codificação, referências ausentes/duplicadas/autorreferência, digest esperado divergente e revogação.

Os registros de run/envelope são dados de teste explícitos, identificados com `fixture-`; não resultam de SessionV2. A verificação semântica C10 e a autorização da origem são entradas controladas. Nenhuma execução, SkillLoadReceipt observado ou recibo de aceitação nativa é produzido ou reivindicado por esses testes.

### Cobertura do material e ordem do artefato

O mesmo verificador de WP10 valida `MeetingMaterialProposal.coverage` como um conjunto de seções e contagens. Ele valida separadamente `artifact.sectionRefs` contra a ordem da seleção autorizada. O consumidor WP07 também exigia igualdade da ordem do array coverage com a ordem do artefato, embora o produtor permita reordenar a tabela de cobertura.

O consumidor agora exige uma bijeção: mesmas seções, sem duplicatas, com as contagens já conferidas na revisão. A ordem original de `artifact.sectionRefs` é capturada e revalidada; todos os artefatos devem ter a mesma seleção ordenada. Uma tabela de cobertura reordenada não reordena o relatório nem a revisão.

O quarto teste usa SQLite, `createReviewPort`, `renderPreservedReview` e `createReviewArtifactStorage` reais. Preserva duas seções, gera e armazena DOCX, consome um material cuja tabela de cobertura está invertida e confere a ordem original persistida do artefato. Recusa cobertura duplicada, contagem divergente, artefatos com seleções ordenadas diferentes e revogação. A contribuição continua sendo fixture explícita; as fontes são controladas e isso não é prova de C17 físico ou execução nativa.

### Revalidação no candidato final W14

Os quatro testes C11 acima passaram novamente no [run 43537891941, job 132271205478](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537891941/job/132271205478), sobre **W `dcde725380e76ff3180b1415e3c0838b9ca7df34`** e **S `33388c5eacd3dd62529a86e5c2228ce0fdb390da`**. Os resultados individuais estão nas linhas **912–915** do log, com 79 PASS, 0 FAIL e 952 expect() calls no conjunto de 20 arquivos. O [recibo final não browser](hosted-test-43537891941.json) conserva o hash e os nomes exatos.

A UI de contribuição também passou no [run 43537439411](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537439411), linha 1025, com envelope completo controlado, recusa da ausência de provenance, recuperação por Retry access, preservação do digest fixado, rendering dos campos e limpeza após revogação. Isso verifica o consumidor no navegador; não transforma os identificadores fixture-not-native-evidence em uma execução observada de SessionV2.

## 3. C07: há preparação factual, mas não há leitura do corpo histórico

No [readRoutineResult atual de WP09](https://github.com/gustavomhss/Orchestra-SF/blob/f18d5819bec7848664772c77d7501e7c25d578bf/modules/sucafina/Sucafinav1/product/routines/capabilities.ts#L80), o handler abre o run autorizado, exige `resultRef` e devolve o próprio `RoutineResult`. Ele não reabre nem valida o corpo factual imutável identificado pela referência.

APIs existentes e limites:

| API | Utilidade disponível | Limite para WP07 |
| --- | --- | --- |
| `createSfRoutineProduct`, em factory.ts | Compõe publication, routines, descriptors e descoberta autorizada de runs. | A descoberta entrega `RoutineResult[]`; não acrescenta leitura do corpo. |
| `prepareFactualReview`, em review.ts | Prepara projeções autorizadas, confirmações e um rascunho; permite `readPreviousReview` para o C05 selecionado. | É preparação factual corrente. Não é persistência/reabertura de um resultado C07 de um run anterior. |
| `readDecisionRoutine`, em decision.ts | Revalida admissão, caso e run; exige uma referência de resultado. | Também devolve metadados `RoutineResult`, sem o corpo factual. |

Fontes: [factory.ts](https://github.com/gustavomhss/Orchestra-SF/blob/f18d5819bec7848664772c77d7501e7c25d578bf/modules/sucafina/Sucafinav1/product/routines/factory.ts), [review.ts](https://github.com/gustavomhss/Orchestra-SF/blob/f18d5819bec7848664772c77d7501e7c25d578bf/modules/sucafina/Sucafinav1/product/routines/review.ts), [decision.ts](https://github.com/gustavomhss/Orchestra-SF/blob/f18d5819bec7848664772c77d7501e7c25d578bf/modules/sucafina/Sucafinav1/product/routines/decision.ts).

A composição [host-context.ts de WP10, linha 414](https://github.com/gustavomhss/Orchestra-SF/blob/d41ea01b8d9aa068301c1643c1ec3dc088900533/apps/cli/src/sucafina-product/host-context.ts#L414), ainda instancia `BusinessPorts["routines"]` com `catalog`, `prepareAdmission`, `readAdmission`, `readRun` e `run` indisponíveis nesse caminho. Os verificadores de reunião e revisão executiva recusam `factualRoutineResults`; o executivo também recusa confirmations, routinePreparation e admittedRun. Isso confirma que apenas corrigir o consumidor de brief não fecha a integração C07.

Permanece necessário o reader autenticado de corpo por run/result/digest descrito na seção 2 de INTEGRATION-DELTA, seguido da composição real pelo proprietário. Não foi encontrado um reader público equivalente nos arquivos de produção inspecionados.

## 4. Decisão: cenário histórico existente; comparação ainda corrente

O [result-store atual de WP11](https://github.com/gustavomhss/Orchestra-SF/blob/ff99e4b4de56bbf6e7ef36daf5d3eb749779017a/modules/sucafina/Sucafinav1/product/decisions/result-store.ts#L42) exporta:

- `read`, com igualdade da versão atual do caso;
- `readForCalculation`, para cenário corrente e fontes admitidas;
- `readHistoricalScenario`, com versão atual maior ou igual à versão original, mesma encarnação e autorização das fontes;
- `readByRequest`, recuperação de resultado da requisição/idempotência, passando pelo reader corrente.

Não exporta `readHistoricalComparison` nem um reader histórico genérico. `createDecisionComparisonService` resolve alternativas autorizadas e chama `planner.compareScenarios`; isso produz uma comparação corrente, não reabre a comparação originalmente selecionada. `createDecisionChoiceResultLookup` usa o histórico de cenário para localizar o preview de uma escolha; não oferece histórico da comparação.

Fontes adicionais: [comparison.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ff99e4b4de56bbf6e7ef36daf5d3eb749779017a/modules/sucafina/Sucafinav1/product/decisions/comparison.ts), [choice-result-lookup.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ff99e4b4de56bbf6e7ef36daf5d3eb749779017a/modules/sucafina/Sucafinav1/product/decisions/choice-result-lookup.ts).

O WP07 já consome `readHistoricalScenario` em `decision-access.ts`. O teste existente prova o uso de um cenário v1 com comparação autorizada v2 e a recusa da comparação v1 sem reader histórico. Não foi introduzido recálculo para substituir a comparação preservada.

## 5. Portfolio e sensibilidade

O [createPortfolioHistory atual](https://github.com/gustavomhss/Orchestra-SF/blob/ff99e4b4de56bbf6e7ef36daf5d3eb749779017a/modules/sucafina/Sucafinav1/product/decisions/portfolio-history.ts) fornece `read` e `list` para resultados de portfolio anteriores, vinculados à encarnação do caso e a `verifyHistoricalProvenance`. O consumidor WP07 já recebe esse reader e `currentCase` para a alternativa histórica. Seu uso requer a verificação de proveniência real pelo host; o callback não é uma prova de integração nativa.

O [createPersistentSensitivityPort de WP13](https://github.com/gustavomhss/Orchestra-SF/blob/27375325788fa571d39137728ec7f0666e89f22c/modules/sucafina/Sucafinav1/product/portfolio/sensitivity-store.ts#L29) ainda chama `results.read({ kind: "sensitivity", resultRef })`. A base de cenário pode usar `readHistoricalScenario`, mas as amostras e o resultado de sensibilidade usam leituras correntes, além da vinculação de critério. Esse reader não abre uma sensibilidade de uma versão anterior do caso.

Permanece necessário o delta histórico de WP13/WP11. Um adapter WP07 que acessasse diretamente o dicionário C08 para contornar essas verificações não preservaria a fronteira do produtor e não foi criado.

## 6. Observado e cutoff

O [createSfReviewOutcomeAdapter](https://github.com/gustavomhss/Orchestra-SF/blob/02ac8172c17ad57e830bfb23d3ff1d1b1191852b/modules/sucafina/Sucafinav1/product/decision-memory/outcome-review.ts) recebe somente `caseRef` e `choiceId`. Ele retorna a observação/comparação atualmente autorizada ou indisponível.

O [createSfDomainOutcomeAccess](https://github.com/gustavomhss/Orchestra-SF/blob/02ac8172c17ad57e830bfb23d3ff1d1b1191852b/modules/sucafina/Sucafinav1/product/decision-memory/domain-outcome.ts) confere a escolha atual, a projeção escolhida, unidade/período/moeda, fonte, cobertura e cutoff durante a leitura. O [registry de seleção](https://github.com/gustavomhss/Orchestra-SF/blob/02ac8172c17ad57e830bfb23d3ff1d1b1191852b/modules/sucafina/Sucafinav1/product/decision-memory/outcome-selection.ts) persiste seleção e digest da escolha em preferences, mas não uma série imutável de observações por cutoff. O [access genérico](https://github.com/gustavomhss/Orchestra-SF/blob/02ac8172c17ad57e830bfb23d3ff1d1b1191852b/modules/sucafina/Sucafinav1/product/decision-memory/outcome.ts#L32) pode aceitar um cutoff posterior na segunda leitura quando os outros dados permanecem iguais.

Não há nesses pontos um método público por cutoff histórico. O consumidor `outcome-access.ts` continua solicitando o cutoff preservado e recusando um produtor que devolva somente a observação posterior. A recusa evita trocar silenciosamente o retrato da reunião por estado corrente; não prova que o histórico ausente existe.

## 7. Blobs centrais conferidos

| Arquivo e pin acima | Blob |
| --- | --- |
| WP09 routines/capabilities.ts | `8f07a33f0f40d66946724232935c8a9d6729d6bb` |
| WP09 routines/factory.ts | `56ab7cf58e65d2d051279aac484d58b17ccf1f0e` |
| WP09 routines/review.ts | `0757da9fa30d59580366057443b951c7bad5b4e8` |
| WP09 routines/decision.ts | `e6d47edeaaa5a5255208abc222ffffc42a15947c` |
| WP10 ai/contribution-reader.ts | `b37ba4c19209fa58b8fdf62ab23787058955c5eb` |
| WP10 analysis-verifier-routines.ts | `e386affd5c315a062ea85a4f62d403131f9c682b` |
| WP10 host-context.ts | `c54af94fa8c854ee4f4874eb475c0ff45625b53a` |
| WP10 contracts/outputs.ts | `428c3c4cc1fdb5d674549b000179c0e06bb0ceb2` |
| WP10 contracts/normative-contracts.json | `daabdfc6fdd3f20a262e51cb25b8d12288df6cc2` |
| WP10 ai/skills/sf-preparar-revisao-executiva/SKILL.md | `b331ec5ba4c55aae7387c22ff5c0d3532766cb4f` |
| WP11 decisions/result-store.ts | `0d2977360afb7b9af6d39b19eff6e9198c7c1c55` |
| WP11 decisions/portfolio-history.ts | `6834ac4460c8f98fa3b6c2db0743e0d1e39769c5` |
| WP13 portfolio/sensitivity-store.ts | `3d7d19b1de537638d0b1f9918c27c3712e2f534d` |
| WP14 decision-memory/outcome-review.ts | `08dbdc8fe96069030afc1a2617260ca2eb7088b6` |
| WP14 decision-memory/domain-outcome.ts | `024733060d3a5eb0729a81ea81f2487b6420843f` |
| WP14 decision-memory/outcome.ts | `dd9fd5006aaebae6c8a5391f28ebc97a5466fe11` |
| WP14 decision-memory/outcome-selection.ts | `bc30d168f18a186a9cbdc149607fec9c30223247` |

## Estado de aceitação

A correção de formato C11 e o alinhamento de coverage passaram novamente no candidato W14, com os limites de fixture descritos acima. Os históricos ausentes e a integração nativa permanecem com seus proprietários.

O produto intermediário `46781943bf93bad698233b995354d15c90c4821c` teve 1 PASS e 1 FAIL no [run 43534944664](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534944664): a segunda preservação anual demorou cerca de 5.475 ms e excedeu o limite de 5.000 ms. Esse resultado continua sendo uma falha histórica no [recibo correspondente](hosted-test-43534944664.json).

No W14 `dcde725380e76ff3180b1415e3c0838b9ca7df34`, a jornada anual completa e a contribuição passaram no [run principal 43537439411](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537439411), com os limites originais. A redução da cópia persistente no recibo C05 e sua reabertura autorizada estão cobertas por restart SQLite, legado, concorrência, adulteração e revogação no teste da linha 849 do unit14. O bloqueio anual atual foi retirado somente dentro desse escopo funcional; as falhas anteriores e a sobreposição involuntária dos dois runs de browser permanecem registradas em [checks.json](checks.json) e [EXECUTION.md](EXECUTION.md).

A matriz reconciliada conserva **50 VERIFIED_SCOPED e 36 BLOCKED_EXTERNAL**. O typecheck integral continua FAIL por 137 diagnostics externos e zero próprios. Nenhum teste local de produto foi executado; nenhum recibo nativo ausente foi declarado concluído.
