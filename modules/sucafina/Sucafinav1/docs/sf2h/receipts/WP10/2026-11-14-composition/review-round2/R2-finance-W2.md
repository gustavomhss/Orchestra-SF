# R2 — Rechecagem independente financeira de W2

**Parecer provisório: CHANGES_REQUIRED.** Revisão encerrada para liberar a correção; nenhuma evidência do predecessor foi atribuída a W2.

## Identidade, lease e integridade

- Revisor: R2 (`/root/review_finance`), independente e sem autoria de produto/testes; zero edições de fonte.
- Candidato: `b7a6b5d4b66acf172762aba72f01e424bf9c0b90`; tree `4fba27f0de68963a0da60debb8ced17fe3abd1e8`; pai `a43883c930cf996472b27c524aadb4694c13b5a3`.
- Lease: somente leitura da cópia imutável `analysis/frozen-W2/repo`; todos os builders CLOSED, conforme manifesto e instrução do root.
- Manifesto SHA256: `4a2e542c5ba300543a822f8ac45fd0d37e051339054b28ea84219493f9b29063`. **841/841 blobs** conferem tamanho, SHA256 e git blob SHA1; zero divergências.
- Somente os relatórios R2-finance-W2.json/.md foram escritos. Nenhum teste/build/typecheck/import de produto local, CI dispatch ou mutação remota foi realizado.
- Autores reportados na sessão: root, authority_builder, composition_intake, runtime_analysis e produtores publicados. A identidade individual de cada patch W2 não foi independentemente apurada; R2 permaneceu disjunto em todas as seções.

## Disposição por achado

| Achado | Disposição em W2 | Limite de aceite |
|---|---|---|
| R2-F01 — preparação | Correção estática observada | Ainda falta prova de nova preparação pelo produtor real nas três superfícies; Apply completo não foi qualificado. |
| R2-F02 — cálculo C17 | Wiring estático corrigido | Check próprio falha em R2-W2-F04; execução hospedada do teste de cálculo/Atlas não disponível. |
| R2-F03 — histórico Review | **OPEN, high** | Histórico de registros simples corrigido; Portfolio histórico não alcança o case scope pela UI real após N→N+1. |
| R2-W2-F04 — typecheck | **OPEN, high** | TS2339 observado no job hospedado do próprio W2. |

## R2-F01 — Real default Portfolio preparation replaces the absent callbacks; full producer path is not yet qualified

**Estado:** STATIC_FIX_OBSERVED_HOSTED_PROOF_PENDING. **Owner:** WP10 own Portfolio composition; C12 Apply prerequisite remains with published Procurement/decision producers. **Critérios:** `WP10.T01.DOD.01`, `WP10.T01.SUC.01`, `WP10.SUC.10`.

The original missing-callback defect is repaired in the inspected code. Exact human intent and parent-to-child command derivation are enforced; no new static bypass was found in this bounded recheck.

### Evidência

- `apps/cli/src/sucafina-product/portfolio-services.ts:30-49,85-100`: Default composed preparation is installed; parent-grant wrappers are used by HTTP and contribution prepare/promote.
- `apps/cli/src/sucafina-product/portfolio-preparation.ts:24-47,49-87`: Real human choice/answer checks, domain metrics and Procurement preparation replace unavailable defaults; the private handoff permits only the exact derived child.
- `apps/cli/src/sucafina-product/portfolio-handoff.ts:25-65,67-87`: Parent payload and child command digests are bound in a private WeakMap; persisted parent/child receipt is reopened before mutable candidate evaluation on retry.
- `apps/cli/src/sucafina-product/portfolio-http.ts:29-67,71-101`: Same mounted route accepts dashboard/planner/procurement with exact path, origin, method, closed schema, authenticated intent and case binding.
- `apps/cli/src/sucafina-product/host-context.ts:260-272,812`: Host passes procurementEvidenceWrites and mounts portfolioHttp before extended/procurement fallback routes.
- `modules/sucafina/Sucafinav1/product/decisions/mutations.ts:44-68,231-260`: C08 transaction contains case mutation and portfolioReplay; replay rechecks current membership, incarnation, authority and persisted result identity.
- `modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts:11-41`: Actual default supports only explicit Procurement request amount replace, matching choice, evidence, currency and period.

**Limite da prova:** Source tests verify intent rejection and HTTP replay of a C08 receipt manually committed by the fixture. Positive replay exercises Planner and Dashboard. They do not produce a new valid prepared command through the full Portfolio evaluator, and do not exercise a positive Procurement HTTP request.

**Prerequisito estrangeiro:** Do not label C12 Apply complete. This does not erase the mandatory WP10 preparation/HTTP proof obligation. No producer files were edited by R2.
O default aceita apenas substituição explícita do valor de Procurement. `procurement/decision-host.ts:168–177` não compõe `reviewDigestFor`; `decisions/prepared-apply.ts:59` o exige. O produtor estrangeiro também permanece sem `revalidateProducer`. Essa limitação não transforma a obrigação own de preparar em um bloqueio global.

### Rechecagem necessária

- New valid human choice -> Portfolio evaluation -> real Procurement replacement preparation -> atomic C08 receipt through all three mounted surfaces.
- Retry the actual committed operation after a lost reply; verify no second prepared change, case increment or receipt.
- Changed payload, candidate/choice, principal, membership, source/version and cross-origin requests fail at the actual consumer.

## R2-F02 — Canonical Planner calculation is wired through original request binding, replay, BCS and Atlas; W2 check is not green

**Estado:** STATIC_WIRING_FIXED_CHECK_BLOCKED_RUNTIME_PENDING. **Owner:** WP10 calculation composition; published WP03/WP11 contracts remain owner-controlled. **Critérios:** `WP10.T01.DOD.01`, `WP10.T07.DOD.01`, `WP10.T07.CMP.01`, `WP10.T07.SUC.01`, `WP10.SUC.10`.

The orphaned calculation factory/router failure is repaired structurally. The returned calculation is the actual published canonical issuer output, not an invented alternative representation. A DomainProjection of the stored scenario is assembled after checking that canonical output. Type error R2-W2-F04 blocks acceptance of this candidate.

### Evidência

- `apps/cli/src/sucafina-product/business-services.ts:199-228,277-280,334`: Private calculation case binding checks current C08 membership/incarnation/version without recursively reading case evidence; actual persistence is wrapped and the calculation resolver is passed to BCS/Atlas composition.
- `apps/cli/src/sucafina-product/planner-calculation-services.ts:32-67,68-97,98-142`: Original request/result digest capture is producer-private; published request store and record-only Planner replay issue the canonical ref. Resolver compares the full issued ref, current sources, persisted result and request binding and preserves null/coverage restrictions in its projection.
- `modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts:26-69`: Protected preferences bind actual canonical request to stored scenario; current case and source fences are checked and binding is re-read.
- `modules/sucafina/Sucafinav1/product/planner/calculation-evidence.ts:21-53,65-72`: Published issuer emits kind=calculation with calculationId planner:scenario, engine/input/result/source digests after two record-only replays; recursive/unsupported evidence is refused.
- `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts:159-190,262-278`: Calculation route and current-source continuity proof now exist in the complete router.
- `modules/sucafina/Sucafinav1/product/decisions/result-store.ts:24-44,93-94`: readForCalculation remains version-exact and record-only; historical Review calculation reading is deliberately separate.

**Limite da prova:** Test source uses real SQLite, source issuer, Planner, protected request/result stores, sf_source_get descriptor, BCS and real pinned scanner/Atlas reopen path; coverage and accepted ledger event are explicit fixtures. No hosted W2 execution result was available to R2 at report time.

### Rechecagem necessária

- Hosted W2-successor execution of this exact test selection, with collected-test count and scanner/process evidence.
- Canonical issue -> sf_source_get -> BCS/Atlas append -> reopen -> recall/dedup, plus tampered input/result/engine/source, cycle/budget and revocation failures.
- Any normal case N->N+1 requirement for current calculations must be reconciled by the C09 owner; current reader intentionally refuses it. Review history is not a fresh C17 result.

## R2-F03 — Historical records are repaired, but real Review UI cannot reach historical Portfolio after case version advancement

**Estado:** OPEN_PARTIALLY_FIXED. **Owner:** WP10 Review composition. **Critérios:** `WP10.T02.CHK.02`, `WP10.T01.DOD.01`, `WP10.T01.SUC.10`, `WP10.T03.CHK.01`.

Ordinary case evolution still makes a preserved Portfolio review inaccessible from the actual product UI. Mounting the historical reader alone does not satisfy the preservation journey.

### Evidência

- `apps/cli/src/sucafina-product/review-history.ts:21-76,79-118`: Historical record access requires current scoped-source ACL/fields/period/incarnation and immutable preserved body backed by the original principal’s atomic review receipt; it no longer requires equal source version.
- `apps/cli/src/sucafina-product/review-calculation-history.ts:14-49`: Historical calculation proof checks original C08 scenario/input binding and current case membership/incarnation, without claiming a fresh calculation.
- `apps/cli/src/sucafina-product/review-services.ts:45-60,80-98`: History and actual handoff are mounted, but both currentCase and Portfolio provenance caseFor use business.resolveCase.
- `apps/cli/src/sucafina-product/business-services.ts:165,185-197`: UI resolveCase requires a private caseBindings entry; without it, case-selection-unavailable is returned.
- `modules/sucafina/Sucafinav1/product/reviews/http.ts:140-159`: Actual GET review-read admits a new UI context and calls reviews.read without any case binding; only sf/reviewRef query keys are accepted.
- `apps/cli/src/sucafina-product/extended-http.ts:125-132`: The rendered preserved-review page also reads the review directly without a case binding.
- `modules/sucafina/Sucafinav1/product/reviews/decision-access.ts:34-41`: After current Portfolio read fails, historical fallback first calls currentCase; unavailable prevents history.
- `modules/sucafina/Sucafinav1/product/decisions/result-store.ts:42-44,93-94`: Current Portfolio read is version-exact, so a normal case version increment triggers that fallback.
- `modules/sucafina/Sucafinav1/product/reviews/port.ts:125-153`: Preserved review read reauthorizes decisions; failure denies the saved review.
- `apps/cli/src/sucafina-product/review-handoffs.ts:13-45`: Default handoff uses actual collaboration producer and reopens relation/action/correlation/assignment; no synthetic closure receipt.

### Reprodução

1. Preserve a review containing an authorized Portfolio result for case N through a context in which the case was selected.
2. Advance that same accessible case to N+1 without replacing its incarnation.
3. Open the normal dashboard review-read GET for the saved review.
4. Current Portfolio result read fails exact case version; decision-access invokes business.resolveCase on the fresh unbound UI context.
5. case-selection-unavailable prevents Portfolio history; authorizeDecision fails and preserved review read returns denial. The Review page/report path cannot be qualified as preserved Portfolio access.

**Correção mínima:** Compose a private historical Review case scope from an authenticated persisted result/review reference, with current membership, same incarnation, current version and egress recheck. Apply it to the real read/preview/download consumers that need Portfolio history. Do not accept an arbitrary caller-supplied case or weaken current C09 validation. A host adapter can resolve this within WP10 ownership.

**Limite da prova:** First source checks a simple dashboard-record Review using a manually assembled review service, with decisions explicitly empty; it does not cover the default Portfolio historical composition or Review HTTP. Second source checks historical calculation helper against seeded C08 run/input records and current membership/incarnation; it does not create a real historical Review containing that calculation.

### Rechecagem necessária

- Preserve real Portfolio at N; advance same case to N+1; reopen via actual Review HTTP and rendered page; confirm original body unchanged.
- Preview/report/download and successor comparison through the same authorized historical lane.
- Membership removal, incarnation replacement, altered stored binding/review/receipt and revocation suppress historical content.
- Historical calculation capture plus Review body/receipt and actual closure handoff require integrated proof; the separate calculation helper test alone does not cover that consumer.

## R2-W2-F04 — New calculation projection does not typecheck in hosted W2

**Estado:** OPEN_HOSTED_CHECK_FAILURE. **Owner:** WP10 own Planner calculation composition. **Critérios:** `WP10.T04.DOD.01`, `WP10.T04.DOD.10`, `WP10.T04.QLT.10`.

The candidate’s own CLI typecheck fails. F02 cannot be accepted as a verified working integration on this SHA.

### Evidência

- `apps/cli/src/sucafina-product/planner-calculation-services.ts:112-116`: The check for context in authorizedProjection does not narrow its context union to ProductContext before accessing sourceRefs.

### Reprodução

Falha hospedada, originalmente informada pelo root e inspecionada por R2: run `43548947850`, job `132306683850`, log linhas 561–566. Checkout do SHA W2 comprovado nas linhas 277 e 329–337. TS2339 at planner-calculation-services.ts(116,162): sourceRefs does not exist on ProductContext | runtime/native/UI context union.

**Correção mínima:** Narrow authorizedProjection/context using the actual DomainProjection shape before reading sourceRefs; preserve rejection of unsupported evidence projections. Run required hosted check on the new frozen SHA without casts that bypass validation.

### Rechecagem necessária

- Hosted own CLI typecheck on successor SHA has no corresponding error.
- Canonical calculation projection/source closure behavior still passes the scoped hosted test.

## CI observado e qualificação

O check `43548947850`, job `132306683850`, usa dispatch `55e5300c23b39054874060b34e36abda0a6f443d` e faz checkout explícito de W2. O log contém o TS2339 own e dois gates `agent-scratch` para logs brutos em `docs/sf2h/receipts/WP10/2026-11-14-composition/hosted-round1/` (linhas 702–703). Há outros diagnósticos em produtores estrangeiros; R2 não os alterou nem assumiu sua autoria.

Não há resultado unit W2 disponível neste parecer. O check predecessor `43548298822` não qualifica W2. A inspeção das fontes de teste não é declaração de execução nem AM05.

## Universo canônico e independência

O JSON preserva os **171 IDs/textos/famílias/tasks exatos das 7 tasks**, extraídos diretamente de `context/pack.json`. A comparação com o mapa do builder apenas confirmou identidade dos dados; nenhum status do builder foi aceito como prova. O parecer avalia os caminhos e critérios associados aos achados; não preenche artificialmente aceite dos demais critérios.

A cobertura anterior de margem versus economia, aging pelo evento correto, C08/CAS/migração, C11, materialidade e saídas restritas permanece identificada como revisão histórica de W. Este recheck focal de W2 não converte aquela leitura em prova atual de runtime.

## Conclusão para o root

É necessário corrigir o case scope histórico de Portfolio e o erro own de tipo, resolver os gates de empacotamento e congelar um novo SHA. Depois, R2 deve reabrir a revisão independente e observar as provas hospedadas correspondentes aos consumidores reais. Não há PASS native, AM, CI, global ou de campanha neste parecer.

