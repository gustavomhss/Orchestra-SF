# WP10 BI composition — W7 candidate

Status: **NOT_REVALIDATED**. This is an own composition payload, not a release or independent final review. Root assigns the published W/tree and equivalent Actions S after intake.

## Pins and decisions

- Base W6 `7c7e5b086a9de405cd3f8e18e8d631af55cf0979`, tree `3deb1ed790fc247a6633c9cc25a11523ae3f61b1`.
- PR29 source `78f80881e94913b9b211bad7d17fbc95467ce0d7`, tree `ffae7f1279c8c7af7b98f19f3ebc04960db75cc7`; predecessor f075 was reviewed, not imported wholesale.
- Keep the canonical WP01 shell and its30s authority polling. BI uses `data-sf-retain-view`; actual accessRevision is emitted as meta/header. No shell source is included here.
- Client refreshes source/authority on timer, focus, visibility and manual refresh; pending reads have bounded headers/body and cancellation. Selection changes invalidate both data/options generations. Authority loss/pagehide clears private data. Canonical logout owns its one POST; BI clears immediately.
- `bi-source` reopens the exact protected projection after destination resolution. Explicit `refDigest` belongs to that current row, is included in admission, and cannot select an arbitrary reference or implicit A/B. Only legacy singular producer drilldown may omit the digest.
- Preserve W5 literal callback bundle insertion and ArrayBuffer fixture body. Source78 fixture's one-script assertion was inconsistent with its restored shell: this payload requires canonical shell plus exact compiled BI asset (two scripts).

## Dependencies and exclusions

Existing shell seam is W6 blob `db1fbf64fc5a0200474a3aa28f1694b3a940c3db`. Owner PR31/50906b86da953f9e6fb24f989c51db0fc69496c1 shell `d69bb554ba35863b0bf248c6aa0382205614d12a` preserves retain marker, logout binding and polling; root may intake it separately.

A/B client rendering consumes owner PR35/217c9bcc75d499eff3884fb4afe662d5c0029935 `analytics/source-navigation.ts`, view and waterfall changes through the separate owner manifest. Our HTTP selector also preserves existing singular drilldown. No foreign file is copied here. Review source changes from PR29, foreign UI code and unrelated snapshots remain outside this payload.

New C17 calculation-history producer seams in PR35 remain **pending their real consumers** unless a separately reviewed composition explicitly wires them. This BI change does not authorize historical financial source links: `extended-source-links` still requires fresh evidence. No original version is attributed to current authorization.

## Counterproofs prepared, not executed

`bi-lifecycle.test.ts` contains4 focused cases: manual/focus/timer refresh and one real logout with a delayed genuine success; canonical authority polling while BI remains pending and real session revocation; a cleared selection defeating delayed real options; exact A/B origin digests from two real Planner sources, including missing/unknown/malformed/duplicate selection and revoked authority.

Lifecycle tests run an isolated loopback server, actual local-operator cookie/revocation code, SQLite/C08/C16 and the compiled client. The operator/domain seed is explicitly a fixture. Timers use a controlled browser clock; authority and source responses are produced by the real host. No installed OS identity/native model/global claim. Browser/process cleanup and105s cooperative/120s outer budgets remain.

`bi-case-access.test.ts` preserves real persisted case-only revocation and late-source discard. `bi-call-scope.test.ts` adds the after-destination-await case-removal negative while the original source and session remain authorized.

Suggested nonoverlapping Actions selections: (1) `bi-lifecycle.test.ts` + `bi-case-access.test.ts` (5tests,120s each maximum); (2) `bi-call-scope.test.ts` (6tests,120s each maximum). These keep each request bounded below15minutes of test budgets plus ordinary setup. Root may combine only after measured evidence supports that budget. Use package `sucafina`, directory `modules/sucafina`, explicit file paths, strict Omni and CI.md. No local tests, typecheck, guards or browser execution occurred. Typecheck/guards remain required on final W. Do not include WP01 browser suites without their required finalizer.

## Reattached predecessor flight, no approval transfer

[Run43580252381](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580252381), job132403235716: W `f075e9824b7d8aed50b7f42c597528ef198177db`, tree `2751625f28928baf371d39576fe46777aa81f74e`; S `dd648c423ab97fbe6e806b620057a328a5816b5f`, tree `ac9a7f96aa0f8bd6b30200c5628c37058e8176b0`. S is W's direct child and only adds `.ci-run.json`; request SHA256 `bc01cc977b331e5538d4dad42e38048c943a2747fde600eb7cee580fd05c371b`.

**FAILURE:198pass/2skip/12fail,2163assertions,24files,2274.65s.** Omni PASS:38spawns/22declared/0delegated, nonce `61ba1e84741e852d5655bf54b0582c01`. BI case-only revocation passed on f075, whose logged single-script page removed the shell; that is not proof for78/W7.

| Path under Sucafinav1 | Failed test | Observed cause |
|---|---|---|
| `test/product/wp02/host-workbench.test.ts` | Dashboard contextual controls preserve a real agenda and record, then review and apply an existing C12 choice | Case selector contained only the placeholder; expected existing case Review the action (line168). |
| `test/product/wp02/host-workbench.test.ts` | Dashboard draft conflict reloads the same draft identity and preserves local edits until the current base is confirmed | Existing case option absent; selectOption timed out at15s (line301). |
| `test/product/wp02/host-workbench.test.ts` | Dashboard discovery fences participant removal after options were assembled | Expected denied/stale after participant removal; received ok with empty cases/drafts/preparations/changes (line439). |
| `test/product/wp02/host-workbench.test.ts` | Dashboard contextual draft retains edits when current write authority is withdrawn | Existing case option absent; selectOption timed out at30s (line489). |
| `test/product/wp02/workbench-recovery.test.ts` | Dashboard recovers a committed draft after response loss, restores only its authorized identity on reload, and fences revoked late discovery | Fixture could not choose existing case; selectOption timed out at30s in editNewDraft line23 (caller60). |
| `test/product/wp02/workbench-recovery.test.ts` | Dashboard discards an uncertain private application review when fresh discovery no longer authorizes its case | Fixture could not choose existing case; selectOption timed out at30s in editNewDraft line23 (caller153). |
| `test/product/wp02/workbench-recovery.test.ts` | Dashboard recovers the same C12 application receipt after a committed response is lost and the page reloads | Fixture could not choose existing case; selectOption timed out at30s in editNewDraft line23 (caller208). |
| `test/product/wp01/shell-recovery.test.ts` | (unnamed) | Actions selection omitted required browser-lifecycle.test.ts last; beforeAll/unnamed failed in browser-fixture.ts67. This is a request protocol failure, not shell product evidence. |
| `test/product/wp10/analysis-composition/alternative-selection.test.ts` | canonical comparison drafts the exact human-selected second alternative and supports only the private replay context | 105000ms cooperative fixture deadline during January draft/private replay; high repeated source verification fan-out. |
| `test/product/wp10/analysis-composition/alternative-selection.test.ts` | comparison capture refuses missing or outside selections and a running draft cannot adopt a newer human selection | 105000ms cooperative fixture deadline during January selection-change/draft. |
| `test/product/wp10/analysis-composition/alternative-selection.test.ts` | annual 2026 canonical comparison drafts the exact human-selected second alternative and supports only the private replay context | 105000ms cooperative fixture deadline during annual2026 draft/private replay. |
| `test/product/wp10/analysis-composition/alternative-selection.test.ts` | annual 2026 comparison capture refuses missing or outside selections and a running draft cannot adopt a newer human selection | 105000ms cooperative fixture deadline during annual2026 selection-change/draft. |

WP02 failures require exact-owner fixes and a new matching run; WP01 failure requires a valid request selection. Four WP10 alternative-selection timeouts remain unresolved by evidence: the separate C17/performance candidate needs its own matching execution. No assertions or budgets were relaxed here.

## Gates retained

All WP00/WP10 criteria, eight final selections, AM01–AM06, three independent reviews, C/G7 and D/G8 remain intact. Teammate static feedback found and prompted the options-generation fence; it is not an independent final approval. This payload has no GLOBAL_RELEASE claim.
