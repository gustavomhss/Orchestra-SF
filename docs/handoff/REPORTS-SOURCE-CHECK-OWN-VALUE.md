# Source-check descriptors require their own value field

## Scope and preparation status

This isolated product candidate is a direct child of
`1e31da764179efa3b00dff88cfe35cf3a2921120` (qualified assignment builder).
It changes exactly three paths: the source lifecycle implementation, one new
four-case regression file and this manifest. Preparation is reviewed separately
from execution; no new compiler, test, installed profile or nominal run is
claimed by this document.

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

These controls have not executed on this candidate. Existing own/opaque,
closed-descendant, source revocation and final C08 controls remain intact.
The installed V2 RPT02 profile remains red at its original deadline despite
further server progression; this correction does not claim to resolve it.
No LocalStore/copy builder, private native-clone proposal or ACL candidate is
changed here. A later ACL/source-lifecycle union must preserve both this own
value classification and the existing readCheckScope forwarding boundary.
