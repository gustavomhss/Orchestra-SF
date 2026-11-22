# G09 — repaired Linux candidate and exact remaining review

## Current decision

**The two product repairs are merged, and all eight installed TUI journeys pass. The candidate is not formally G09-qualified.**

This checkpoint records the owner-authorized partial merges and the new exact candidate. It preserves the preceding failures and the remaining acceptance boundary. The machine-readable companion, `g09-current-candidate.json`, contains the complete eight-case receipt and artifact identities.

| Work | Result | Evidence |
|---|---|---|
| Built-in TUI slot fallback | Merged as #617 | [PR617](https://github.com/gustavomhss/Orchestra-SF/pull/617), [source CI](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44980275760) |
| Synchronize draft before external editor | Merged as #621 | [PR621](https://github.com/gustavomhss/Orchestra-SF/pull/621), [current-base source CI](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983966623) |
| New Linux CLI/Web/factory producer | PASS | [run44983358294](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983358294), job137088492396 |
| Installed TUI | **8 PASS / 0 FAIL** | Same run, job137091279851 |
| Canonical residue diagnosis | Completed as **DIAGNOSTIC_UNQUALIFIED** | Same run, job137091279832 |
| Formal G09 dispositions | **0 of 23,041** accepted by the canonical report | Independent review and authenticated obligation inventory are not supplied |
| Deployment / full sf-ci | Not performed | Outside this focused candidate workflow |

The tested artifact is pinned to source `83f1283f8e39cd5863d9806b9a48f0573f44eaff`. The source repairs were separately integrated into advancing `dev`; unrelated concurrent `dev` changes are not silently included in the tested artifact.

## Product repairs and validation

### Slot fallback

PR617 changes the default slot view to return its built-in children even when no optional plugin host has initialized a registry. Configured plugin replacement behavior and the fallback after unregister/dispose/clear were checked.

- Source commit: `1839ed2b0ebe1efd67f9cfc92c9daf14fb73576c`.
- Merge commit: `6118495582672d41129cde7cd1749790e42da04c`.
- Source CI: **5 passed, 0 failed, 15 assertions**, TUI typecheck passed, **78 guards / 0 gate findings / 0 warnings / 0 errors**.
- Candidate runtime repeated the five slot tests with pinned Bun1.4.1: **5 passed, 0 failed**.

### External editor draft synchronization

The first rebuilt candidate invoked the correct editor in the selected worktree, with the correct parent executable, but supplied an empty draft. [Read-only inspection44982991303](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44982991303) verified the retained 522-byte observation.

OpenTUI0.4.5 updates the native buffer synchronously and queues content-change delivery through a microtask. A rapid typing/editor shortcut sequence could read the Solid store before that callback. PR621 adds the same synchronization already present in prompt submission: read `input.plainText`, update the store, and synchronize extmarks before the editor captures content.

- Source commit: `162451955d375eb5a5b91d7962a06bdc5c0b261d`.
- Source base: `888669d395a196ef95979d340d00304fa16256ab`.
- Merge commit: `4c19971bc6a4c5a1f95c5e049666a44f0c43d5cd`.
- Scope: **one file, five added lines, no removed lines**.
- Current-base CI snapshot: `3ab9051de89ce8457902741a0795daee11016084`, run44983966623, job137090357327.
- Existing production-helper tests: **5 passed, 0 failed, 6 assertions**; TUI typecheck and all78 guards passed with no findings.
- Installed regression: the **same rapid-input sequence** passed in the new ELF. No sleeps or assertion changes were introduced.

## Exact current candidate

| Identity | Value |
|---|---|
| Source and workflow | `83f1283f8e39cd5863d9806b9a48f0573f44eaff` |
| Source tree | `3dc5e13e4368c0452fa54481878965295f77405e` |
| Producing run / attempt | `44983358294 / 1` |
| Producer job / verified check-run | `137088492396 / 137088492396` |
| Candidate artifact ID | `14738902174` |
| ZIP SHA256 | `f080447b290086cc2b4fa0229204568876ee76f4cba5a98e608e0ba0aa1312a9` |
| Tar SHA256 | `af312871e79307bd281e7d46a162feeb44bc0112db0e67cb59f8be55db20a109` |
| ELF SHA256 | `724894cb17c5781a9fd7a23be6de2f191fb1d62abdfa51835c74b5c88a4ad242` |
| TUI evidence artifact | `14739297277` |
| Diagnostic artifact | `14738453502` |
| Full diagnostic JSON SHA256 | `211422a64e4c713e4e3f96b5a88489fba76e099d26ea6d8001794ce019e7ff34` |
| Unchanged journey harness SHA256 | `216d1ffdce087b0c096cb0abc4424fdf8833ee4626d8504a49845371ca4a4212` |

The producer verified actual prod/Sucafina inputs, frozen dependencies, TUI/CLI typechecks, native builds, compiler map-to-ELF binding, temporary installation and idempotence, installed Web/Team/C17, palette generation, installed Tree-sitter, and exact archive inventory/extracted bytes.

The Web/Team/C17 proof uses the installed product and substituted Entra/Graph transport. It is not a real Microsoft tenant or Azure deployment. The generated palette equality case passed **1/1 with9 assertions**. The canonical controls passed **17/17** (16 required negative controls plus staging confinement), with no failed, skipped or cancelled cases.

The producer recorded **78 guards,19 changed paths,0 gate findings,7 warnings,0 errors**. The warnings are deliberate CI proof milestone logs in the frozen native HTTP/C17 helpers. They were retained and reported; no rule, ignore comment, or approval label was changed.

## Eight actual installed TUI journeys

| Named journey | Result |
|---|---|
| TUI Session fork preserves source identity and placement | PASS |
| TUI project session list excludes another project | PASS |
| TUI creates a Git worktree and moves the selected Session | PASS |
| TUI cancels and confirms moving a Session with file changes | PASS |
| TUI normal removal requires confirmation and preserves other copies | PASS |
| TUI forced removal distinguishes cancellation and confirmation | PASS |
| TUI editor and export preserve selected Session and worktree binding | PASS |
| TUI bootstrap without Basic authority cannot read or mutate project state | PASS |

The first seven exited through the keyboard with status0. The no-Basic case received the expected401 responses and exited naturally with status1. Every case recorded complete cleanup, zero forwarding errors and zero unexpected response indices. Candidate inputs stayed unchanged; the temporary runtime was removed.

The editor case completed: draft delivered to the actual observer, cancellation without export, opening without saving without an artifact, and saved export containing the returned bytes in the selected Session/worktree.

These journeys do not establish PermissionV2 correctness, Microsoft authority, execution of the saved-permission DataProvider method, every branch of the earlier33 Solid findings, or post-move editor cwd when attach remains in an older directory. The receipt explicitly retains those limits.

## Preserved failures

| Candidate | Installed TUI | Disposition |
|---|---|---|
| Original source3ef84da, artifact14722264806, ELFff145b04… | **2 PASS / 6 FAIL** | Failed built-in slot composition remains preserved in #610 |
| First new source63beecc, artifact14738193420, ELF25a19138… | **7 PASS / 1 FAIL** | Empty editor draft; export was not reached; real failure remains preserved |
| Current source83f1283, artifact14738902174, ELF724894cb… | **8 PASS / 0 FAIL** | Passing only for this exact executable and named journey scope |

Neither a later source merge nor a new passing executable changes the prior binaries' status.

## Canonical G09 state

The unchanged scanner reports:

- **19,882 occurrence IDs**.
- **3,159 reachability/content findings**.
- **23,041 unclassified IDs**.
- **0 formally classified IDs**.
- Artifact **BOUND**, controls **VERIFIED**, source rechecked after diagnosis.

The three reported blockers are `independent-current-source-review-missing`, `unclassified-occurrences-or-reachability`, and `executed-test-obligations-missing`. With no dispositions, the zero active-legacy/orphan category counts do **not** prove those categories absent.

[Read-only navigation44984675361](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984675361) validated the exact report bindings, recomputed occurrence/finding identities and read3,722 file headers plus every finding. Its input is pinned in commit`423956fda19bffb24f1afa7e80ecb6b548385fa9`; it does not run or alter the product or sign a review.

### Focused semantic work

**Generic saved permissions.** The TUI's `project.permission.refresh(projectID)` reads a real generic API and caches grants. The generic backend uses those grants as operational `allow` rules; calling this mere file placement or assuming personal authority would be incorrect. Static composition review found that the installed Microsoft factory supplies trusted ingress, the listener mounts only its dedicated installation layer, and it does not supply `PermissionSaved.node` or generic routes. Corporate business state uses separate admitted Team storage. The Microsoft bridges do not install the generic native Session/Permission executor. The proposed classification is a surface removed from SF composition, subject to an exact installed negative proof; generic code is retained and is not claimed dead or physically absent. The follow-up test must distinguish its producing artifact from its later execution and must not invent a persisted permission row.

**Visual CSS and palette JavaScript.** The earlier source proposal reviewed1,424 precise spans in26 unchanged CSS files:1,423 class-selector spans and one explanatory comment. It does not credit archive bytes not read. The current archive has12 selected CSS files with485 spans and five palette modules with940 spans. One index-CSS path/hash differs from the preceding candidate, so exact old archive IDs cannot simply be reused. The ongoing read-only inspection parses the real v2 bytes, bounds each selector/comment/string literal and records source/consumer relationships. Forty-one source spans are outside the palette generation case and must not inherit its proof.

**Atlas resolution and meaning.** Atlas has its own nested workspace and a product boundary builder that resolves `@atlas/*` from source; its test workspace has distinct dist/exports and Vitest configuration. The current2,540 Atlas findings comprise1,891 `@atlas` imports,593 `vitest`,1 `vitest/config`,31 `fast-check`,8 nonliteral dynamic imports and16 extends findings. An `@atlas/knowledge/brand` negative fixture is an explicit exception to a blanket alias rule. Actual project catalog identity, native-memory ownership and temporary Git revision worktrees have different roles. Neither file location nor absence from the scanner's conservative graph establishes dead code or classification.

## Completion boundary

G09 requires exact semantic dispositions and applicable passed obligations for the full audit, then independent authenticated reviewer and obligation-producer evidence. The existing canonical contract requires distinct trusted signer IDs/keys provisioned independently by the host and isolated from audited code. This checkpoint supplies no fake signer, approval, trust anchor, classification-by-directory, forged same-run environment or weakened control.

The current package and evidence remain in draft[PR619](https://github.com/gustavomhss/Orchestra-SF/pull/619). The old evidence remains in draft[PR610](https://github.com/gustavomhss/Orchestra-SF/pull/610). This checkpoint is an accountable progress record, not a qualification sidecar or go-live approval.

Even a future G09 PASS would cover residue qualification only. Full native journeys, real Microsoft operations, migration/restore and the other mandatory gates have separate acceptance evidence.
