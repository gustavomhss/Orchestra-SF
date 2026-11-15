# Missão76 — achados causais B2/R1

**A mudança em `result-store` removeu 1.131 chamadas de digest e 11 clones no workflow medido, preservando as fronteiras observadas.** B2 e R1 passaram nos mesmos 58 testes selecionados, com 580 expect calls em 11 arquivos. A qualificação aqui é de componentes; estes runs não executaram o P03 original.

## Evidência e fonte exatas

| Execução | Fonte W / validação V / executor S | Resultado |
|---|---|---|
| [B2 — run43672619431, job132685806297](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43672619431/job/132685806297) | W `c9285ddf74eb4260162f6040226e4745dab184ff`; V `a5ab06e87c7280d28264dbaaf9fcf035824bdf12`; S `8bfce3242f1d7c8d6a224ba1418d6486d52444a8` | 58 PASS, 0 FAIL, 580 expect calls |
| [R1 — run43673023213, job132687025106](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43673023213/job/132687025106) | W `6854c0f966e4fd78322932181359c3742c53c16d`; V `ccd7384a75efd69da203c7c42f04f3083ceb4974`; S `85b75ff50d77665e963f852cf4c15b1786c9d8b6` | 58 PASS, 0 FAIL, 580 expect calls |

Os dois V aplicam o mesmo bundle readonly59 de nove arquivos. Ele é dependência de validação, separado da autoria76. Os blobs dos cinco arquivos de testes/helpers compartilhados foram comparados via GitHub MCP nos W imutáveis: todos idênticos, inclusive probe `c3576cac82d2edb793fe7ef9bc5fb8d2b8c2a38f`. O marker muda somente label e hashes esperados. A única alteração de produto é `result-store`, de blob `23a90b2e44e8bf7f50ff41f6f1622f77a5c9dd85` para `c76d9bc385a4b5102b756812b778c844f20ab733`.

A comparação completa e os SHA256 dos artifacts estão em `B2-R1-CAUSAL76.json`. A reagregação independente dos JSONs brutos confirmou todos os 386 sites B2 e 382 sites R1, sem discrepâncias com os agregados recebidos.

## Trabalho removido, por chamada responsável

| Operação em result-store | B2 | R1 | Mapeamento da fonte |
|---|---:|---:|---|
| Digest final repetido de `latest.stored`, escalar | 11 | 0 | B2 `118:223`; R1 reutiliza digest privado de `112:26` |
| Digest final repetido de `previous.stored`, batch | 596 | 0 | B2 `202:220`; R1 reutiliza `latestDigests[index]` |
| Digests finais de casos compartilhados no batch | 1.192 | 668 | B2 `202:116/151`; R1 helper `215:22` |
| Clone adicional do retorno escalar | 11 | 0 | B2 `119:35`; R1 publica `stored` do envelope final já clonado |
| Clone integral do envelope final escalar | 11 | 11 | B2 `116:22` → R1 `120:22` |
| Clone integral do envelope final batch | 334 | 334 | B2 `194:22` → R1 `206:22` |
| Clone independente de cada retorno batch | 596 | 596 | B2 `203:37` → R1 `226:37` |
| Digest do `stored` da observação final batch | 596 | 596 | B2 `202:186` → R1 `225:180` |

Fontes: [result-store B2](https://github.com/gustavomhss/Orchestra-SF/blob/c9285ddf74eb4260162f6040226e4745dab184ff/modules/sucafina/Sucafinav1/product/decisions/result-store.ts) e [result-store R1](https://github.com/gustavomhss/Orchestra-SF/blob/6854c0f966e4fd78322932181359c3742c53c16d/modules/sucafina/Sucafinav1/product/decisions/result-store.ts).

A soma causal é **11 + 596 + 524 = 1.131 digests**. No workflow inteiro, `digestSfValue` passa de 133.103 para 131.972 chamadas e `structuredClone` de 72.415 para 72.404. Todos os deltas por módulo pertencem a `result-store`; as contagens dos demais módulos permanecem iguais.

O WeakMap de casos vive somente no processamento final de um batch, depois das observações e callbacks externos. Ele reutiliza o digest do mesmo objeto privado quando irmãos compartilham o caso. Os casos da segunda observação e da observação final continuam objetos distintos. O envelope final continua integralmente clonado; erros e getters de campos não selecionados não são pulados. Cada retorno batch conserva seu clone para que ocorrências duplicadas continuem independentemente mutáveis.

## Controles focados e semântica preservada

| Controle | B2 → R1 |
|---|---:|
| Digests integrais de stored, leitura escalar | 4 → 3 |
| Digests integrais de stored, batch duplicado | 8 → 6 |
| Digests de caso, batch duplicado | 12 → 10 |
| Digests de referências em `calculationSources` | 64 → 24 |
| Eventos do callback escalar / batch | 11 → 11 / 19 → 19 |
| Replays canônicos do cálculo | 2 → 2 |

Em `calculationSources`, quatro derivações de seis referências passam a digerir cada referência uma vez. A deduplicação conserva o digest integral e a primeira ocorrência. Os testes verificam fontes, versão, replay e recusas. **Esse ramo teve zero chamadas observadas no workflow de diagnóstico**: seu ganho é demonstrado pelo controle focado, sem atribuição de ganho ao P03.

Os 192 registros de chamadas públicas têm `calls/completed/errors` idênticos; os cinco digests de saída coincidem. Os 87.440 eventos medidos preservam o hash de ordem `979b2e2ed8ca4658f1b9138abd0f69aca87b616ff8e3ca6f3996523d38cbacb4`. As regressões selecionadas cobrem mutação de retorno e callbacks, aliases duplicados, alterações de caso/result/source, getters e clone failure no envelope final, autoridade, headers/lease, facades e replay. São evidências específicas; o observer de boundaries não enumera chamadas lexicais internas nem prova equivalência universal.

## Custo residual e decisões nos outros produtores

`state-provider` e `criterion-comparison` permanecem byte-idênticos. O clone opaco de C08 em `state-provider.ts:65:24` continua com **2.216 chamadas**. Seu custo foi medido diretamente; não se supõe que readonly59 autorize projetar o estado depois de callbacks externos. Permanecem relevantes os contraexemplos58 de função não clonável fora da seleção, getter que altera a seleção durante o clone e erros observáveis em campos omitidos.

Uma `bindings.read` continua realizando dois replays canônicos e duas avaliações. Seus tempos inclusivos não são somados aos compares, métricas ou transações descendentes. `operation-verifier.ts:94:37/80` é atribuição de stack ao caller de `projectionDigest`, não uma expressão direta `digestSfValue`: o helper pode aparecer inlined. Interpretar esses sites exige a fonte exata e admite sensibilidade ao JIT/stack.

## Limites de medição e próximo gate

O probe mede a implementação síncrona completa de `digestSfValue`, incluindo canonicalização e hash; captura o stack fora do timer. Durações públicas se sobrepõem. As fases de topo somaram **36.252,721390 ms em B2 e 35.358,113073 ms em R1**. São duas amostras instrumentadas, sem alegação de speedup, distribuição de latência ou previsão do P03.

B0 fica como histórico: o spy antigo retinha argumentos/resultados em seu histórico. B2 e R1 usam o mesmo observer corrigido, com comprimentos máximos de `calls/results` iguais a 1, resíduos 0 após limpeza e nenhum callback observado pendente ao report. Isso não demonstra retenção zero da invocação ativa/última. Memória é do processo inteiro, incluindo fixtures, instrumentação e GC; não há conclusão sobre heap do produto.

Esta evidência termina na qualificação material de componentes R1. A repetição do **P03 original** pertence a recibo separado, mantendo **72 assertions e 180000ms**. Nenhum resultado de P03, composição71 ou aceite global é promovido por este documento.
