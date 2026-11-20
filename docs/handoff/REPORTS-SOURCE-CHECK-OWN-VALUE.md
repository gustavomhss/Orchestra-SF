# Source-check descriptors require their own value field

## Qualified product

Product `5781be6f78ef783653a6eca2543701c6454f162b`, tree
`66516033c000fddb7935ee15fc687c07fd5daba3`, is a direct child of
`1e31da764179efa3b00dff88cfe35cf3a2921120` (qualified assignment builder).
Its product delta contains exactly three paths: the source lifecycle
implementation, one new four-case regression file and this manifest.
The separately authorized component and compiler results are recorded below;
there was no new installed profile or nominal run.

## Concrete compatibility failure

At the parent, `source-lifecycle.ts:110,116,120,123` classifies dependency
descriptors with `"value" in descriptor` or `"value" in live`. An own accessor
descriptor has no own value field, but inherits one while Object.prototype.value
exists. That can admit an initially opaque getter or allow a getter to replace
an already admitted data property without invalidating the identity pin.

The first case changes observable legacy behavior: an initial input.persistence
accessor is evaluated an extra time during admission. An initial driver
currentSnapshots accessor can instead leave a stale pin that refuses egress
after the test restores the original data method. Both initial compositions
must retain the real legacy forwarding path.

After an own-data composition is admitted, replacing either dependency with an
accessor must refuse before the getter executes. Restoring the descriptor must
not reopen the failed scope; subsequent access and outer egress must still
report `SF_SOURCE_CHECK_SCOPE_CLOSED`.

## Localized change

Only those four membership expressions become `Object.hasOwn(..., "value")`.
The absent-property checks `name in persistence`, prototype checks, retained
owners, real callback invocations, thirteen awaits and sticky scope handling are
unchanged. `canonicalScopedSourceCheck` at line 90 is byte-identical.
Reversing the four substitutions reconstructs parent blob
`1b1406812829a723ab75fc62c3b298055fbe6b1d` exactly.

This is descriptor classification and identity fencing, not a grant, purity
claim or cached authorization. Initial opacity continues to execute the actual
provider. Once admitted, a changed dependency cannot fall back to that path.

## New regression controls

File:
`modules/sucafina/Sucafinav1/test/product/reports-draft-reconciliation/source-check-own-value.test.ts`.

| Case | Real dependency | Required observation |
| --- | --- | --- |
| Initial input accessor | input.persistence returns the real LocalStore | One getter, complete fresh snapshot, successful scope egress |
| Initial driver accessor | currentSnapshots returns the original real method | One getter, complete fresh snapshot, successful scope egress |
| Admitted input swap | input.persistence replaced after a successful source read | Getter zero; immediate, restored-access and egress refusal |
| Admitted driver swap | currentSnapshots replaced after a successful source read | Getter zero; immediate, restored-access and egress refusal |

Each case opens a real private LocalStore, initializes all three source surfaces
with the real factory/inventory/projector, and enters readSnapshotRoot through
the raw driver before source admission. The binding is explicitly only the
test's lexical owner/Request pin; no UI authorization, grant or receipt is
fabricated. Full snapshot equality and distinct identity are checked, followed
by a successful fresh root and source scope after cleanup.

The accessor is installed before the inherited value; both descriptors have
null prototypes. There is no await or assertion while Object.prototype is
modified. A synchronous finally removes the injected value before restoring any
previous prototype descriptor, then restores the owner.
Captured call and scope errors are separate, so an unrelated fixture exception
cannot satisfy the expected refusal. All assertions occur after restoration.
No existing test or fixture is changed.

## Limits and future composition

All four new controls and the complete existing source-scope and revalidation
files passed on this exact product. Own/opaque, closed-descendant, source
revocation and final C08 assertions remain intact.
The installed V2 RPT02 profile remains red at its original deadline despite
further server progression; this correction does not claim to resolve it.
No LocalStore/copy builder, private native-clone proposal or ACL candidate is
changed here. A later ACL/source-lifecycle union must preserve both this own
value classification and the existing readCheckScope forwarding boundary.

## Component qualification

Run [44697917500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44697917500),
job `136159018625`, cleanup `136159809697`: success, push, attempt 1.
**46 pass, 0 fail, 684 expects**, three complete files, 68.80 seconds.
The selection was four new descriptor cases, nine source-scope cases and
33 source-revalidation cases. No name filter was used.

Snapshot `cf127e4b2990848f82419636286579359b7f47a4`, tree
`cf4694450fbfc4fe8054d6bf342c38f9c82231c8`, is a direct product child.
Its only changed path is request `1777f271d6a43f7b364cd2be2bd4d2be48e47dfd`:
Bun/Sucafina, global timeout 30000, the three full file selectors and
OMNI=1. The existing cases retain their 120000 ms budgets; the four new cases
use the unchanged global limit. All original test/fixture blobs are unchanged.

The four new cases passed in 13.21, 10.29, 10.81 and 15.01 ms respectively
(initial input, initial driver, admitted input, admitted driver).
The typed surface array at new-test line 21 already contained `as const` in
the first published blob; no corrective or empty commit was needed.

The focused omni control reported not applicable because no declaring test
ran; this gate makes no claim of testing omni spawning. Cleanup succeeded.

## Real compiler qualification

Run [44697919119](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44697919119),
job `136159024050`, cleanup `136159888790`: success, push, attempt 1.
**2 pass, 0 fail, 0 skip, 0 cancel**, 62759.954789 ms.
Sucafina took 31840.195741 ms; CLI took 30875.619413 ms.
Both actual `bun run typecheck` scripts emitted the exact product SHA
`5781be6f78ef783653a6eca2543701c6454f162b`; no TypeScript diagnostic appeared.

Snapshot `2ce04b8ef2d4339e494c74d8c86bc2df9a593ef3`, tree
`e45ff9486d98c2513f28c4a0d66ad668337287f4`, is a direct product child.
It changes only request `e359ff4033d50207f9770b1838b3667a6453321e` and
the qualified Node harness `1ca7a371447b315dcbdba5693093e71c04252ea4`.
The harness differs from its qualified predecessor only in the product marker.
Cleanup succeeded.

## Durable evidence and boundaries

[Full case and compiler evidence](diagnostics/REPORTS-SOURCE-OWN-VALUE-44697917500.json)
retains all 46 case names, exact original ISO timestamps, result text and
reported duration, associated with the actual preceding Bun source-file
header. It also retains both compiler markers, outcomes and summary lines
with original timestamps. ANSI and unrelated logs are excluded.

Both CI snapshots were compared and read back before their single trigger;
each had zero runs before the branch was created. No rerun, assertion removal,
new waiver, approval or extra budget was introduced. This documentation update
does not change the qualified runtime/test blobs or claim that the installed Reports
timeouts are resolved.
