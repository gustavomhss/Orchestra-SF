# Reconciliação externa atual — WP03/WP05/WP11

Inspeção fixada em astra-compose [`35b9fd4f532abeb1058f00281d4ad8885ca9966f`](https://github.com/gustavomhss/Orchestra-SF/tree/35b9fd4f532abeb1058f00281d4ad8885ca9966f) e astra-interface [`0c3d98dd1263a305ce294c78ad5939cdda110a78`](https://github.com/gustavomhss/Orchestra-SF/tree/0c3d98dd1263a305ce294c78ad5939cdda110a78). A observação própria inclui W20 `5e4c2b288665113e58162a616a9965c03e397e19`, tree `64510c36da425ed2ec0da67836bfcd691fd1f625`. [external-reconciliation.json](external-reconciliation.json) conserva os blobs/SHA256 atuais e a inspeção anterior como histórico. Nenhuma fonte alheia foi editada. Os resultados de teste mencionados abaixo pertencem somente aos seus W/S indicados.

## C17 histórico: caminho delimitado implementado no owner

O finding genérico de que o host não chama os readers históricos foi superado no COMPOSE6. `planner-calculation-history.ts` liga `requests.readHistorical` e `results.readHistoricalCalculation` ao evento do ledger de um caso atual autorizado, exige o capture protegido anterior do Atlas e reproduz o request original pelo produtor canônico. `business-services.ts` conserva esse capture sem recursão por `cases.read`. O BCS agora admite a identidade integral do cálculo histórico e compara duas resoluções autorizadas, incluindo a observação final. A projeção permanece histórica, sem reclassificar o cenário como corrente ou aplicado. [Revisão de fonte e pins](reviews/review-compose6.md).

Os limites continuam explícitos:

- O capture original precisa existir antes do avanço do caso. O primeiro append somente depois do avanço permanece fora desse caminho.
- A closure histórica aceita registros ainda atuais. Cálculo histórico aninhado/misto, assumptions e replacement refs não estão cobertos pelo novo helper.
- Mudança material ou revogação de fonte impede a entrega. Bytes capturados não substituem autoridade corrente.
- COMPOSE6 ainda contém stores anteriores às cercas finais próprias de W18. A composição precisa unir os pins compatíveis antes de validar o comportamento.
- A receipt do owner declara `NOT_RUN`. A presença do caminho não transfere prova de BCS/Atlas/HTTP instalado, runtime nativo, C/D ou aceite do bundle.

F2 também permanece superado em código: as guardas de replay atual/histórico usam `AsyncLocalStorage` por chamada, conservando ciclo e profundidade. O patch antigo `compose4-calculation-ancestry.patch` é histórico e não deve ser reaplicado automaticamente.

## Threshold e cobertura

Os quatro arquivos WP13 inspecionados no COMPOSE6 continuam com o delta principal implementado: `parameterOperation` para observação de fonte, validação da fronteira canônica e observação adjacente IEEE, escopo de subtotal conhecido e preservação da cobertura condicionada. Writer e replay usam `threshold-proof.ts`. O patch COMPOSE4 é histórico; a pendência é produzir, persistir e reproduzir **55000/15000** no candidato composto, preservando training omitido/40000/zero/null, moeda/FX, fonte e metadata.

A cobertura N/A instalada ainda precisa de uma rota demonstrada. Os providers canônicos de baseline observados recusam `not-applicable`; o fix próprio de promoção sem operações conserva essa recusa. O teste de categorias compartilhadas com declaração all-inclusive não comprova a classificação humana N/A do host. Não inferir zero de ausência nem retirar o gate para obter um teste verde.

## Dois fixes próprios disponibilizados em W20

`mutations.ts` (`3e7575cddfd52d9f5751c0ee6179c747bb318c98`) agora prepara o proof por `coverageEvidence.entries` mesmo quando o assessment da observação é igual. O resultado passa pelo reassessment canônico, mantendo igualdade integral com o proof e todas as cercas de fonte/autoridade/CAS. `hot-topic-draft.ts` (`5e0b80a470958dd201db4283bde96d594935e68d`) seleciona o snapshot Dashboard exigido pelo verificador do seu target Hot Topic.

Os dois deltas têm [revisão independente estática](reviews/review-late-core.md) e testes discriminantes próprios. No snapshot desta reconciliação, a execução desses testes ainda está pendente. Promoção de alternativa ou draft não constitui `ChoiceRecord` aplicado nem recibo de domínio.

## BI: avanços existentes e deltas restantes

As rotas `extended-bi-browser.ts`/`extended-http.ts` já usam a fábrica comum, transportam `valueId`/`refDigest`, verificam pertença da referência ao valor autorizado e repetem a leitura. A seleção A/B e a revalidação por foco, visibilidade, refresh, pagehide e BFCache estão presentes. A antiga descrição de um único handler Dashboard não representa o host atual.

Ainda faltam três demonstrações/deltas precisos:

1. `bi-selections.ts` (`5bb690b8072d932f1717206b5967c95b45e3b365`) e `bi-services.ts` (`7d44c1982c3c62fdaf21f98945ded9e572fd359a`) continuam sem `advantageComparisonRef` no parser/equality. O [patch de dois arquivos](../../WP05/finance-20261114/advantage-selection-proposal.patch) transporta a comparação inversa realmente persistida; o BI não deve recalcular ou negar o valor financeiro.
2. O mount real deve conservar versão, engine, contexto e referência originais da seleção, abrir o detalhe exato e restaurar filtros/foco no retorno. Reler uma projeção corrente no endpoint não demonstra sozinho esse contrato.
3. BI09/10 continuam dependentes dos planos canônicos de componentes/tempo. `series: []` com tabela persistida não comprova waterfall ou timeline completos.

## Planner mensal

Os três blobs base do [delta mensal](../../WP03/finance-20261114/monthly-consumer-proposal.diff.txt) permanecem iguais no COMPOSE6/interface atual: contrato `920fda293db553096f4d8ab7004fcd9652a69291`, HTTP `2befb1d4c7964b30830311abe1c93c7c575b8f70`, UI `3adef2d68f54f2e04f9532751f5ddc9bed7e4b60`. O caminho HTTP correto é `product/interface/planner-http.ts`.

O owner deve aplicar/reconciliar before/after canônicos, annual/spread/reset e rebase explícito, preservando body/key de retry incerto. Os testes próprios do produtor não substituem a montagem mensal/HR/catálogos/comparações e as jornadas com dois operadores.

## Aplicação e dependência Procurement

A união de `apply.ts` própria em W18 tem blob **`964a53310c340f4496d7410d66f8b852270b75f1`**. Ela conserva tentativa durável antes do dispatch, CAS renovado, reread autoritativo do recibo e cercas de receipt/proof/unicidade, inclusive no retry reconciliado. Os nove casos de `execution-reconciliation.test.ts` passaram no [run 43587138878](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587138878), W `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f`, S `0faf62c7f5e10f5ae17037bb6bd8eb512396f2fd`. **O run inteiro falhou: 17 pass / 5 fail.** Não atribuir esses casos a outro head ou a prova instalada. O `apply.ts` de interface0c3d98 (`4bdd12ac162d61465557363953e25dfd99fad5e8`) é anterior à união e não deve sobrescrevê-la.

Uma das falhas S12 ocorre antes da aplicação de duas superfícies: a emissão Procurement é indisponível. A inspeção separada localizou listas de campos incompatíveis no grupo — o issuer inclui `approvalStage`, mas o projector de integração antigo não admite esse campo. COMPOSE6 já delega ao projector do owner, que admite os dois seletores. O [recibo de dependências](procurement-projection-dependency.md) fixa a closure publicada de quatro arquivos; nenhuma fórmula, policy ou fonte externa foi copiada para corrigir o teste Finance. A integração precisa consumir os bytes canônicos e validar os cenários de aplicação/replay/recibo revogado no bundle compatível.

As factories novas de current-choice, divergence e application-status também exigem serviços concretos e concessões humanas separadas na composição. C/D, provas residentes/nativas e o epic de todo o bundle permanecem com S0.
