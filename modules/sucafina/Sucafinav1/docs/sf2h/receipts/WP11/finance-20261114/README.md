<!-- FINANCE-CURRENT-RECONCILIATION -->
# Reconciliação atual e escopo do registro histórico

Esta observação usa Finance `0c4a2545a63b4903c7eedb00d3f0989eb74ed398` e as fontes inspecionadas Compose `ed10a3806a4ffdf6ad5891e2065d93a4c91412cf`, Interface `cccd00c568aea65bb0c1b5cb4a82c2a236c7e775` e drift `4bd1f807e449d040e3db61c4d2b1e177b205ac69`. O [registro central de dependências](external-reconciliation.md) prevalece sobre diagnósticos e campos chamados “atuais” no documento histórico abaixo.

Compose já adotou `advantageComparisonRef` e implementou seis destinos BI protegidos com retorno de foco. A proposta de seleção inversa abaixo é histórica; o host atual avançou além dela. Os novos consumidores ainda precisam de validação e o teste owner tem TS2345. C17 com ledger, fonte record-only e captura Atlas protegida prévia também existe; seus limites permanecem explícitos. Não reaplicar os patches COMPOSE4 superados.

Mensal contrato/HTTP/UI conserva os três blobs base do patch, sem adoção. N/A exige rota/prova humana; Procurement exige a closure canônica publicada de quatro arquivos. Preservar Finance apply/result/request e os incrementos W25 de mutations/Hot Topic. O run BI S16 `43591377679`, W25, passou 1 caso/86 assertions; isso não concede aceitação nativa, C/D ou do bundle.

## Documento histórico integral preservado

Todo o conteúdo abaixo permanece no seu instante e pin originais, inclusive suas antigas palavras “atual”, “pendente” ou “não aplicado”. Não constitui nova instrução de intake nem resultado de execução nos heads acima.

# WP11 — incremento financeiro e decisões

Este recibo acompanha a PR de grupo `astra-finance` contra `sf2-stack`. O mapa em `criteria.json` conserva os **83 IDs e textos canônicos**, as quatro tasks e seus trabalhos completos. Os estados do mapa descrevem evidência observada; não são uma declaração de READY, DONE ou aceitação C/D.

## Proveniência preservada

- Plano imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- SHA-256 de `campaign.json`: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- Handoff/pack: `a3d29d011ba3607a57914701300f09117a3e2de9`.
- Implementação anterior WP11 reaproveitada: branch `astra-wp11`, head `ff99e4b4de56bbf6e7ef36daf5d3eb749779017a`, sem PR identificada no intake. A branch original não foi escrita.
- Primeiro incremento de grupo: `8184761b61f78d6aeac73232fdc879e93f85bc5e`.
- Segundo incremento: `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`, tree `a67576fae5212720d3e695138b0979931d4f7c79`.
- Terceiro incremento: `66bbe152c145f04c16223a938589c63cedb3b716`, tree `f727ae5bfcef26383ff47a2b06bb65b161295dd2`; check próprio e correção de seguimento descritos abaixo.
- Incremento W10: `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb`, tree `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e`: via histórica C17 explícita, contraprova com aceite/reopen e cotação confirmada de implementação70000.
- Handoff do owner COMPOSE em `5866bcb2ed610f80138aaabc261acac4acf709cd` foi lido. Os deltas sugeridos para `mutations.ts`, `proposals.ts` e `prepared-apply.ts` já estavam resolvidos no segundo incremento. O narrowing de `ScenarioResult` em `alternative-replay.ts` foi adotado no terceiro, sem alterar a semântica do replay.

Pins finais de W/S, árvore, seleção normalizada e igualdade dos blobs pertencem ao recibo de execução do grupo. Um teste de W1 não qualifica alterações materiais de W2/W3.

## Comportamento implementado

**Cobertura C10 composta.** Uma parcela pode sustentar mais de uma categoria, por exemplo implementação/migração/treinamento e impostos incluídos no preço final. O assessor classifica referências; o Planner continua calculando as quantias. Uma referência repetida dentro da mesma categoria e componentes de identidade duplicada são recusados. N/A exige uma justificativa e evidência que o produtor reconheça. A classificação persistida contém somente as declarações N/A que passaram por essa verificação; a declaração bruta do cliente não ganha confiança por ser salva.

**Ausência preservada no replay.** O assessor gera `pending/missing-category` para uma categoria omitida. Quando uma classificação é reaproveitada numa simulação, esse placeholder derivado não se torna uma resposta explícita: `derivedMissingCategoryIds` conserva a categoria original. Zero confirmado, valor nulo, categoria omitida e N/A sem suporte continuam distintos.

**Observação financeira e escolha humana.** O caminho canônico do Planner para uma requisição sem operações e sem premissas observa a fonte corrente. Pode publicar um `ScenarioResult` financeiramente completo somente com projeção confirmada, quantificação completa e cobertura C10 completa. A promoção humana usa a porta `addAlternative` existente, grava nova versão e exige a verificação da fonte dentro da transação. Operações hipotéticas continuam como simulação condicionada. Nenhum desses caminhos aplica um `ChoiceRecord`, aprova Procurement ou cria automaticamente uma mudança preparada.

O teste `renewal-choice-history.test.ts` executa um único provider C08 e um único caso/incarnação. Registra cobertura, preserva uma escolha humana condicionada e introduz a cotação posterior em uma **cópia da fonte Planner** por comandos reais. Publica a alternativa revisada pelo produtor e pela mutação reais, lê novamente o ChoiceRecord original e reabre a persistência. O consumidor BI em `test/product/wp05/choice-history-bi.test.ts` lê a primeira fase enquanto ela é corrente, registra a escolha, lê a fase revisada e recusa usar a referência antiga como resultado corrente.

| Observação | Antes de confirmar treinamento | Depois de confirmar treinamento |
| --- | ---: | ---: |
| Renovação | 240000 USD | 240000 USD |
| Transição conhecida | 210000 USD | 250000 USD |
| Total coberto | indisponível | 250000 USD |
| Custo alternativa − baseline, comparador canônico | −30000 USD | +10000 USD |
| Vantagem baseline − alternativa, mesmo comparador com ordem inversa | +30000 USD | −10000 USD |
| Teto da implementação para vantagem mínima de 20000 | 55000 USD | 15000 USD |
| Escolha histórica | subtotal 210000 e treinamento pendente | registro original idêntico |

O cenário de implementação 70000 ganhou contraprova própria em W10: `implementation-quote-history.test.ts` parte do escopo com treinamento/migração incluídos, registra a escolha, copia a fonte por `Versions.copy`, grava a cotação por `OPEX.save` e publica a observação sem operações: transição235000, vantagem5000 e critério mínimo20000 falho. O teste compara o inventário compartilhado/N-A inteiro antes/depois e preserva a fonte e a escolha originais, inclusive após reopen. Não soma preços no consumidor e não trata a amostra de70000 do solver como essa prova de revisão.

**Intervalos de fonte.** A seleção de uma observação sem operações recebe `parameterOperation` somente do emissor canônico de unidades, a partir de um valor mensal USD confirmado. O certificado WP11 exige que valor, período e moeda coincidam com o componente atual; não aceita um parâmetro sem essa prova nem injeta operações na requisição histórica. As amostras hipotéticas variam esse parâmetro e deixam os demais componentes intactos.

**C17 durável.** `result-store.ts` e `scenario-request-store.ts` conservam a recusa record-only por padrão. A composição pode fornecer os verificadores canônicos de ancestry do Planner. Eles autenticam cada cálculo ancestral por replay, verificam o binding do request persistido, limitam ciclos/profundidade e exigem projeções autorizadas dos leaves. `calculation-persistence.test.ts` usa o Planner real, requests/resultados C08, reopen e revogação de fonte; os callbacks de autoridade/captura desse teste são fronteiras sintéticas explícitas, sem alegação de prova nativa.

**Histórico C17 explícito (W10).** `readHistoricalCalculation` e `readHistorical` exigem seleção corrente e referência integral ligada a um evento do ledger C08, com origem, caso/encarnação, versões, moeda, horizonte, request/result/closure e duas observações autorizadas. As consultas normais continuam current-only. O teste aceita uma contribuição citando um cálculo real, avança o caso e reabre stores/issuer/case-port; cobre referência fora do ledger, mudança do ledger entre observações, origem/caso/encarnação/version incorretos, horizonte incompatível, revogação e mudança real da fonte. As fronteiras de contribuição/grant são sintéticas. O BCS completo requer o delta de host documentado em `host-c17-proposal.md`.

**Isolamento de callbacks.** O result-store lê snapshots próprios e entrega cópias separadas aos verificadores de caso/fontes/cálculo. Mutações dessas cópias durante a chamada são rejeitadas; uma referência retida não alcança o resultado devolvido nem a publicação. O teste dirigido cobre leitura, escrita, hook de cálculo e mutação de objeto retido entre verificações.

**AlternativeDraft.** A identidade da operação continua pertencendo ao registry de execução do host. A captura verifica operação, handler, run/session/providerGeneration, principal, accessRevision, callId e digests exatos. `verifyAlternativePublication` valida conteúdo de uma captura autenticada; não transforma um JSON fornecido pelo modelo em captura confiável. O host publicado em `417038d6b3cfd1817f40ffc60e56f42e505b50a5` já contém `alternative-services.ts` e `alternative-captures.ts` com produtores/consumidores reais. Não se alegou ausência de callers com base no seed.

## Validação e limites

O check hospedado W2 `43579025258` examinou o produto `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`: zero diagnósticos TypeScript em WP03/WP05/WP11, 131 diagnósticos externos e guards aprovados com 78 regras, 753 paths e zero erros. Portanto o typecheck do package ainda falhou globalmente. O check W3 `43579943285` (job `132402313995`) encontrou os mesmos 131 diagnósticos externos e um diagnóstico próprio: o union de categorias derivadas inferia `never` para `.includes(...)`. O candidato W4 usa `Set<string>.has` no mesmo filtro, sem mudar a regra nem afrouxar tipos ou assertions. Os guards W3 passaram com 78 regras, 759 paths, 13 warnings e zero erros. O fix W4 depende de publicação e revalidação pelo owner do grupo; consulte o recibo de execução para a conclusão exata de cada seleção.


O run W5 `43581459736` (job `132406887167`, W=`8090bddb8e38faf6209c091b863bff58afe50a9c`, S=`4980a888f46900d2a4ed0c11bb3b1b6dfd331d58`) passou cinco testes em quatro arquivos, 41 expects e zero falhas. A seleção cobre `coverage-access`, `proposal-coverage`, `planner-apply` e `analysis-promotion`. Foram corrigidos inventário esperado incompleto, WeakSet privado não compartilhado com o provider, inicialização das três superfícies e ausência da fonte Planner na fixture de promoção. Log SHA-256: `02daaecf073fc85472a1bc296bf36126de841cf854ffdc3990a7d76e9859c26c`. Essa execução não qualifica W10.

Nenhum teste de produto foi executado localmente. Não foram alterados timeouts/assertions para ocultar falhas. Os testes novos com fixture de engine usam o orçamento já adotado pela seleção da fixture; eventual timeout deve ser diagnosticado, não promovido a aprovação.

As revisões estáticas cruzadas WP03/WP05 examinaram fronteiras de cobertura, fonte e comparação. Elas não substituem três revisões independentes aceitas, recibos nativos com SessionV2/SkillLoadReceipt, C/D nem o epic final de S0.

## Deltas delimitados para integração

1. **Host C17:** COMPOSE `4306b310e4d6dac77f9beab461adad4e8e924849` já compõe os hooks de replay aninhado. Restam a entrada histórica de ledger usando a seleção corrente em `withCalculationCase`, a continuidade de cálculo no BCS e o guard de ancestry por cadeia no host. `host-c17-proposal.md` delimita esses gates; `compose4-calculation-ancestry.patch` é uma proposta não aplicada contra esse head. Não se afrouxou autorização nem se reescreveu referência histórica.
2. **Interface N/A:** `apps/cli/src/sucafina-product/decision-controls.ts` ainda informa que N/A está indisponível. O owner deve oferecer justificativa/evidência suportada e a confirmação humana já existente. Não preencher automaticamente valores, impostos ou categorias.
3. **Sensibilidade WP13:** `product/portfolio/planner-sensitivity.ts` precisa consumir o teto canônico quando os valores conhecidos permitem um limite condicionado, preservando pendências/total nulo. Seleções source-only precisam usar o `parameterOperation` emitido pelo produtor. Não fabricar um `SensitivityResult` para demonstrar BI11.
4. **Composição total:** typecheck externo, provas de execução parcial Planner/Procurement no candidato integrado, prova nativa dos cinco exports C16 e os gates C/D permanecem explícitos no mapa. Nenhuma prova isolada deste recibo resolve uma dependência não demonstrada.

Os arquivos compartilhados, host, artifact-store e interfaces gerais permaneceram sob seus owners. Estas propostas não autorizam ampliar políticas financeiras, alçadas, identidade, Azure/deploy ou engines.
