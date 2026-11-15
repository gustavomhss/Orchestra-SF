# R2 — propostas inertes e fronteiras de egress

Estado: **HELD para revisão do owner e Actions. Nada nesta pasta foi aplicado ao produto.**

## Proveniência

Os três shared blobs foram lidos por GitHub MCP em `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85` e novamente em `d088708276b48f896ad4e0ecd2a95cb73dc413b1`; seus SHAs são idênticos nos dois commits. A série foi regenerada sobre W1 remoto congelado `d962e08b81a707f3536344614c1faa3e728917b8`. O preimage de `atlas-memory.ts` é o blob remoto `f68e20ef62f14c98ca9ccda9e2fec0a5c579b4de`, preservado em `preimages/atlas-memory69.before02.txt`; os demais blobs shared permanecem idênticos. Isto não representa execução da proposta em CI.

`R2-preimages.json` registra Git blob, SHA-256 e tamanho de cada preimage/postimage, além do hash das propostas. Os postimages completos estão em `postimages/*.txt`. Hunks foram gerados com `SequenceMatcher(autojunk=False)`, preservando as quebras de linha originais. Os arquivos `preimages/*.txt` são cópias literais de fontes efetivamente lidas, não arquivos históricos inferidos. A única execução local foi processamento de texto para gerar/identificar patches; nenhum teste, typecheck, build, aplicação ao produto ou mutação remota foi executado por este revisor.

## Série proposta

1. `01-capability-terminal-rank.HELD.patch` move a revalidação externa de `recallSfDecisions` para antes do segundo rank. A proposta pressupõe o rank69 que finaliza todas as observações canônicas em C08. Depois dele, comparação e `deliver` ficam síncronos. Esse passo reduz a janela do handler, mas não relê a seleção de negócio; isoladamente não é uma prova completa do consumidor.
2. `02-selection-final-hook.HELD.patch` depende do passo 1. Acrescenta ao rank um callback opcional, host-only, `beforeFinalize`, que termina antes da comparação canônica em C08. O callback não é persistido e não devolve um grant. Em `capabilities.ts`, ele relê `recallSelections`, confere a seleção e o input originais e revalida autoridade. Em `case-recall.ts`, ele executa o `read()` final já existente e sua revalidação, preservando o caso-fonte que pode não estar entre os candidatos. O retorno do rank é seguido apenas de comparações síncronas. Matches e ranked.cases anteriores são fixados por digest antes do await final. O consumidor reconstrói eventId/evidenceRefs e explicações exclusivamente de checked.records/checked.cases canônicos, compara o fingerprint completo e devolve os matches reconstruídos. Um flag local exige que o callback tenha realmente sido executado; um rank substituto que ignore o callback falha fechado.

A simples troca de ordem em `case-recall.ts` não é proposta: reler o caso-fonte antes de começar o rank permite que ele mude antes dos primeiros snapshots canônicos. A proposta com callback conserva essa checagem depois das leituras do rank e antes do fence que detecta novas alterações no estado.

A série não adiciona AsyncLocalStorage, WeakMap de resultados, cache de autorização, contrato global de capability, scanner extra ou terceira rodada de ranking. Uma segunda leitura de seleção em `capabilities.ts` pode materializar metadata; se isso mudar os snapshots já observados, o resultado deve falhar fechado. Compatibilidade e custo ainda precisam de Actions.

## Fronteiras que continuam HELD

| Fronteira | Fonte efetivamente lida | Último await após o rank/leitor | Consequência |
| --- | --- | --- | --- |
| Handler `sf_decision_recall` | `host-binding/capabilities.ts`, blob `eb14812f4e3e6545b9732a3930da6c2cececa81c` | `host.revalidate(call)` após o segundo rank | Propostas 1+2, prospectivas e não qualificadas. |
| Consumidor `createSfCaseRecall` | `decision-memory/case-recall.ts`, blob `03e75875386483c7e37dce3f7bb21189f3066774` | `read()` e `host.revalidate(call)` após o segundo rank | Proposta 2 preserva a seleção/caso-fonte; requer revisão e teste. |
| Dispatcher compartilhado UI/native | `host-binding/capability-dispatch.ts`, blob `6ba1b02eee73d44133c78599284f9772b26007b1` | `authority.revalidateDomainContext(context)` após `descriptor.handler` | Wrapper de handler69 não fecha esta janela. Não há hook async terminal no contrato atual. |
| Bridge nativo | `host-binding/sf-mcp-bridge.ts`, blob `bc00a2fe70bb37d6132369c3767388e544e18510` | transporte, provider conflict e `registry.revalidate(lease)` depois de dispatch | Continua fora da prova69. SessionV2/native: NOT_RUN. |

Nenhum patch executável de dispatcher/bridge foi produzido. Acrescentar um finalizador geral exige decisão de owner; repetir o handler completo depois desses awaits é uma alternativa sem cache, mas amplia significativamente o trabalho e a superfície de avaliação. Ambas ficam HELD. Não se removeu a revalidação compartilhada, não se concedeu bypass e não se consumiu novamente um lease.

## Qualificação que a69 pode entregar sem estes patches

A69 fecha seus leitores raw, `context.recall`, consumidor privado de integridade e rank, com provas funcionais/componentes cirúrgicas. A preservação35 selecionada inclui SQLite persistido, novo processo/PID, challenge, exit0 e `createSfCaseRecall` funcional. Isso não prova a corrida terminal dos wrappers externos, navegador/renderização/reload, modelo, skill carregada ou SessionV2. Os próprios witnesses35/69 distinguem identidades e ledger sintéticos de código de produção e dizem `nativeSessionWitness: false`.

A fixture WP02 chama `descriptor.handler` diretamente em seu método `dispatch`; ela não prova o `dispatchSfCapability` compartilhado. Nenhum PASS de função/componente deve ser promovido a PASS do dispatcher, bridge, AM05 integral, guards45 ou G4/G7/G8.

## Provas exigidas antes de qualquer aplicação

- Positivo com seleção/caso-fonte autorizados e dois candidatos distintos.
- Mutação do caso-fonte que não está no conjunto de candidatos durante a última releitura.
- Revogação real e corrupção de captura após as checagens de seleção, com zero reparo/append/scanner adicional.
- Callback ignorado, input/seleção alterados e tentativa de reutilizar observações.
- Regressores40 e restart35 completos, sem aumentar budgets ou filtrar as asserções.
- Para dispatcher/bridge, discriminadores na própria fronteira compartilhada e witnesses nativos pelo owner64; testes diretos de descriptor não substituem esses gates.

Integração permanece com60. Target observado: `d088708276b48f896ad4e0ecd2a95cb73dc413b1`; esta investigação não fez merge, rebase ou nova escrita fora do namespace69.
