# C17 histórico — proposta delimitada para astra-compose

## Reconciliação posterior — COMPOSE6 / interface0c3d98

O estado atual está em [external-reconciliation.md](external-reconciliation.md), nos pins COMPOSE `35b9fd4f532abeb1058f00281d4ad8885ca9966f` e interface `0c3d98dd1263a305ce294c78ad5939cdda110a78`. **C17 histórico está implementado em código para o caminho delimitado de ledger autorizado, capture Atlas anterior e closure record-only ainda fresh.** Primeiro capture depois do avanço, histórico nested/misto, assumptions/replacement e fonte materialmente alterada continuam fora desse helper; a execução composta ainda precisa de prova. F2/AsyncLocalStorage e o delta central WP13 também estão presentes; preservar a validação real de 55000/15000 e suas condições. O campo BI `advantageComparisonRef` ainda precisa do delta de seleção. Mensal contrato/HTTP/UI conservam os três blobs base do patch. W20 publica os fixes próprios de proof na promoção sem operações e snapshot Dashboard no Hot Topic, ainda com execução pendente nesta observação. O S12 passou os nove casos de reconciliação do apply W18, mas falhou como run: 17 pass / 5 fail. Não transferir esse resultado para outro head.

## Registro histórico abaixo — propostas e pins anteriores

As seções restantes preservam o diagnóstico e as propostas nos pins originais; o registro atual acima prevalece quando as supera. Os antigos gaps genéricos F1 de C17 e F2 de Map não são pendências atuais equivalentes, e patches COMPOSE4 não devem ser reaplicados automaticamente. Preservar as provas que ainda faltam sem declarar READY/DONE.

## Pin e estado

Owner: `astra-compose` / WP10. Fonte inspecionada: `4306b310e4d6dac77f9beab461adad4e8e924849`.

| Arquivo | Git blob fornecido e inspecionado |
| --- | --- |
| `apps/cli/src/sucafina-product/planner-calculation-services.ts` | `48a9cdd2d38fad855d8a338f8dc119c64f81057f` |
| `apps/cli/src/sucafina-product/business-services.ts` | `611831c32ddbf58296b33e1930806185564189b9` |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `0ac4c11d4eddb6e4a67c2c41efe40a7ff34fa47e` |

Esse head já compõe o replay aninhado publicado em W2. O finding anterior de host somente record-only foi superado nesse pin. Permanecem a continuidade histórica após avanço do caso e um guard de concorrência por binding reintroduzido no host.

Os arquivos acima não foram editados. A implementação própria WP11 está em `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb`, tree `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e`; o check e os testes afetados ainda dependem dos recibos do grupo. O patch acompanhante é uma proposta não aplicada, sem alegação de CI aprovado.

## F1: APIs próprias disponíveis

```ts
type HistoricalCalculationRead = {
  caseRef: { id: string; incarnation: string; version: number } // versão CORRENTE
  eventId: string
  reference: Extract<BusinessEvidenceRef, { kind: "calculation" }>
}

results.readHistoricalCalculation(selection, context)
requests.readHistorical(selection, context)
```

`read`, `readForCalculation` e `requests.read` continuam exigindo a versão corrente. A via histórica não modifica `StoredDecisionResult.caseRef`, o pedido, os digests, a referência C17 ou o ChoiceRecord.

Os stores leem o caso e o evento do C08 autorizado; o caller não fornece um evento. A associação exige caso/encarnação e versão atual exatos, versão produtora anterior ou igual à do evento, evento anterior ou igual à versão corrente, ocorrência única do `eventId`, referência C17 integral presente na closure daquele evento, origem installation/project e digests completos. Período/moeda devem corresponder ao resultado e caber no horizonte/moeda do caso corrente. O resultado e a closure ainda passam pelos verificadores canônicos de fontes e replay. As duas observações reautorizam e comparam snapshots; alteração de ledger, versão, fontes ou objeto de callback não preserva autorização.

`test/product/wp11/calculation-history.test.ts` contém a contraprova com C08, issuer de fonte, autoridade UI, Planner e issuer C17 reais, `createAnalysisAcceptance`, avanço do caso, reopen e leitura pelo case-port. Captura de contribuição e concessão de aceite são fronteiras sintéticas declaradas. O teste não usa o BCS/host composto e não demonstra sessão nativa.

## Delta do host: seleção histórica privada

1. Expor uma entrada interna separada, por exemplo `resolveHistoricalEvidence(selection, call)`, destinada à leitura de um evento persistido. Não transformar a consulta pública corrente de cálculo em fallback histórico.
2. Ler a associação no C08 corrente sem chamar `cases.read` recursivamente. `HistoricalCalculationRead.caseRef` deve ser a seleção atual autorizada. Passar essa seleção a `withCalculationCase`, conservando integralmente suas verificações atuais de igualdade, binding, membership e revalidação.
3. Dentro dessa passagem, usar `requests.readHistorical` e `results.readHistoricalCalculation`. A factory `createPlannerCalculationEvidence` continua sendo o único emissor/replayer. Seus loaders precisam receber a seleção histórica privada; o replay usa o pedido original e a fonte reautorizada.
4. Os hooks `verifyRequestSources` e `verifyCalculationSources` atualmente chamam `withCalculationCase(stored.caseRef)`. Na entrada histórica, devem receber a seleção atual já autorizada pela passagem privada. Fora dela, manter `stored.caseRef`. A passagem precisa ser vinculada ao contexto e à cadeia assíncrona, sem cache de autorização e sem reescrever o binding nativo.
5. Para ancestry histórica, cada cálculo descendente precisa de sua referência integral no mesmo ledger autorizado. Uma lista de run IDs ou um `fresh` isolado não substitui essa prova. Se um descendente não estiver coberto, a leitura deve recusar. Não reutilizar uma permissão histórica entre casos ou chamadas.
6. Confrontar a referência reemitida com `selection.reference` integralmente e repetir a leitura dos stores e a revalidação antes de entregar a projeção. Os campos do cálculo e seus rótulos continuam distinguindo observação, hipótese e aplicação.

Essa é uma composição dos produtores existentes. Não exige relaxar `withCalculationCase`, ampliar a autoridade de um agente ou copiar fórmulas.

## Gate adicional do BCS

No blob `0ac4c11...`, `assembleSfBusinessContext.resolveAncestry` exige, para `historical`, `authorizedProjection`, `currentRef`, `differences`, `sameHistoricalSource` e `proveContinuity`. `sameHistoricalSource` não contém um ramo para cálculo. Apenas conectar os stores históricos deixaria esse gate fechado.

O owner deve conectar a entrada histórica somente ao percurso de ledger autorizado, conservando a consulta corrente separada. A continuidade de cálculo deve exigir a **mesma identidade imutável integral**, associada ao ledger corrente e reproduzida pelo produtor; não aceitar apenas o mesmo `runId` ou uma versão maior de caso. A prova deve vir da passagem C08/issuer acima, vinculada à chamada atual. A diferença de versão do caso pode ser exposta como metadado histórico, sem inventar uma diferença financeira ou reclassificar o cálculo antigo como resultado corrente.

O percurso de `cases.read` achata evidências do ledger. A composição precisa preservar a associação privada com o evento durante essa leitura; ela não pode ser inferida de texto do modelo, um `eventId` sem consulta C08 ou um global boolean. Atlas ainda exige seus envelopes e provas de continuidade próprios. Nenhum desses gates foi alterado ou demonstrado pelo teste de WP11.

## F2: guard de concorrência do host

`planner-calculation-services.ts` conserva `replaying: Map<binding, Set<runId>>`, o mesmo padrão que a revisão identificou no produtor. Dois replays independentes do mesmo binding, ou 17 cálculos sem ancestry entre si, podem ser recusados como ciclo.

`compose4-calculation-ancestry.patch` propõe somente a substituição desse guard por `AsyncLocalStorage` com conjuntos imutáveis por cadeia. O patch preserva o limite 16 por caminho, o teste de autorreferência, as consultas de store, `withCalculationCase` e revalidações. Não coalesce nem armazena respostas autorizadas entre chamadas. Não foi aplicado a fonte alheia.

## Seleção exigida ao owner

- Aceite real que cita C17: caso v → v+1, reopen, ledger e resultado históricos idênticos, consulta corrente recusada.
- Caso/incarnação/origem incorretos, referência ausente do ledger, horizonte incompatível, fonte alterada e revogação: recusa, sem dados financeiros retornados.
- Mudança do ledger e revogação entre as duas observações: recusa.
- Dois replays independentes do mesmo cálculo e 17 irmãos: sucesso sem falso ciclo; A→B→A, self e profundidade real excedida: recusa.
- Consumidor completo BCS/Atlas e prova nativa do candidato integrado, separados dos testes de contrato.

F1 do host permanece **INTEGRATION_UNPROVEN** até esse percurso ser composto e validado no candidato final. O patch F2 também requer validação cirúrgica própria no host.
