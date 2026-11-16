# Missão 206 — HANDOFF-189 / U39 OPEX + U40 CAPEX
**Epoch:** `source-closure-e2-browser206` · **PR existente:** [#150](https://github.com/gustavomhss/Orchestra-SF/pull/150) · **branch:** `sf-ux-n13`.
**Autoridade viva:** HEAD reservado `0dd0ee1275f5b85d6658e1f094617e9b4eaefccb`, S0-FENCE blob `be4642b5782ade8dde8ba8630f1d2e574a4ff445`. Leitura da fonte da 195 no handoff `679e17ecdfec23ab53ce4b23206594874617528d`; **admissão F04 já feita pela 195 preservada**, sem refazer `canRead/save`. Planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`, UX normativo `cbac654784714f68779ae1434d30e6ea8970c4d1`. Modelo efetivo: GPT-6; session-ID não exposto por GitHub MCP, nenhum lifecycle de predecessor inferido.
**Lease aceita:** somente os dois specs nativos e `closure206/**`. Publicação remota por GitHub MCP, expected-head/CAS com `force:false` em cada commit; não houve reset/merge/deploy.

## Resultado de código
| Suite | CAP | Spec | Pré 195 | Pós 206 | Testes escritos |
|---|---|---|---|---|---|
| U39 | CAP04 / OPEX | `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts` | `285db9bfdd046366f8fd814991f9f0724eff445f` | `f72347df8d20a465e478053c976e62fde124348d` | 22 (3 anteriores + 19 novos) |
| U40 | CAP05 / CAPEX | `packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts` | `83ee904b4ecf79248410a7714bb63ed7baf4aaf5` | `3c1fa87f3b1d36e6ebbe2801ca7a9856381893de` | 22 (3 anteriores + 19 novos) |

**44 casos declarados, todos `NOT_RUN`.** Implementações de teste completas, não placeholders/TODOs/skips. Fonte exata dos nomes/linhas e IDs em `CRITERIA-MATRIX.json` (blob `dc34a6a7f611acf7ce7f188599081e973bd9f4c5`).

## Seis critérios e seus cenários completos
As duas suites são paralelas nas fontes, **mas cada uma exige produtor, coleção e identidade próprias**, não totals/planner paralelos.

| Critério | Cenários com asserções escritas no spec (linhas dos dois specs) | Estado |
|---|---|---|
| **U39-AC01** | A01/versões (129); review pré-POST (155); CRUD owner/DELETE (449); monthly entries/edição/CAS (480); annual/12 meses (528); year amount/limpeza (573); deviation/evidência (613); fonte CAP03/import autorizado (731); fonte integral campo a campo e status/missing/zero (1166) | **NOT_RUN** |
| **U39-AC02** | read filtered-empty (129); review (155); filtros/return (676); vazio genuíno (700); not-found (715); readonly (775); denied (803); revoked (822); CAS conflito real 409 (865); validação sem POST (923); held response/submitting (959); lost response/pending (991); late GET/owner isolation (1035) | **NOT_RUN** |
| **U39-AC03** | viewport inicial 320/768/1024/1280/1440, 200/400% (193); todos os campos/ações, teclado, mês grid e reflow (1081) | **NOT_RUN** |
| **U40-AC01** | Mesmas linhas AC01, com `capexProjects`, `capexEntries`, `projId`, CAPEX status, sem import CAP05, fonte original | **NOT_RUN** |
| **U40-AC02** | Mesmas linhas AC02, com owner F01 da instalação/projeto CAP05 e respostas tardias escopadas | **NOT_RUN** |
| **U40-AC03** | Mesmas linhas AC03, com ações/projeto CAPEX e estados específicos | **NOT_RUN** |

## Produtor e prova honesta
O oráculo dos novos casos é o **GET real autenticado** `domain.page.CAP04`/`domain.page.CAP05`, seguido de POST acionado **somente pela interface real/review** e de novo GET com versão original do produtor. Sem `page.request.post` como atalho; sem fixtures financeiras fake, reescrever admissão, recomputar budgets/totals no frontend ou copiar Planner.
- Original: `modules/sucafina/Sucafinav1/runtime/dashboard-budget.ts` blob `b64f2f49b42aea2f2d74d6c1da18a3bce4873365` com coleções OPEX/CAPEX, year 2026, annual/monthly, `deviations`, `budgetYtd` e versionamento.
- Contratos `domain.page.CAP04/CAP05` e comandos `save,delete,save-entry,save-deviation,annual-entry,year-amount`; cache ou ausência de fonte **não** viram PASS.
- Falhas do F04 instalado e do produtor devem ser reportadas como pré-condição ausente/FAIL ou NOT_RUN, nunca convertidas em skip ou prova de sucesso.

## Patch compartilhado necessário → **somente 189/PR65**
**INERTE, NÃO APLICADO:** `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure206/patches/189-budget-surface.inert.patch` blob `5436359403ebf6a738ddd58ed4fa11fb62100534`; metadata `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure206/patches/189-budget-surface.json` blob `c790cf4da67a8ab69c195087c84d33e42af762b6`. Dez hunks com contexto, preimage real `ed94efe4d919eb80e4592057170d03c4b2348eb6`, postimage inerte `1ba0272bee68c30175f779e733eb77bf4485c3f9`, path `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx`. Consumo: filtro/sort F01 owner-scoped na volta detalhe/lista, estado `submitting`/pending sem duplicate confirm, limpeza/owner fence no `finally` tardio; nunca aplicar à 206, jamais alterar domínio/shared fora da 189.

## Insumos mínimos externos exatos → **199**
Contrato detalhado `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure206/REQUIREMENTS-199.json` blob `9e837cf9575f83b0d2f7ffdbbb0e3005a00a7928`:
1. **Duas seleções F04 reais independentes**: manifest U39 `CAP04` e U40 `CAP05`, cada uma com `chapterHref` e `year=2026`, `candidateSha` da integração, CDP host real e Context Microsoft autenticado, suite privada com sourceRecordId e versão do produtor.
2. **Mapeamento REAL do caso de teste e ator**: `entry, source, empty, readonly, denied, revoked, stale, late` em `NativeInstalledCase`, `nativeSelectedCase(testInfo.title)`, `nativeHarness.selectedCase`. O fixture 199 observado em `bd61d0d200952f585f3aff9544ec8932009f5f5d` só tem `entry` para U39/U40 e não entrega `selectedCase`; casos negativos falham fechados, não fingem login.
3. **Fonte original isolada por cenário**: coleção genuinamente vazia, recordId/CAS original preservado, leitor sem write, denial real, revogação com `accessRevision` observada, segundo autor original no mesmo recordId, fonte CAP03 apenas se permitida, projeto e instalação distintos em GET tardio. Não interferir nas sessões paralelas nem usar dados sintéticos.
4. **Callbacks de ação privilegiada F04 verdadeira**: `nativeHarness.revokeViaOriginalProducer({capabilityId,principalRef}) → {committed:boolean}` e `nativeHarness.advanceViaSecondAuthenticatedWriter({capabilityId,recordId,expectedVersion}) → {sourceVersion:number}`. São APIs de fixture F04/199, NÃO responsabilidades do spec 206; falta de callback = falha explícita.
5. **Ambiente privado de execução**: `GITHUB_ACTIONS=true`, `SF_NATIVE_CANDIDATE_SHA=<sha integrado>`, `SF_NATIVE_INSTALLED_MANIFEST=<arquivo 0600 dentro de scratchRoot 0700>`, `SF_NATIVE_BROWSER_ENDPOINT_FILE=<endpoint CDP de host real 0600 no mesmo root>`, requester/holder/denied Microsoft distintos, dashboardAdmin se previsto; sem launch/restart/auth fabricada.

## Solicitação cirúrgica → **200/PR106**
Arquivo `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure206/CI-REQUEST-200.json` blob `ea9f0df6ed6b11cb47df7420f78a97b5d2b855c4`: executar **separadamente ambos os specs com manifestos reais F04 correspondentes** após 189 consumir patch e 199 entregar pré-condições, preservar os negativos, coletar run IDs, logs, estado 409/403, source CAS, capturas e provas de 320–1440px/200/400%. Sem CI pela 206; 191 superada, não acordar dispatcher. A 190/PR107 compila. No momento não há run IDs informados; `NOT_RUN` para testes, build, typecheck, validadores.

## Handoff de integridade e contenção
Último checkpoint de código espec `2953bc15d8b8ed7aff34bbca00a1fc231cecabff`, último checkpoint de matriz/requests `6a309ca2e0c9f4adc1f9b0d9097b234b44e77c82`. `START206.json` guarda lease e ACK sem session inventada; `ARTIFACT.json` registra pre/post e todos os status.
**Nenhum merge em dev, deploy, Azure, engines, guard bypass, restart, teste local ou CI autônomo. Goal nativa permanece `PAUSED`, `GLOBAL_RELEASE=false`.**
