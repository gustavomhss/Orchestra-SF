# R1 — W27 Memory / participação privada v2

**Conclusão de fonte: os cinco caminhos exatos dos overlays selados estão aptos para composição. Conclusão funcional: HOLD, aguardando CI do candidato publicado.** O finding `R1-W27-PARTICIPANT-EGRESS-01` está corrigido na fonte v2; não atribuo aprovação funcional à contraprova ainda não executada.

Revisor R1, `/root/independent_r1_w16`, sem autoria de produto ou testes. Nenhum produto foi importado/executado localmente; não executei testes, typecheck, build, browser ou mutação remota. Corte `2026-11-14T17:44:49.062353+00:00`. Base W26 `a1434e7ea7340aa1d1c8ce6bb48958b724218170`, árvore `a9398de38c9e684d28c27b0188ab653e75bf3305`. Não há SHA W27 qualificado neste parecer. `finalForCandidate:false`; nenhum critério é promovido.

## Recheck do bloqueio v1

No blob `64a7252089ca33d9f316a4382a0ef73fb70d8466`, o owner concluído fica retido até depois de `await persistence.transaction`. O callback fecha `open/accepting` (linha 175), mas conserva os predicados. A verificação exterior (181–182) observa o owner, os filhos pendentes, todos os pins e o ancestral; somente o `finally` exterior os limpa (197). Os owners aninhados qualificados separadamente transferem seus predicados e os dos seus descendentes para o ancestral depois do encerramento de sua própria transação (188–189). Não há novo `await` entre essa verificação e o retorno.

A nova contraprova, linhas 271–305 do teste `b1137e58b9800eb94587848d3e3882a87c1a11a4`, encaminha a chamada real a `engine.transaction` uma vez. O hook troca apenas o reader do filho concluído depois de a raiz real fechar. O teste exige que a injeção tenha ocorrido, que `currentSnapshots` esteja ausente naquele ponto, que o produtor canônico tenha produzido um resultado fresco antes disso, que o pai devolva `changed`, que tenha havido uma única execução e que o digest persistido permaneça igual. Não há retorno positivo fictício no wrapper.

Esse teste cobre diretamente o reader do filho no encerramento da transação. Pins de entrada e transferência de owners independentes foram examinados na fonte; não são contraprovas executadas separadamente neste parecer. A v1 e seu HOLD permanecem intactos.

## Fronteiras examinadas

A participação continua privada em ALS e só nasce depois da observação protegida completa. O filho precisa da mesma instância de dependências, call e Request e de um subconjunto de referências completas; a mera disponibilidade de snapshots não concede autoridade. Cada filho ainda executa o produtor canônico real e repete autenticação e observações de ambiente.

O helper genérico fixa Request e todos os headers, método/URL, abort, identidade e conteúdo do binding, lease, seleção e expiração, callback e objeto de reader, refs e dependências. A v2 prolonga os pins concluídos pelo último `await` de sua transação. Isso fecha o defeito concreto identificado, sem declarar aceite geral de revogação em todas as portas.

O helper Memory conserva provas completas do C08, snapshots, fontes e partição Atlas do mesmo caso. A closure distingue versões e seletores completos; cálculos, mistura de domínios e fontes com idade contínua em aprovação não entram. `cases`, `atlas` e os namespaces usados pelo Atlas canônico continuam sujeitos às suas próprias leituras autorizadas. As regras de overlap, closed ALS e active ownership conservam a separação de observações e impedem reentrada destacada.

O Atlas canônico é chamado uma vez na observação agrupada; os produtores de records continuam reais. Fallback `unsupported` só ocorre antes do trabalho canônico começar; drift, falha, chamada duplicada ou retorno alterado recusam a observação. Os hooks reais de escrita permanecem fora da raiz agrupada.

## Compatibilidade estreita com T01 e T07

Li os requisitos do pack sobre agregação fora das transações de domínio, proibição de outro Surface dentro da transação de metadados e reads multi-domain fora da transação central, e os confrontei com C08, source lifecycle, Atlas e LocalStore reais. A conclusão abaixo se limita à closure elegível de um domínio de negócio, Procurement, acompanhada de metadados protegidos do mesmo caso/Atlas.

O helper abre `Persistence.transaction("dashboard")`, mas sempre devolve `commit:false`; não chama C08 `state.transaction` ou append Atlas. As leituras aninhadas reais compartilham a mesma raiz LocalStore e usam snapshots defensivos. Um `commit:true`, blob write ou outro writer aninhado envenena a raiz e recusa o resultado. `state.read` faz autorização de namespace antes e depois do callback. O caminho de recall Atlas só lê.

**Precisão operacional:** LocalStore implementa essa raiz com `operation(true)` e `BEGIN IMMEDIATE` (linhas 199 e 129). Ela reserva o slot de writer. Não é uma transação SQLite read-only nem um caminho sem bloqueios. O limite admissível é um escopo sem commit de domínio, elegível para somente Procurement e metadados, sem prometer commit global. Leituras de outros domínios e callbacks de escrita não ganham autorização por esse agrupamento.

Não identifiquei um conflito concreto novo com T01/T07 nesse recorte. A interpretação não se estende a agregação mixed-domain nem a transação central de escrita. Latência, espera de writers e concorrência exigem medição hospedada; nenhuma melhora de desempenho é presumida. Nenhum critério T01/T07 é declarado cumprido por esta leitura.

## Identidades e validação estática

| Caminho | Blob Git | SHA-256 |
|---|---|---|
| `apps/cli/src/sucafina-product/procurement-record-read-scope.ts` | `64a7252089ca33d9f316a4382a0ef73fb70d8466` | `83a2e8ff826eeb1c07b14ee9d90e7a465d6ca444437729ee039481ecae051906` |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/procurement-record-read-scope.test.ts` | `b1137e58b9800eb94587848d3e3882a87c1a11a4` | `146379c5e287bac835b3529c06606a6d929d75521b2386325a6b91ce17d1f845` |
| `apps/cli/src/sucafina-product/memory-case-read-scope.ts` | `ba55d4f1624dabed660e58d3d8b787bd991acd7a` | `26f577d698afd62bd0b73c508f44ba7eafcf00d8e3bb167916c2f23f11d5ba08` |
| `apps/cli/src/sucafina-product/business-services.ts` | `385dd1998ec3fb73b32f77ab3dec9c93beb440d1` | `82d182ce0ae3cff5f7346d4b7f61519440316c37a74751687277744d8d673ef2` |
| `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts` | `ee5c725ae78e0eba5c12600da80eb51b7173c2ed` | `7af2197cbad8b0456dab995d097ea86e9468e8d560cc58546f57e1c16b7e99fd` |

Selos conferidos integralmente:

- `agents/ci/W27-record-participation-v2/seal.json`: SHA-256 `3bbd1ffe5f4ad8d001db40b715b3128ad73e6d826630f7211a8e4b6201cfa6ae`, 9/9 membros coincidentes.
- `agents/c17/W27-memory-atlas-scope/seal.json`: SHA-256 `6eb52791d8131151081f8d0af1993ccd018ccb1fe03fc864f10ab10085c9cd7e`, 13/13 membros coincidentes.
- `agents/root/W27-memory-observation-composition/seal.json`: SHA-256 `b2749db05a3825dff0cf43aedf364aa1a20d2b2ded287f2ab17907777c9278fc`, 6/6 membros coincidentes.

Resolvi 142 imports relativos literais dos cinco caminhos para 89 alvos no tree completo W26 mais overlays, sem alvo ausente. Três alvos existentes não estão hidratados no snapshot local; isso não é deleção. Essa verificação não substitui typecheck. Os dois helpers da base já foram obtidos por GitHub MCP e comparados integralmente aos bytes congelados.

Os três corpos originais de testes do helper genérico permanecem literais. Há dez declarações de teste na v2, todas com timeout de 120.000 ms. No teste histórico, as 84 linhas anteriores com `expect` permanecem em ordem, agora com 92; a cauda de races/lifecycle é byte a byte igual. Os limites de 225.000 ms cooperativos e 240.000 ms do Bun continuam iguais.

## Provas pendentes e preservação

A falha histórica W26 A, run `43618475702` / job `132518644009`, S `dd53af531181d1b05e5081b765dbfecc2a6ba6a9`, foi 45 pass / 1 fail, 46 testes em oito arquivos; Memory atingiu 225 s. Não transferi esse resultado nem qualquer outro terminal para W27. É necessário conferir os blobs no candidato publicado e executar/avaliar os checks e arquivos integrais na identidade W/S correspondente.

Os 171 critérios literais e sete tasks foram preservados, sem promoção. A disposição dos 128 inputs estrangeiros arquivados e 131 somente leitura permanece; este foco não reaudita todo o arquivo histórico. Não há aceite de native, runtime residente, Task/knowledge governado, epic global, viabilidade financeira completa, merge ou deploy. O trace opcional de exact-threshold fica fora da conclusão de composição dos cinco caminhos.

Este parecer e o checkpoint v1 permanecem como etapas de fonte. Os três pareceres FINAL independentes ainda dependem do candidato definitivo e de seus terminais atuais.
