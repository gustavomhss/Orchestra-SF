# Checkpoint75 R3 — ClamD real e admissão privada

**Os sete controles live passaram na fonte75. Os cinco browser originais continuam NOT_RUN75. Nenhum dos251 critérios foi fechado integralmente e a composição73+75 por71 ainda não foi emitida.**

## Identidade da execução observada

| Campo | Identidade |
| --- | --- |
| Produto W4 | `d50287e998b2f42f548bce3b72b75e16eff40043` |
| Tree W4 | `07e01afadab8499b1ada9ffa939c26e9070a1a63` |
| Snapshot S3 | `209c613895a2555ba7de8befc33f1bd41b263f62` |
| Tree S3 | `659cae7dbdc9cbe9cad4387e1498a39a1c3ae90a` |
| Request SHA256 | `e339ac1cb8e4741ccf7fe623015ec3bfa5a2050c431c7aa7423b0104ce08edcb` |
| Run / job | [43672349552 /132684956460](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43672349552/job/132684956460) |
| Resultado | **7 PASS,0 FAIL,0 testes skipped,150 expect calls,3 arquivos** |
| Artefato | [operations75-controls-43672349552-1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43672349552/artifacts/14145385503),18829 bytes |
| ZIP SHA256 | `3c850b7e0a7ce11cdfae73be98e2d1c4ca2c0378549cd7fa991f76dfb45d7edd` |

O SHA256 do ZIP local coincide com o digest publicado no job. O GitHub MCP confirma o job terminado com conclusão success e S3 como filho direto deW4. O request e os receipts de serviço apontam os mesmos W/S/run. Os passos exclusivos de Playwright foram skipped porque a seleção era controls; nenhum teste browser foi executado.

## Delta observado

| Controle | Estado | Duração |
| --- | --- | ---: |
| CLAMD-LIVE-CLEAN-EICAR-CLEAN | PASS | 61,58ms |
| CLAMD-LIVE-ERROR | PASS | 11,11ms |
| CLAMD-LIVE-DOWN | PASS | 334,26ms |
| CLAMD-LIVE-MALFORMED | PASS | 12,08ms |
| PRIVATE-IMPORT-ADMISSION | PASS | 352,09ms |
| PRIVATE-SUPPLIER-UPLOAD | PASS | 72,78ms |
| PRIVATE-ADMISSION-DOWN | PASS | 80,78ms |

Foi observado ClamAV1.5.4, pacote oficial com tamanho/hash esperados, bases oficiais main/daily/bytecode verificadas por FreshClam e3628275 assinaturas carregadas. Os daemons ficaram prontos somente em127.0.0.1:3310/3311; clean/EICAR/clean-after, ERROR de tamanho, comandos malformados e indisponibilidade tiveram controles reais. O cleanup registrou principalSTOPPED e daemon de erroABSENT, preservando a evidência.

Na admissão privada de import, os gates UI, validação, target e humano passaram. EICAR e indisponibilidade foram recusados em `file-admit/denied/file-not-accepted`; as tentativas limpas chegaram a `file-admit/ok`. Os controles de import/upload verificaram persistência dos bytes limpos e ausência de mudança dos snapshots/blobs nos negativos. Isso não atribui retroativamente uma causa única ao403 do R4 histórico63 e não prova preview, Apply, extração ou confirmação.

O campo `productQualification: NOT_RUN` do receipt de setup pertence ao estágio anterior à execução. A prova posterior dos sete casos vem de bun.log; o receipt original não foi reescrito. Omni declara not applicable, sem spawn nem prova de paridade nativa.

## Dependência73 reconciliada

O terminal [4a93f6aa8b8af138774fd1e25a7183e7a84706ba](https://github.com/gustavomhss/Orchestra-SF/commit/4a93f6aa8b8af138774fd1e25a7183e7a84706ba) publicou source release para composição com checks pendentes. Li PRESENTATION-RELEASE, CONSUMER-RELEASE, AUTHORITY-FINAL e SOURCE-MANIFEST nesse SHA.

A unidade combinada contém:

- `runtime/procurement.ts`: postimage `a4ab021f646c0fc819b3afdde18796630fb9603f`.
- `runtime/application.ts`: postimage `81f469822a2756b3e1ca87effbf5fd865a56010d`.
- Quatro arquivos de testes, também preservados no released_unit.

A release adota os quatro hunks/sete interpolações numéricas63 junto à correção de privacidade73. **O postimage money-only63 não substitui essa unidade combinada.** A lease73 está encerrada;71 é o integrador exclusivo. A disponibilidade da fonte remove a ausência do patch73 como dependência, mas ainda exige composição71 e execução das cinco jornadas inalteradas pela75.

Os29 PASS reportados pela fonte73 não são creditados à75 nem ao futuro candidato71. Seus checks45, reconciliação do oracle legado, revisão fria e limitação de revogação durante scan aceito permanecem registrados. Os sete controles75 não exercitam mudança de identidade/visibilidade durante um scan aceito.

## Acceptance e pré-requisitos exatos após a revisão documental

M75-PACK-01/02/03/05 passam a **PARTIAL_SOURCE_EVIDENCE**, com full_obligation_closed=false. Isso registra positivamente o scanner, a admissão privada e a infraestrutura CI executados no R3. PACK02 mantém somente o handoff terminal do recurso/owner CI pendente; não volta a classificar a infraestrutura como não executada. M75-PACK-04 permanece NOT_RUN porque requer os cinco originais.

O screen-shell foi implementado na fonteW1 e preservado naW4, com postimage f1573e02df562db7569f53931d7a4524a108ad4b. Continua aguardando composição71 e OP-PROC-03 original; nenhum candidato composto é presumido.

A [reconciliação75 no PR65](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6888686934) registra a verificação independente e do root sobre C35 **antes do intake73+75**:

| Dependência dos cinco originais | Blob preservado63 |
| --- | --- |
| Host Operations wp04 | `8230eb28f322dde255382b74280192f39844724d` |
| Playwright production config | `ae56b7fc9da248ee8e34d73d0eb13c8fe8e0c088` |
| Identidade local de operador | `4845de24285df2459991da7d9895aad95eb93b19` |

Essa seleção usa Bun.serve4174 e factories/identidade Operations reais. **As releases74/79 do listener Node/ServerHttpApi não são pré-requisitos desses cinco testes.** O resultado não qualificará CLI Node, Microsoft, Entra ou paridade nativa.

O próximo bloqueio concreto é71 compor as nove pós-imagens75 deW4 com a unidade73 completa e devolver C/tree/ACK de intake. Depois disso,75 executa uma vez a seleção original preparada, requestSHA e4201f174defe27af1f45cac85a40535e665aa851eeb6e803311b9ae72085717, com ClamD efêmero real no job. Checks45 e handoff terminal CI continuam gates separados de fechamento, não bloqueios genéricos do host browser.

O rótulo histórico “complete W3 tree” na closure75 é uma correção documental de intake paraW4: pins, nove pós-imagens e patch já sãoW4 d50287e998b2f42f548bce3b72b75e16eff40043/tree07e01afadab8499b1ada9ffa939c26e9070a1a63. Nenhum material de produto foi modificado por essa correção.

## Conservação dos critérios e gaps

O checkpoint mantém **sem alteração** os251 objetos de critérios, suas anotações, os cinco registros browser e os resultados históricos63. Os dez gaps originais permanecem; somente o estado dos pré-requisitos de scanner/import/upload e da disponibilidade73 foi atualizado.

Continuam0 critérios integralmente fechados,0 PASS diretos novos para WP04/WP06,5 browser NOT_RUN75 e `GLOBAL_RELEASE=false`. Documentos PDF/DOCX/negativos, C06 e consumidores, typecheck/guards, AM01–AM06, oito seleções, permissões nativas/físicas, compreensão humana, revisões e C-G7/D-G8 não são promovidos.

O próximo checkpoint deve anexar o candidato71 exato e os resultados das cinco jornadas. R3 pertence aW4; não é relabelado como execução sobre a futura composição.

## Arquivos

- `criterion-matrix75.checkpoint-R3.json`: matriz completa e testemunhas R3.
- `checkpoint-R3-source-observations.json`: leitura documental de metadados GitHub e releases73.
- `CHECKPOINT-R3-MANIFEST.json`: hashes, contagens e invariantes documentais.

Reconciliação exclusivamente documental: nenhuma publicação remota, nenhum produto/teste/typecheck local e nenhuma execução Actions nova.
