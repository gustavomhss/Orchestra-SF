# G09 closeout review for preserved candidate 14722264806

**The preserved candidate is not qualified. Installed TUI execution found a real missing-fallback defect: two named cases pass and six fail. This branch contains a source repair and unsigned review evidence; it does not claim a corrected distribution or formal PASS.**

**Qualification state: unqualified.** This record separates verified evidence from acceptance decisions and missing authenticated inputs. It does not replace the historical checkpoint, promote a release, or assign any occurrence/finding disposition.

The implementation in this branch adds one focused execution probe for the generic TUI in the original ELF. Actual outcomes belong to the Actions run for the branch commit and its `execution-manifest.json`; the presence of this document or a successful probe is not a formal G09 PASS.

## Frozen identity and existing evidence

| Object | Exact identity |
| --- | --- |
| Original artifact | `14722264806` |
| Candidate source | `3ef84da65d6b8ad7cd3250412bbcabdf90924172` |
| Candidate source tree | `48d57887656fd2e325dee97a7c066bcb8e84bbc8` |
| Producer workflow | `b1e3c29c1b7462872aa3d23b2777a5b619dfb6cb` |
| Producer execution | run `44944208924`, attempt `1`, job `136967815702` |
| Original ZIP SHA-256 | `84e5f993f0d32e91c3fcb7e815e40c3155c1c1c17b80c4d394d3eb57b2b151ec` |
| Installed tar SHA-256 | `dc11455bbcce4565b24cdca53ce3e5ab05f883757f6c0765910a0e4c98147d83` |
| ELF SHA-256 | `ff145b04dc0897b32b7cdd904cf3bba7d793cf4a391d3c02325d3c6125006a9f` |
| Existing recovery harness | `65c6cfa0084cc0dc0b190c6d0bda103c1c189ec2` |

The prior recovery is [draft PR #601](https://github.com/gustavomhss/Orchestra-SF/pull/601). Its last inspected execution is [run 44968592532, job 137043117261](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44968592532/job/137043117261). The corresponding [artifact 14732642812](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44968592532/artifacts/14732642812) has ZIP SHA-256 `2297358a5612c5755bfd5d7b5341981689090da688631cb66e8abceb05c7bd29`.

The new probe uses the existing acquisition and installation-mode verifiers at that exact recovery commit. It does not build or install product dependencies. It verifies the original ZIP, source/tree, tar, package receipt and installed file bytes before invoking the ELF.

## What the published gate actually requires

The inspected [scanner](https://github.com/gustavomhss/Orchestra-SF/blob/ebed903a650cd979d30faa5f4ba6d1f1b175036a/script/sf-ci/team-profile-residue.mjs) is commit `ebed903a650cd979d30faa5f4ba6d1f1b175036a`, blob `10ae99ab085821f0e312ee05479cad3fb723c7b0`.

Its acceptance conditions are concrete:

1. Every occurrence and reachability finding has an exact, nonduplicated disposition tied to the current inventory. Each includes its producer, consumer, entrypoints, owner, action, justification, review source and nonempty test obligations. Occurrences additionally identify the symbol and store field.
2. No occurrence/finding remains unclassified, active legacy, or orphaned.
3. Required inventory and actual archive binding are present. Complete executed negative controls match the pinned scanner/tests, with every required case passing.
4. The review and executed-obligation sidecars bind the exact audit and execution. They authenticate with distinct Ed25519 reviewer and producer identities/keys provisioned independently of the candidate.
5. Every obligation is an exact `{path, fileSha256, caseName}` and matches a passing executed case with job/evidence identity. The producer proof binds the authenticated review payload.
6. The scanner returns PASS only with an empty blocker list.

The scanner does **not** impose a universal Bun end-of-span requirement. It does not automatically require a separate TUI journey for every lexical hit. Specific behavior obligations belong to the authenticated review. Its own limitations state that residue qualification does not replace the separate native-journey and Microsoft-operation gates.

This is a statement about the version inspected. Its published historical adapter targets an earlier candidate. The unavailable local adapter and signed review for artifact 14722264806 may contain additional applicable requirements; this record does not waive an unknown requirement.

## Measurable inventory, without inherited credit

| Population | Independent diagnostic total | Historically reported classified | Historically reported pending |
| --- | ---: | ---: | ---: |
| Occurrences | 19,718 | 2,079 | 17,639 |
| Reachability/evidence findings | 3,146 | 235 | 2,911 |
| Total | 22,864 | 2,314 | 20,550 |

The 2,314 historical dispositions are reported checkpoint counts, not recovered authenticated entries. The recovery session has accepted **zero new formal dispositions**. Until the signed review is recovered and its exact ID sets verified, the historical counts cannot be credited as a current signed result.

The structural supplement examines 2,523 specific findings. Every row retains `resolutionProven: false`; none is a classification. The 83 recovered supplement IDs correspond to 33 Solid tokens and 50 tsconfig findings, not 83 additional accepted dispositions. Navigation grouping is not a semantic review rule.

A finite closure ledger is therefore the exact ID set plus the review's deduplicated test-obligation set. Percentages based on generated files, passing helper tests, or number of workflow steps would misstate formal completion.

## Solid attribution: independent technical review

A separate agent reviewed the frozen implementation, fixtures, controls and documentation in this recovery session. This is technical review; the agent is not the established authenticated QA signer.

No defect was identified in the inspected candidate paths that invalidates these limited claims:

| Claim | Observed coverage | Limit |
| --- | ---: | --- |
| Exact preserved intermediate bytes reproduced | 8 files | Does not establish product behavior |
| Complete tokens in source, intermediate and extracted ELF module | 33 IDs | Does not classify their meaning |
| Exact supplemental Babel endpoints | 28 IDs | Does not fill original Bun map gaps |
| Supplemental AST origins | 5 IDs | Uses the documented v2 projection and exact structural paths |
| Original Bun span ends qualified by the receipt | 0 IDs | All remain `not-proven` |
| TUI branches exercised by the attribution harnesses | 0 IDs | All remain `not-observed` |

The existing job passed 12 attribution controls. It also passed the AST-origin suite of 21 controls with 72 assertions. Three complete AST projections matched, and all five selected tokens had complete supplemental origins. The AST result was actually executed; the earlier appendix sentence “ainda não executado” is superseded by that run, without changing endpoint or qualification claims.

The five AST-origin IDs are:

- `18a091809496a9d5162a36c494b35ee590557c3729af4e738aa9cb214ad45b1a`
- `98e5517da30a5e6b8a3ae98596e9ed9f4d079db4f84785e8d8b8060edc26ae43`
- `cac015cc219832e7b4ac54953d561a981962fc106781d788766660822726c568`
- `1fc85caa720b5b14efca68ac644f48366a10c555d2f1d1a1ae503ab3d0313c11`
- `376ceed62f07f09b65bf8a00538895654f87c95096cb2ca80bac2f59286f580b`

The remaining 28 IDs are the exact set difference from the [33-ID fixture](https://github.com/gustavomhss/Orchestra-SF/blob/65c6cfa0084cc0dc0b190c6d0bda103c1c189ec2/.github/ci/g09-solid-cases.json), not inferred by filenames or substring matching.

The [strict recovery harness](https://github.com/gustavomhss/Orchestra-SF/blob/65c6cfa0084cc0dc0b190c6d0bda103c1c189ec2/.github/ci/g09-recover-solid.mjs) requires 33 supplemental Babel candidates and therefore remains incomplete at 28. Its acceptance expression does not require original Bun end points. The [AST supplement](https://github.com/gustavomhss/Orchestra-SF/blob/65c6cfa0084cc0dc0b190c6d0bda103c1c189ec2/.github/ci/g09-solid-origin.mjs) makes a separate claim; it must not be counted as five more Babel endpoints.

The formal reviewer can evaluate the alternate evidence and choose justified obligations. That decision does not require pretending an unavailable Bun segment was recovered. The existing strict harness and its failures remain unchanged.

Two integration conditions remain explicit:

- A downstream consumer must verify the execution manifest, control outcomes and artifact hashes and recompute sets/totals from the actual rows. An isolated `status` string in an AST receipt is not authenticated evidence.
- The published [historical adapter](https://github.com/gustavomhss/Orchestra-SF/blob/ebed903a650cd979d30faa5f4ba6d1f1b175036a/script/sf-ci/g09-581.mjs) does not register the new Solid control files in `historical.evidenceFiles`. If a review chooses those new files as formal obligations, a versioned evidence registration and corresponding bindings/signatures are needed. No file may be renamed to impersonate an original candidate test.

## Permission fix and retained CLI surface

[PR #589](https://github.com/gustavomhss/Orchestra-SF/pull/589) is merged. The inspected `dev` commit `8bd7645767deb85b286b046a52a4e9f1db100262` has exactly the corrected `packages/core/src/permission.ts` blob `b1baeae5de82fdfe6f5d41fe2da770eb020dfc30`.

[Run 44956890174, job 137006883494](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44956890174/job/137006883494) executed 25 tests, with 95 assertions and zero failures across the permission and session-store-permissions files. The execution snapshot `00ea1840a584c6350550f4d05637efdbedee5f3c` is a child of `a90fcb86b2909249a54adbc8a23d5c4d4ee104d8` with only the CI request added.

That source correction is complete for the tested cases. It is not present in the frozen candidate, whose old source returned allow instead of deny in both selected later regressions. Those tests did not execute PermissionV2 inside the installed ELF and do not establish a Microsoft Team authorization bypass.

The dedicated Microsoft host is a distinct composition. Its previous TUI probe observed seven actual GETs returning empty upstream 404 responses in each of two credential cases. This establishes the named negative bootstrap boundary only.

The original [build entry](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/script/build.ts) compiles the Omni entry, which imports the command registry. The original [serve handler](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/commands/handlers/serve.ts) permits generic serving without an installation; the default command starts that generic daemon. The [attach handler](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/commands/handlers/attach.ts) then invokes the TUI.

Consequently, the Microsoft-listener 404s cannot justify classifying all packed generic TUI code as unreachable. Conversely, success against a generic daemon cannot establish Microsoft corporate authorization.

## Focused generic TUI execution

The new workflow addresses the remaining bootstrap uncertainty in the retained generic CLI surface:

- It uses the exact preserved ELF for both server and attach, verifies process identity through /proc, and requires an actual Linux PTY.
- It creates fresh private runtime/config/data directories, supplies no user credentials, and uses only a generated local Basic credential configured through the real server interface.
- It keeps Omni strict. Product execution occurs as the runner user inside a network namespace containing only loopback.
- Its observer forwards actual upstream responses, including the event stream. It records request/response identity and does not fabricate bootstrap JSON or authority.
- It uses bounded waits and captures failure diagnostics. Cleanup and process termination are not evidence of successful bootstrap.
- It publishes no fixture credentials and binds evidence to source, tar, ELF, harness, workflow, run, attempt and job.

This probe concerns generic bootstrap. It does not cover worktree creation, move, removal, forced removal, editor/export, complete authorization, corporate TUI admission, the individual 33 Solid branches, or formal ID classification.

No repeated old-source permission run or repeated full inventory/AST run is needed to answer this bootstrap question.

## New review route without historical credit

The historical checkpoint is required to authenticate and reuse its old dispositions. It is **not** a universal prerequisite for starting another review of the same preserved bytes.

The published scanner accepts a newly authenticated review bound to the newly computed exact inventory; it has no mandatory reference to an older review. The new producer attestation must bind the corresponding new review payload. Therefore the technical route is to review all 22,864 exact IDs again, reuse independently verified execution evidence where its scope genuinely applies, and execute any additional obligations. None of the 2,314 historically reported dispositions is silently credited.

The adapter for that route must be versioned explicitly for artifact 14722264806 and the registered evidence. It is a new proposal, not a claimed reconstruction of missing commit 1b35f764. Its adoption and the independent reviewer/producer authority remain prerequisites to a formal PASS. This branch does not establish new signer authority or provision signing keys.

The unsigned review index in this branch reads the already preserved diagnostic artifact, checks its ZIP/manifest/report identities and recomputes exact occurrence/finding IDs. It does not rerun the product or scanner, classify by path, accept an old signature, or count the groups as review decisions.

## Authenticated input dependency and closure conditions

The bounded recovery search checked connected files by the exact hashes and queried the original adapter commit directly. The commit lookup returned “No commit found for SHA”. The accessible briefing and later diagnostic reports name the following objects but do not contain their authenticated bytes:

| Required original object | Expected identity |
| --- | --- |
| Local adapter commit | `1b35f7641a54bfe3bf0229c13b547993570b98fc` |
| Signed review file SHA-256 | `88ccaecb26f1906cea6ab715343007a093de742da36cf69449c8b19115e90fed` |
| Review payload SHA-256 | `4f1e46014a484141df28eba9a241b5490bd0d4b60ec0e7e7d5abed053fe4f74e` |
| Producer attestation file SHA-256 | `d96477f227f78088368ea30d0dffaa66984e1aa42069a4391b1661aa8d47d062` |
| Attestation payload SHA-256 | `84d712c45339df7664aef44454ee1cb490136fffa01281764bcf8e59ff61cebe` |
| QA binding SHA-256 | `043dbf735a1a0263706b151979638487be4c0c45a8f996583011c96f20c296a8` |

The exact original full diagnostic, independently established reviewer/producer public keys and signer authority are also needed to validate and reuse that historical checkpoint. A branch or Git bundle can preserve the adapter commit. The search was bounded; absence from its results is not proof that those files do not exist elsewhere.

| Work item | Completion evidence |
| --- | --- |
| Reuse historical checkpoint (optional route) | Exact original bytes and valid independent trust bindings; verify all hashes and complete ID sets. Otherwise review the entire exact inventory without historical credit |
| Complete residual review | Zero unclassified IDs, active legacy and orphans under the applicable signed review |
| Accept attribution method | Explicit authorized disposition of the 28-endpoint/5-origin evidence and exact test obligations |
| Finish applicable behavior obligations | Exact reviewed cases executed on the appropriate retained surface with matching hashes and run/job evidence |
| Resolve old-source permission failures | Legitimate disposition supported by the actual retained surface, or a separately identified corrected candidate |
| Execute formal G09 | Correct applicable adapter, exact preserved artifact, authenticated review/producer proofs and empty blocker list |

Changing the ELF to incorporate #589 creates a new candidate and new qualification bindings. Keeping the old ELF does not make its source defects disappear. Neither route permits copying the corrected-source green result onto the old artifact.

No signing key, signer authority, replacement signature or historical disposition is created by this branch.

## Verified new review preparation

The new review starts from every exact ID, without importing historical dispositions:

- 19,718 occurrences and 3,146 reachability/findings, across 17,501 inventoried files.
- Source report SHA-256: `961f5887408921b93f55ce960e9c4570279335bc94d623cfe2bbddae19e25451`.
- [Index run 44975787464](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44975787464), artifact `14735392840`, ZIP SHA-256 `aeb63841fe5566f85a1f3f78e99e48f488186797548996edbebe615f6bb56f46`.
- Every occurrence/finding ID was recomputed from the canonical identity fields. Full ID sets remain in the artifact; stdout is bounded file-level navigation.

The proposed supplemental adapter with a custom ZIP reader and evidence registry was rejected during technical review as unnecessary for preparation. It is not committed or used for qualification. Preparation already has the exact frozen inventory and binding; the applicable final verifier must be explicitly established before authentication.

## Unsigned semantic work products

`g09-visual-disposition-draft.json` records 1,424 exact source CSS occurrence IDs and positions in 26 hash-verified files. The proposal is `different-meaning`: 1,423 class-selector spans and one explanatory comment. It includes producer/consumer context and the actual palette-generation case from the original producer. That case does not cover 41 of these source occurrences, and it does not establish raw packed CSS/JavaScript attribution. The 1,425 packed visual occurrences remain pending their own exact context review; the separate command-palette worktree token is excluded.

`g09-solid-disposition-draft.json` records the 33 exact Solid occurrences with source, intermediate and packed token identities, semantic proposals, execution conditions and explicit unresolved branches. Thirty-two have a technical-placement proposal; the saved-permission refresh token remains unresolved. Proposals and supplementary execution observations are not authenticated dispositions.

The reference census inspected 7,921 tracked script files and found 51 files matching the declared patterns. In production TUI code, the identified `useData()` caller is Autocomplete, whose observed use is `data.location.reference.list()`. No direct production caller of `data.project.permission.refresh` was found in this inspected set. Textual absence does not establish universal dead code or authorize an orphan/personal-installation classification.

Both work products keep canonical dispositions unassigned. They do not claim that the full 22,864-ID review is finished.

## Installed TUI journey execution

The eight named cases exercise real PTY input against the preserved generic daemon. Setup/oracle HTTP calls are recorded separately from forwarded TUI traffic. Product effects are checked against Session state, filesystem bytes, Git worktree registration and a real external-editor observer.

The first run, [44976993733](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44976993733), stopped before all cases with `GIT_PROJECT_IDENTITIES_NOT_DISTINCT`. The harness had used the old `?directory=` query, which the preserved Location contract ignores. Both setup requests therefore resolved the server working directory. The Git fixtures already had distinct content and were not changed.

The correction uses the protocol's `location[directory]` query, validates the same query in the forwarding observer, and records both requested/resolved directories and Git HEADs. The distinct-project requirement remains intact. The original failed run is retained as a setup failure with zero credited journeys.

[Run 44977473580](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44977473580), attempt 1, job `137070483874`, executed all eight named cases at harness SHA-256 `7d1a56231a5388e1a8e06da9b917a2d22f47af959ef61b8ad6c6341cff64e25c`:

| Named behavior | Result | Observed limit |
| --- | --- | --- |
| Fork a Session | PASS | Actual TUI fork POST, new identity, preserved source placement and keyboard exit 0 |
| Project/directory listing and Session selection | FAIL | Filtering, search and selected Session GET occurred; the required Session title did not render |
| Create Git worktree and move Session | FAIL | Move command was absent; the creation branch was not reached |
| Cancel and confirm moving changed files | FAIL | Move command was absent; cancellation/transfer was not reached |
| Normal removal | FAIL | Move dialog was not reached; removal confirmation was not exercised |
| Forced removal | FAIL | Move dialog was not reached; forced-removal confirmation was not exercised |
| Editor and export | FAIL | Editor was not invoked; later export actions were not attempted |
| Bootstrap without Basic authority | PASS | Seven real 401 responses, natural rejected exit 1 and unchanged project/Session state |

The artifact is `14736875120`, ZIP SHA-256 `2d05e7d50fea55c3654b78f8b2cf287cae29b4864a86f620daa82783c7e6606d`. All forwarding-error and unexpected-response lists are empty. Original ELF/tar bytes remained unchanged and the temporary runtime was removed. The six failed cases required cleanup signals; those signals do not count as successful keyboard exits.

## Confirmed TUI defect and source repair

The observed failures have a concrete composition cause:

1. `apps/cli/src/tui.ts` in the preserved source passes a host whose `start()` is empty (blob `ec99d67457f67a0a184b742dd4e61c84efaada4d`).
2. `packages/tui/src/plugin/slots.tsx` initializes its slot view to `() => null`; only `setup(api)` replaces it with the registry-backed renderer (blob `0ec84d58bf6bdb63bd4bd00392a474036b01beff`).
3. App awaits the empty start and marks itself ready. The CLI never calls `runtime.setupSlots(api)`.
4. The Session wraps its Prompt in `session_prompt`, and its sidebar title/footer use slots too. The empty view discards their children. Session data effects and global commands still run, while the Prompt's Move/editor commands never register.

The same CLI/slot source blobs were present in inspected dev commit `d3ccea42b5f8409c8d6c68e4909f7b868b50322c`. Empty providers do not guard registration of the Move/editor commands in this source; changing the fixture policy or extending waits is not the repair.

This branch changes the default view to `(props) => props.children ?? null`. Registry setup, plugin registration and replacement remain unchanged. The accompanying source regression file renders the real runtime without a host, checks plugin replacement and restoration, and checks fallback behavior after lifecycle operations. Its hosted validation is recorded in [PR #610](https://github.com/gustavomhss/Orchestra-SF/pull/610).

This is a source repair. It neither changes the preserved ELF nor proves that a newly built distribution passes all eight installed journeys. The unchanged failing ELF is not rerun merely to repeat the known composition defect.

## Conditions for qualification

The canonical scanner has **16 named control cases**. A prior test suite may report a different total because it includes additional tests; that does not change the canonical control set.

A formal PASS requires the exact inventory/artifact binding; justified dispositions for every occurrence and finding; zero unclassified IDs, active legacy or orphans; the complete authenticated review; current successful canonical controls; every exact applicable executed obligation; a producer attestation bound to the review payload with independently trusted reviewer/producer identities; and an empty blocker list.

The historical signature is not a universal prerequisite to start a new review. An original Bun end point and a separate TUI journey for each lexical token are not universal requirements of the published scanner either. Additional obligations must come from the applicable review/protocol and cannot be silently waived.

**Technical decision for the preserved candidate: NO-GO; formal G09 has not been run.** Review and technical obligations remain unfinished, in addition to authentication and verifier requirements. It would be incorrect to state that only a signature is missing. The corrected later-source PermissionV2 result cannot be assigned to this frozen ELF.

This evidence branch is a draft review/probe deliverable. It does not promote, rebuild, replace, deploy or qualify the original candidate.
