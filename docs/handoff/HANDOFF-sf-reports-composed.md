# Handoff — sf-reports-composed

SHA: 9c8502cf67b56820cc9a3bcde38c17ea1036e2e5 (code; this handoff is a later documentation commit)
Data: 2026-11-20 (UTC)
Estado: partial — composition ready for the lead's single Reports gate; no acceptance run yet

Branch: sf-reports-composed.
Frozen UI parent: f1e8aa1c8b622cb99e6ee5e49bb049fe77264de4 (sf-ui-c02).
Original integration base: f7dd58e32bc834f1485df20b91adbf759b4c4ad0 (sf-join-four).
Ingress/config provenance: sf-continuation-reports at 40f935a39f1a686a2b0ac011999632ea37ffa581, draft PR #396.
Owner: Session 5 Reports composition only. The lead owns every Actions dispatch, PR decision and merge.

## Feito

- Re-read sf-ui-c02 immediately before creating this branch: its live head was still f1e8aa1c8b622cb99e6ee5e49bb049fe77264de4. The new branch was created at that exact commit. No write to sf-ui-c02 or any protected integration branch.
- Retained all Session 1 UI and assertions at that frozen tip. In particular, commit 33fd90d66ebb5ad0d1ab11008e83b6302cc4f4e4 had already fixed successor availability by using the real, admitted dashboard.dashboard-agenda and dashboard.dashboard-review-preserve operations. No grant or availability entry was fabricated, and that fix was not duplicated.
- Ported exactly the three reviewed ingress/config files from 40f935a: reports-support/production-installation.ts, reports-support/fixture.ts and e2e/playwright.production.config.ts. GitHub compare against the frozen UI tip confirmed no unrelated file changes.
- Reports now prepares its original installed configuration with installedShellOrigin(), owns the real CLI listener at 127.0.0.1:4174 with --public-origin equal to the preview origin, redeems the original local-operator enrollment and uses unchanged connectInstalledShell to select the issued server credential and real project through native controls.
- The production config identifies the exact Reports spec using the existing filename normalization, sends that preview's upstream traffic to the owned listener, and does not start the WP04 fixture for Reports. Public browser requests stay on the preview origin, normally http://127.0.0.1:3000. No origin, CORS or allowed-host rule was widened.
- The Reports fixture rejects any resolved trace/video/screenshot mode other than off before enrollment or credential entry. The spec's existing off settings and original one-worker/zero-retry requirements remain. Playwright 1.59.1 source was previously reviewed: file test.use options are applied after project/CLI defaults, and the worker starts tracing from the same resolved option registration.
- Fixed the remaining integration race with four added lines in reviews/agenda/index.tsx:69-75: selection invalidation now aborts the current preview read before clearing its displayed result. The existing post-await and catch guards both inspect that controller's aborted signal, so an older record selection cannot restore a confirmable preview. The existing submitting/outcome-unknown guard prevents this path from aborting an uncertain preserve mutation. No automatic retry was added.

## Changed files in this composition

1. packages/app-shell/e2e/playwright.production.config.ts — exact Reports upstream selection.
2. packages/app-shell/e2e/sucafina/reports-support/fixture.ts — preview base URL and capture guard.
3. packages/app-shell/e2e/sucafina/reports-support/production-installation.ts — original installed owner at the permitted listener.
4. packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx — abort stale preview when selection changes.
5. This handoff.

No assertion file was modified by this composition. No runtime/application.ts, schema, suites.json, workflow, exported digest, baseline or protected branch was modified.

## Preserved contracts

- Native record discovery resolves every actual opaque record reference under the original admitted call. It does not substitute a page-limited record catalog or infer a selection from a count.
- The frozen Session 1 tests still require Projects 25 to 24, exactly one source record omitted, all remaining project values/periods unchanged, other section values unchanged and source snapshots unchanged before/after removing a selection.
- A new revision is prepared through the original dashboard operations with explicit retained record references. Its projection must contain exactly the retained 24 actual project IDs and the changed original financial value 190. Its previousReviewRef and section order remain exact.
- changeForecast retains the original admitted CAP04 read, year, original source 110, explicit draft review, no early write, exactly one confirmed mutation, CAS version increment and reload assertions.
- Source navigation retains exact authorized origin/path/year and original review immutability. The latest Session 1 additionally requires a successful year-selected CAP03 read and the displayed original producer total.
- exportReview retains the original current-owner read marker, preserved comments, real artifact download, exact same-origin GET ?sf=review-download, MIME/attachment checks and actual DOCX/PPTX package semantics. reviews.export.docx/pptx remain Schema.Never.
- Revocation still requires zero protected content/controls. Session 1's native-toolbar adjustment permits only its public Refresh access control; it is not a new permission added here.
- No dead console, synthetic principal, fake response, baseline, coverage, GO, deploy or SF_ORCHESTRA_WEB_PACKAGE_VERIFIED claim.

## Merge order and open work

No merge was performed by this owner. This branch is a reviewable composition of the UI owner's exact commit plus the lead's reviewed ingress/config, not a second replacement implementation.
Draft PR #396 remains the isolated ingress/config review. Session 1 remains owner of its UI branch.
A complete handoff requires a successful gate for this exact composition. The lead must record the resulting snapshot/code SHA, run/job IDs and artifact before qualifying it for integration.

## Verification and remaining evidence

- GitHub-only source review and compare/readback completed. The published code commit differs from its frozen UI parent in only the four code paths listed above.
- No shell, local build, local typecheck, local test or local guard execution.
- No CI was dispatched by this owner. No sf-ci run, package, artifact or package sha256 was produced here.
- No current runtime failure has yet been observed on this new composition.
- Historical run 44631696084 used a diverged candidate. Its first temporal failure was reports-support/review-flow.ts:253:27 waiting for CAP04; its first explicit expect at :177:29 received HTTP 500 from the original JSON source download. Runtime application.ts in that historical code is byte-identical to the assigned base; no cause for that 500 was proven or patched here. Those historical lines are evidence to inspect if the new gate reaches them, not acceptance or proof of a current defect.
- Previous run 44646379209 failed all four cases at reports-support/review-flow.ts:21:30 before native Reports ingress. This composition changes that ingress and includes the UI owner's later native review fixes; the old failed gate does not qualify it.
- Guards: not run by this owner.
- sf-ci jobs: not run by this owner.
- Baseline/artifact: none from this composition yet.
- Package/sha256: not created by this owner.

## Como retomar

1. Lead freezes this branch's final head (the code SHA above plus this documentation commit).
2. Create the permitted ci-run snapshot with the smallest supported nominal request below. Run the entire Reports spec, one worker, zero retries; retain original assertions and deadlines.
3. Record the actual first failure file:line or all success results. Do not repeat an identical failed gate without a concrete code change; stop and record unbound if the same point repeats without change.
4. Coordinate any subsequent native producer fix with Session 1 before editing another owned path. Never replace runtime/application.ts or relax authority/assertions.
5. Only a success result for the composed candidate can qualify this partial handoff. Integration order, the single final sf-ci and factory package remain the Session 5 lead's responsibility.

```json
{
  "package": "app",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": ["e2e/sucafina/reports.spec.ts"]
}
```
