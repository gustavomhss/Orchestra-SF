# W08 / S03 — handoff terminal da sessão sucessora e2

**Estado: ARTIFACT_READY / NOT_INTEGRATED / NOT_QUALIFIED / GLOBAL_RELEASE=false.** A autoria exclusiva de W08 está completa no branch `sf-ux-w08` / PR [#123](https://github.com/gustavomhss/Orchestra-SF/pull/123); **NÃO MERGEAR PR em bloco** porque o ancestral de coorte incorpora outros outputs. 114/S0-C-e17-browser114 (PR65) mantém a integração; 120 (PR106) CI e 119 (PR107) compiler/guards. A Goal nativa permanece pausada.

## Autoridade e fencing

- Novo ator: ChatGPT GPT-6 via GitHub connector `gustavomhss`. Session ID não exposto; requested-model Astra não alterou effective GPT-6. Epoch `ux-native-w08-e2`; e1 revogado.
- Fence/HEAD conferido antes da primeira escrita: `e3b1940b7ffe5dd5c7b96fdfcb4c0d1805b1d940`, tree `b32a612fd464b3a44d0f9286741738ac7f728139`. Sem escritor conflitante observado no momento do CAS; sucessão S0 grant `8852ed4a060f6eb3b49c142b894852d0af49740f`.
- ACK e2 real: `ACK-W08-e2.json`, commit `b756c6ce4f5cb1d4e77bdfb1a841b2f222e238a3`, tree `a70554359eba31f51845de03f9b0e2488956c82d`.
- Commits de produto: `cb987ca6d9d5f02afd1588af1efc3ab84ac82dcf` (seis files) e `85391432a6a8d9ac17d285f665d6b364b44b72db` (type-only bindings F01 Schema), material tree `c2ccd39adc980222cfbfe8db71b3a72b9627cd81`.
- Todos os updates de HEAD feitos via GitHub MCP e CAS `expected_sha`, `force:false`, sem reset/rebase/force.

## Seis arquivos de produto verificados por fetch remoto

**Preimage de todos = ABSENT** no HEAD original e2; propostas originais estão retidas em `receipts/native-ui/W08/proposed` e nenhum avanço anterior foi apagado.

| Path alvo | Blob instalado |
|---|---|
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/draft/index.ts` | `be374a69825b2f1bae7589ba5b46cb633371b1eb` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx` | `25cc846b83a3c89cc1b1f90aeb2daff5d82865ee` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/s03.css` | `c824658aefddab52631c09209bc48183c6e8c3f0` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/receipt/index.tsx` | `e8ac63822a4de506b4453121b363c5e4b30e8f65` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-s03.ts` | `776a4726a0ffb9222998cdfb28f0f0631ff85f82` |
| `packages/app-shell/test-browser/sucafina-native/s03.test.ts` | `fbc5e62bf762f92433536ede01e6ab2e67408f00` |

Manifesto integral machine-readable: [ARTIFACT-W08-e2.json](./ARTIFACT-W08-e2.json). O código é o original de seis proposals reaproveitado com correções conservadoras: CAS exato de versão esperada (incluindo `0` vs `null`), tipos F01 canônicos, union discriminada de receipt, copy typed effect-state e reutilização do `sf.common.*` congelado. Todos os paths escritos são da allowlist W08. As únicas diferenças de W08 após os commits de produto são receipts próprios.

## Contratos, invariantes e qualidade

- Os exports públicos principais são `createSfDraft<Value>(input:SfDraftInput<Value>):SfDraftController<Value>`, `SfChangeReview(props:SfChangeReviewProps)` e `SfReceiptView(props:SfReceiptViewProps)`, com as assinaturas exatas de `component-signatures.ts@e283b202`.
- Draft conserva `ownerKey/editScopeKey/surfaceId/identity`, versão CAS e `pendingOperation={operationRef,idempotencyKey,payloadDigest,expectedVersion}`; dirty não é sobrescrito por read, conflito não faz merge automático, `outcome-unknown` preserva identidade, e callback não reenvia mutações.
- `quarantine` oculta o conteúdo privado sem descartar intenção; `restoreSameAuthority` é exclusivamente chamável por F01 após releitura real de autoridade/ACL; `revoke` apaga cópia privada, intent e fence. Sem localStorage, cache persistente ou URL com conteúdo.
- Review renderiza somente snapshots/effects fornecidos, só chama `onConfirm` após `SfReviewConfirmation.kind=admitted` e estado/bloqueios compatíveis; não calcula números financeiros. Receipt só renderiza recibos reais do produtor, separa `confirmed-by-authorized-refetch` de receipt e `onReconcileRead` nunca faz retry de escrita. Denied/session-expired oculta dados.
- Estilo reutiliza tokens Mx/Orchestra; responsividade usa fluxo e breakpoint 400px. Sem backend paralelo, stubs, schemas permissivos ou generated edits.

## Bloqueios de integração e patches compartilhados

1. **F01:** Schema/context tipos públicos e registry provider com `createDraft` injetado exclusivamente por I00. Tipos já corrigidos em S03 para importar `@orchestra/schema/sucafina/context`, sem import runtime do provider.
2. **F02:** `@orchestra/schema/sucafina/common` com união fechada `SfOperationId` e transporte real; ausente nesta branch, **BLOCKED_INTEGRATION**, não bloqueia código standalone autorado.
3. **F03/W04:** entrypoint `../frame` deve reexportar `SfSource`, já definido em `frame/types.ts` de W04; `SfStatePanel` e demais exports devem ser compostos no mesmo C. Patch exato/preimage está em [SHARED-PATCHES-W08-e2.md](./SHARED-PATCHES-W08-e2.md). Nenhuma alteração na branch W04 feita por W08.
4. **I00/114:** registrar os símbolos `SF_S03_COPY`/`SF_S03_COPY_BR` no dicionário Orchestra, junto ao `SF_COMMON_COPY` de F03; antes aprovar editorialmente as novas chaves `sf.s03.*` ausentes do copy manifest congelado. A integração não pode afirmar aprovação por mera existência do arquivo.
5. **Intake:** a PR #123 é draft e inclui diff coorte anterior; consumir **somente seis blobs de produto** acima, verificar preimage do candidato e pedir consumer ACK, não merge whole-tree.

Fonte canônica `dbf9547211d9b0fade619790de7c19c0869b7c7d`, UX normativo `cbac654784714f68779ae1434d30e6ea8970c4d1`, C58 `422f1ed7b549021d7c62c834c9d9041279112af4`. Assinaturas e locks congelados conforme `ARTIFACT-W08-e2.json`. Drift do `EXECUTION-PROTOCOL.md` é documental (referências antigas 105/101/45 substituídas por 114/120/119), não mudança S03.

## Casos e prova ainda pendente

Os sete testes escritos em `s03.test.ts` cobrem intenção incerta, resultado remoto/dirty, quarantine e revoke, restauração same-authority delegada, sucesso sem projeção e novos checks CAS stale e versão zero. **TESTS NOT_RUN; COMPILER NOT_RUN; CI NOT_DISPATCHED.** A qualificação de UI, teclado/acessibilidade/receipts e casos de produtor integrado não foi executada/atestada por W08. `S03-AC01/AC02` implementados contra contrato, sem evidência qualificada ainda. Tarefas canônicas `WP01.T03` e `WP11.T04` permanecem com prova dependente de composição (inclusive versões/ACL/autorização e casos parciais).

120: após composição pelo114, selecionar `packages/app-shell/test-browser/sucafina-native/s03.test.ts` com dependências/consumidores transitive, dedup por candidato tree/seleção/runtime/fixture; registrar run/job real ou manter NOT_RUN. 119: app-shell `bun typecheck` e guards no mesmo candidato. Não executar suites locais nem marcar green por docs.

## Entrega e lease

Receipts `HANDOFF-W08-e2.md`, `ARTIFACT-W08-e2.json`, `SHARED-PATCHES-W08-e2.md` são exclusivos W08. Estado terminal **ARTIFACT_READY entregue à114**, libero slot autor para integração; correções futuras somente com novo lease limitado, jamais reabrir e1. Consumer ACK da114 e evidências 120/119 **pendentes**. Sem deploy, Azure, merge, tests locais, Goal resume ou claim GLOBAL_RELEASE.
