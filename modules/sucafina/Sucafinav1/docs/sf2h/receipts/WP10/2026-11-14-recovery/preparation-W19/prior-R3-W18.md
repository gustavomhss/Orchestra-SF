# Revisão independente R3 — W18

**Parecer: HOLD.** Não aprovo o candidato como entrega integral. Registrei uma obrigação própria nova de comprovação da montagem residente de Review; o check hospedado falhou em 14 diagnósticos estrangeiros. O run funcional A ainda estava em execução ao fechar este parecer. Não alego falha HTTP não observada, aceite nativo nem global.

## Identidade e independência

- Revisor: `/root/independent_r3_w16`, R3 independente, rodada W18.
- Produto: `8b1cc71d8ab2484055a0d055c8487d4579476b9b`.
- Árvore: `6bace347fcd4deec2018185aff7ec152d79eaec5`.
- Pai W17: `2ec17b2c8204d5e953eec3186b7e236c0faaad47`; PR29 para `sf2-stack`.
- Não participei da autoria do produto, não o editei, não executei testes/typecheck/build/browser locais e não alterei remotos. Escrevi somente os novos artefatos R3; preservei W16/W17. Builder audits e outros pareceres não substituíram minha leitura.

## Obrigação própria: Review residente

**R3-W18-REVIEW-MOUNT-01 — P1, montagem/prova pendente, owner WP10.** O host real sempre fornece `reviewReaders.contributions` e `reviewReaders.outcome` (`host-context.ts`, 261–266). O serviço só habilita `localSnapshotReaders` quando não recebe qualquer reader definido (`review-services.ts`, 97–100). Assim, o novo cache de prova por Request/call está desabilitado nessa montagem: `protectedRead` usa `legacyRead`, inclusive no grupo C08 de `review-source`.

A contraprova nova em `review-portfolio-http.test.ts` constrói o serviço sem readers, portanto observa um ramo diferente. Os três blobs que demonstram isso foram conferidos remotamente no SHA W18. O `prepare()` novo executa dois passes antes do grupo C08 e pode materializar determinadas fontes. **Por isso, não afirmo reprodução de 409, nested-write ou vazamento em W18.** A obrigação demonstrada é provar a correção na montagem que de fato inclui os readers residentes.

Fechamento necessário: contraprova hospedada com a mesma configuração, corpos/recibos verdadeiros, Review atual e predecessor, C08 real e revogação tardia. Se houver correção, delimitar a autoridade dos readers locais e manter o caminho conservador para readers externos. Não habilitar cache genericamente nem retirar a revalidação de body, receipt, Request, lease e fontes.

## C17 e C12

O reader histórico C17 está agora ligado ao BCS e deriva sua seleção do ledger C08 corrente. Reabre request/result originais, exige captura Atlas protegida e fecha fences de estado/fontes/dia/Request antes e depois. A seleção histórica fica em ALS privado; `selectedCase`, `resolveCase` e a execução nova continuam estritos. O limite record-only permanece explícito.

O achado **R1-W17-CALCULATION-HISTORY-01 pertence a R1**. Minha leitura de W18 confirma a correção da causa apontada e a adição de uma contraprova composta: `createSfAnalysisRunContext` → BCS histórico → `wrapStore` → `preserveStale` → C08. Ela conserva o selector v1 quando o caso avança para v2, nega execução corrente pelo selector antigo, verifica output preservado e descarte da lease. O run A ainda não forneceu resultado terminal; código de teste não fecha prova funcional. Seus metadados native são fixtures declaradas, sem alegação de Task/Session/model reais.

C12 passou a consumir exatamente os outputs publicados de PR35. A reserva durável antecede dispatch; uma tentativa sem recibo não autoriza novo efeito. A reconciliação reabre o recibo canônico e o caso, preserva edições independentes e conserva CAS. Os wrappers próprios de Dashboard e Procurement revalidam intenção humana, Request e lease depois do produtor. A contraprova de retry/fim de lease foi inspecionada, sem execução local ou aprovação funcional transferida.

No helper de operações Planner já registradas, a leitura exige igualdade com alternativas/choices armazenados, captura original protegida, identidade física e período/valor/componente exatos. Esse caminho não promove nem aplica operações. Não encontrei bypass novo confirmado nos caminhos C17/C12 inspecionados.

## CI exato observado

| Seleção | Snapshot S | Run / job | Resultado observado |
|---|---|---|---|
| Check W18 | `6d72852aa48f864338caa93204ae894ec1e978fe` | 43591239877 / 132436212526 | **FAILURE**: Typecheck Sucafina; demais etapas listadas abaixo passaram |
| A W18 | `f84d2f41bb5755d350d524053c391fc8338e7bdd` | 43591262845 / 132436280987 | **IN_PROGRESS**, nenhum resultado terminal aceito |

CLI, consumidores WP10, geração/compatibilidade Atlas e guard de subprocessos passaram. Guards: 78 regras, 1328 paths alterados, zero gates, 48 warnings, zero errors. Os 14 diagnósticos de Typecheck Sucafina são estrangeiros; zero diagnósticos próprios foi corroborado pelo log e ZIP, sem converter o check inteiro em sucesso.

**R3-W18-PUBLISHED-DEPENDENCY-02 — P2:** `product/planner/evidence-reader.ts` importado exatamente de PR34 usa `sfPlannerEvidenceRef`, export ausente no `integration/planner-sources.ts` composto. Isso causa TS2305 no check W18. Owner externo: astra-operations/WP04–WP06; WP10 deve compor a dependência publicada compatível e repetir check no sucessor. Uma proposta de blob para W19 foi comunicada, mas não pertence a W18 e não recebe aceite aqui.

Artefato check `14112034219`, 4194 bytes, SHA256 `08329a4279831996b48cd01911e58a5caf164185103a2acf8268d33640ec063d`: conferi independentemente ZIP e 11 arquivos extraídos. `revisions.txt` contém o produto e árvore W18 exatos. Os comparativos remotos dos snapshots mostram apenas `.astra-wp10-check.json` e `.ci-run.json`, respectivamente. B8/C26/D10 foram informados como preparados; nenhum dispatch ou resultado desses lotes foi aceito por mim.

## Pins, ownership e preservação

Recomputei a árvore Git completa a partir de 18.671 entradas de metadados, incluindo **16.120 blobs**, e não houve divergência. Compare remoto e manifest concordam nos **47 paths**: 20 modificados, 27 adicionados, zero remoções; 41 owned e seis inputs estrangeiros exatos. Todos os 401 pins atuais correspondem à árvore e não há violação de exclusões entre os paths declarados owned. Inspecionei as waves14–16 e comparei os seis novos inputs estrangeiros, BCS e helper histórico com seus commits publicados. Ao todo, 16 verificações remotas de blobs bateram byte a byte no candidato.

O intake14 mantém um SHA de output intermediário de `business-services.ts`; sua identidade final é a do manifest W18, que registra o overlay próprio final. Não uso o pin intermediário como se fosse o blob entregue.

Os 100 recibos WP10 preexistentes ficaram intactos. `stop-handoff.json` permanece com blob `d1ac5e6da263fc2dd1766f13e4368b898bcceab5`, SHA256 `bc761d68afd64bcb7e49d2abbe98f849ee113b197b579b16f561b12622f65166`, **128 foreign_copies e 131 recorded_readonly_inputs**. Esse resultado prova preservação byte a byte do índice original, sem readmitir as cópias antigas como runtime e sem alegar re-fetch de todos os blobs históricos.

## Critérios e gates restantes

Comparei literalmente IDs, textos, famílias, tasks e títulos do draft com o pack canônico: **171/171 critérios, sete tasks e 43 obrigações** preservados. O draft não integra o commit W18, mantém SHA/árvore nulos e afirma zero critérios/tasks aceitos. Esses campos precisam receber apenas evidência efetiva no pacote final.

**Freeze9 permanece 37/38.** O host CLI atual tem SHA256 `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772`; o contrato espera `4c654665a12aa02a6d5a851cdbe662f6f0fabdacf21e4b600f598e499a3a1922`. É necessário binding estrito publicado pelo owner WP00, composto por WP10/S0, preservando o teste.

C07 ainda não tem os ports native/publication instalados no host; os leitores indisponíveis não anunciam rotinas chamáveis. Fixtures, nomes de producers ou receipts antigos não provam sessões/tarefas/skills/tools/artifacts reais. A matriz 5/18/8/39/6, AM01–AM06, jornadas visuais/personas e epic global continuam sem aceite. O epic global será posterior ao bundle total, como solicitado.

Antes de conclusão: fechar a obrigação própria de montagem, resolver a dependência publicada e os demais diagnósticos com owners precisos, obter runs funcionais exatos do candidato final, fechar Freeze9 e vincular os três pareceres independentes e o mapa íntegro ao pacote de entrega. S0 revisa e integra; esta revisão não autoriza merge em dev nem deploy.

## Artefatos desta revisão

`review-W18.json` contém achados estruturados, causalidade, owners, limites, steps e hashes de CI. `inventory-W18.json` distingue leitura de código, leitura direcionada de testes, verificação de bytes e observações anteriores retidas por identidade. `remote-W18.json`, `metadata-W18.json`, `criteria-W18.json` e `check-job-W18.txt` preservam as provas desta análise. Nenhum item equivale à execução local do produto ou à aprovação integral dos171 critérios.
