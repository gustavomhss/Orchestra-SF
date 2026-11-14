# Montagem da escolha atual — proposta para WP10/S0

Estado: **OWNER_INTEGRATION_REQUIRED**. Este documento descreve os pontos exatos da montagem; não declara que o host publicado os executou. Nenhum arquivo de `apps/cli` foi alterado pelo WP11.

## Referências examinadas

- WP11: produto `efa0e57e54862f99a07b2837af5e729adb881415`.
- WP10/PR32: `5866bcb2ed610f80138aaabc261acac4acf709cd`.
- `apps/cli/src/sucafina-product/decision-domain-services.ts`: blob `8a97e942cc70a27e9faceb5ddb44998bb74dc235`.
- `apps/cli/src/sucafina-product/decision-domain-http.ts`: blob `5cb8e4e45c1e68af4c59ec096b499ed0907f6c66`.

O host publicado compõe serviços individuais. Ele não chama `createDecisionProduct` nem `createDecisionHostProduct`; portanto a disponibilização desses exports no domínio, isoladamente, não demonstra uma rota montada no CLI.

## Contrato executável entregue pelo WP11

`product/decisions/product.ts` expõe `currentChoicePreview` e `promoteCurrentChoice`. `host-product.ts` vincula os dois passos ao grant humano existente `decisions.promote-alternative`, sempre com o payload integral. O payload da prévia difere do payload da promoção; o primeiro grant não autoriza o segundo.

`product/decisions/http.ts` admite:

| Ação privada | Corpo fechado | Retry histórico |
| --- | --- | --- |
| `decision-choice-preview` | `caseRef`, `choiceId`, `alternativeRef`, `coverageRef` | Não |
| `decision-choice-promote` | Os campos da prévia mais `choiceDigest`, `resultRef`, `resultDigest`, `scenario` | Sim, somente a receipt já persistida |

O serviço de prévia exige o resultado persistido do produtor e sua associação privada. Revalida o caso, a escolha, a alternativa, os dois resultados, a continuidade das fontes e o registro privado na saída. A promoção revalida essa associação dentro da transação C08, preserva `ChoiceRecord` e passa a alternativa para uma nova versão. Não aplica operações nos domínios.

## Ligação necessária no owner

1. Compor `createCurrentPlannerChoice` com `business.planner`, o emissor canônico de fontes de `business.plannerProduct`, `createPlannerResultPersistence`, `business.results`, `business.authorizeCase` e `business.operationIdentity`.
2. Resolver a continuidade pelo histórico C02 da mesma identidade/incarnação. A versão antiga pertence à escolha histórica; não deve ser reclassificada como fonte atual. A verificação precisa capturar a revisão atual e fornecer `fenceSnapshot` para o mesmo snapshot de Planner usado pela transação. Igualdade de strings ou um callback constante não satisfaz esse requisito.
3. Usar o registro de cobertura da proposta e a resolução de evidências publicados. Registrar a classificação/materialidade da nova fonte com seu período, moeda e inventário; não copiar a avaliação da alternativa anterior como prova da nova.
4. Na composição individual de `createSfDecisionDomainServices`, construir `createCurrentChoicePreview` e `createCurrentChoicePromotion` com os mesmos inputs explícitos de `createDecisionHostProduct`. A promoção deve chamar `preview.read` em `verifyProvenance`; `verifySources` deve resolver o registro atual pelo BusinessContextService e a continuidade C02. Os verificadores sob lock devem usar o ator e as projeções de fontes capturados pelo host.
5. Expor os dois handlers na montagem de HTTP. Reutilizar os validadores fechados de Decisões e `business.withCase`; somente promoção admite `{ allowHistoricalRetry: true }`. Manter `human.finish` no `finally` e revalidar a autoridade antes de devolver o resultado.

## Provas exigidas após a montagem

- Operador humano admitido prepara a prévia; nenhuma escolha ou operação oficial é alterada.
- Outro payload, fonte alterada, incarnação substituída, revogação ou edição concorrente recusa a promoção antiga.
- Uma segunda confirmação humana promove o resultado exato. Perda de resposta e reinício recuperam a mesma receipt, sem nova simulação nem aplicação.
- O consumidor real mostra o resultado atual e a escolha histórica sem confundir cobertura completa com operações hipotéticas ainda não aplicadas.

Os testes WP11 `http.test.ts` e `current-choice-lifecycle.test.ts` cobrem as fronteiras do domínio e o ciclo no provider. A montagem de CLI, o browser e a sessão nativa permanecem provas separadas do owner; não são inferidos desses testes.
