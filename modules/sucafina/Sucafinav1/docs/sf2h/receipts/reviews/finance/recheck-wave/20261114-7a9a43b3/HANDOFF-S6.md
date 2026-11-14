# Suplemento terminal S6 — Finance independente

**Parecer permanece REQUEST_CHANGES. FIN-IND-001–005 continuam OPEN em `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1`; FIN-IND-005 permanece P1 / NEEDS_EVIDENCE. Esta revisão preliminar não aprova o candidato C.**

Este suplemento acrescenta o resultado que terminou depois do corte de 19:25:12 UTC dos seis recibos no commit `628f1f26b0fcd679d09c47b976b81d9b1ee92ba0`. Esses recibos são preservados como retrato daquele corte. A pendência “S6 em voo” passa a **terminal reconciliado: failure**. Não houve execução de testes, novo dispatch ou edição do produto pelo revisor.

## Identidade e resultado

- Produto W: `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1`, tree `2da074668b164b1aa5e051f8a70366969425906f`.
- Snapshot S: `0e68fec2e33e6c4c2103f368fed1d00dc832cb0c`, tree `9339889db0210f25ba46ee9a3ab7553e146bef1d`.
- [Compare W → S](https://github.com/gustavomhss/Orchestra-SF/compare/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1...0e68fec2e33e6c4c2103f368fed1d00dc832cb0c): um commit, único arquivo adicionado `.ci-run.json`; o produto é o mesmo W.
- [Request](https://github.com/gustavomhss/Orchestra-SF/blob/0e68fec2e33e6c4c2103f368fed1d00dc832cb0c/.ci-run.json), blob `85fc069e57a87392820409f443e4f4b47c8c4564`: jornada `journey-phase.test.ts`, filtro `^FIN-IND-005 Finance performance`, env vazio; idêntico ao request S3.
- [Run 43631582858](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43631582858) / [job 132559159277](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43631582858/job/132559159277): **0 pass / 1 fail / 18 expects**, um teste em um arquivo, 180,22 s. Run atualizado como concluído às 19:25:24 UTC.
- Cleanup 132560430979 concluiu com sucesso; isso só confirma limpeza do snapshot. Omni: não aplicável.
- Leitura terminal corroborada por dois contextos independentes de leitura, root e finance_evidence. Sem autoria do produto.

## O que o terminal demonstra

A fixture retornou em 12.521 ms; o cálculo omitido concluiu em 35.505 ms; a escolha retornou em 11.486 ms; a confirmação do treinamento retornou em 52.749 ms. Os tempos são inclusivos e não devem ser somados a filhos como se fossem operações independentes.

O teste completou as 18 assertions anteriores à avaliação confirmada: **`baselineResult.knownSubtotal=240000` é custo**, o subtotal selecionado inicial é 210000, a cobertura do treinamento está pendente e o teto condicionado é aproximadamente 55000. A escolha registra o caso na versão 4. Após treinamento confirmado de 40000, o mesmo caso/encarnação avança à versão 6, custo total 250000, diferença −10000 e critério falho. O digest repetido nesse checkpoint ainda é a variável da escolha original; não substitui releitura histórica.

A emissão de cobertura confirmada retornou `ok` em 33.094 ms. **A primeira qualificação**, iniciada em elapsed 158387 ms, retornou `stale` em elapsed 180017 ms, duração 21630 ms. Não houve chamada observada a `confirmed.results.write` nem a `confirmed.exact`.

| UTC | Observação terminal |
| --- | --- |
| 19:25:04.2114577 | Preview dentro da primeira qualificação retornou `ok` |
| 19:25:08.5909963 | Nova resolução de autoridade retornou `ok` |
| 19:25:12.9201613 | Guard da fixture: elapsed 180015 ms, budget 180000 ms, `deadline-exceeded` |
| 19:25:12.9206362 | `confirmed.units.revalidate → false` |
| 19:25:12.9208531 | `confirmed.authority.is-still-valid → false` |
| 19:25:12.9210606 | Primeira `confirmed.coverage.qualify → stale` |
| 19:25:12.9213194 | `confirmed.evaluate → stale` |
| 19:25:12.9275247 | O teste lança `Source-only certified analysis unavailable: {"status":"stale","reason":"coverage-authority-changed"}` |

A fase `prepare:transition-confirmed:complete` é o último marcador da fixture, não a operação ativa no prazo. O erro final vem da condição na [linha 49 do teste](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/test/product/review-fixes/finance-resume-performance/journey-phase.test.ts#L48-L53), após receber o resultado recusado. O trace marcar uma promise como “completed” não a transforma em resultado `ok`.

**Não foram alcançados**: teto confirmado 15000, witnesses 15000/15001, releitura da escolha original, replay autorizado, fechamento/reabertura do armazenamento e UI, leitura do colaborador e recusas de outsider/revogação posteriores. O limite observado ocasionou uma recusa conservadora; não demonstra revogação empresarial real, erro da fórmula ou regressão isolada de performance.

## Relação com PR56, S3 e S5

O diagnóstico PR56 e o S6 param na primeira qualificação, em execuções e árvores identificadas separadamente. Já S3, no W `95f47448…`, chegou a dois samples confirmados e iniciou o solver antes de falhar. Não transportar esse progresso para S6 e não apagar a evidência anterior.

S5 continua válido em seu escopo: **36 pass / 0 fail / 297 expects**, sem a jornada longa. A proposta `coverage-issue.NOT_APPLIED.patch.txt` da PR56 continua não aplicada ao produto W. S6 não a valida e não resolve a diferença entre o predicate da autoridade original e o predicate de uma nova resolução descrita em [coverage-preview.md](coverage-preview.md).

## Retomada e owners

1. **Finance/WP13 + WP11:** usar este terminal e seus traces para explicar o custo residual. Antes de outra tentativa do owner, produzir delta material ou hipótese discriminante, preservando assertions, guard e provas históricas/replay/reabertura. Não duplicar S6 inalterado.
2. **WP13 + WP10/S0:** resolver equivalência do callback original, objeto mutável, fallback antecipado, identidade, revogação e cleanup antes de adotar a proposta PR56.
3. **WP10/S0 e WP01/S1-A:** consumir e provar as correções de integração já identificadas para FIN-IND-001–004 no candidato real.
4. **S0:** montar Portfolio com dependências autenticadas, congelar C e encaminhar as três revisões finais sobre esse mesmo candidato.

[CI-S6-terminal.json](CI-S6-terminal.json) contém evidência estruturada. [REVIEW.md](REVIEW.md), [findings.json](findings.json), [evidence.json](evidence.json), [provenance.json](provenance.json) e [HANDOFF.md](HANDOFF.md) permanecem preservados. Corte deste suplemento: **2026-11-14 19:29:41 UTC**; PR42 e PR56 ainda estavam nos pins revisados. Mudanças posteriores são delta pendente.
