# Revisão independente — isolamento da observação do matcher

**Parecer: nenhum bloqueio estático no candidato congelado; Actions continua pendente.** Esta revisão cobre somente o delta do fixture `current-choice-lifecycle.test.ts`.

## Pins conferidos

| Item | Pin |
| --- | --- |
| Produto de referência W28 | `29172d2e4db859eedac31e84778c447bb97f6c08` |
| Tree W28 | `8d7a7657597d024c5a55a9f5a4fdccf604c40d25` |
| Blob anterior | `35d562e6686b27f5fdad5c88584391d7649571df` |
| Blob final revisado | `7a5100d9e60a81f654cc31714efd2b1e7d0b68f5` |
| SHA256 do candidato | `d8aa020d994c2ed6aa489a9b4968c44cfd3c0be4f3d76caaefc8b0b7470b6f4d` |
| Tamanho | 27779 bytes |

Recalculei o Git blob do arquivo anterior a partir da captura W28 e do candidato a partir dos bytes locais. O capture de publicação possui um único path e corresponde exatamente ao arquivo revisado. O JSON desta revisão conserva os quatro pins auxiliares de cobertura/classificação/canonicalização, todos iguais ao manifest publicado.

## Delta e preservação de oráculos

Há um único hunk de observação, imediatamente após a obtenção da cobertura confirmada. O matcher existente observa um `structuredClone` da mesma entry de treinamento. Seus valores esperados continuam literalmente `status: "included"` e `expect.arrayContaining(["training:11"])`. Nenhum dado desse clone é passado para o produtor financeiro, a persistência ou o verificador de cobertura.

Conferi a sequência de todas as assertions: são **40 expectativas originais preservadas**, com a substituição equivalente do argumento da observação, e **uma nova expectativa** que exige o mesmo digest da assessment original antes e depois do matcher. Todo o conteúdo fora desse hunk é byte idêntico ao blob anterior. Continuam um teste e o limite original de **180000ms**.

As demais verificações de fonte, revogação, corrida do caso, três operações do cenário, ChoiceRecord histórico, subtotal250000 com totalnull/condição, promoção humana separada, reabertura e ausência de aplicação Planner permanecem. Não há alteração de basis, cálculo, autorização, source fence, resultado esperado ou produtor. Não foram acrescentadas leituras de domínio, I/O de armazenamento, observações de fonte ou replays; somente a saída diagnóstica do clone e os digests locais.

O `catch` novo apenas registra a falha de canonicalização da observação clonada. Ele não envolve o matcher nem a assertion de invariância e não converte uma falha desses oráculos em sucesso.

## Evidência e hipótese

S18, [run43593276333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43593276333), job132442336638, registrou `DataCloneError` durante a observação de entries, três resoluções fresh e reavaliação indefinida. A saída final foi `choice-preview-coverage-unavailable`. O log bruto conferido tem SHA256 `f2ddd43802e937d99fac54620e3e628db91f95d9216c7029a1180db091c0dfa1`.

O código canônico estabelece que `assessCostCoverage` pode retornar a própria entry de entrada, de modo que `coverage.entries` e a assessment compartilham essas entries. Já `classifyCoverage` mantém clones próprios. Seu verificador confronta o digest da entry atual com a cópia classificada. Uma mutação por um matcher sobre a entry compartilhada poderia contaminar a posterior reavaliação e explicar a canonicalização/clonagem recusada.

Essa relação estática sustenta a fronteira escolhida para o clone, mas **não demonstra que o Bun executou essa mutação**. O próximo run deve observar o diagnóstico antes/depois do matcher e executar a jornada inteira. Mesmo que o isolamento destrave a jornada, a explicação causal deve citar o diagnóstico efetivamente observado.

## Finding corrigido durante a revisão

O comentário do candidato anterior `0a5c3908792d12468cda60975398256e73e4a72a` afirmava incorretamente que a classificação compartilhava as entries. Solicitei a correção. O candidato final `7a5100d9…` e sua metadata dizem corretamente que assessment e lista de entrada compartilham objetos e que classificação conserva clones. Essa foi uma correção de comentário/metadados; o comportamento do candidato não mudou.

## Limites

A revisão usou leitura de código, comparação textual e hashes por Python; não importou nem executou código de produto, Bun, testes, CI ou runtime nativo. Não fiz alterações de fonte ou escritas remotas. Li o AGENTS aplicável e preservei a exigência de testes somente no Actions.

O parecer não afirma aprovação do ciclo completo, ganho de duração, typecheck do package, prova instalada/nativa ou aceite de critérios C/D. Os oráculos continuam sujeitos ao resultado do candidato exato. Não se declara READY ou DONE.
