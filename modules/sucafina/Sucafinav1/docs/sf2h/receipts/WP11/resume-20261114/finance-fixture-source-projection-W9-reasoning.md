# W9 — Planner canônico para a projeção de fonte

A proposta muda somente dois fixtures próprios: cria `sourcePlanner` sobre o `operationSources` já existente e o fornece a `createStoredPlannerScenarioHost`. O Planner classificado permanece em comparação, simulação, regras, teto, preview e mutação. As três operações compostas, os grants, as fontes, todas as assertions e o orçamento de180000ms permanecem intactos.

## Projeção e cobertura

O leitor de cenário usa somente `FinancialAnalysis.baseline`. Essa `DomainProjection` contém valores financeiros reais, além da estrutura: componentes/quantias, estado de evidência, dados ausentes, valores mensais, moeda, escopo e versão do motor. Tudo continua vindo de `buildPlannerFinancialProjection`, com o mesmo ator e fonte. A proposta não injeta valores nem reproduz fórmulas.

Em `planner/port.ts`, a projeção de base é construída antes e independentemente da decisão de completude C10. Essa decisão modifica o envelope `FinancialAnalysis.comparison/gaps`, que o leitor de cenário descarta. O patch evita reenriquecer esse envelope descartado com o registry de decisão C08. Não usa um total coberto produzido pelo port operacional.

O resultado e a basis retornados pelo leitor continuam sendo os dados persistidos de C08. O leitor preserva as duas observações reais do caso/resultado, seus digests exatos, a alternativa atual única e a igualdade final do caso. O Planner operacional preserva autenticação do ator/roleMap, fonte e escopo, campos/período/digest, dupla projeção real e revalidações de fonte/autoridade. Não há cache entre chamadas.

## Consumidores C10 preservados

`compareScenarios` continua usando as fontes classificadas: verifica coverageRef, basis e assessment exatos na entrada e após releituras e critérios. `comparePlannerScenarios` ainda compara o resultado persistido à projeção canônica e exige cobertura completa, componentes confirmados, ausência de lacunas e totais reconciliados antes de produzir diferença completa.

`comparePlannerPreview` mantém simulação e fontes classificadas, revalida cobertura e continua exigindo preview transitório condicionado/total nulo. Sensibilidade, teto e intervalo mantêm seus produtores canônicos e as reobservações de caso, resultado, fonte, projeção e evidência. No fixture humano, o mesmo resolver atual continua vinculado à UI/grant real. A cobertura indisponível do port operacional é um envelope descartado; ela nunca substitui o assessment persistido.

## Revisão e limites

O revisor independente `ci_reconciliation` não encontrou bloqueio estático. O shared worktree já foi observado com os dois blobs candidatos exatos; este agente escreveu somente a proposta em scratch. Nenhum teste ou typecheck local foi executado.

A proposta reduz um caminho de releitura da composição dos fixtures. Não há duração medida nesses bytes, promessa de PASS ou prova de otimização do host instalado. H2/W8 permanece falho; treinamento250000, teto15000, intervalo e retomada do colaborador precisam ser alcançados no próximo run.
