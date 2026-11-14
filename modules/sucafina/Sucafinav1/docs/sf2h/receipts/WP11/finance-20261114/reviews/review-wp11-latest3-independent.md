# Revisão independente — intake final da PR40

**Sem novos bloqueios estáticos nos seis blobs candidatos. Validação de produto no GitHub Actions pendente.**

Fonte: `65509f0b8c435b88fb0ec9949299571f011d2347`. Baseline de produto Finance: `6184a0d3c818fd508f05028d34428ef1c95c01a5`; o head documental reportado pelo root é `3ab41cbb106435635999e1417b10a087a34a5d95`. A revisão leu os candidatos imutáveis em scratch e os diffs salvos antes da adoção.

## Pins revisados

| Arquivo relativo ao package | Blob candidato |
| --- | --- |
| `product/decisions/hot-topic-draft.ts` | `d8a151c558227b3bd2612dbb6caba993efa85783` |
| `product/decisions/mutations.ts` | `e0840d775274ea73c6b938711764c69593dadca0` |
| `test/product/wp11/renewal-choice-fixture.ts` | `a7fbf1ab3e35810cc717980b89421f039eae41f1` |
| `test/product/wp11/renewal-human-choice-fixture.ts` | `18d95b84d01b26048af9a442c44cb32e8f14e9f5` |
| `test/product/wp11/hot-topic-snapshot.test.ts` | `ad9f8aa17a1ece912132d4c2453547693697716f` |
| `test/product/wp11/promotion-coverage-proof.test.ts` | `991a7fb18f9e8e7372bd2e0193b6727ab6633b26` |

## Análise

`hot-topic-draft.ts` fecha duas janelas observáveis: substituição de draft durante o último callback de fonte em `readCurrent`, e durante a última autorização de caso em `list`. A nova leitura C08 reúne caso e draft/ativo depois desses callbacks e exige igualdade dos digests já autorizados. O port de estado atual autoriza antes e depois do callback de leitura. Permanecem o vínculo ao ator, a checagem de cancelamento, o CAS e a superfície Dashboard. Nenhuma autorização ou fórmula nova foi criada.

Nos dois fixtures de renovação, `sourcePlanner` continua sendo `createPlannerPort` real e alimenta somente a projeção consumida por `createStoredPlannerScenarioHost`. O host usa `FinancialAnalysis.baseline`, mantendo o resultado C10 e a basis persistidos, as duas leituras do resultado, a associação única à alternativa e o digest final do caso. Julgamento, comparação, preview, mutação, regras e teto continuam com as fontes classificadas. `compareScenarios` verifica `coverageRef`, basis e assessment nas observações repetidas. A indisponibilidade da cobertura no envelope de projeção não vira total completo.

`mutations.ts` difere da versão Finance apenas no comentário. Mantém a chamada de `entries` e o reassessment canônico mesmo quando a cobertura anterior é igual, preservando a correção mais forte do grupo.

## Provas adicionais e consumidores

O novo arquivo Hot Topic define seis casos, incluindo as duas corridas finais específicas desta mudança. O novo arquivo de promoção define seis casos: as ordens de fontes `[0,1]` e `[1,0]`, prova exata do digest recalculado, idempotência e preview hipotético, além das negativas de prova ausente, revogação, fonte e caso. C08 e produtores financeiros são reais; admissões e callbacks controlados pertencem ao fixture. Esses testes não comprovam uma sessão nativa ou interface instalada.

Os consumidores diretos dos fixtures alterados são `renewal-choice-history.test.ts`, `renewal-choice-revision.test.ts`, `implementation-quote-history.test.ts` e WP05 `choice-history-bi.test.ts`. Nenhuma assertion, operação, grant, threshold ou limite de tempo existente mudou nos dois patches.

Para o intake, os dois arquivos novos cobrem riscos adicionais. Os consumidores de renovação/BI precisam de evidência dos bytes com a nova composição; um run anterior de W22/W23 não executa esses bytes. A presença de batching já idêntico em PR40 não exige repetir testes de batching sem risco adicional. O root decide a seleção e preserva a cadência sem duplicar runs.

## Limites e execução

Foram feitas somente leitura e verificações de metadados. Zero testes locais, imports de módulos de produto, comandos Bun, typecheck, dispatches de CI, escritas remotas, browser ou edições do repositório. O relatório não mede performance nem declara PASS, READY, DONE, C/D, prova nativa ou aprovação de produto. Findings de integração fora desses seis arquivos continuam com seus respectivos responsáveis.
