# R1 — W27 Memory / participação privada v1

**Parecer: HOLD da v1 por bloqueio próprio de fonte.** Este checkpoint é independente, anterior à publicação e não constitui um parecer FINAL nem aceite de critério.

Revisor: R1, `/root/independent_r1_w16`. Não sou autor de produto ou testes. Não executei produto, testes, typecheck, build ou browser localmente e não fiz mutação remota. Corte: `2026-11-14T17:40:39.582186+00:00`. Base imutável W26: `a1434e7ea7340aa1d1c8ce6bb48958b724218170`, árvore `a9398de38c9e684d28c27b0188ab653e75bf3305`. W27 ainda sem SHA de candidato neste parecer.

## Bloqueio R1-W27-PARTICIPANT-EGRESS-01

**Severidade alta; composição da v1 bloqueada.** Em `apps/cli/src/sucafina-product/procurement-record-read-scope.ts`, blob `b6d0fee3e7b267d2deb484350e630dbf887d7cf9`, o filho concluído registra seu predicado `current` no pai (linha 104), mas o `finally` do callback da transação apaga `scope.pins` na linha 179. O `await` de `persistence.transaction` só termina depois, na linha 180. A linha 181 verifica somente `current()` do pai.

A sequência estática problemática é: o filho completa a leitura canônica; o pai completa sua última observação protegida; o callback fecha o escopo e apaga os predicados; a transação ainda pode estar em encerramento; o reader ou os refs de entrada somente do filho mudam; a verificação exterior observa apenas o pai. A composição real usa readers distintos no escopo Memory e no filho de evidência, de modo que o pin do pai não substitui o do filho. Não alego ter executado essa sequência nem demonstrado um exploit: o bloqueio decorre diretamente da ordem de callback, limpeza e `await` na fonte.

O teste v1 das linhas 195–219, blob `226ce02c006221e5a55fcb10605d7087ef9d788a`, muda reader/input ainda dentro do trabalho do pai. Isso cobre um desvio anterior ao snapshot final, sem cobrir o intervalo de encerramento da transação.

**Correção requerida:** manter os predicados dos participantes concluídos até a verificação síncrona posterior ao `await` exterior, conservando o fechamento lexical para novas participações. A regra deve incluir os owners aninhados qualificados de modo independente e seus filhos. A contraprova precisa injetar a mudança após o callback protegido real terminar e antes de a Promise da transação se resolver, exigir `changed`, uma execução canônica real, ausência de escrita/retry e manter o caso positivo inalterado. A prova funcional deverá ocorrer no CI hospedado do candidato publicado.

## Observações independentes de fonte

A v1 limita a participação aos refs completos, Request/call e dependências exatas e executa o produtor canônico em cada filho, com nova autenticação e observações de ambiente. O helper Memory inspecionado conserva os pins de binding, lease, seleção, reader, método/URL/todos os headers, estado completo, snapshots e fences de fontes. Os namespaces `cases` e `atlas` são autorizados por leituras reais próprias.

A closure Atlas considera o caso e a partição autorizada inteira; a deduplicação usa o digest completo das referências. O caminho agrupado permanece restrito a records e exclui cálculo e closures mistas/sem suporte. O callback canônico é executado uma vez; fallback por `unsupported` só cabe antes de seu início. Divergência, duplicação ou alteração de retorno recusam a observação. Nenhum desses pontos elimina o bloqueio de encerramento do helper genérico.

O wiring de negócio passa o callback `memoryRecordRead` existente ao helper. No teste histórico, contei 84 linhas anteriores com `expect` e 92 novas, com todas as anteriores preservadas em ordem. A cauda iniciada por `// All races start after a complete canonical Atlas read has succeeded` permanece byte a byte. Os limites de 225.000 ms cooperativos e 240.000 ms do Bun permanecem iguais. São constatações estáticas, sem conclusão de desempenho.

## Identidade e selos

| Fonte | Blob Git | SHA-256 |
|---|---|---|
| `procurement-record-read-scope.ts` | `b6d0fee3e7b267d2deb484350e630dbf887d7cf9` | `4e56d0976c8428ade49f7787f7f1fa768ee308be0b4e5075339e9c4a5c3148bc` |
| `procurement-record-read-scope.test.ts` | `226ce02c006221e5a55fcb10605d7087ef9d788a` | `4c97de9e56f936554b1b8adc6b745e0c3670a286b2bf659b80e1fe96b9e7630d` |
| `memory-case-read-scope.ts` | `ba55d4f1624dabed660e58d3d8b787bd991acd7a` | `26f577d698afd62bd0b73c508f44ba7eafcf00d8e3bb167916c2f23f11d5ba08` |
| `business-services.ts` | `385dd1998ec3fb73b32f77ab3dec9c93beb440d1` | `82d182ce0ae3cff5f7346d4b7f61519440316c37a74751687277744d8d673ef2` |
| `historical-memory.test.ts` | `ee5c725ae78e0eba5c12600da80eb51b7173c2ed` | `7af2197cbad8b0456dab995d097ea86e9468e8d560cc58546f57e1c16b7e99fd` |

Recalculei os hashes de todos os 9 membros do selo genérico v1 e dos 13 membros do selo Memory: todos coincidem. O selo genérico tem SHA-256 `e36cf86214eb31a0bf206aa6a942e6a6ec202467d6f928843b21818d0d80291c`; o selo Memory tem `6eb52791d8131151081f8d0af1993ccd018ccb1fe03fc864f10ab10085c9cd7e`. O overlay do root ainda tinha audit draft no corte e foi identificado pelos bytes observados, sem atribuir a ele selo final.

Também comparei os dois helpers da base W26 obtidos por GitHub MCP ao snapshot congelado: `7438cac1582ec97b4e55fcef0494554a21e9e7b4` e `bd4701de1dabd10be4b19253981d288108c2a3f7` coincidem integralmente. O inventário e as comparações constam no arquivo de auditoria correspondente.

## Evidência e limites

O run histórico W26 A `43618475702`, job `132518644009`, S `dd53af531181d1b05e5081b765dbfecc2a6ba6a9`, terminou com 45 testes passando e um falhando em 46 testes/8 arquivos, sem erros ou skips: Memory alcançou o limite cooperativo de 225 s. Isso motiva a nova composição; não é prova W27. Nenhum terminal W27 é atribuído a este checkpoint.

Reconteio do pack: 171 critérios literais e sete tasks; nenhum critério foi promovido. A disposição histórica dos 128 inputs estrangeiros arquivados e 131 somente leitura permanece preservada; este foco não refez a auditoria integral de cada arquivo arquivado. Aceite nativo, runtime residente, Task/knowledge governado, viabilidade financeira completa, epic global e integração permanecem fora deste parecer.

O próximo passo é uma revisão separada de `agents/ci/W27-record-participation-v2`, mantendo este checkpoint intacto. Um parecer FINAL exige o candidato definitivo publicado e seus terminais hospedados atuais.
