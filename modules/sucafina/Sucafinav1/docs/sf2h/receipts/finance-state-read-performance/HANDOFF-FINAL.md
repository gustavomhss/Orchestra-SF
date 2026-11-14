# HANDOFF-FINAL — missão22 / finance-state-read-performance

**Consumidor: sessão14. FIN-IND-005: OPEN_IMPLEMENTED_NOT_CLOSED.**

A missão publicou uma redução segura da materialização no leitor canônico de casos e a comprovou com C08/SQLite reais. A prova curta passou; a jornada original continua falhando no budget de 180000 ms. O patch, suas preimages/postimages, a contraprova, os logs completos e todas as pendências acompanham este handoff. A publicação deste pacote encerra a autoridade de escrita da missão22.

## 1. Identidade, autoridade e continuidade

- Repositório: gustavomhss/Orchestra-SF; branch finance-resume; [PR42](https://github.com/gustavomhss/Orchestra-SF/pull/42).
- Missão: [finance-state-read-performance.json](https://github.com/gustavomhss/Orchestra-SF/blob/f23da37c8a2dd6ccfa69c73cf36837b8943e225e/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-wave/finance-state-read-performance.json).
- Planejamento fixo: dbf9547211d9b0fade619790de7c19c0869b7c7d; campanha sf2h-integral-20261112; T0: 2026-11-13T04:01:10Z.
- Ator: S0-C scoped source-support22; lease epoch browser-source-performance-22. Sem autoridade de supervisão, integração de sf2-stack ou release global.
- Head recebido e conferido: d8d586e19c824f75a88494a9c3677faac617e81d; árvore 37e25cf23c449eb1e0fca381301681fa14e9fd4d. O HANDOFF-FINAL da sessão18 já havia encerrado a autoridade predecessora. Nenhum avanço posterior foi resetado.
- Os hashes do COMMON, pack integral, AGENTS, missão e anexos estão em [integration-intake.json](./integration-intake.json). Os 155 critérios/textos originais continuam acessíveis em [criteria-provenance.json](./criteria-provenance.json), com o planejamento fixo e sem substituir o status da campanha.

| Marco | Commit | Árvore | Conteúdo |
|---|---|---|---|
| W0 | 231b0652d12d5c6ce8b5d31d02b725eabdbe308f | 19e946d6a0c68d9fce1e1a2696bf31e66e796814 | Teste discriminante e intake inicial; produto ainda na preimage |
| W1 | a710446e3a002068eacf6ff1ade66365d24005d6 | 2083c7594b85505d0a97167acb30c0b6fd65f6b8 | Implementação nos dois arquivos autorizados, fixture e sete adversários |
| W2 | 1a656f1f7251de8c104e5b03a43b457e80437181 | 1ebd1ee9d0e95253526d0ee73cf2353a71ccbe58 | Dois imports de tipo e duas anotações de parâmetros no teste curto |

**S2 foi executado em W1.** W2 preserva exatamente os dois blobs de produto de W1 e não muda instruções executáveis, assertions ou budgets do teste curto. W2 é o candidato dos checks finais de pacote e da jornada S3. A prova anterior não foi reclassificada como execução em W2.

O commit que contém este handoff é documental e é identificado externamente na PR42. Os checks de W não são apresentados como checks desse commit documental, nem este recibo concede aceite C/D/G4/G8 da campanha.

## 2. O que mudou no produto

Em product/host-binding/state-provider.ts, a factory selectSfCase registra a identidade de um seletor conhecido em um WeakMap privado. O registro contém o código de projeção e o ID do caso; não contém casos observados, snapshots, resultados ou grants aprovados.

Depois da autorização inicial e da validação original de readSfState, o caminho seletivo destaca somente o caso requerido. A clonagem acontece antes do mesmo await e antes da autorização final. A factory mantém o predicate de principalRef, policyVersion e accessRevision, lendo o binding no momento de execução da callback. A otimização exige ID string, contexto/binding congelados e campos de autoridade como data descriptors próprios. A inspeção do campo raiz cases também usa descriptor, evitando invocar getters adicionais ou tornar visível um campo que o clone original omitiria.

Callbacks opacas, callbacks encapsuladas, contextos mutáveis ou com accessors e lookups ausentes, herdados ou malformados seguem o caminho original com structuredClone(state). A implementação não tenta inferir a pureza de uma callback recebida.

Em product/decisions/case-port.ts, somente as duas callbacks de leitura do método read passam a usar a factory. **As duas observações continuam separadas pelos checks externos.** Draft, prepare-intent, os predicates de cobertura, as verificações de fontes e os digests finais não foram simplificados.

A preservação de isolamento, revogação, Request/headers/binding/lease/abort, CAS e poison de escrita aninhada está discriminada por teste e por inspeção em [semantics.json](./semantics.json). Os 18 testes existentes de aceitação do provider usam testPersistence e são evidência suplementar; a prova financeira curta, os sete adversários novos e as cercas existentes de caso usam SQLite real.

A equivalência examinada corresponde aos dados planos persistíveis pelo driver e aos fallbacks protegidos. Não há alegação nova para adapters que introduzam valores não persistíveis em namespaces alheios: o clone integral poderia detectar incidentalmente esses valores. O driver SQLite e sua serialização permanecem intactos.

## 3. Contraprova e redução medida

S1 executou o teste curto sobre a preimage de produto. A execução terminou em **FAIL esperado**, exatamente na assertion que exige zero travessias do ramo alheio: observado 2. As assertions anteriores de conteúdo, quantidade de leituras e checks passaram. O resultado real do Actions permanece failure; a classificação de contraprova não o converte em PASS.

S2 passou **41 testes / 352 assertions**, sendo 33 testes existentes e oito novos: materialização e sete adversários. O intake inicial previa seis adversários; esse registro histórico foi preservado e o terminal descreve os sete efetivamente executados.

O estado representativo tinha **1241296 bytes**, com um caso de **115925 bytes**, dez resultados e dezoito transações. Ele foi produzido pelos helpers financeiros existentes, com C08 e SQLite reais. Os grants/fontes controlados da fixture são sintéticos; esta prova não é evidência nativa ou de bundle integrado.

| Observação no mesmo estado e runner de S2 | Callback opaca / fallback original | Seletor canônico |
|---|---:|---:|
| Leituras C08 de casos | 2 | 2 |
| Travessias instrumentadas do ramo alheio | 2 | 0 |
| Clonagens do caso | 2 | 2 |
| Checks do host | 36 | 36 |
| Mediana de seis amostras intercaladas por modo | 132,552736 ms | 122,3452405 ms |

A redução observada da mediana foi **10,2074955 ms / 7,700705%**. Os contadores foram medidos separadamente das doze amostras temporais sem instrumentação. O teste não usa uma razão temporal como oráculo. O controle opaco encapsula a mesma callback e chega ao fallback original sem substituir a persistência nem a autoridade.

Esta é a mediana inclusiva da operação case-port.read nesse estado. Não é uma redução de 7,7% da jornada completa; não foi inferida economia de I/O, de tamanho persistido ou de todos os reads. A preparação curta omite a longa sensibilidade e não equivale ao checkpoint de vinte transações/doze resultados da jornada original. Os dados brutos estão em [S2-result.json](./S2-result.json); a contraprova em [S1-result.json](./S1-result.json).

## 4. Jornada original e regressões Finance

S3 executou os mesmos 43 testes Finance afetados, mais a jornada original inalterada. **Os 43 nomes PASS coincidem exatamente com os 43 da seleção da sessão18.** Foram revalidadas as negativas de fonte/revogação, Request, headers, lease, callbacks retidas, facades e o predicate original. A contraprova deste predicate registrou uma resolução, uma checagem original, zero checagens substitutas e zero previews, recusando coverage-authority-changed.

A seleção terminou com **43 PASS / 1 FAIL / 368 assertions**, quatro filtrados, 44 testes em 14 arquivos e 464,54 s. A única falha foi a jornada original, com duração de **180032,11 ms**. O log imprime essa mesma falha duas vezes; há somente um teste falho.

O teste original conserva o blob 6395a5dc529acadfb0d9c1e2d8dca0664f40a39e, seu budget Bun de 300000 ms e o guard de 180000 ms da fixture. Nenhuma fixture, assertion, aritmética ou oracle foi alterado.

| Checkpoint da jornada | Tempo observado | Resultado |
|---|---:|---|
| omitted.assertions-complete | 35055 ms | Baseline 240000, subtotal 210000 e cobertura pending/conditioned; treinamento omitido |
| choice.persisted | 43117 ms | Escolha condicionada persistida |
| confirmed.assertions-complete | 80178 ms | Treinamento confirmado 40000, total 250000 e diferença −10000 |
| confirmed.exact iniciado | 148191 ms | Operação iniciada; sem conclusão aprovada |
| Deadline da fixture | 180018 ms | confirmed.exact retorna unavailable; confirmed.evaluate falha fechado |

Erro final, na linha 49 do teste original:

> Source-only certified analysis unavailable: {"status":"stale","reason":"source-or-authority-changed"}

**Não foram alcançadas as assertions finais** do threshold confirmado, das testemunhas 15000/15001, da releitura real da escolha histórica após essa análise, do replay autorizado, da reabertura real e das negativas outsider/revogação dessa jornada. Os testes separados que validam replay/reopen de recibos e as releituras da prova curta não substituem essas etapas.

O trace terminal registrou **3494 leituras C08 de cases / 70670 ms inclusivos**. Os tempos são aninhados e não devem ser somados. Também não constituem uma comparação controlada com as 3095 leituras/71840 ms anteriores: o trabalho alcançado é diferente. O início de exact aos 148191 ms, frente aos 178956 ms do recibo anterior, é um checkpoint observado, não uma medida controlada de aceleração ponta a ponta.

No checkpoint confirmado equivalente, o estado continuou com 1311209 bytes, casos 115934 bytes, resultados 319129 bytes, transações 443599 bytes, um caso, doze resultados e vinte transações. O patch reduz a materialização seletiva; não reduz o estado serializado. [S3-result.json](./S3-result.json) contém os traces completos e [terminal-review.json](./terminal-review.json) a auditoria dos resultados capturados.

## 5. Ledger exato de Actions e checks

| Seleção | Candidato / snapshot | Run | Resultado |
|---|---|---|---|
| S1 | W0 / 27256440a3aa6383b6d96ebd95d9788f3a637ec4 | [43638918360](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43638918360) | 0 PASS, 1 FAIL, 56 assertions; vermelho discriminante |
| S2 | W1 / 71c5fcff52b381955b2038c90ff5bf3660c7cabb | [43639203076](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43639203076) | 41 PASS, 0 FAIL, 352 assertions |
| K1 | W1 exato | [43639621582](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43639621582) | Typecheck FAIL: 117, sendo 2 novos; guards: 43 gates / 15 avisos |
| K2 | W2 exato | [43639846168](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43639846168) | Typecheck FAIL: 115 herdados / 0 novos; guards: 43 gates / 15 avisos |
| S3 | W2 / 9a2867b258de5cb049876a0005ef54109a4a11c5 | [43640055910](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43640055910) | 43 PASS, 1 FAIL, 368 assertions |

Todos os requests, árvores, pais dos snapshots, hashes, jobs, tempos de fila/setup/comando, nonce/verdict Omni e artefatos estão em [CI-LEDGER.json](./CI-LEDGER.json), nos recibos individuais e em [ci-metadata.json](./ci-metadata.json). Os snapshots S alteram somente .ci-run.json em relação a seus Ws. O ambiente observado foi ubuntu-24.04 com Bun 1.3.14 (0d9b296a), sem overrides de env.

O fluxo foi sequencial: S1 → S2 → K1 → K2 → S3. Nenhum par se sobrepôs. Não houve testes locais, epic/full suite, alteração de workflow, repetição da mesma árvore longa falha ou reinício de servidor/Orchestra. Os jobs e cleanups terminaram; não há run pendente. Os controles Omni foram not applicable e não concedem prova nativa.

K1 encontrou dois TS7006 novos na instrumentação do teste. W2 adicionou os tipos Snapshot/BlobTransaction, e K2 eliminou ambos. Os **115 diagnósticos restantes são herdados**, incluindo dois relativos a bi-artifacts em linhas preexistentes do provider tocado. A comparação normaliza o deslocamento de 31 linhas e conserva as diferenças de mensagens. Não há alegação de typecheck verde.

Os guards executaram 78 regras contra origin/dev a1d37698a7bb097c1578f827eba6a19b9917ef07, com 43 gates, 15 avisos e zero erros do engine. Os achados coincidem com a evidência herdada. Nenhum ignore, waiver, label de aprovação ou apagamento de recibos foi introduzido. O pacote continua FAIL nesses checks; o encaminhamento pertence ao integrador/dono correspondente. [K2-result.json](./K2-result.json) preserva todos os diagnósticos e achados.

Os logs completos estão em [ci-log-archive.json](./ci-log-archive.json), com tamanho e SHA256 dos bytes de cada job. As seleções Bun não exigem upload de artefato nesse workflow; os dois checks de pacote publicaram os artefatos registrados em K1/K2.

## 6. Intake seletivo da sessão14

O pacote reproduzível inclui:

- [full-candidate.patch.txt](./full-candidate.patch.txt): delta integral de seis arquivos entre o head recebido e W2 — dois produtos, três testes/fixture e intake inicial.
- [finance.patch.txt](./finance.patch.txt): somente os dois arquivos de produto aplicados e testados no branch Finance.
- [composed.NOT_APPLIED.patch.txt](./composed.NOT_APPLIED.patch.txt): proposta seletiva para os dois arquivos no composto, **NOT_APPLIED / NOT_TESTED**.
- Preimages/postimages em diretórios próprios, mais [source-identities.json](./source-identities.json) e o índice de hashes [artifact-index.json](./artifact-index.json).

| Arquivo | Preimage Finance | Postimage Finance | Preimage composta |
|---|---|---|---|
| state-provider.ts | b7988a2963a2797a96ea19ab2b3a481564548213 | e7810b956073fa83a977109cfdea4735493b8aa3 | 2fd55c7304add0829d7434917c80664fe86356b9 |
| case-port.ts | d43849ba101000eb9eb2a6ddc9a04830b004ccc6 | 2bbcf63bb0fa56dd3a93190f7711f99aef2efb74 | d43849ba101000eb9eb2a6ddc9a04830b004ccc6 |

A comparação anterior à edição usou sf2-stack@b62c32940d06c15c04f52b88209d5b4930cf1a3e. Na conferência final observada, sf2-stack estava em 9cc27888581a13b55992cdb5dfbd27e43479ac29 e os dois blobs continuavam idênticos às preimages fixadas. A sessão14 deve conferir novamente o head/preimages vivos antes do intake e reconciliar qualquer avanço posterior.

**Não substituir o provider composto pelo postimage Finance.** A proposta composta preserva state-layout/bi-artifacts, migração, registries de escrita protegida, checkNamespaces, sourceFence, nativePublicationGuard e os checks adicionais já presentes no stack. Seu postimage proposto do provider é 71ce2ba1b04d3c7f63f7c444ca23dd084a8e2b0c. A árvore composta inteira nunca foi copiada ou escrita.

## 7. Pendências e término da autoridade

1. FIN-IND-005 continua aberto: a jornada original precisa concluir as assertions restantes dentro dos budgets intactos.
2. A sessão14 precisa consumir o delta e constituir um novo candidato integrado antes de alegar qualquer resultado do bundle.
3. Typecheck e guards herdados permanecem FAIL e exigem tratamento pelos donos apropriados, sem supressão pela missão22.
4. O próximo ganho material requer prova própria. Callbacks opacas continuam precisando de estado destacado completo, e o driver continua carregando/desserializando snapshots integrais. Os digests e checks observáveis não podem ser compartilhados entre objetos/janelas ou requisições. Não foi identificado outro delta material com equivalência demonstrada dentro dos dois arquivos que justificasse nova tentativa longa nesta missão.

A fronteira residual, o dono de encaminhamento e as ações seguintes estão em [residual-boundary.json](./residual-boundary.json). Não houve edição de Memory, Apply/C12, UI de alternativas, união WP13, engines, runtime/local-store.ts, fixtures, contratos globais ou arquivos compartilhados excluídos.

**Autoridade de escrita da missão22: encerrada com a publicação deste HANDOFF-FINAL e dos recibos. Consumidor: sessão14.** O consumidor deve registrar o SHA terminal recebido e conferir a continuidade antes de qualquer escrita. Não há controller/Goal/worker nativo lançado ou retomado, entrega integrada aceita, E17/G4/G8 concedido ou GLOBAL_RELEASE declarado por este pacote.
