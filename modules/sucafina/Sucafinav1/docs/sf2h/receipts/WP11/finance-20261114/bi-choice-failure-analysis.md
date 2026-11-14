# S11 — calendário confirmado da cotação de treinamento

## Falha observada

GitHub Actions run `43586902727`, job `132423255218`, produto W `6016a70d7ab0c3d50f1ec2827a534a80e48a5c56`, envelope S `78f709e52a052768188343f93cd5fa36ba867da2`.

A jornada `same-case BI preserves the human choice while the confirmed training revision changes its current source result and table` terminou com timeout de `180000 ms` após `645858.41 ms` observados. O log contém também uma falha funcional: `knownSubtotal` chegou a `250000`, mas a asserção de `total=250000` recebeu `null`. A falha funcional não deve ser ocultada pelo timeout. Os outros quatro testes do run passaram.

## Causa por inspeção de fonte

O fixture anterior `wp05/engine-revision-fixture.ts` copiava a versão real do Planner e criava a linha `training` por `domain.execute` com `annual: 0` e somente `f10: 40000`. O novo fixture da PR #40, `wp11/renewal-source-fixture.ts`, repetia o mesmo payload.

O comando canônico preserva as outras onze previsões como `null`. O qualificador de `product/planner/port.ts` observa orçamento zero nessas células, mas classifica o outlook como `estimated`, pois não existe previsão confirmada. `product/planner/coverage.ts` exige componentes `confirmed` para declarar completude. Assim, `scenario-port.ts` conserva `total: null`, ainda que o subtotal conhecido some `250000`. A conduta do produtor é correta; o teste exigia completude sem fornecer o calendário confirmado da cotação.

A correção pertence aos inputs sintéticos do fixture. A cotação deste cenário declara uma cobrança pontual de `40000` em novembro e ausência de cobrança **explicitamente confirmada** nos outros onze meses. Os helpers agora fornecem `f` com doze valores por meio do mesmo comando OPEX canônico. Nenhum consumidor converte ausência em zero e nenhuma fórmula, engine ou autorização foi copiada ou alterada.

## Deltas próprios congelados

| Arquivo | Blob antes | Blob depois |
|---|---|---|
| `test/product/wp05/engine-revision-fixture.ts` | `93e9c37cfea05574c3c0b3ae080a03fdd5063056` | `856381de3f333ca79b302483d3b8893d55f00441` |
| `test/product/wp05/choice-history-bi.test.ts` | `40fbaf6eb4a7b88c3f4feb54773961188cd007da` | `c939c5e39c80f3cdbc08fd700cd017a7b0ed50b4` |
| `test/product/wp11/renewal-source-fixture.ts` | `fb973752979eb98ba2e1c3c9002ade471443b728` | `79de9744dcf08cfc8a4f17084954a9230bb1793a` |

Todos os caminhos são relativos a `modules/sucafina/Sucafinav1/`. Os bytes anteriores foram conferidos contra o estado publicado W18 para WP05 e contra o blob explicitamente autorizado do intake W19 para WP11. O manifesto inclui SHA256 antes/depois e pins das fontes inspecionadas.

O teste BI passou a exigir, **antes de ler o BI**, a operação de observação sem operações hipotéticas, os doze componentes de treinamento com calendário/valor/moeda/estado exatos e o resultado canônico completo. Todas as asserções anteriores continuam, incluindo preservação do `ChoiceRecord`, leitura de resultado persistido, `30000 → -10000`, links de origem e ausência de mudanças aplicadas. O timeout permanece `180000 ms`.

O helper WP05 original deixou de ter imports depois do intake da PR #40. Foi corrigido para não conservar uma implementação do fixture com o mesmo erro, mas não se atribui a ele cobertura de execução pelo teste BI, que agora usa o helper WP11.

## Custo e limites

O log mostra que a primeira observação DOM foi concluída e limpa em aproximadamente `18.5 s`; a falha ocorreu muito depois, no caminho da revisão/consumo dos resultados. A fonte anterior inicializava `createWp05SensitivityFixture`, incluindo `persistent.evaluateAndStore`, embora a jornada já criasse seus próprios resultados e regras. Sua verificação de operações também usava o Planner enriquecido pelo registro C10. O intake da PR #40 usa um bootstrap mínimo de fontes reais e isola a verificação de operações do enriquecimento C10, preservando verificações e autoridade a cada observação.

Essas são diferenças estáticas concretas; não constituem medição de melhora. O custo no head final precisa ser observado em Actions, com os novos traces já presentes no fixture. Não foi alegada causa de infraestrutura, e nenhum timeout foi aumentado.

## Validação necessária

Seleção cirúrgica recomendada no produto publicado com estes bytes:

- WP05: `test/product/wp05/choice-history-bi.test.ts`.
- WP11: `test/product/wp11/renewal-choice-revision.test.ts`, sujeito ao limite de um run em voo por WP.

O helper também participa de `renewal-choice-history.test.ts`; qualquer seleção adicional deve responder a um risco específico, respeitando o protocolo CI.md e a deduplicação. `renewal-implementation-quote.test.ts` conserva o caminho de implementação, que não foi alterado.

Nenhum Bun, teste de produto, typecheck ou run de CI foi executado por este agente. A revisão é por fonte e hashes. Não há PASS, prova nativa, shell montado, C/D, READY ou DONE reivindicados.
