# Proposta de composição da admissão de renovação — dc9 + Finance W31

## Resultado estático

A proposta preserva o verificador canônico completo dos cenários com operações ou premissas, dentro da transação real somente de leitura introduzida e qualificada por Finance. Para cenários vazios, consome a observação de duas projeções atuais de PR40, com fences de fonte e autoridade antes da projeção final. A transformação de principal em Actor é extraída da implementação canônica de Planner e reutilizada; não é copiada para o fixture.

Esta é análise do autor da proposta, não revisão independente nem execução. Nenhum teste de produto, import de produto, Bun, typecheck, guard ou prova nativa foi executado. Os únicos arquivos escritos estão no scratch. Nenhuma alteração foi feita na branch, no repositório local ou nos produtores de integração.

## Pins

Base Finance: `c449efc092e507fca2b4f61d1e7ce057faf05c89`. Fonte PR40: `dc9d4327d07db58d026e7672cf619717394f5ffd`.

| Arquivo | Blob anterior Finance | Blob proposto |
| --- | --- | --- |
| `product/planner/port.ts` | `e365ac59376482dfcc6f81aed045b0153f911038` | `8389709232225424b5905638d0951d8cdbb71dd7` |
| `test/product/wp11/renewal-operation-verifier.ts` | `2338917427497733e4bd88aec852985206cce066` | `f85c1c8e7196aff1381513b2d5ed2109641d6a45` |

Os caminhos completos, tamanhos e SHA256 constam em `proposed-manifest.json`. O diff está em `proposed.diff`; os dois arquivos completos ficam em `proposed/modules/sucafina/Sucafinav1/...`.

## Decisões de composição

A versão dc9 do helper retirou a transação externa dos cenários não vazios. Consumir esse arquivo integralmente descartaria o trabalho de Finance para evitar repetidas decodificações de C08 dentro de uma verificação. A proposta conserva, nesse ramo, exatamente o parser, request/signal/revalidate de entrada, `createPlannerOperationVerifier`, transação `commit:false` e revalidação externa de saída. Nenhum scope ou resultado sobrevive entre invocações.

O ramo vazio precisa de snapshots distintos. O novo teste altera o domínio Planner por comando canônico durante a segunda resolução da fonte e confirma que a gravação realmente ocorreu. Prender os dois snapshots na transação externa antiga impediria essa gravação aninhada, descaracterizando a corrida. A proposta mantém os dois snapshots de dc9, a releitura exata da referência, digest do binding, identidade do Request e final `revalidate` depois do último `authenticate`, antes da última projeção. O resultado é apenas admissão booleana; não é um valor financeiro, avaliação C10, concessão de execução ou ChoiceRecord.

A busca nos exports disponíveis não encontrou um mapper reutilizável do principal autenticado, roles e `snapshot.data.access`. `compareForecast` mantinha essa transformação privada; `createPlannerSourceIssuer` também não era apropriado porque percorre identidades de scoped source e pode tocar C08. A proposta extrai somente o mapper privado de `port.ts` para `plannerSourceActor`. `compareForecast` chama esse mesmo produtor e o fixture o importa. A expressão do Actor é idêntica byte por byte à anterior; recusa principal ausente, diferente ou `local:` permanece igual. Não houve mudança de políticas, papéis, campos ou fórmula financeira. Nenhum outro consumidor foi refatorado.

O delta de `renewal-choice-fixture.ts` pode ser consumido exatamente no blob `9514f80dc7e8dbb9c8acf1822bbd4f1ea067c0e1`: sua última comparação passa de `planner` a `sourcePlanner` e apenas `projection.value.candidate` é devolvido. Os resultados persistidos, comparação com critérios, comparação inversa, classificação e preview continuam no Planner classificado/C10.

O teste novo deve entrar exatamente no blob `4a5780b82989b9e8c3437bb3758779d7cfb76733`. São sete casos declarados, 35 linhas `expect(`, nove variantes de scope e uma contagem explícita de duas fontes, duas autenticações e três revalidações no caminho vazio positivo. A contagem de assertions executadas depende dos loops. A proposta não altera teste, assertion ou timeout. As três provas de `renewal-read-scope.test.ts` de Finance também permanecem intactas.

## Verificação estática e seleção de CI

Conferi 31 imports relativos dos dois arquivos propostos, a igualdade do literal de Actor, os hashes dos candidatos e os elementos do wrapper não vazio. O blob remoto W31 de `port.ts` coincide com a baseline local. Esses checks são metadata e leitura, não execução de produto.

Para a extração canônica, a seleção mínima de WP03 é `port.test.ts`, `port-hr.test.ts` e `capability-parity.test.ts`. Eles exercitam comparação real e mudanças de fonte/FX, visibilidade Finance/viewer de HR e passagem por UI/bridge privado com autoridade revogada. A existência de um caso de bridge em teste não qualifica uma instalação nativa.

Para o helper compartilhado, executar `renewal-source-admission.test.ts`, `renewal-read-scope.test.ts`, `current-choice-lifecycle.test.ts`, `renewal-choice-history.test.ts`, `renewal-choice-revision.test.ts` e `implementation-quote-history.test.ts`, mais WP05 `choice-history-bi.test.ts`. O coordenador deve incluir separadamente os consumidores afetados pelo fence de current-choice de dc9. Typecheck do package e guards permanecem obrigatórios. Só Actions nos pins publicados pode demonstrar os novos budgets, races e ausência de regressões; os passes S19/S20/S21 anteriores não qualificam estes novos blobs.
