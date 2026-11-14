# Memory/Atlas — diagnóstico causal W26 e contraprova para WP10

## Conclusão e estado

**A falha terminal é o esgotamento do prazo global de Memory após trabalho repetido no host. `same-request-new-proof` é o ponto de esgotamento, não uma chamada Atlas demonstrada como bloqueada por 225 segundos.** A fase começou em 207.690 ms, com 17.310 ms do orçamento de 225.000 ms restantes; seu `finally` registrou 17.324 ms e `aborted:true`. As fases prepare, verify e accept-output já haviam consumido juntas 113.622 ms.

Há um defeito concreto de observação: o teste chama `currentSnapshots()` apenas para distinguir uma entrada raiz de uma aninhada. Quando existe escopo, esse método copia e valida os três snapshots. As 7.580 classificações aninhadas observadas em prepare implicam **22.740 cópias de snapshots somente para contar chamadas**. A quantidade é derivada da implementação e do contador; sua duração e predominância no timeout não foram medidas.

**Entrega:** diagnóstico, helper/teste próprios, patches versionados e requests preparados. **Patches em fonte compartilhada: NOT_APPLIED. Novos testes/checks: NOT_RUN. Predominância de um custo interno: NOT_PROVEN.** Não há declaração de correção funcional, aceite nativo ou aceite de WP10.

Fontes primárias: [run A26](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618475702), [job 132518644009](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618475702/job/132518644009), [teste W26](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts#L60-L85), [LocalStore](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/runtime/local-store.ts#L154-L173).

**Atualização antes da publicação:** o A27 do owner avançou além do timeout anterior e chegou a uma falha distinta de integridade de captura aos 182.124,35 ms. O terminal foi consumido nesta entrega; veja a seção A27 abaixo. Isso mantém o teste falho e não valida os patches propostos.

## Identidades e limite de escrita

| Objeto | Commit / árvore |
| --- | --- |
| Produto investigado W26 | `a1434e7ea7340aa1d1c8ce6bb48958b724218170` / `a9398de38c9e684d28c27b0188ab653e75bf3305` |
| Snapshot A26 | `dd53af531181d1b05e5081b765dbfecc2a6ba6a9` / `ab3895d693c0923a8e26aebe03654cce1854149d` |
| Branch de diagnóstico recebida | `diagnose-memory`, inicialmente no W26 |
| Owner encontrado durante a investigação | `astra-wp10@ab8fb4f29d078d179742a77679ef85e5c549b114` / `6b889a436fafe019580801edba3015d90fa75dfd` |
| Plano normativo | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| CI.md consultado | `sf2-control@d3d411f7e2476a562a57aa7620823980eaf34e46`, blob `c34ab425e0f3b7dc0899a05826829f38b5af84bb` |

A comparação W26→snapshot apresenta um único commit e somente `.ci-run.json` acrescentado. O resultado pertence à implementação W26. A PR desta frente tem destino `astra-wp10`; seus únicos arquivos novos ficam em `docs/sf2h/receipts/diagnostics/memory/` e `test/product/diagnostics/memory/`, sob Sucafinav1. Nenhum arquivo de produto ou teste do owner é alterado pela PR. A identidade final de entrega (head/tree) consta na descrição da PR e no retorno ao solicitante, sem tentar inserir no próprio commit seu hash autorreferente.

## O que o run demonstra

A26 terminou **45 pass / 1 fail, 46 testes em oito arquivos, 1.904 expects, 391,43 s**. Memory foi o teste falho, em **225.029,32 ms**. O cleanup 132521071078 terminou success e a API de artifacts retornou lista vazia. Omni reportou pass, uma declaração, dois spawns e zero delegações; isso não é prova de execução residente nativa.

| Fase de Memory | Duração registrada (ms) | Decorrido ao retorno (ms) | Entradas de persistência | Raiz / aninhada | C08 | Atlas chamada / ok |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| prepare | 37.782 | 41.206 | 11.030 | 3.450 / 7.580 | 786 | 2 / 2 |
| verify | 37.979 | 79.186 | 11.072 | 3.492 / 7.580 | 798 | 2 / 2 |
| accept-output | 37.861 | 117.079 | 11.072 | 3.492 / 7.580 | 798 | 2 / 2 |
| same-request-new-proof | 17.324 | 225.014 | 4.896 | 1.503 / 3.393 | 357 | 1 / 1 |

Cada uma das três fases positivas registra seis chamadas a `context()`, quatro dentro do escopo observado, e 188 fences de evidência. Somando apenas as fases instrumentadas: 64.118 entradas de persistência, 19.055 classificadas raiz, 45.063 aninhadas, 4.578 leituras C08 e **14 chamadas Atlas / 14 retornos ok**. “Duas observações Atlas” é a contagem por fase positiva, não a contagem do teste inteiro.

As linhas 994–1050 e 1063–1071 do log decodificado estão preservadas em [A26-memory-excerpt.log](evidence/A26-memory-excerpt.log); [evidence.json](evidence.json) conserva fases, contagens, identidade e limitações. Os campos phaseMs/elapsedMs já foram arredondados pelo logger. `returned` é emitido no finally: não significa sucesso da fase final. O marcador de `stale.preserve` não aparece, e a cauda posterior de lifecycle, cancelamento, output, captura e revogação não recebe crédito.

O helper de [deadline](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/test/product/wp10/integration/composition-test-deadline.ts#L1-L26) inicia um relógio único e não o reinicia por fase. Isso explica causalmente o ponto de parada. Não localiza sozinho o microcusto.

## Caminho real de amplificação

| Fronteira no W26 | Operação real e consequência |
| --- | --- |
| [input-producer-memory.ts:16–24](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/apps/cli/src/sucafina-product/input-producer-memory.ts#L16-L24) | Executa duas observações independentes completas e compara suas identidades. Preservar ambas. |
| [analysis-memory-evidence.ts:64–82](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/apps/cli/src/sucafina-product/analysis-memory-evidence.ts#L64-L82) | Revalida autoridade, lê caso, chama CaseRecall, resolve contexto, relê caso e revalida ao sair. |
| [case-recall.ts:44–77](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts#L44-L77) | Lê caso/candidatos, ranqueia, confere memória dos matches, ranqueia novamente e repete a leitura. As releituras são provas reais, não um loop infinito demonstrado. |
| [atlas-memory.ts:188–247](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts#L188-L247) | A chamada “Atlas” agrega C08/outbox/partição, resolução direta das referências (224/241), provas de continuidade (228/242), caso e revalidações finais. O factory Atlas de leitura está em 235; não há scanner nesse caminho de recall. |
| [business-context.ts:54–108](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts#L54-L108) | Resolve ancestry e filhos, revalida e prova continuidade. O contador de context() não conta todas as chamadas diretas a resolve() nem as provas internas. O cache existente é local a uma chamada e não autoriza cache entre chamadas. |
| [decision-host.ts:255–310](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/procurement/decision-host.ts#L255-L310) | Para fonte histórica, lê arquivo original, emite identidade atual, prova continuidade física, lê projeção, relê original e repete emissão/continuidade. A prova explícita posterior volta a ler origem/continuidade. |
| [product-authority.ts:87–123](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/integration/product-authority.ts#L87-L123) | Reautentica usando snapshots defensivos quando já há escopo; fora dele abre transação de dashboard. Nem toda revalidação cria uma conexão. |
| [state-provider.ts:28–39](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts#L28-L39) | Lê C08 em transação, autoriza, copia estado, executa callback e autoriza novamente. |
| [local-store.ts:119–136,154–205](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/runtime/local-store.ts#L119-L205) | Raiz passa por fila/conexão/BEGIN IMMEDIATE e lê/decodifica três snapshots. Caminho aninhado copia o snapshot selecionado. O contador do teste acrescenta mais três cópias defensivas antes de cada entrada aninhada. |

A multiplicação é evidência de execução e de composição. Os logs não oferecem um perfil exclusivo capaz de escolher entre custo de cópia/validação/digest, repetição de qualificação, admissão SQLite ou espera de lock. Os números “root/nested” medem **entradas em APIs**, não conexões, consultas, commits ou fsyncs.

## Defeito específico de instrumentação e correção proposta

W26, [linhas 68–78](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts#L68-L78), e W27, [linhas 69–79](https://github.com/gustavomhss/Orchestra-SF/blob/ab8fb4f29d078d179742a77679ef85e5c549b114/modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts#L69-L79), usam `driver.currentSnapshots?.()` só para escolher o contador. [LocalStore:154–161 e 444–478](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/runtime/local-store.ts#L444-L478) comprova a cópia recursiva e a validação dos três snapshots.

Correção proposta: **classificar pelo escopo do callback real, sem materializar snapshots apenas para contar**. O marcador fica em AsyncLocalStorage privado do observador, entra apenas após o driver admitir o callback e fecha em finally. Ele não concede autoridade, não é consultado pelo produto e não reutiliza resultados. Continuam reais a execução, as opções/sinais, os argumentos dos callbacks, retornos, erros e todas as sondagens/assertions de snapshots existentes fora desse contador.

O pacote oferece duas etapas separadas:

1. **Medir:** integrar o observador em modo `snapshots`. Ele executa uma vez a mesma classificação já existente e registra seu tempo síncrono. Acrescenta tempos de entrada→callback, corpo e saída, separados por classificação; preserva os contadores antigos.
2. **Contraprovar/corrigir:** mudar somente o modo para `callback-scope`. Não aplicar a mudança como conclusão de performance antes de ler a medição. O teste próprio exercita LocalStore real, aninhamento, filas, cancelamento e escopo encerrado; permanece NOT_RUN nesta entrega.

[patch-manifest.json](patch-manifest.json) fixa preimages, postimages, versões e dependências. Os patches W26/W27 são alternativas de integração, não devem ser aplicados em sequência. A contraprova pressupõe o patch de medição correspondente. Não editar manualmente o source compartilhado nesta branch.

## Trabalho simultâneo do owner

O WP10 publicou W27 enquanto o diagnóstico partia de W26. W27 já qualifica a partição inteira para agrupar **uma** observação Atlas real em escopo lexical de records, mantendo a independência das duas observações externas. Não reapresentamos esse agrupamento como uma correção nossa.

Fontes lidas: [composição W27](https://github.com/gustavomhss/Orchestra-SF/blob/ab8fb4f29d078d179742a77679ef85e5c549b114/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-recovery/preparation-W27/agents/root/W27-memory-observation-composition/README.md), [participação v2](https://github.com/gustavomhss/Orchestra-SF/blob/ab8fb4f29d078d179742a77679ef85e5c549b114/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-recovery/preparation-W27/agents/ci/W27-record-participation-v2/README.md), [R1 v2](https://github.com/gustavomhss/Orchestra-SF/blob/ab8fb4f29d078d179742a77679ef85e5c549b114/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-recovery/preparation-W27/independent-preflight/R1/preflight-W27-memory-v2.md).

O preflight R1 é de fonte e mantém **HOLD funcional**. W27 também reconhece scans lineares dos predicados retidos a cada liveness check, potencialmente quadráticos no conjunto. E LocalStore ainda reserva o writer via BEGIN IMMEDIATE mesmo com commit:false. Nenhuma dessas observações demonstra que lock ou predicados sejam o custo dominante de W26.

A alteração do contador permanece aplicável como proposta independente: W27 conserva as duas chamadas classificatórias a currentSnapshots. A aplicação ao owner exige conferir novamente o blob completo; se mudou, rebase limitado pelo owner, sem sobrescrever seu trabalho.

O observador acrescenta timers, Promises e ALS e pode perturbar a ordem de microtasks. A contraprova deve manter o mesmo helper e os mesmos logs nos dois candidatos, alterando somente o modo do classificador. Essa comparação não elimina o overhead de medição.

## Atualização terminal A27 consumida antes da publicação

O run do owner [43624030665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624030665), job **132535810515**, terminou **59 pass / 1 fail, 60 testes/oito arquivos, 1.447 expects, 297,68 s**. Snapshot `e336f3e945fc22ae737af9b2425186c25b46a43d`, tree `56b50dd0bab45311b7859f30179eb3d91ea68f32`: W27 mais somente .ci-run.json. Cleanup **132537774635 success**; artifacts vazios; Omni pass com uma declaração/dois spawns/zero delegações. Não foi disparado por esta frente.

**Memory não expirou nesse run. Falhou por assertion aos 182.124,35 ms.** same-request-new-proof concluiu em 12.398 ms, decorrido 157.725 ms; stale.preserve concluiu em 837 ms, decorrido 159.119 ms. A falha agora é [historical-memory.test.ts:580](https://github.com/gustavomhss/Orchestra-SF/blob/ab8fb4f29d078d179742a77679ef85e5c549b114/modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts#L569-L585): após corromper a captura persistida, a leitura Atlas da linha 577 devolveu unavailable conforme exigido, mas **staleAccess.preflight retornou ok, esperado denied**. Os três probes finais após access.allowed=false não foram alcançados. O arquivo inteiro continua falho.

| Fase positiva | A26 → A27 (ms) | Persistência A26 → A27 | Raízes A26 → A27 | Aninhadas A26 → A27 |
| --- | ---: | ---: | ---: | ---: |
| prepare | 37.782 → 27.126 | 11.030 → 9.996 | 3.450 → 2.216 | 7.580 → 7.780 |
| verify | 37.979 → 26.648 | 11.072 → 10.038 | 3.492 → 2.258 | 7.580 → 7.780 |
| accept-output | 37.861 → 26.442 | 11.072 → 10.038 | 3.492 → 2.258 | 7.580 → 7.780 |

As três fases positivas somam **80.216 ms**, versus 113.622 ms em A26. A diferença observada é 33.406 ms, em runs distintos; não é uma atribuição exclusiva de milissegundos à alteração. Cada fase preservou duas chamadas/conclusões canônicas Atlas, duas agrupadas e quatro contextos BCS agrupados. Houve menos 1.234 entradas raiz, 1.034 entradas totais, 100 fences e 96 C08 por fase, com mais 200 chamadas aninhadas. O classificador ainda implica 23.340 cópias extras por fase positiva W27: cálculo estrutural de 7.780 classificações aninhadas × três snapshots, não um contador independente nem duração medida.

Essa observação reforça a localização do custo na amplificação de leituras da composição e mostra o avanço real do owner. Não mede isoladamente clones, lock, digest ou scans de pins. Não demonstra que o teste completo passou dentro do prazo.

O consumidor [analysis-stale-commit.ts:37–82](https://github.com/gustavomhss/Orchestra-SF/blob/ab8fb4f29d078d179742a77679ef85e5c549b114/apps/cli/src/sucafina-product/analysis-stale-commit.ts#L37-L82) é **byte idêntico em W26/W27**, blob `9f574a7573538c2a46796dfd650fadbac052dc80`. O preflight verifica o contexto histórico via context.context, mas não chama diretamente o recall Atlas que recusou a captura. Isso delimita a próxima investigação de integridade; não atribui automaticamente a falha a cache nem prova que W27 a introduziu. A correção desse consumidor pertence ao WP10 e deve conservar o positivo stale.preserve, a autoridade por chamada e a verificação final de commit.

A prioridade do owner mudou: corrigir essa divergência de captura e aproveitar a próxima qualificação necessária para medir custo residual, se necessário. Não repetir A27 sem delta e não iniciar uma rodada histórica somente para reconfirmar a falha. [Excerto A27, linhas 980–1042 e 1057–1064](evidence/A27-memory-excerpt.log); identidade/fases completas em [evidence.json](evidence.json).

## Contraprova econômica e decisão

Requests completos e instruções estão em [VALIDATION.md](VALIDATION.md). Um request seleciona somente o teste do observador; outro seleciona somente o arquivo histórico completo. O mesmo request histórico é reutilizado em candidatos distintos de medição e contraprova. Não há filtros de nome, ampliação de timeout, epic ou full suite.

| Medida nova | O que permite decidir | O que não permite afirmar |
| --- | --- | --- |
| Tempo síncrono do classificador | Parcela direta causada pela instrumentação; comparar original versus callback-scope no mesmo produto/fixture | Resultado de W26 não se transfere a W27; um green isolado não prova ganho causal |
| Entrada→callback raiz | Custo de admissão/conexão/BEGIN/decodificação, inclusive espera | Não chamar o bucket inteiro de “lock wait” |
| Corpo do callback | Trabalho real durante a transação, incluindo filhos | Tempos inclusivos de pais/filhos não podem ser somados como tempo de parede |
| Saída após callback / falha antes de callback | Custo de egress/commit/rollback/cleanup ou admissão recusada | Não inferir SQLs, deadlock ou engine lento por contagem |
| Contagens e todas as assertions preservadas | Contraprova não obteve velocidade removendo observações/probes | Fixture continua sem provar inferência/Session/residente nativo |

Se o tempo do classificador for pequeno, rejeitar a hipótese de que ele domina o timeout. Se admissão dominar, medir queue/retry/conexão/decode no LocalStore **somente por novo patch para o owner**. Se o corpo dominar, focar continuidade/C08/predicados do candidato observado, sem cachear autorização ou retirar testemunhas.

O W25 confirma a natureza cumulativa: retry começou em 185.504 ms e stale.preserve retornou em 203.067 ms; W26 só chegou ao retry em 207.690 ms. W26 reduziu 352 entradas de persistência por fase positiva, mas seus tempos foram maiores. São runs distintos, não um benchmark controlado nem prova de regressão causada pelo W26. [Recibo W25](https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-recovery/preparation-W26/W25-A/terminal.json).

## Preservação e limite de aceite

A proposta mantém duas observações independentes, revalidação de autoridade/C08/fontes/Request/período/lease, ancestry/replay, writers reais, todos os asserts e os limites de 225.000/240.000 ms. Não altera engines, política/algoritmo Atlas, permissões ou runtime. O plano [WP10](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) e [CI.md](https://github.com/gustavomhss/Orchestra-SF/blob/d3d411f7e2476a562a57aa7620823980eaf34e46/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/CI.md) orientam a seleção e a aplicação pelo owner.

Não houve execução local de produto, dispatch de CI, alteração de branch alheia ou mensagem a terceiro. A entrega encerra esta investigação documental com próximo passo concreto; a correção do timeout e a prova da parcela dominante permanecem dependentes da execução hospedada pelo WP10.

