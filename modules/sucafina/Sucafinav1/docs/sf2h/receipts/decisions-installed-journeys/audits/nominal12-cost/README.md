# Missão52 — diagnóstico limitado da primeira comparação no nominal12

**O artifact confirma uma interrupção antes da resposta; não identifica um gargalo interno.** No run12 há um único POST `decision-compare`, encerrado com `net::ERR_ABORTED`, sem status HTTP ou corpo. O run11 recebeu HTTP200 nas três comparações, mas falhou depois na descoberta do histórico. Não se transfere o PASS de uma etapa11 para12.

## Shapes e solicitações antes da comparação

As observações próprias11/12 coincidem estruturalmente: duas fontes Planner v1,17campos iguais, período2027, USD1200/2400; case v2 após anexação; duas coberturas v1 da mesma basis,9categorias pending, registradas com case v2/v3; recuperação da segunda promoção entrega case v4,3POSTs e2intenções. Não houve mudança Planner real nem regra numérica salva antes do primeiro compare12. O DOM12 confirma as duas alternativas, subtotais1200/2400, cobertura pending, case Version4 e nenhuma escolha humana registrada.

O inventário inteiro de requests/rede até o primeiro compare também é igual, inclusive6GET workbench-case,6POST workbench-analysis,6POST decision-portfolio-results,4GET bi-data,2coverage e3promote. O requestfailed da promoção perdida faz parte da recuperação intencional presente nos dois runs. Não há aumento observado de alternativas ou de chamadas UI nessa seção da jornada.

## Tempos que realmente existem

| Step Playwright composto | Run11 ms | Run12 ms |
| --- | ---: | ---: |
| create two actual Planner versions through human controls | 1324 | 1841 |
| discover and inspect authorized sources before attaching them to the saved case | 2507 | 4796 |
| save the first alternative with an explicit pending cost inventory | 6035 | 11624 |
| lose the second creation response and explicitly recover the identical request | 8037 | 16238 |
| reopen the exact alternatives and consume them in the current comparison | 10798 | 16729 |

Esses tempos incluem UI, navegação, espera e múltiplas operações. **Não são tempos HTTP nem tempos exclusivos de produtor.** A quinta linha11 inclui atividades posteriores à sua primeira comparação que o run12 não alcança, portanto nem essa linha delimita o mesmo trecho até o fim. As quatro primeiras etapas comparáveis já aumentam antes da falha; isso mostra uma diferença ampla de custo observado, sem distinguir código, espera ou variação do runner.

Os campos da captura de rede são apenas `event/method/path/mode/httpStatus/contentType/error`; não há timestamp nem duração. Os dois logs CLI contêm boot/watchers/shutdown e os profiles estão vazios. Não é possível extrair desses arquivos quantos segundos o produtor passou comparando, se terminou após abort, nem onde esperou.

## Leituras de código com W exato

- W11 `fb9ed54674e7792008e8d1bd7425adc7effe8c09`; W12 `c4883ae51636a4ebbcf9274994e96e2725214e48`.
- `decisions/case-port.ts`: mesmo blob `2bbcf63bb0fa56dd3a93190f7711f99aef2efb74`.
- `decisions/result-store.ts`: mesmo blob `23a90b2e44e8bf7f50ff41f6f1622f77a5c9dd85`.
- `planner/stored-scenarios.ts`: mesmo blob `1761a5d2558c9091d1c02730774751ace44e9131`.
- `planner/scenario-comparison-port.ts`: mesmo blob `1782c2094239c3712d3a895a6a25f4160fb429c7`.

No stored-scenarios36–40, o agrupamento continua por digest do `stored.caseRef` completo. Os mapas inicial47 e final98 são novos por fase; versões históricas diferentes permanecem grupos distintos. `resolveMany` preserva batch de resultados inicial/final e releituras reais de casos/projeções. O artifact12 não contém os envelopes históricos completos; não converto esse mecanismo estático em uma contagem de grupos observada no run.

A captura P9 de `record-choice` não foi alcançada: não houve request `decision-choose`. BCS mudou de `390bce2594e39a28defce1d47fafa0d7291e940e` para `1400fa4894c55e99ae7fa18c809be9c2298fc49d`, incorporando a unidade69 e o fallback P9. Em BCS274–289, o caminho histórico só é tentado após a leitura retornar stale/unavailable; o caminho fresh e as guardas atuais permanecem. Sem instrumentação desse run não afirmo se o fallback foi invocado. O diff está salvo para separar esses deltas de qualquer proposta76.

## Conclusão operacional delimitada

Não há evidência suficiente aqui para escolher uma correção de performance. Os dados descartam a hipótese específica de mais alternativas ou mais requests UI antes da comparação, e mostram os produtores de agrupamento idênticos. Eles não isolam o custo interno da composiçãoC41. Não proponho redução de observações, cache de autoridade, alteração de política, ampliação de deadline ou retry idêntico como diagnóstico.

O produtor protegido P9 e seu custo de captura não foram qualificados por J1/12. Qualquer decisão de compor uma release76 deve apoiar-se na autoridade, nos preimages e nas provas próprias dessa release; este artifact não fornece atribuição causal a76 nem a outro delta.

Leituras exclusivamente estáticas e parsing dos artifacts existentes. Nenhum produto ou teste executado. Os dados, hashes e comparações estão em `findings.json`; os conteúdos remotos pinados em `source-readback.json`; o diff BCS em `business-context-W11-W12.diff`.
