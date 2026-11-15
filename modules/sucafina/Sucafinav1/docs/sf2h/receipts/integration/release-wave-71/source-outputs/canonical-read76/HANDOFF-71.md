# Missão76 →71 — custo dos produtores canônicos

**Entrega parcial de fonte qualificada; P03 permanece FAIL.** A [PR draft87](https://github.com/gustavomhss/Orchestra-SF/pull/87) contém uma melhoria material em `result-store`, seis arquivos de teste/helper e os recibos. A76 libera esse conjunto para reconciliação seletiva pela71, mantendo a falha original e os checks45 pendentes. `GLOBAL_RELEASE=false`.

## Fonte e composição de validação

| Papel | Commit | Árvore |
|---|---|---|
| Base76 | `faa30fddb7e7b61696b66fd069f51cf18c51125f` | `b3b4f89ddd6a3ca5d570681f91098214b5ce935d` |
| W76 material | `6854c0f966e4fd78322932181359c3742c53c16d` | `fd815bff71b812debd0a7773e33060fe21427e55` |
| V76 = W + bundle59 exato | `ccd7384a75efd69da203c7c42f04f3083ceb4974` | `51fedc4707ccb553e95658720678562390e16edc` |
| S regressões R1 | `85b75ff50d77665e963f852cf4c15b1786c9d8b6` | `c2734bc867038f87c41010ebfb95fc1c162880bb` |
| S P03 original | `e827b3d6d8de3832ea903d5cb914c59eaf12ba26` | `cf47f376fddce6b9633765ec2620544d6cf1198c` |

O commit que contém este handoff é o envelope documental terminal; seu SHA/tree são publicados na PR e no comentário de entrega após o CAS. W continua a identidade do produto/testes qualificado. Cada S difere de V somente em `.ci-run.json`.

[MANIFEST](delivery/MANIFEST.json), [patch de produto](delivery/product.patch), [patch completo de fonte/testes](delivery/source-and-tests.patch), [reconstrução textual](delivery/patch-check.json) e [dependências](delivery/DEPENDENCY-CLOSURE.json) registram pre/postimages, hashes, bytes e imports. O patch material contém somente `product/decisions/result-store.ts` e os seis arquivos sob `test/product/canonical-read-cost/`. A reconstrução textual não executou produto ou testes locais.

O [overlay59](validation/readonly59-overlay.json) tem nove postimages exatos da release59, material `26f7af7efcc143d558df51eeb35e4a7011f456fe`, terminal `608763f1765e0eac34565a3668d330bb1cdbd140`. Ele é dependência de V, excluída dos patches76. O diagnóstico usa seu contrato readonly. A71 deve reconciliar essa dependência com a composição atual, especialmente a72, sem sobrepor cegamente arquivos históricos.

## Causa e mudança

A chamada responsável foi medida por site de `digestSfValue` e `structuredClone`, com fonte exata, contagens e árvores públicas. O resumo está em [FINDINGS76](findings/FINDINGS76.md), os dados pareados em [B2-R1-CAUSAL76](findings/B2-R1-CAUSAL76.json), e a revisão independente em [RUNTIME-REVIEW](reviews/RUNTIME-REVIEW.json).

| Trabalho no workflow medido | B2 | R1 | Removido |
|---|---:|---:|---:|
| Digests globais | 133.103 | 131.972 | 1.131 |
| Clones globais | 72.415 | 72.404 | 11 |
| Digests finais repetidos de stored | 607 | 0 | 607 |
| Digests finais de casos compartilhados | 1.192 | 668 | 524 |
| Clone opaco completo C08 | 2.216 | 2.216 | 0 |
| Clones independentes dos retornos batch | 596 | 596 | 0 |

A implementação reutiliza o digest do stored já privado, conserva o digest novo da observação final e entrega o valor escalar do envelope final já integralmente clonado. No batch, digests de casos são memoizados apenas pela identidade do objeto privado, num WeakMap novo após a observação final, avaliados no mesmo ponto do guard. Observações distintas nunca compartilham identidade. Cada ocorrência retornada em batch conserva seu clone independente.

A união de fontes calcula uma vez o digest integral por referência e preserva a primeira ocorrência. O controle específico mede 64→24 digests e dois replays. Esse ramo teve zero chamadas no diagnóstico composto; não recebe crédito causal sobre o P03.

C08 `state-provider` e `criterion-comparison` permanecem byte-idênticos. Clones opacos, efeitos/getters/erros não selecionados, autoridade, fonte fresca e replay continuam presentes. Não foi aplicada a projeção rejeitada58, nem alteração de anchor/cache de autoridade. Os 192 registros de fronteira pública, 87.440 eventos e cinco resultados permanecem idênticos entre B2/R1. Os tempos são descritivos de duas execuções instrumentadas; não há promessa de speedup.

## Qualificação e resultado original

| Etapa | Run | Resultado |
|---|---|---|
| B0 exploratório | [43671421907](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671421907) | 56 PASS / 2 FAIL / 559 expect calls; dois defeitos novos de instrumento preservados |
| B1 correção focada | [43671961465](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43671961465) | 3 PASS / 0 FAIL / 42 expect calls |
| B2 baseline controlado final | [43672619431](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43672619431) | 58 PASS / 0 FAIL / 580 expect calls, 11 arquivos |
| R1 candidato | [43673023213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43673023213) | 58 PASS / 0 FAIL / 580 expect calls, mesmos 11 arquivos |
| P03 original,uma tentativa | [43673511994](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43673511994/job/132688523969) | **0 PASS / 1 FAIL / 1 error / 24 expect calls; 180011,68 ms** |

O [gate material](findings/MATERIAL-GATE.json) foi publicado e relido em `2d01f58ff651ab52a32b73a6f399b0fcd183ee71` antes do despacho original. Os cinco testes/helpers fixos e a seleção B2/R1 são idênticos; somente produto e marker esperado mudam. O spy final limpa seu histórico: máximo 1, resíduos 0 e pendências 0. B0 fica excluído da comparação temporal/memória por retenção do observer antigo.

O [recibo P03](ci/P03.json) e a [revisão independente](reviews/P03-REVIEW.json) preservam o arquivo original de blob `47b5358c8dda3179045499388ce98871576a2aa9`, 72 linhas de assertions na mesma ordem e timeout de 180.000 ms. O runner registrou 24 chamadas de expect(), incluindo fixtures; isso não equivale a 24 das 72 linhas do teste original. A linha 50 recusou o resultado de `evaluateAndStore` com `stale / portfolio-analysis-changed` após timeout. O último checkpoint concluído foi `prepare:transition-omitted:complete` aos 5.160 ms; sua reemissão no deadline não identifica a função ativa. As 146.500 revalidações e 12.026 leituras de casos são contagens inclusivas, não custo exclusivo nem prova de melhora.

Não haverá segunda tentativa original pela76. Nenhum run provou Omni nativo: o controle declarou `not applicable` com nonce próprio.

## Consumo pela71 e pendências

1. Confirmar o target atual e os preimages. Na observação C35 `e87e22d163924635bf0b41785c9bc80bf780ac0a`, tree `be4dec9ee1960b572b6bfc4dee9e0a7d21b2c60c`, result-store ainda era `23a90b2e44e8bf7f50ff41f6f1622f77a5c9dd85`; os três produtores e os quatro postimages runtime59 foram conferidos viaMCP. Isso é observação histórica, não lock de target.
2. Reconciliar o patch material completo e dependências, conservar receipts/falhas e publicar C/tree próprios. A76 não escreveu `sf2-stack`, runtime72, executores65, Portfolioanalysis/production, source61 ou Atlas69.
3. Consumir o [pedido45](checks/REQUEST-45.json), [comentário6888586763](https://github.com/gustavomhss/Orchestra-SF/pull/32#issuecomment-6888586763). `bun typecheck` em modules/sucafina e `bun run check:guards --base origin/dev` continuam **REQUESTED_NO_RESULT_OBSERVED**;45 deve registrar V/C,comandos,base/config e resultado real. Não há PASS de compiler inferido.
4. Tratar P03 como **FAIL_HELD** e encaminhar o custo residual aos owners autorizados. O site C08 e os digests do verificador continuam grandes custos medidos, mas seus contratos exigem observações independentes. Atribuição do caller `operation-verifier.ts:94:37/80` passa pelo helper `projectionDigest`; não é uma expressão direta nem prova automática de redundância.
5. O [patch externo mínimo](external/EXTERNAL-CANDIDATE76.patch), com [manifesto](external/EXTERNAL-CANDIDATE76.json), propõe retirar um clone final privado em `product/planner/stored-scenarios.ts:91`. O site original tem 224 chamadas em B2/R1. **É inerte, não aplicado, não testado e pequeno diante do custo residual.** A71/S0 deve atribuir owner, revisar o preimage e exigir os controles negativos antes de qualquer aplicação.
6. Emitir ACK de recebimento/aceite ou rejeição com W76,head documental terminal,C/tree de destino e pendências. Solicitação de ACK não equivale a recebimento. As oito seleções finais,AM, reviews, C-G7D-G8 e aceite humano/global continuam com seus owners.

[CRITERIA76](CRITERIA76.json) discrimina cobertura parcial de todos os IDs lidos. [RELEASE76](RELEASE76.json) e [AUTHORITY-FINAL](AUTHORITY-FINAL.json) encerram a lease76 para este incremento, sem estender autoridade de terceiros.
