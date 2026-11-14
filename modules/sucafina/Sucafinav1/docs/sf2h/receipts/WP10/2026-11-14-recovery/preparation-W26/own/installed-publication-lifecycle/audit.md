# W26 — ciclo de vida da fixture de publicação instalada

**Candidato próprio isolado, pronto para composição e CI hospedado.** A mudança mantém um único root real de Core durante os cinco casos do arquivo. Os providers de publicação, o AuthoringStore, a autoridade UI e os registros residentes continuam com seus escopos reais por fixture. Não houve edição do espelho central, de fontes estrangeiras, de branches ou de CI.

Este relatório é de builder. Não substitui nenhum dos três revisores independentes e não concede aceite nativo ou global.

## Fonte e candidato

| Item | Identidade |
|---|---|
| Base W25 publicada | `3d59829e5d9e438cbb443428a9479d7f63b5bf31` |
| Árvore W25 completa | `ee95a2e3d0f02efabe6a4442fcf59479265a9f61` |
| Único arquivo alterado | `modules/sucafina/Sucafinav1/test/product/wp10/native-host/routine-installed-publication.test.ts` |
| Blob base | `94cbf538fdb06949acf773941c437c8fd43a8a0e` |
| SHA256 base | `883ab148424655ad3f716fd283096e9e836119feacc8016d434ea43d5b288f4d` |
| Blob candidato | `9cb78aa7320e5e28fa43018cbd9ab94650523a5d` |
| SHA256 candidato | `cf88744e8bc83a53ead83b253e9d1a5775e48d0b6512dfac2645db5ca0264c7b` |

O candidato está em `package/`, a base exata em `base/` e a diferença em [own-diff.patch](own-diff.patch). O [change-manifest.json](change-manifest.json) registra os hashes e o [source-manifest.json](source-manifest.json) identifica cada fonte canônica lida e arquivada por MCP, conferida contra a árvore completa W25. Ausência no espelho parcial não foi usada como prova de arquivo novo.

## Falha observada e limite do diagnóstico

O [run 43615096939](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615096939), job `132508295747`, executou o snapshot `0b56a60ab2b66f123d2e9c375863cb48ff85788b` do produto W25. A seleção terminou com 41 passes e duas falhas em 43 testes de sete arquivos. O cleanup `132510432552` teve sucesso. Nesse arquivo C07, os quatro primeiros casos passaram e o quinto falhou em 538,08 ms. A outra falha da seleção pertence a Memory e está fora deste candidato. Fontes: [hosted-causality.json](hosted-causality.json) e o log bruto `evidence/W25/A-job-132508295747.raw.txt`, SHA256 `c370e59135e63629adc585c6b021ef1e31aebccacd1ae948b9dbd7474866cad4`.

A exceção registrada foi `RangeError: Cannot use a closed database` em `packages/core/src/database/sqlite.bun.ts:67`, durante a preparação de um statement. O quinto corpo já havia atravessado o registro da fonte residente real; ele é o caso que cria, arquiva, restaura e remove uma Core Session real. O stack disponível não inclui uma cadeia completa até `Session.create` e não identifica univocamente o singleton, o leitor capturado ou o caminho de refcount que reteve a conexão. O trecho pertinente foi preservado em [log-C07.txt](log-C07.txt).

A leitura estática mostra uma fronteira inadequada para a intenção dessa fixture: o helper W25 adquiria e encerrava o root inteiro da aplicação separadamente em cada caso, enquanto os leitores de Location e Session capturam serviços do root. O adaptador SQLite real encerra o handle nativo em finalizers. O candidato remove a liberação do Core entre esses cinco casos. Isso é uma correção concreta do ciclo de vida da fixture; a resolução funcional da falha e o proprietário exato da conexão fechada ainda dependem do próximo CI.

## APIs públicas e composição

| Fonte canônica W25 | O que sustenta |
|---|---|
| `effect/app-node-builder.ts`, blob `f81f07cd9f4876742c1e8039f4453bf31fd55f58` | Constrói o mapa real de Locations e entrega o contexto completo da aplicação às aquisições lazy. |
| `effect/layer-node.ts`, blob `4d1491948140e05894193050f07b664163a69912` | `compile` admite replacements do tipo Layer; `Layer.succeed` pode fornecer as instâncias reais capturadas. |
| `location-service-map.ts`, blob `2f9f70c7edf21ab9e8d57eb6966aacab13c47c33` | As aquisições lazy recebem os exports concluídos do root. |
| `location-services.ts`, blob `b6eaefbc8dd8df2be112371c69b7791f462cf82e` | O LayerMap possui as Locations e seus serviços reais em escopo. |
| `database/sqlite.bun.ts`, blob `b2bc802d3215ff3d6276544240169adaf1663a98` | Statements usam a conexão real; finalizers encerram seus recursos. |
| `session.ts`, blob `00b276d8f2c9e634ae55a37e800fae388eb595e6` | Criação, archive e remoção continuam passando pelos serviços reais de Session e persistência. |

As seis fontes estão no [manifesto de fontes](source-manifest.json). A composição usa as mesmas APIs públicas e o mesmo `SessionExecutionLocal.node` já exigido pelo root instalado. Não copia engine, não cria `Tool.Context`, não substitui `Session.resume` e não introduz DB ou sessão simulados.

## Alteração do helper

O root é adquirido de forma lazy por `ManagedRuntime.make(AppNodeBuilder.build(...))`. Ele exporta `SessionV2`, `SessionStore`, `SessionExecution` real com o provider Local e `LocationServiceMap`. As duas dependências injetadas nas contribuições de cada fixture são exatamente `root.store` e `root.locations`, por `Layer.succeed`, sem casts.

Cada chamada de fixture cria instâncias novas das contribuições instalada e de publicação. `Effect.scoped` continua encerrando esses providers, a autoridade UI e o AuthoringStore daquela chamada. O quarto caso conserva sua contraprova de provider retido após disposal; ela passa a verificar essa recusa enquanto o Core compartilhado ainda permanece vivo.

As Locations permanecem sob o LayerMap real durante o arquivo inteiro. Depois das fixtures, `afterAll` aguarda `ManagedRuntime.dispose()` antes de tentar remover qualquer diretório temporário. As dependências não são substituídas por objetos que imitam suas interfaces. O custo adicional conhecido é manter até cinco Locations reais até o encerramento do arquivo; não há medição de desempenho nova.

A aquisição rejeitada não fica em cache: o runtime parcial é descartado, os erros originais e de cleanup são propagados ou agregados e a referência da Promise é limpa por identidade em `finally`. Um guard síncrono recusa duas fixtures ativas ao mesmo tempo. Isso preserva a premissa de execução serial em vez de permitir mistura de placement, providers ou autoridade.

Os diagnósticos `SF_PUBLICATION_LIFECYCLE` identificam o número da fixture e se o root já existia. `SF_PUBLICATION_LIFECYCLE_FAILURE` acrescenta a fase e a exceção original, que é relançada. Não há conversão de falha em sucesso.

## Preservação das provas

A comparação textual conferiu que o bloco dos cinco corpos de teste é byte exato, com SHA256 `7f67baf5f9da8fd1be1a9b59a8e9ab08f7ed5dd8c5de472a17cc395f1a66720e`. Permanecem 52 ocorrências de `expect(` no arquivo e cinco budgets de `120_000` ms. Esses números são contagens estáticas de fonte, não contagens de assertions executadas. A redução de cinco aquisições completas do root para uma também é uma estimativa estática, condicionada ao caminho de aquisição bem-sucedida.

Continuam intactos os casos positivos reais e as recusas por drift de skill, publicação revogada, knowledge indisponível, lease UI encerrado, troca de Location, projeto diferente, provider descartado, Session arquivada/removida e lease nativo encerrado. Não foi alterado nenhum corpo para acomodar um resultado observado. Detalhes em [verification.json](verification.json).

## CI necessário e limites

A seleção é o arquivo inteiro `Sucafinav1/test/product/wp10/native-host/routine-installed-publication.test.ts`, com todos os cinco casos e nenhum filtro. O [ci-selection.json](ci-selection.json) especifica a observação esperada: quinto caso completo, contraprova de disposal do quarto preservada e teardown sem erro oculto. O CHECK hospedado também deve confirmar os tipos das APIs Bun/Effect no novo SHA.

O candidato não foi executado, importado, testado, compilado ou verificado por typecheck local. Não houve browser, dispatch de CI ou mutação remota. Nenhum resultado do W25 se transfere para o candidato. Uma falha adicional de lifetime em outro arquivo ou no próprio Core continua possível e terá de ser diagnosticada pela execução hospedada.

Este ajuste não implementa `SfRoutineNativePort`, não habilita os cinco callables C07 e não inicia um Task governado. O quinto caso testa identidade e lease de publicação; seus identificadores de lease não constituem recibos de execução nativa. A lacuna de APIs e inputs confiáveis continua separadamente registrada no [audit W25](../W25-native-boundary/audit.json), SHA256 `dc56f01d6639df1d082b319bfed2078403cb3258f9336edf2b7a2630a31288fa`.

O próximo passo autorizado cabe à raiz: compor os bytes selados, publicar um novo SHA, executar CHECK e o arquivo completo hospedados e apresentar o novo SHA e seus recibos aos revisores independentes.

