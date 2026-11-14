# W27 — observação causal do limiar exato pelo host

Pacote autoral de diagnóstico WP10, pronto para composição e CHECK/X hospedados. Não é correção de desempenho comprovada nem parecer independente. Nenhum arquivo de produto, branch ou recibo anterior foi alterado por este pacote.

## Evidência terminal usada

O candidato W26 `a1434e7ea7340aa1d1c8ce6bb48958b724218170`, árvore `a9398de38c9e684d28c27b0188ab653e75bf3305`, foi executado no snapshot `4650ebf5948747a49f04120070765aa6317e6fd8`, run **43619479808**, job **132521664604**. O resultado real foi **0 pass / 1 fail / 1 teste / 1 arquivo / 3 expects / 285,82 s**, com cleanup **132523530424 success** e artifacts API vazia.

O fixture concluiu em **9.640 ms**. A fase `host.evaluate-and-store` consumiu **275.640 ms**, até o deadline cooperativo de **285.000 ms**, com elapsed total **285.285 ms**. Foram observadas **1.934 chamadas à API environment nessa fase, 2.054 no total**. Essas contagens não medem conexões físicas, SQL, commits nem decisões distintas de autoridade.

O bruto tem 74.559 bytes, SHA256 `11eda6cac42c499c5262a5f7ca5dea483bcf6e3b8eff52e8478e79050408a7bc`. O índice normalizado tem SHA256 `5f09a625c7d16252a2c5f6717c8fcc13c17cedad75d7548d76f65eb343428e7d`. Ambos, a triagem e seu selo estão indexados em `source-manifest.json`; o log não foi duplicado neste pacote.

A execução não alcançou as asserções do resultado, persistência, releitura recomposta, retry e revogação. Não se atribui nenhum aceite a essas etapas.

## Alteração proposta

Apenas o arquivo completo `modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-exact-threshold.test.ts` é substituído por seu overlay próprio. O helper observacional usa os objetos públicos reais retornados pela composição e encaminha **o mesmo receiver, os mesmos argumentos exatamente uma vez, o mesmo valor retornado e o mesmo erro lançado**. A delegação usa `original.apply(this, args)` tipado; não exige pressupor que métodos ignorem `this`.

Não há nova API de produto, resultado numérico sintético, cache de cálculo, alteração em produtor estrangeiro, nova autorização ou relaxamento de fence. Os wrappers do host principal e os compartilhados são instalados logo após o factory real do fixture, antes das operações e da preparação dos cenários. Os do host recomposto são instalados antes da primeira releitura. As referências ficam estáveis durante a operação e são restauradas apenas no cleanup LIFO, antes do dispose de suas composições.

Os eventos `SF_EXACT_THRESHOLD_TRACE` registram chamadas e correlação assíncrona por `id`/`parentId`:

| Escopo | Informação observada | Limite da observação |
| --- | --- | --- |
| `primary` / `recomposed.hostUnits.issue/resolve/revalidate` | Quantidade, duração e status; seleção de units.issue | Conta somente chamadas por esse objeto exposto. O produto possui units internas; chamadas lexicais a issue/resolve não são inferidas. |
| `primary` / `recomposed.planner.simulateScenario` | Cada amount/targetRef recebido pelo produtor real, duração e status | Não equivale ao callback lexical completo de preview. O comparador também lê cenário, fonte e cobertura antes/depois. |
| `shared.scenarios.resolve/resolveMany` | Observações simples e em lote, referências, quantidade e duração | Um lote é contado como uma chamada real, não como um número presumido de leituras físicas. |
| `shared.results` / `cases` / `evidence` / `sources` | Leituras atuais/históricas, writes, resultados e tempo inclusivo | Reflete os crossings desses métodos; closures que guardaram uma função original podem não passar pelo wrapper. |
| `sensitivityBindings.bind/read` e `proof.verifySensitivity` | Entrada, término, status e parentesco das recertificações reais | Mostra se bind/read/proof foram alcançados. Não produz nem substitui sua prova. |

Chamadas críticas são emitidas individualmente. As demais emitem as duas primeiras, potências de dois, retornos de pelo menos 1.500 ms e recusas/erros; **todos os crossings entram nos contadores**. O callback environment já existente emite um pulso no máximo a cada 15 segundos, com frames ativos e totais, sem timer adicional. O evento final é emitido mesmo se o deadline/cleanup lançar erro. Como o cleanup original aborta o sinal também no encerramento normal, `finished.aborted` isoladamente não demonstra deadline: devem ser lidos o terminal e os eventos de fase.

As durações são **inclusivas e sobrepostas**. Um resolve pode conter leituras de results e evidence; somá-las como tempos disjuntos seria incorreto. As arrays são rotuladas por tamanho, sem inventar status individual. A observação acrescenta algum overhead e precisa de CHECK hospedado; ela não promete uma execução mais rápida.

## Mecanismo estático e hipótese ainda aberta

O factory publicado faz units.issue, limites inferior/superior, anchor analítico, vizinhos IEEE e eventual busca no intervalo de bits. Conserva os dois witnesses adjacentes finais e reemite units. Cada probe chama preview real. A persistência também valida samples, escreve, vincula e relê canonicamente o resultado. O verifier atual recertifica o domínio e os limites de um certificado exato persistido; não se deve afirmar que toda recertificação refaz a busca binária.

O log X26 não indica qual dessas partes consumiu o tempo. A próxima execução deve localizar a última chamada ativa, os amounts já simulados e se binding/proof foi alcançado. Funções capturadas lexicamente podem ultrapassar um wrapper de propriedade: **zero chamadas registradas num wrapper não prova ausência de execução do factory**. Nenhum escopo readonly de Calculation foi transplantado para Sensitivity e nenhum cache numérico foi introduzido.

## Preservação e validação realizada

`static-validation.json` registra a inversão das nove inserções/substituições de instrumentação e a remoção do helper: o resultado coincide byte a byte com o teste W26. Preservados **1 teste completo, 40 expects, dados de duas fontes, três samples, thresholds e contraprovas**; budgets continuam **300.000 ms externo / 285.000 ms cooperativo**. A request X26 permanece reutilizável byte a byte; não foi disparada outra execução por este autor.

Foram conferidos hashes de **18 arquivos congelados** contra a árvore W26, **6 fontes de evidência** e a presença dos imports relativos na árvore. O novo import é o builtin `node:async_hooks`. Não houve import de produto, teste, build ou typecheck local. Essas verificações estáticas não substituem CHECK/X hospedados ou as três revisões independentes.

## Aplicação e próximos passos

1. Root compõe o único path próprio indicado em `DELIVERY.json`, sem substituir factories estrangeiros ou editar outras fontes.
2. CHECK do sucessor verifica tipos; X usa o mesmo arquivo completo e request W26, com budgets preservados.
3. A triagem usa o trace para propor correção causal separada, caso o timeout permaneça. O resultado hospedado mantém sua própria identidade W/S/run/job.

Não há aceite nativo, global, financeiro completo ou dos 171 critérios. A cobertura training continua explicitamente pendente no fixture; isso não representa promoção humana nem cobertura financeira completa. A execução de releitura usa outro serviço/proof sobre o mesmo store aberto, sem alegar restart durável.
