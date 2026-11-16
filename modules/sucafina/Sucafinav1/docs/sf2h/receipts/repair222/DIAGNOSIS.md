# Missão 222 — causa, correção e fronteiras AM02

**Epoch:** `causal-ci-e1-browser222`. **Source commit:** `6c2002b712ce08a6c1f335458d4175f8420743e9`. **Execução nova:** `NOT_RUN`. Nenhum resultado de CI antigo constitui prova do código novo.

## Causa verificável no B16

O run histórico `43781314836` / job `133018910748` executou somente `Sucafinav1/test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts` e terminou em `FAIL_SCOPED`, com `denied authority-unavailable` em `native-capabilities-fixture.ts:63`, originado na chamada de `readBiPresentation` em `performance-public-c16-reopen.test.ts:85`. `nativeValue` somente expõe a recusa; não é sua causa.

A primeira perda de autoridade ocorre **entre a lease nativa e o consumidor BI**: a prova fazia `product.native.lease(Tool.Context,"sf_bi_view",inputDigest)` e passava diretamente o contexto ainda não consumido a `readBiPresentation`. A função chama `readBiView` → `authority.receiptFor`. O registro em `product/host-binding/execution-context.ts` somente disponibiliza `receiptFor` e `requestFor` depois do consumo uma única vez de `registry.consume`, realizado pelo dispatch autorizado via `validateDomainContext`. A lease pendente tem `used:false`. Assim, a negativa `authority-unavailable` é legítima e deve continuar.

Não se comprovou perda de `principalRef`, `policyVersion`, `accessRevision`, `SkillLoadReceipt`, `hostId` ou `providerGeneration` nessa primeira fronteira: a chamada falha antes do recibo, por ausência de consumo. Não atribuir a falha ao host, ao BI, ao request-body nem à reconstrução após reabertura sem observação nova.

## Caminhos positivos distintos, mesma porta

1. **Request autenticado e C15:** `createNativeFixture.prepare` usa o `Request` original, `product.human.admit` com POST/origin para `analysis.start`, `runs.create/attach`, `SessionV2` e `loadSfSkill`. `verifySkillReceipt` reabre a skill e confirma digest de fonte, conteúdo, mensagem sintética de carregamento e vínculo a `runId/nativeSessionId`. `product.native.bind` revalida principal, caso/versão, sessão, perfil, seleção, policy, accessRevision, hostId/location e geração. `model` na fixture é apenas metadata da sessão, não inferência atestada.
2. **Agente/ToolRegistry/bridge privada:** `fixture.wrapper` atravessa o `ToolRegistry.materialize().settle` nativo e a contribuição `Host.Contribution`; `sf-mcp-bridge.ts` cria `InMemoryTransport` privado e demanda uma lease por `Tool.Context`/digest. `dispatchSfCapability` consome `registry.consume` via `validateDomainContext`, chama a porta de domínio real e compara recibo canônico, principal, callId, input/resultDigest e generation. Não há fake MCP ou engine paralela. Isso é um harness direto, **não uma mensagem inferida de provedor**.
3. **UI/consumidor BI:** `fixture.ui` continua usando `product.ui.admit` + `dispatchSfCapability`. O novo `fixture.uiPresentation` pede `product.ui.admit(Request,"sf_bi_view",digest)`, chama `product.ui.validate` para consumir exatamente essa intenção, e só então chama `readBiPresentation` com o contexto UI revalidável. O `finally` aguarda a leitura e executa `finish`. Compara a projeção `BI01` ao valor realmente retornado pelo C16 no mesmo domínio.
4. **Negativa preservada:** `readBiPresentation` com lease nativa **não consumida** deve continuar retornando `denied authority-unavailable`; o teste agora o afirma explicitamente, em ambos os ciclos.

## Reabertura, grant e revogação

`fixture.reopen` revoga bindings antigos, limpa o mapa de receipts observados, fecha/reabre o mesmo armazenamento, substitui o `hostId` e incrementa a geração; a nova `prepare` cria sessão/run, carrega skill e obtém binding novos. O teste compara gerações 1 e 2, exige `providerGeneration` do recibo e recusa contextos/bindings anteriores. A tentativa `sf_maestro/sf_dashboard_read`→`sf_kpi_explain` fora de grant ocorre nas duas gerações; o replay do mesmo callID e o `principalRef` em payload também continuam negados.

A nova negativa final revoga a role do principal **no snapshot persistido de Dashboard**, via `revokeOwner`, depois das provas positivas. Ela exige `product.ui.admit` negado e tool wrapper/private MCP negado em cada uma das três portas. Essa revogação não altera `grants`, C15, policy nem registry por introspecção. A role é reavaliada contra o request pela autoridade de C08.

O `Request`/HTTP-body foi inspecionado: o harness usa `Request` nativo sem construir JSON HTTP para essas leituras; `runtime/request-body.ts` é o parser público que limita streams, mas não participa desse erro direto. Não reivindicar uma prova de ingresso HTTP browser/UI completo que não foi executada.

## Compatibilidade e proibições

**Raiz da falha: consumidor de teste.** Não é necessário patch de runtime/producer para 211; não existe patch inerte fictício. 211 incorpora apenas os dois blobs de teste/fixture indicados no handoff. `product/contracts/host-context.ts` permanece com 219. `observe-native-c16.ts`, skills de 196, 39 operações, agentes, fonte C15, guards, recibos de aplicação e demais branches não foram modificados.

O `run` B16 é somente evidência histórica de falha. As novas positivas, negativas, reabertura, revogação, validação CI, recheck independente e qualificação AM02 permanecem **NOT_RUN** até nova seleção executada por 214 sobre C composto por 211. A meta nativa continua pausada; `GLOBAL_RELEASE=false`.
