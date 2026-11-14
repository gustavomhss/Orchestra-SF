# W27 — Escopo lexical de uma observação real de Atlas Memory

**Estado: candidato autoral isolado, selado para composição e ainda não executado.** Este pacote contém somente a alteração própria de `apps/cli/src/sucafina-product/memory-case-read-scope.ts`. Não altera o espelho central, contratos ou produtores estrangeiros, testes, budgets, recibos antigos ou branches. É trabalho de builder; `FINAL=false` e não substitui R1/R2/R3.

## Base e identidade do candidato

| Elemento | Identidade |
| --- | --- |
| Produto W26 | `a1434e7ea7340aa1d1c8ce6bb48958b724218170` |
| Árvore W26 | `a9398de38c9e684d28c27b0188ab653e75bf3305` |
| Blob anterior do helper | `bd4701de1dabd10be4b19253981d288108c2a3f7` |
| SHA256 anterior | `d8ffc62f8e9c2c9bb49dcbff0ef3324154f4369a8db2184838f11e6a8f16c4db` |
| Blob candidato | `ba55d4f1624dabed660e58d3d8b787bd991acd7a` |
| SHA256 candidato | `26f577d698afd62bd0b73c508f44ba7eafcf00d8e3bb167916c2f23f11d5ba08` |

`manifest.json` registra os bytes de base e candidato. `source-manifest.json` prende as dependências lidas à árvore completa publicada W26; `import-closure.json` registra a resolução textual dos imports. `changes.patch` é o delta contra essa base congelada. Os hashes de todos os artefatos estão em `seal.json`.

## Falha hospedada que motivou o delta

O resultado terminal W26 A pertence ao run `43618475702`, job `132518644009`, snapshot `dd53af531181d1b05e5081b765dbfecc2a6ba6a9`. São 45 testes aprovados e uma falha, em 46 testes e oito arquivos. O único teste que falhou foi `historical-memory.test.ts`: o prazo cooperativo cumulativo de 225000 ms terminou durante `memory.same-request-new-proof`. O orçamento externo de 240000 ms permaneceu intacto. A origem é `evidence/W26/normalized/A-authority-lifecycle/terminal.json`; o log bruto tem SHA256 `b4b41f42838860c118967c8a08182f9f0cf2af01835bd2b1cf3ce8817c8f7f41`.

Na fase positiva `prepare`, o log W26 mediu 37782 ms, 11030 invocações de persistência, 786 chamadas C08, 24 leituras de caso, 40 testemunhas externas de caso e 188 testemunhas com a marca de evidência. Houve seis contextos BCS, quatro agrupados, e **duas leituras reais de Atlas, ambas concluídas**. Os 11030 eventos se dividem em 3450 invocações fora de uma raiz retida e 7580 aninhadas; são invocações da API instrumentada, não commits físicos nem conexões SQLite.

As 188 testemunhas incluem as raízes genéricas que envolvem leituras canônicas de caso. A divisão em 94 pares é uma inferência estrutural sobre observações de duas testemunhas, não uma medição independente de 94 chamadas ao resolver de evidência. Não há ganho de tempo ou contagem W27 medido neste pacote.

## Causa e mudança delimitada

No caminho elegível, a observação já concluiu uma prova canônica do caso e a conservou no escopo lexical. Uma chamada real de Atlas volta a consultar esse caso e vários leitores próprios voltam a abrir testemunhas completas para referências que pertencem ao mesmo conjunto de fontes. W26 preserva corretamente os produtores e suas verificações, mas repete fronteiras próprias que contribuem para o prazo cumulativo. A proposta mantém o trabalho canônico e permite compartilhar somente a qualificação lexical já concluída, sob um conjunto conservador de referências completas.

O novo parâmetro opcional `readMemoryCanonical(records, call, work)` recebe o tipo próprio `SfProcurementRecordObservation<MemoryResult>`. Ausência do callback, ausência da prova de caso concluída ou inelegibilidade anterior ao trabalho mantêm o caminho canônico. Não é criada uma API estrangeira, nem uma autorização, uma projeção ou um resultado sintético.

O processo de admissão tem três momentos separados:

1. A testemunha externa real de `cases` conclui e guarda hashes privados do estado C08 inteiro, dos três snapshots completos e dos três source fences. Conserva também os vínculos do ambiente, principal, Request, todos os headers, binding, lease e seleção já existentes.
2. Uma leitura C08 real e separada de `atlas` deriva o owner com `deriveSfMemoryOwner`, usando o contexto e o caso autorizados. Ela reúne as referências completas do caso atual e da partição inteira daquele owner. Exige os mesmos bytes protegidos da testemunha anterior. A ausência de grant, partição compatível ou closure elegível é `unsupported` antes de qualquer trabalho novo.
3. Dentro da raiz que o callback próprio qualificou, outra leitura real de `atlas` compara a partição, o caso, todo o estado C08, todos os snapshots e todos os source fences com as testemunhas anteriores. Uma mudança retorna indisponibilidade e invalida o escopo, sem recaptura ou segunda tentativa fora da raiz.

O hash agregado da testemunha de Memory não é comparado com o hash agregado do leitor genérico: eles têm inputs diferentes. A ponte compara os componentes comuns completos, sob leituras C08 reais. `LocalStore.currentSnapshots()` devolve clones novos, portanto identidade de objeto não serve como testemunha de uma raiz.

## Limites da closure e das leituras internas

O predicado original `procurementCase` e o percurso recursivo `procurementReferences` permanecem byte a byte iguais à base. O caso precisa conter exclusivamente o conjunto previamente permitido de registros Procurement e eventos desse mesmo caso, sem o caminho temporal de approval age. Referências completas são reunidas pelo seu digest completo; versões ou seletores de campos diferentes do mesmo `refId` não são colapsados para a qualificação genérica.

A partição precisa ter estruturas `events`, `envelopes`, `originals` e `captureDigests`. Seus envelopes precisam corresponder ao owner, caso, incarnation e versões válidas até a versão atual. As referências dos envelopes, dependências e capturas originais são percorridas. Este é um filtro conservador anterior ao trabalho; os produtores canônicos continuam validando o conteúdo, capturas, continuidade, outbox e ambiguidade de resolução. O scan canônico de `caseForEvidence` não foi retirado nem reduzido.

O caso autorizado contém views de prepared changes e receipts. Por isso a coleta adicional usa `procurementReferences` no `AuthorizedCaseProjection.case`, sem forçá-lo ao tipo de `DecisionCase` bruto. A prova exata já passou por `procurementCase` na testemunha externa, e os hashes exigem que permaneça exatamente a mesma. Não houve relaxamento do predicado nem cast de permissão.

Uma segunda `AsyncLocalStorage` privada identifica somente o callback real da primeira leitura de Atlas daquela observação. Uma leitura interna de caso precisa ter a mesma chamada, caso, incarnation, digest completo de entrada e objeto de prova já concluída. Ela continua abrindo a leitura C08 real de `cases`, revalidando o ator e o host, autenticando o principal, relendo ambiente e comparando o estado completo. O resultado é um clone da projeção comprovada; somente `checkedAt` é atualizado.

Essa leitura interna não emite a marca externa `sf-memory-case-fence`. As testemunhas externas antes, depois e ao final da observação continuam fora da raiz retida, preservando os pontos em que os testes podem executar escritores reais. O escopo interno não muda hooks de escrita ou seus contratos.

## Concorrência, identidade e saída

O reader interno reclama o slot de leitura sincronamente antes do primeiro `await`. Reentrada, chamada concorrente, outro seletor, outro reader, lease ou binding substituído, headers alterados, cancelamento e continuação destacada com frame fechado invalidam a observação. O marcador ALS permanece fechado nas continuações destacadas; não há Promise compartilhada nem registro global.

O callback opcional é preso por identidade. Seu trabalho precisa executar exatamente uma vez e concluir. Um retorno `observed` só é aceito quando seu valor é igual ao resultado efetivamente devolvido pelo callback canônico. `unsupported` autoriza fallback somente quando o callback de trabalho não começou. Depois de entrada, erro, mudança, trabalho parcial ou retorno inconsistente recusam a saída. O frame fecha em `finally`; um reader interno ainda pendente também invalida o escopo.

Os dois passes independentes de Atlas continuam construindo observações lexicais distintas. Não compartilham prova concluída, resultado, token, fonte ou autorização. Caminhos native, mistos ou fora da elegibilidade permanecem canônicos. A autorização é observada novamente em cada fronteira relevante; o delta não introduz cache de permissões.

## Composição e provas pendentes

O parent mantém a injeção própria em `agents/root/W27-memory-observation-composition` e os testes completos de Memory. O CI builder mantém a participação aninhada de records em `agents/ci/W27-record-participation`, com token privado compartilhado apenas entre leitores próprios compatíveis. Este pacote prende a assinatura pública genérica W26; o parent deve fixar os hashes finais desses outros overlays na composição W27.

Nenhum teste foi alterado neste pacote. O teste W26 completo preserva 84 expressões `expect`, o prazo cooperativo de 225000 ms e o externo de 240000 ms. O parent está acrescentando observabilidade e contraprovas no próprio overlay. A seleção sugerida em `ci-selection.json` inclui os arquivos inteiros de Memory histórico, Memory services, record scope e evidence scope.

O CI do SHA composto precisa demonstrar as duas observações reais de Atlas, o funcionamento dos escritores externos, recusa de mudanças entre testemunha externa e raiz, headers e autoridade atuais, isolamento de chamadas concorrentes e destacadas, execução canônica nova em outro escopo da mesma Request e conclusão do restante do teste sem ampliar seus budgets. `CHECK` e todos esses testes continuam pendentes para este candidato.

## Alternativas avaliadas e limites de conclusão

Compartilhar apenas a raiz existente de cada leitura de caso reduz uma parte menor das testemunhas. Na fixture inspecionada há dez resoluções históricas por leitura canônica e duas dessas leituras por `prepare`; isso produz quarenta testemunhas internas, deixando a maior parte das 188 observadas. Essa contagem é estática, sem inferência de ganho de tempo. Agrupar somente a delegação própria de `proveContinuity` também adicionaria novas raízes e tem benefício incerto; não foi implementado. Remover verificações de autoridade ou memoizar por identidade de snapshots foi rejeitado.

Foram executadas somente leitura de fontes e logs, comparação textual e cálculo de hashes. Não foram executados produto, testes, imports de produto, typecheck, build ou browser locais; nenhum CI ou mutação remota foi iniciado. Não existe declaração de PASS funcional, aprovação independente, aceite nativo ou aceite global neste pacote.
