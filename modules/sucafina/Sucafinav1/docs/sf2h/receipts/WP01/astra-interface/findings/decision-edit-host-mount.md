# WP01 — montagem do editor de DecisionCase no host

Estado: dependência de composição identificada por leitura; a prova de consumidor W7 não é prova do router instalado. Owner: astra-compose/WP10.

Pin examinado: `7c7e5b086a9de405cd3f8e18e8d631af55cf0979`, tree `3deb1ed790fc247a6633c9cc25a11523ae3f61b1`. O arquivo `apps/cli/src/sucafina-product/host-context.ts` conserva o blob `0d3abcf642deb3d2f6c6346cdddc8bfb40141532` observado em4306.

## Evidência da cadeia publicada

- `host-context.ts` monta `decision-domain-http`, `portfolio-http`, baseline, memory, extended, Dashboard, Procurement e Collaboration, além dos handlers documentais. Não localizei uma instância de `createDecisionHttp` ou de `createDecisionCaseManagement` nessa montagem.
- `decision-domain-http.ts` blob `5cb8e4e45c1e68af4c59ec096b499ed0907f6c66` atende coverage, criteria, select-portfolio, condition e controls. Não atende `decision-edit`.
- `portfolio-http.ts` blob `c434de513cb7ceae4acad1fc595e776785ec85af` atende, entre outros, `decision-answer-question` e seus callbacks reais. A rota de anexar resposta existe nesse handler; não deve ser confundida com o editor ausente da cadeia examinada.
- `extended-business-services.ts` blob `a57e9d39f81e8a064f903765e70533bdffea4ba2` compõe `analysis-choice-http` (`ade98212eba04a8fe35624ea7e96214ec00a92ce`) e `extended-http` (`34a2e30f19cb49eb65feb872e4804517429dbb34`). Suas listas fechadas atendem escolhas de análise, BI e reviews.
- `product/interface/http.ts` blob `970686ad87415779c4db807cfe03affeeb9ec59b` renderiza `decisionEditForm`, mas a lista de modes workbench não inclui `decision-edit`.
- O generic HTTP de decisões publicado existe. A disponibilidade do arquivo e do renderer não demonstra que o host o montou.

## Incremento próprio

`product/ui/decision-edit.ts` permite comparação autorizada, adoção explícita da base atual, conservação por ID dos critérios, confirmação de alteração estrutural, releitura antes do POST e purge por revogação. O fixture novo compõe o HTTP original com operadores, C08, BusinessServices, intent fences, case reads e CAS reais. Seus casos são sem fontes; `verifyEdit` limita-se explicitamente a esse escopo. Não substitui a prova do host inteiro nem de fontes/nativo.

## Ação do owner

Indicar o entrypoint publicado se houver outro mount. Caso contrário, montar a rota real com case-management e seus verificadores atuais, sem ampliar grants; preservar a lista fechada de campos e a mesma política de retry histórico/intent. Contraprova de composição: dois operadores autenticados, primeiro commit200/segundo409, comparação sem gravação, adoção explícita, nova mudança detectada antes de POST e revogação entre comparação e adoção. O teste de UI já entregue deve ser reaproveitado, sem reduzir suas assertions.

O finding foi comunicado na PR32, comentário6875491758. Não alteramos host-context, handlers compartilhados ou identidade para contornar essa dependência.
