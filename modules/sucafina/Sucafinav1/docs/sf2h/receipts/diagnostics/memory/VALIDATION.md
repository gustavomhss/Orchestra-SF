# Request cirúrgico ao owner WP10

## Estado e pré-condições

**NOT_APPLIED / NOT_RUN.** Estes arquivos são requests preparados para o protocolo existente; nenhum snapshot CI ou run novo foi criado por diagnose-memory. O validador canônico não foi executado localmente. Sua forma foi confrontada com o código publicado de validateRequest/locateTestPackage e com o request A26 existente.

Ler novamente o head/tree de `astra-wp10`, a PR #29, os runs e recibos antes de aplicar ou disparar. Fixar um único candidato e conferir o preimage completo em [patch-manifest.json](patch-manifest.json). A versão W27 é a proposta aplicável ao owner observado `ab8fb4f29d078d179742a77679ef85e5c549b114`; W26 é uma alternativa preservada para a investigação do snapshot original, **não instrução para reverter o owner**. Se o preimage divergir, o owner resolve apenas o conflito delimitado de instrumentação.

Inputs novos para intake seletivo:

- `modules/sucafina/Sucafinav1/test/product/diagnostics/memory/persistence-observer.ts`
- `modules/sucafina/Sucafinav1/test/product/diagnostics/memory/persistence-observer.test.ts`

A PR de diagnóstico não aplica os patches ao teste histórico. Não incorporar snapshots antigos de produto: consumir somente os dois blobs próprios e o patch correspondente ao teste atual.

## Terminal existente consumido e prioridade atual

A27 terminou antes da publicação: run 43624030665 / snapshot e336f3e945fc22ae737af9b2425186c25b46a43d, 59 pass/1 fail, cleanup 132537774635 success. Memory passou pelo retry e por stale.preserve, mas falhou aos 182.124,35 ms em staleAccess.preflight após captura corrompida: expected denied / received ok (historical-memory.test.ts:580:103). Não houve timeout nesse terminal, e a cauda de revogação final segue sem prova. Corrigir a divergência no consumidor real antes de declarar Memory concluído. A medição proposta pode acompanhar a próxima rodada necessária; não repetir A27 sem delta só para reconfirmar a falha.

## Sequência mínima e condicionada

1. **Qualificar o observador primeiro.** Intake dos dois arquivos próprios em candidato do owner e executar somente [request-observer.json](requests/request-observer.json), pelo test-ci existente. Um arquivo/um teste com ambos os modos e LocalStores reais. Sem scanner/modelo/Atlas simulado. Esse teste não prova Memory, autorização de negócio ou aceite nativo. Se falhar, corrigir o observador antes de gastar uma rodada histórica.
2. **Medição no candidato real.** Aplicar `patches/01-w27-measure.patch` somente se o blob histórico for `ee5c725ae78e0eba5c12600da80eb51b7173c2ed`; para outro head, reconciliar e registrar novo preimage/postimage. Manter modo `snapshots`. Executar [request-memory.json](requests/request-memory.json): somente o arquivo histórico completo, sem `-t`, sem alterar 225000/240000 ms e sem os outros sete arquivos do antigo corte A.
3. **Ler o terminal antes de decidir a contraprova.** Se o custo do classificador for material ou se houver outra razão concreta para validar sua remoção, aplicar `patches/02-w27-remove-classifier-copies.patch` sobre o postimage da etapa anterior. Repetir somente o mesmo request histórico no candidato alterado. Entre os candidatos A/B mudar apenas o modo do classificador, mantendo helper, phase logs, produtos, fixtures, assertions, probes e budgets idênticos.
4. **Se o classificador não dominar, não atribuir-lhe o timeout.** Usar os buckets da medição para delimitar a próxima hipótese: admissão versus corpo versus egress. Instrumentar internamente LocalStore ou a composição somente por novo patch delimitado do owner se o dado justificar. Não ampliar timeout nem repetir automaticamente uma suite inteira.

A execução histórica de medição é justificada por uma hipótese nova e falsificável: cópia recursiva de três snapshots para cada classificação aninhada. Ela acrescenta informação que A26 não contém. A etapa 3 é condicional; não há solicitação de três reexecuções de 225 segundos.

## Semântica das métricas

O log novo `SF_MEMORY_PERSISTENCE_TIMING` acompanha cada fase já instrumentada:

| Campo | Interpretação |
| --- | --- |
| `scopeInspectionCalls/Ms/Errors` | Quantidade, tempo síncrono e erros do accessor usado pelo classificador. Na contraprova, acessos fora de callback observado e de escopo expirado continuam reais. |
| `root/nestedSubmitToCallbackMs` | Após classificar, tempo até entrada no callback real. Inclui fila, conexão, BEGIN e preparo/decodificação; não isola lock. |
| `root/nestedCallbackInclusiveMs` | Tempo dentro do callback, incluindo filhos. Não somar com filhos ou com tempos de Atlas como wall time. |
| `root/nestedAfterCallbackMs` | Callback encerrado até settlement do driver, incluindo validação final/commit/rollback/cleanup onde existirem. |
| `root/nestedRejectedBeforeCallback(Ms)` | Tentativas recusadas antes de executar o callback e sua duração. |
| `persistenceCalls/rootPersistenceCalls/nestedPersistenceCalls` | As contagens existentes. Erro síncrono de classificação incrementa somente total e scopeInspectionErrors; não é entrada bem-sucedida no driver. |

O próprio observador acrescenta leitura de relógio, Promises e ALS, e pode perturbar microtasks. Manter a mesma instrumentação nas duas variantes limita esse fator; não o elimina. Somar tempos inclusivos de raízes concorrentes também pode exceder a duração da fase. Apenas a soma das medições síncronas do classificador representa esse trabalho direto sem overlap de awaits no mesmo thread JS; continua havendo overhead do relógio.

O marcador ALS é específico desta fixture, onde os caminhos transacionais passam pelo driver observado. Não exporta autorização nem constitui API geral de contexto do LocalStore. Nenhum consumidor de produto lê o marcador.

## Contraprova esperada e critérios de recusa

- Ambos os modos precisam preservar os resultados reais do teste curto: blob/snapshot, aninhamento, identidade de erro/retorno, rollback, raiz enfileirada, cancelamento e recusa do escopo encerrado.
- No histórico, manter as duas observações independentes em prepare/verify/accept-output, quatro contextos BCS agrupados e os probes/adicionais W27, se W27 for o candidato. Os counters não autorizam dispensar nenhum assert.
- Exigir as sondagens reais source/capture/principal/clock/lease/Request headers e o retry com nova prova. Para declarar o timeout resolvido no escopo do arquivo, também precisam ser alcançados stale.preserve e a cauda posterior, com resumo terminal PASS.
- Se a variante leve ganhar tempo mas diminuir os reads/observation/probes esperados ou deixar writers inalcançados, a hipótese não está validada.
- Se A e B usam produtos/fixtures/helpers distintos além do modo, não atribuir a diferença ao classificador.
- Se o run continuar falho, publicar exatamente a fase final, contagens e tempos, sem converter improvement parcial em correção concluída.
- Um green do teste curto ou do arquivo histórico não prova Session/modelo/residente, AM05 integral, concorrência global ou aceite de WP10.

## Envelope Actions e deduplicação

Protocolo consultado: `modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/CI.md` em `d3d411f7e2476a562a57aa7620823980eaf34e46`. Sources no owner W27:

| Fonte | Blob |
| --- | --- |
| .github/workflows/test-ci.yml | 9f078f4e37b758691bcd073e5590f05d5444392a |
| script/test-ci.ts | 6f67619958ce0567ea93dd66c53ae3aca242cb95 |
| script/test-ci-request.ts | 5007e48270b80c83eb719d35cec9e6343206a195 |
| script/test-ci-location.ts | ee07aaf93c54fa935e6c4e9d845aa73af3b464ee |
| script/module-registry.json | c0f283ebff3bd3d5c087c8c7d4e61c3e7b15e903 |

O registry resolve sucafina para `modules/sucafina`. Os requests usam runner bun, arquivo integral explícito, timeout padrão de request 120000 e Omni strict. O timeout explícito do corpo histórico continua 240000 e o cooperativo 225000; nenhum budget existente é elevado. O teste curto novo tem budget próprio de 30000.

O owner deve registrar W/tree e conferir hashes dos inputs antes de criar S. Via GitHub MCP: criar blob `.ci-run.json`, tree sobre W com somente esse arquivo acrescentado, commit S filho de W e só então ref única `ci-run-linux-astra-wp10-<Wcurto>-<requesthash>-<tentativa>`. Não executar uploader local com git/gh, editar workflow, alterar permissão ou disparar epic.

Deduplicar por árvore do candidato, request normalizado, workflows/validator, runtime/config/env, fixtures e seleção. Consultar Actions push runs, incluindo branch específica; não confiar em helper limitado a eventos de PR. No máximo um test-ci do WP10 em voo, aguardando terminal e cleanup anteriores. CHECK pode ter regra própria do owner; não iniciar outra fila concorrente.

Adotar uma execução equivalente existente se a identidade e a instrumentação coincidirem. Um A27 sem estes tempos pode prover resultado funcional, mas não mede retrospectivamente scopeInspectionMs. W27 CHECK e X exact-threshold não são prova de Memory. O estado de deduplicação desta entrega está em `publication-observation.json`; deve ser atualizado pelo owner no momento do dispatch.

## Recibo exigido após execução

Guardar W, tree, S, diferença envelope-only, request normalizado e seu hash, run/attempt/jobs/cleanup, logs/artefatos realmente disponíveis, arquivo efetivamente selecionado, controle Omni e resultados. Os patches desta entrega permanecem NOT_APPLIED/NOT_RUN até o owner publicar a identidade e a observação real. Nenhum resultado antigo pode ser reatribuído ao novo candidato.

