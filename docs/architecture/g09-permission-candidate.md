# PR #589 versus the frozen G09 candidate

## Conclusion

The source of candidate 14722264806 contains the PermissionV2 implementation that PR #589 subsequently corrected. This is a concrete Core permission defect, not a naming-only cleanup: configured Session permission rules are not read, and a request with no resources evaluates to allow.

The inspected dedicated Microsoft/Team C17 composition does not mount the generic server routes or create the local native host that consumes PermissionV2. This investigation did not demonstrate a Microsoft Team authorization bypass through C17. Conversely, a successful C17 or TUI-bootstrap boundary case cannot certify that the retained generic Core implementation is free of this defect.

The two focused regressions were subsequently reproduced against the unchanged candidate source in Actions run 44964767854. Both failed with `Expected: deny` and `Received: allow`. This confirms the source behavior; it does not establish a failure of the already-observed C17 or an installed-ELF Team authorization bypass. The issue should not be described as a harmless naming-only change.

The composition investigation below is static. The candidate-source regression observation is recorded separately below. No ELF was rebuilt, no deployment occurred, and no G09 IDs were classified.

## Observed candidate-source regression

[Run 44964767854, attempt 1, job 137031173967](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44964767854/job/137031173967), workflow `36e5c15fa14fca1149b125e286923f15facba74a`, executed the exact PR test bytes against the frozen source:

| Selected test | Observed result |
|---|---|
| denies calls without resources even under configured and saved allows | Failed: expected `deny`, received `allow` |
| enforces recorded Session denies while keeping order within each configured ruleset | Failed: expected `deny`, received `allow` |

The log records two selected tests, zero passing, two failing and three assertions. The second case first passed its agent-level denial assertion and then failed the recorded-Session denial assertion. This is not a preload/import failure or a run with no matching tests. The focused Omni control reported `not applicable`; this run supplies no Omni-spawn evidence.

The workflow verified the old PermissionV2 SHA-256 before and after, verified the PR test SHA-256 before copying it to a new temporary test path, checked all tracked source files remained unchanged, preserved the actual Bun exit code, and removed only its owned test copy. The artifact is [14731740025](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44964767854/artifacts/14731740025), ZIP SHA-256 `afcd6d539588f9ffb60f5f5199cb590a5e205e2a21e1825067cd105ff57d365b`.

These are candidate-source tests. The installed ELF was not executed by this case, and no Team bypass is asserted.

## Exact identities

| Item | Identity |
|---|---|
| Frozen product | 3ef84da65d6b8ad7cd3250412bbcabdf90924172 |
| Frozen product tree | 48d57887656fd2e325dee97a7c066bcb8e84bbc8 |
| Artifact | 14722264806 |
| ELF SHA-256 | ff145b04dc0897b32b7cdd904cf3bba7d793cf4a391d3c02325d3c6125006a9f |
| Old PermissionV2 Git blob | 2e3d29d3f1ec1fe805d21af091029721c9fa738e |
| Old PermissionV2 SHA-256 | 19e4a3668e1689c0b9565cb4d09444e155e1a06a571484e37e642d3cff3857d6 |
| PR #589 head | a90fcb86b2909249a54adbc8a23d5c4d4ee104d8 |
| PR #589 merge | eb381dcc7ccdd4b965adf360241e67a1714810b6 |
| Corrected PermissionV2 Git blob | b1baeae5de82fdfe6f5d41fe2da770eb020dfc30 |
| Corrected PermissionV2 SHA-256 | 04574316c2dcbb522de0f469eff857ec11cb1891b374b736a33dcff1d593f3ae |
| PR test file Git blob | cb0a88a73c2b040b85a82bb4a549a7927150c0fa |
| PR test file SHA-256 | 14057ce742638f142a993e77a1b46dc39ad8a3f3b4ca471ed30be017a65bce36 |

Sources:

- [PR #589](https://github.com/gustavomhss/Orchestra-SF/pull/589).
- [Candidate PermissionV2](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/core/src/permission.ts).
- [Corrected PermissionV2](https://github.com/gustavomhss/Orchestra-SF/blob/a90fcb86b2909249a54adbc8a23d5c4d4ee104d8/packages/core/src/permission.ts).
- [Candidate tests](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/core/test/permission.test.ts).
- [PR regression tests](https://github.com/gustavomhss/Orchestra-SF/blob/a90fcb86b2909249a54adbc8a23d5c4d4ee104d8/packages/core/test/permission.test.ts).

The recovered cli-source-map-index.json, SHA-256 1b0f15f4d6017878743453356d4a3933d0f2b2e2682514717ea2d52df22d5bb4, names ../../packages/core/src/permission.ts under /$bunfs/root/chunk-ssj44j71.js with SHA-256 19e4a3668e1689c0b9565cb4d09444e155e1a06a571484e37e642d3cff3857d6. That hash matches the exact source bytes fetched at 3ef84d. This ties the old source to the producer's map index; it is not a record of a PermissionV2 call executed inside the ELF.

## What changed and why it matters

| Path | Candidate behavior established by source | PR #589 change |
|---|---|---|
| configured(sessionID, agentID) | Reads the Session and resolves the agent, but returns only agent permissions. It never calls SessionStore.permissions(sessionID). | Reads both agent rules and the rules recorded on the Session. |
| denied(input, rules) | Tests resources.some(...). With an empty resources array this is false. | Explicitly denies an empty resources array. |
| evaluateInput | With no resources, both deny and ask checks over the empty effects array are false, yielding allow. A recorded Session deny is absent from the inputs. | Evaluates both configured layers and lets an effective deny in either layer override grants from the other layer or saved approvals. |
| askExplicit | Consults the same incomplete configured rules before creating a live approval request. | Checks both configured layers, including recorded Session denies, before queuing. |
| Saved approval propagation | Re-evaluates pending requests against the incomplete configured rules. | Preserves the individual configured-rule layers during re-evaluation. |

The existing [SessionStore.permissions implementation](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/core/src/session/store.ts) already reads SessionTable.permission and maps the persisted rules into the V2 representation. The issue is not missing storage support; PermissionV2 does not call that reader in this candidate.

Order within an individual ruleset remains meaningful. The fix does not convert every historical deny into an unconditional deny: the last matching rule within a configured layer is still evaluated, and the effective result from each layer is compared.

## Reachability distinction

### Dedicated Microsoft/Team composition inspected

1. [Microsoft factory](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/modules/sucafina/Sucafinav1/local/microsoft-entry.ts) exports nativeSfTeamInstallation. It does not export nativeSfLocalInstallation.
2. [Installation loader](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/sucafina-product/installation.ts) imports host-context only for nativeSfLocalInstallation. For the Microsoft capability it supplies createSfTeamCurrentChoice when explicitly enabled.
3. [serve.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/commands/handlers/serve.ts) mounts only the installation layer when dedicated is true. It does not compose createRoutes, register the generic daemon or run the generic legacy Session import in that branch.
4. [Team business routing](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/modules/sucafina/Sucafinav1/runtime/team-business.ts) obtains admitted Team/principal context and routes the C17 modes to the supplied Team current-choice capability.
5. [team-current-choice.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/sucafina-product/team-current-choice.ts) creates the UI product authority and uses the original authenticated request/current checks. Its native-session callbacks are unavailable: inspectSession returns undefined; verifySelection and verifySkillReceipt return false; providerGeneration and authorizeDocument return undefined.
6. The AppProcess service used to probe the Atlas scanner is a global process service whose node depends on CrossSpawnSpawner. That dependency declaration does not introduce PermissionV2. See [process.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/packages/core/src/process.ts).

This is a bounded source trace of the actual composition boundaries, not a complete semantic call graph proving all possible future paths unreachable. It supports keeping the known C17 result separate from a generic Core permission defect.

### Different composition with an explicit PermissionV2 consumer

[host-context.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/sucafina-product/host-context.ts) composes the native host. [native-host.ts](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/apps/cli/src/sucafina-product/native-host.ts) imports PermissionV2, persists Session permissions through session.setPermission and later obtains PermissionV2.Service. Therefore the old implementation is not merely an unused string or documentation residue in the overall codebase.

A valid scope decision must name which composition is shipped and permitted to run. The Microsoft boundary test cannot stand in for the native host's own Session permission regressions.

## Existing execution evidence for the corrected code

The GitHub API reports [run 44956890174](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44956890174), attempt 1, as completed/success. It ran .github/workflows/test-ci.yml on push at snapshot 00ea1840a584c6350550f4d05637efdbedee5f3c. The PR body reports 25 passing tests across permission.test.ts and session-store-permissions.test.ts and links the snapshot as a child of a90fcb86b2.

This investigation independently checked the run's status and head SHA, not every test log. It did not rerun those tests and does not transfer that corrected-source success to candidate 3ef84d or to the old ELF.

## Reproducing the focused Actions diagnostic

Use the exact test file from a90fcb86b2909249a54adbc8a23d5c4d4ee104d8 with the unchanged product source at 3ef84da65d6b8ad7cd3250412bbcabdf90924172. Do not cherry-pick the implementation fix into the candidate and then claim to have tested the old source.

The two exact case names are:

1. denies calls without resources even under configured and saved allows
2. enforces recorded Session denies while keeping order within each configured ruleset

Both use the real PermissionV2 service, SessionStore and test SQLite fixture already in the repository. The first mismatch in the old source is evaluate(empty) returning allow instead of deny. In the second case the initial README.md denial is supplied by the agent; the next assertion expects the recorded Session deny for src/private/secret.ts, which the old configured function omits. These failure points were predicted by the static review and then observed at test lines 344 and 377 in run 44964767854.

### Placement without editing product files

Use a separate diagnostic source checkout or copy the PR's test file to a fresh, untracked sibling path under the frozen candidate's packages/core/test directory. The original permission.test.ts and every tracked product file remain unchanged. Do not run concurrently with a verifier that requires a completely clean working tree.

The reference checkout below must be pinned to the PR head. If the same file is copied from another checkout, require the exact SHA-256 before use.

~~~sh
# Run only in the independent GitHub Actions diagnostic job.
g09_probe="$CANDIDATE/packages/core/test/g09-permission-pr589.test.ts"
test ! -e "$g09_probe"
printf '%s  %s\n' \
  14057ce742638f142a993e77a1b46dc39ad8a3f3b4ca471ed30be017a65bce36 \
  "$PR589_REFERENCE/packages/core/test/permission.test.ts" | sha256sum --check
printf '%s  %s\n' \
  19e4a3668e1689c0b9565cb4d09444e155e1a06a571484e37e642d3cff3857d6 \
  "$CANDIDATE/packages/core/src/permission.ts" | sha256sum --check
cp "$PR589_REFERENCE/packages/core/test/permission.test.ts" "$g09_probe"
cd "$CANDIDATE/packages/core"
ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict \
ORCHESTRA_OMNI_CONTROL=declared \
ORCHESTRA_OMNI_CONTROL_NONCE="$(openssl rand -hex 16)" \
NO_COLOR=1 bun test ./test/g09-permission-pr589.test.ts \
  -t 'denies calls without resources even under configured and saved allows|enforces recorded Session denies while keeping order within each configured ruleset'
~~~

Preserve the actual exit code and full logs. Confirm the two exact selected cases executed; a preload failure, missing dependency or zero selected cases does not reproduce the permission defect. The ordinary filtered-out cases in this narrow invocation are not credited as executed coverage.

The package's existing bunfig preloads test-guard, the Omni control and core/test/preload. CI=true comes from Actions; do not set ORCHESTRA_LOCAL_TESTS or disable the guards. A focused run with no declared Omni spawn legitimately reports not applicable for Omni, and is not an Omni execution proof.

Afterward verify the PermissionV2 source hash again, remove only the newly owned probe file, and preserve its original test-file hash in the diagnostic receipt. Label the result as candidate-source regression evidence, not installed-ELF execution, G09 qualification, or a Team exploit.

## Qualification consequence

The frozen candidate's functional C17 receipts remain about the behavior they actually executed. PR #589 does not retroactively invalidate those observations.

However, a claim that all retained Session permission behavior is correct cannot rely on those receipts. If that behavior is a required qualification obligation for a retained surface, the old candidate cannot receive credit merely because the fixed source passed later. A change to the ELF to incorporate #589 would produce a different candidate with a new identity and its own qualification.

G09 already remains unqualified for its recorded coverage and evidence gaps. This investigation adds a specific known Core issue requiring a scope-aware disposition; it neither closes the gate nor independently proves a new Microsoft/C17 breach.
