> Anexo de leitura independente consolidado por S2-R2. O finding R1-W23-C17-BETWEEN-OBSERVATIONS mantém o ID anterior. Este anexo não constitui outro parecer obrigatório da campanha.

# Missão28 — subsídio independente C13/C15/C17, Memory e empacotamento Atlas

## Identidade, limites e resultado

Revisor auxiliar de S2-R2, em contexto novo, sem autoria do produto ou dos deltas examinados. Não assumo identidade nativa, execução de skill residente nem autoria de recibos históricos. Produto analisado exclusivamente no commit `0ce090d7d1d4399d77b435debd59eb7cc903c202`, árvore `f13eadcdf86861982ded1d05ef02e3bdd94adb2f`. Não executei testes, typecheck, build, produto, CI ou dispatch e não alterei código nem remoto. Acesso remoto foi apenas leitura por GitHub MCP. Cache e este subsídio são documentos locais da revisão.

**Conclusão do recorte: REQUEST_CHANGES / não aprovar C13, C15 ou C17.** A correção MemoryA27 está presente na fonte e no consumidor integrado; suas provas pontuais têm valor delimitado. Permanecem a janela instalada C17 entre observações, a falha do cenário histórico integral e ausência da cadeia obrigatória AM/nativa/restart/UI sobre o candidato fixo. Não converter catálogo, tipo, mapper puro, igualdade de projeções ou PASS de fonte em prova composta.

Norma: pack S2-R2 em `dbf9547211d9b0fade619790de7c19c0869b7c7d`, AGENTS e missão/COMMON em `6da04cd66eb268362ee58509271fef773ac2a62e`. Li integralmente AGENTS, missão/COMMON, execution/COMMON, as seções atribuídas do pack (C13/C15/C17, resident, resident_handoff_interfaces, resident_gate_requirements, resident_ui e resident_packaging), e os anexos integrais `specs/resident-runtime.md` e `specs/atlas-packaging.md`. A leitura global do pack e C01–C17 é agregada pelo revisor principal; não atribuo a este subsídio contratos alocados a outros revisores.

## 1. Achado instalado mantido: R1-W23-C17-BETWEEN-OBSERVATIONS

**Estado:** OPEN, defeito de contrato identificado por leitura estática; nenhuma exploração/breach executada nesta revisão. Preservar o ID anterior, sem duplicá-lo. Severidade: bloqueante para aceite C17. Responsabilidade de correção: WP00, fornecedor da composição C17/PR32, em coordenação com WP10.T07, owner contratual e integrador do BCS; a correção MemoryA27 de S0-B não declara fechar esta janela.

**Localização atual no SHA fixo:**

- `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts`, blob `6e0aba2f7aa058cef1b35ecd0c963312e98ef993`, linhas 371–383 (historical calculationProof), montagem do consumidor 359–419.
- `apps/cli/src/sucafina-product/planner-calculation-history.ts`, blob `dbf13c657c7d5e93837367eae7bb7b704f7577c4`, linhas 65–71, 132 e 141: cada observação prende método/url/headers do Request individualmente.
- `apps/cli/src/sucafina-product/planner-calculation-services.ts`, blob `5dfca7fad55453672986fbb3b29d6c68a9e1afa9`, linhas 91–93 e 267: o callback instalado é `historical.resolve`, não callback hipotético antigo.
- `apps/cli/src/sucafina-product/business-services.ts`, linhas 434–445/463–509: cálculo histórico instalado e BCS real.
- `modules/sucafina/Sucafinav1/product/integration/ui-authority.ts`, linhas 26–33: a revalidação compara principal/accessRevision/policyVersion e demais campos de identidade derivados, sem uma impressão dos headers inicialmente observados. Request é preservado por identidade do objeto, o que não torna Headers imutável.

**Mecanismo.** A prova externa captura `request`, `binding`, original e current; invoca `historicalCalculation` duas vezes e aceita mesmas refs/projeção/differences mais revalidação final. Não captura um digest de headers antes da primeira observação nem o verifica entre/final das duas. Cada leitor interno captura seu próprio digest ao entrar. Portanto, prender H1 dentro de uma chamada e H2 dentro da outra não estabelece continuidade H1→H1 do par.

**Contraprova fria acionável (não executada):** admitir chamada com Request R/headers H1; obter primeira observação histórica real; no limite assíncrono após ela, mudar headers de R para H2 preservando mesmo principal, grants, policy/accessRevision, binding, refs, caso, dados e sinal não abortado; fazer a segunda observação real e revalidação com H2. Os predicados externos 378–383 não distinguem esse par do par H1/H1. Manter o callback real e inserir a mudança depois da primeira observação é essencial: devolver duas respostas sintéticas iguais não demonstra o comportamento instalado.

**Evidência contrária considerada:** o leitor histórico real verifica headers dentro de cada observação; o stale-preflight MemoryA27 também verifica headers no seu domínio. Isso restringe a falha, mas não fecha o escopo do `calculationProof` externo. O handoff fonte já preserva explicitamente esse achado, originalmente sobre blob `5cca27ce239c92a8e3c9f9f92f816f5224562904`; a presente revisão relocaliza a mesma janela no blob efetivamente integrado `6e0aba...`.

**Ação e prova de fechamento:** o owner deve prender a autoridade Request/headers/binding ao longo do par e do egress completo, e fornecer recheck independente no novo SHA com positivo real e negativos exatamente entre as observações e depois da última revalidação. Não aceitar apenas negativos dentro de uma observação nem o positivo C09 como equivalentes.

## 2. MemoryA27: fonte corrigida e consumida, prova limitada

### Fonte e consumidor

Fonte runtime W35 `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7`; candidato W36 `f29f9f7acdc860590581d76e1d276139da7af1e3`, árvore `6f69fc8bfcfcd8ae313ef1a556a35d11ad09e556`; fechamento documental D `539a3c7f95174190f783debc74e3694d84ca8653`.

Busquei os dois arquivos também em W36 via GitHub MCP e comparei os blob IDs retornados, não somente o texto do handoff:

| Arquivo | Blob id em W36 e no SHA fixo |
|---|---|
| `apps/cli/src/sucafina-product/analysis-stale-commit.ts` | `8e1b7eaab139c3303462bdb5af9b4c679e61b276` |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `6e0aba2f7aa058cef1b35ecd0c963312e98ef993` |

O recibo integrado `docs/sf2h/receipts/integration/closed-output-intake-23/memory-terminal-authority.json` (blob `6483e6284be8b01babd0acf33036f86ce27c3b55`) registra declaração terminal explícita de PR29 e intake dos blobs. A igualdade observada de blobs sustenta consumo da correção; não transforma a execução W36 numa execução da composição `0ce090...`.

### O que mudou e por que o finding antigo não deve ser repetido

`analysis-stale-commit.ts:71–86` exige a consulta privada `readSfMemoryCaptureIntegrity` antes de preservar metadata stale. A consulta usa a identidade exata da array de resoluções no WeakMap e a chamada original (`business-context.ts:31–42`), consome a observação uma vez e faz nova leitura. Não concede autoridade por igualdade dos dados da array.

`business-context.ts:423–560` prende Request/headers, binding, seleção, fontes, snapshots, capturas e resoluções; valida evento/envelope/owner/case/incarnation/digests e fold canônico; formas complexas caem no recall real completo. Na linha 542 há fence imediatamente após o await do leitor original, antes da continuidade; essa era a colocação corrigida em W35. A autoridade é revalidada no egress. Preservação stale é metadata-only; não reescreve captura nem fabrica contribuição pronta.

**Decisão:** a antiga contraprova “source C12 autoriza, portanto stale preflight aceita Atlas original corrompido” não é um finding atual no SHA fixo. O novo código não autoriza Memory somente porque C12 ainda resolve a fonte. Captura movida para outro owner/ausente também não ganha autorização por recall vazio.

### Execuções existentes relidas diretamente no GitHub

Não executei estes runs. Li metadados Actions, lista de jobs e os trechos de execução dos logs originais por MCP; cache em `aux-memory/logs/`. Os IDs W/S abaixo são diferentes e preservados.

| Prova | W produto | S envelope/checkout | Run / job | Resultado observado |
|---|---|---|---|---|
| MI06 | `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7` | `5860244f722a2c8e5c47c6a24dfb0f44768f5478` | 43637049651 / 132576026162 | 1 pass, 0 fail, 4 filtrados, 5 asserts, 10,72s; somente mutação in-place da fonte depois do await real |
| MI07 | `ab511e9ab2dcb0f64b34bea944533cdbf7ed98e7` | `e63511737be687a2e42f9a15706a229db42a31c1` | 43637227753 / 132576581546 | 0 pass, 1 fail, 687 asserts, 225,71s; cenário histórico integral falhou no deadline |
| MI08 | `f29f9f7acdc860590581d76e1d276139da7af1e3` | `088c84fe639638b3623f2278a91b08e24e614964` | 43638160793 / 132579470930 | 3 pass, 0 fail, 51 asserts, 95,22s; producer.prepare, verifier.verify e proof.acceptsOutput, cada um com positivo histórico antes da revogação |
| CHECK36 | `f29f9f7acdc860590581d76e1d276139da7af1e3` | `42bb400783f50b06c5925a1411c94a33734bc95c` | 43638533816 / 132580630166 | Global FAIL: 13 erros Sucafina externos ao recorte; CLI/WP10 e geração/check/typecheck Atlas/spawn/guards success na fonte |

Request hashes:

- MI06: `b753a2c99edf373a1d754e7db32c2f9a6dd5a5021544beecf7a785bd7788eb54`.
- MI07: `9f6d6f3e5a949573c5b05710150172c9541668c88ac9233b2485a807f3a743ef`.
- MI08: `ae25bc1b17bb395a8319e3cd169a2f5e5ef1cf75b46ea2a313a8ff6bf9233ccb`.
- CHECK36: `1925b62e904109f2044382644dda7e45ac78a28f07587e9bb108137cd9638dd7`.

MI07 conserva timeout cooperativo 225000 ms e externo 240000 ms. O log acaba em `memory.fence-final-request-headers`, phaseMs=18805, elapsedMs=225014, aborted=true; a falha acontece **antes** do caminho stale que MemoryA27 altera. Preservação stale, assert 580 de captura corrompida e asserts 583–585 de revogação final não foram alcançados. Não atribuir o timeout à correção nova sem prova, nem encerrar o cenário histórico com MI08.

MI08 comprova positivos reais seguidos de recusa por revogação do principal da fixture, mantendo Request/headers/seleção/Atlas e mesmo output, sinal não abortado; logs registram canonical reads 2/2/4 e `nativeExecution:false`. C08/SQLite, fonte Procurement, C12/BCS, Atlas e Gitleaks8.30.1 são reais; principal/grants/caso/run/model metadata/saída estrutural são seed de fixture. Não há Session/modelo/skill carregada nativamente, publicação nativa, restart de processo→recall→UI ou AM05 integral.

CHECK36: o log mostra checkout explícito W36, geração e check canônicos sem diff de gerados, spawn 4702 arquivos/66 sites e guards78regras/2217paths/0gates/53warnings/0errors. A falha global contém WP04=3, WP06=4, WP08=5 e WP09=1 diagnósticos. Não transfiro esse PASS parcial a outro conjunto de blobs; não executei o check no alvo. Artefato foi identificado pelo recibo; seu conteúdo de archive não foi examinado.

## 3. C13 — condições, memória, privacidade e encarnações

**Revisão estática favorável, aceite NEEDS_EVIDENCE/HOLD.** Owners WP14 (regra e seleção pura), WP10.T07 (BCS/Atlas/persistência) e consumidores UI/review.

Contraprovas consideradas e barreiras observadas no SHA fixo:

- Owner diferente ou mesma caseId em nova encarnação: `atlas-projection.ts` deriva owner do installation/project/case/incarnation, não de entrada livre; `atlas-memory.ts:32–75,188–249` cruza case real, membership, envelope, record, original captures, output e source maps. Ref/task/pr/logbook empresarial falso não é aceito pelo mapper.
- Revogação de campo/registro: dependências completas são resolvidas antes de construir o store filtrado; recall canônico recebe explicitamente task/owner derivado. Após o recall, o código relê caso/partição/outbox e resoluções, verifica continuidade e revalida. Falha retira o resultado inteiro, não só uma evidenceRef da exibição.
- Corrupção de captura com fonte ainda autorizada: o leitor original cruza `captureDigests`/envelopes/fold e MemoryA27 exige captura real; não “corrige” o original para o conteúdo atual.
- Cache/lista/ranking: `recall.ts` e `invalidation.ts` prendem instalação/projeto/principal/revisões/policy/versões/encarnações; `reauthorize:true` acompanha mesmo decisão reuse. `rankSfAtlasRecall` relê cada candidato no egress, inclusive o conjunto da partição, em vez de só comparar o primeiro dado capturado.
- Materialidade (`materiality.ts:53–91`): referência/fields/período/critério/base escolhida; material/irrelevant/unknown explícitos. Fingerprint normaliza somente ordenação/timestamps válidos, preserva valores empresariais; ausência de fonte não vira escolha atual. Dedupe em `signals.ts` é condição+mudança; reabertura exige mudança distinta e resolve exige resolução independente.
- Registry (`signal-registry.ts`/ `outcome-selection.ts`): seleção humana atual, choiceDigest preservado, incarnation/version/principal, source fence e expectedStorageVersion/CAS; namespaces de preferences explícitos. Listagem reautoriza e refaz projeção, refs e estado antes de egress.
- Resultado observado (`outcome.ts`/ `domain-outcome.ts`): unidade/moeda/período/coverage/expected precisam coincidir; observation tem cutoff válido e fontes autorizadas; delta apenas quando comparável. “not-attributed” e limitações causais são explícitos. Consumidor de review apenas encaminha resultado do produtor.

Esses fatos são evidência de implementação, não prova de todos os interleavings. AM03/AM05 ainda requerem dois atores no mesmo perfil, revogação real de registro/campo e import mesma ID/nova encarnação na composição e UI após restart.

### Lacuna integrada project/policy (não alegação de vazamento)

O contrato C17 inclui `projectSlab` de procedimentos autorizados e C13 admite project somente para procedimento explicitamente revisado. `atlas-projection.ts` implementa mapper puro project com policyRef/review/sourceDigest/frecency, mas o BCS instalado `business-context.ts:203–223` não oferece resolver/continuidade policy; `atlas-memory.ts:82,131,166,216,235` aceita case-event e emite/lê somente task. `business-services.ts` não injeta porta de policy nessa composição. Portanto, mapper/tipos project não sustentam declaração de integração projectSlab. Registrar como **lacuna de integração a completar ou demonstrar por owner WP10.T07/WP14.T05**, não como bypass: o comportamento encontrado recusa de forma segura. Não invento um segundo finding de segurança a partir dessa ausência.

## 4. C15 — catálogo e carregamento versus execução e consumo

Manifest `product/ai/manifests/resident.json`, blob `453c6f3a5b48c081223909af8293f854ad31d7c8`, contém exatamente 5 perfis/18 skills/8 packs/39 rotas/39operações. Revisei as IDs, grants, routes, digests e schemas do catálogo; não os confundo com execução.

`product/ai/resident.ts`, blob `7e3d3849272bb5755d793a9e2b00ad34c523c188`, verifica matriz normativa, presença de schemas, paths contidos, SHA256 dos bytes e conteúdo parseado. Probe1/1 é explicitamente distinguido do bundle completo.

`host-binding/resident-agents.ts`, blob `a1413fd5224f373d704bbdfca7a489a904875d00`, reserva fonte e raiz física, grants por interseção perfil/skill/operação, registro nativo aditivo e desativação por finalizer. `skill-loader.ts`, blob `0a26a1ed086b9ce0a4a1907a233b705e6061e659`, linhas41–84, chama SessionV2.skill(resume:false), compara messages before/after e exige a mensagem sintética exata; relê arquivo/path/bytes após carga e emite loadedMessageId/digests reais. Não há fundamento para repetir um finding genérico de “hash apenas declarado” nesse loader.

**C15 permanece NEEDS_EVIDENCE:** falta no material examinado a prova composta das18 cargas→saídas persistidas→consumidores reais após reload, contribuição dos 5 perfis e revisor em execução/sessão próprias com fontes atuais. AM01/AM03/GNATIVE não são substituídos por fixtures Memory, manifest ou SkillLoadReceipt hipotético. A verificação de C16/lease/rotas globais é agregada pelo revisor principal.

## 5. C17 — durabilidade e Atlas packaging

`atlas-memory.ts:129–185` usa source fences antes do commit, transação state atlas+outbox com versões esperadas/checkNamespaces, releitura de ledger+case+authority sob snapshots atuais, store síncrono snapshot-local, emit real canônico com scanner; append/envelope/originals/captureDigests/outbox são staged juntos e receipt committed só sai do await da transação. Replays settled conferem identidade do evento e reautorização antes de retornar recibo anterior. Scanner hit grava refused sem apagar caso; ausente/timeout/erro não cria memória. `atlas-store.ts` folda e valida tipos/templates/identidade canônica, sem I/O async. A implementação não é evidência suficiente de rollback/crash/cap/concurrency; faltam os cenários obrigatórios no candidato.

Packaging inspecionado:

- `modules/atlas/boundary/src/business-memory-entry.ts`, blob `06f8085df12d57baf7973d0df500da3e366dc29a`: reexports diretos fábricas canônicas e módulos puros; tipos de store, sem concrete durable factory nem scanner export.
- `modules/atlas/boundary/script/build.ts`, blob `69d8473a2dd08704d7aaf8bf36a2930cb8de3e31`: apenas descritor business-memory intercepta importer absoluto exato memory-emit.ts + literal ./scanner.js para native-memory external; exige uma aresta, import nominal literal NO_SCANNER_NAME, zero spawn hits e recusa dynamic import/require/eval/Function/computed globals; hash fixo de allowlist e superfície bound exata.
- `native-bound.ts`, blob `fb3d542eb22e9b8dc9a139ce1ff98189812d6e0d`: exports bound preservados e apenas scanner funcs/types aditivos. `atlas-scanner.ts` importa scanner por native-memory, spec/path/version host, gate clean/hit/could-not-run.
- package export business-memory-ports aponta ao par gerado. Pares fixos obtidos: business JS `cfc144ffec16c1eec41b7350ae8c8d47452088c0`, DTS `7331e839a166dd9690610b99ec6b595aec50c6e5`; native JS `820a3010be24a817edae7ff26299919d448ad4bf`, DTS `bc73667c5513e622ff2b5f4f553605fb3532b395`.

**HOLD ATLAS-PACKAGE/prova composta:** CHECK36 suporta apenas fonte W36. Não gerei nem executei AST tests, guards ou pacote. AM05 exige trace do módulo real, restart de processo, recall e mesa, scanner clean/canary/hit/ausente/timeout/erro, rollback pré/pós commit, idempotência/race/cap e digests dos quatro gerados no candidato. O conteúdo gerado foi obtido para identificação; revisão semântica se concentrou na entry/generator/canonical consumidor, não uma alegação de releitura completa dos minificados.

## 6. Handoff ao revisor principal

Manter REQUEST_CHANGES. Preservar R1-W23-C17-BETWEEN-OBSERVATIONS e MI07 FAIL. Fechar apenas a repetição do finding antigo de MemoryA27 no sentido **fonte corrigida e blobs consumidos**, sem aprovação C17/AM05. Separar explicitamente:
1. correção fonte identificada por W e blobs;
2. consumo exato no bundle fixo;
3. provas existentes executadas em S/W, seus callbacks/negativos realmente alcançados e limites;
4. provas compostas obrigatórias ainda ausentes.

Mudanças após `0ce090...` precisam de recheck independente. Não fiz merge, aprovação, postagem de comentário, commit remoto ou declaração GLOBAL_RELEASE. O revisor principal é o único writer dos novos recibos na PR50.

## 7. Complemento final de leitura normativa e proveniência

A pedido do revisor principal, também concluí a leitura integral, por blocos contíguos e sem resumo substitutivo, dos três anexos abaixo no planning SHA `dbf9547211d9b0fade619790de7c19c0869b7c7d`:

| Caminho em docs/sf2h-plan | Blob | Linhas do conteúdo recebido |
|---|---|---:|
| work-packages/WP07.json | `677eb6f87ba0a4a4e89cc7bbcd001f2c150161a7` | 830 |
| work-packages/WP09.json | `77133cbba49108eca5d9a4f9b8b3cace025d18cd` | 1183 |
| work-packages/WP10.json | `1c7fef239ba8d4e8de77b13ec4803e87d493c133` | 1683 |

Critérios reforçados por essa leitura: WP07.T03.SUC.03 requer consumo do previsto/observado na mesa e abertura da fonte; WP07.T02.CHK.02/04 e WP07.T04.CHK.03 mantêm revogação sobre conteúdo preservado/arquivo e comentário versionado. WP09.T01.CHK.04/60, WP09.T06.CHK.04 e WP09.T07.CHK.03 exigem revogação nos limites reais, C07/skill/consumidor no mesmo candidato e recusa stale/retry sem duplicação. Esses caminhos de UI/Relay/export são responsabilidade do revisor principal/agregação e não recebem PASS por este subsídio Memory.

WP10.T02.CHK.10–11, WP10.T06.CHK.08–10, WP10.T07.CHK.02/03/05/06/10/60–62 e WP10.T04.CHK.01/11 tornam explícito por que catálogo/carga/mapper, prova fonte e driver reaberto no mesmo processo não substituem prova de produto no C fixo. A fonte precisa preservar a distinção C/D; D arquiva e não recebe uma execução fictícia. Nada nessa leitura muda REQUEST_CHANGES ou autoriza executar provas nesta missão somente leitura.

Proveniência AGENTS: consultei a árvore Git exata `modules/atlas` (`cf7fdc434560d994fbe66e821a621622d0b2c85b`) do SHA fixo via GitHub MCP. A resposta recursiva contém 1553 entradas, `truncated:false`, e nenhum `AGENTS.md`, inclusive ancestral dos arquivos boundary/packages examinados. Resultado bruto preservado em `aux-memory/atlas-tree.json`. Aplicam-se as instruções de raiz já lidas; não foi encontrado AGENTS local adicional de Atlas.


