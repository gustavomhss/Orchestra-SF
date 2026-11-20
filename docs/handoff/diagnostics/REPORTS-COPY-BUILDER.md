# Reports mutable snapshot copy builder V2 — isolated assignment candidate

## Status and evidence

Prepared on `reports-copy-assignment` over V1 product
`cb1c440894b3aa2bb8d814569b96e9f284771d68`, tree
`324fea20029d802f1ed9c3d54e6adbd6fe2a220f`. V1 retains its qualification below.
No compiler, component, performance, browser or sf-ci run has been started for
this V2 candidate. Its runtime behavior and performance are not yet qualified.

The retained installed create diagnostic is run 44684328393, head
`5b12edd86f91c5458f57ad23964360596c7c471b`, observer candidate a354 on product 6c.
[Exact records and phase analysis](https://github.com/gustavomhss/Orchestra-SF/blob/4d0c4fd3c6638bc9297f70a7c3ae2ef025b2beef/docs/handoff/diagnostics/REPORTS-CREATE-PROFILE.md)
show that the real create Request 42 reached the server and remained inside
mutationFence in the retained prefix. Of 95240.13313899998 ms observed elapsed,
cloneSnapshot recorded 8366 calls/48118.00314600009 ms inclusive. Canonical and
materialization measured 20285.547882009356 ms and 1273.9611839983845 ms respectively.
These are overlapping inclusive observations, not an exhaustive CPU partition.
There was no retained server abort, final thread C08 or settlement event.

V1's defineProperty builder passed component run 44688042967 (job 136126970493):
72 pass, 0 fail, 2 original UID skips, 1172 expects, 74 declared cases in four
files, 6.66 s. Compiler run 44688044573 (job 136126975445) passed both real
Sucafina and CLI scripts: 2 pass, 0 fail, 0 skip, 0 cancel, 59266.563454 ms.
Those runs qualify V1 only.

The subsequent installed diagnostic 44690149085 (job 136133725978) still failed
the original RPT02 180000 ms limit. Its
[142 retained records and analysis](https://github.com/gustavomhss/Orchestra-SF/blob/baebef3c8b46621e08c39820c32f51f897690cd5/docs/handoff/diagnostics/REPORTS-COPY-BUILDER-PROFILE.md)
show complete preparation of 24163.933933000008 ms and complete mutation-fence
of 70885.60053 ms. The final thread C08 callback began at 95102.780787 ms;
the retained 99105.24953200002 ms prefix had no completed checks, C08 egress,
server abort or settlement. It is not proof of a committed thread.

Preparation performed the same 2836 clone calls as the earlier baseline:
11597.26774999946 ms versus 11824.99461899983 ms inclusive. The new complete
mutation had 5632 calls / 36358.59323099957 ms; the older 5530 calls /
36293.00852700026 ms were an incomplete prefix and are not matched work.
Create's last cumulative clone measure was 9290 calls / 50131.8219969982 ms.
The installed timeout remains; these observations do not establish a causal
speed improvement, exclusive CPU cost or the client's 30000 ms deadline.

V2 changes only object construction in that measured cloneSnapshot -> copyValue
path: it replaces V1's per-property defineProperty and private descriptor with
assignment to a fresh null-prototype output, restoring Object.prototype only
when the entire object is complete. Fewer native property-definition calls may
help, but dictionary representation, shape transitions and allocation costs
could cancel or exceed the saving. No performance improvement or gate closure
is claimed.

## Exact scope

Only `modules/sucafina/Sucafinav1/runtime/local-store.ts` has a runtime delta,
within copyValue's existing object-builder block. Its V1 parent blob is
`2dff8e2d8073c2ffe01fbc59b7b76ab84c1bd587`; the pre-builder original remains
`83f513c9b9c3c9a7f4497eea80c9e4aa896c9be9`.

No cache, snapshot plan, capacity, producer registry, callback, authority rule,
source observation, hash, C05/C08 fence, Request binding, SQL, queue, lock,
timeout or persisted format changes. copyValue remains private. No diagnostic
observer, workflow, request or harness is included in this candidate.

The three original qualification suites and the shared fixture remain
byte-identical. In the existing five-case
`test/product/runtime-fresh-copy-cost/copy-builder-boundaries.test.ts`, all 37
prior direct expects remain literal. Three new direct expects cover the empty
object gap described below; no existing callback, Proxy trace, assertion or
budget is removed or changed. The real LocalStore fixture is unchanged.

## Builder and semantic boundaries

The existing getOwnPropertyDescriptors(value) bulk capture is retained. Its
Object.keys list is captured before any child is visited. The replacement
iterates only those same string keys, checks the same own value descriptor,
and recurses exactly once per key in the same order. A fresh private output
object starts with prototype null and receives each copied value by assignment.
The setPrototypeOf intrinsic and Object.prototype are captured before visiting
children. Every successful object return restores that captured prototype,
including objects with zero string keys and every recursively copied object.
No intermediate output or partially copied value is published.

All code before the descriptor construction, including primitive handling,
ancestor/cycle guards, prototype checks, own-symbol check and Array.from, stays
literal. The existing finally.delete and outer validateSnapshot stay literal.
There is no up-front validation pass over all property descriptors.

The reasoning assumes standard JavaScript intrinsics. Capturing the prototype
restoration primitive and prototype before children avoids late global lookups;
it does not claim compatibility with arbitrary monkeypatches of all builtins.
Domain callbacks, accessors, Proxies and mutable snapshot graphs remain within
the behavior exercised by the controls below.

### Why the complete descriptor map is not passed to defineProperties

A supported plain-object Proxy can return only strings from the first ownKeys
call (the original own-symbol check), then return a configurable Symbol during
getOwnPropertyDescriptors. The original Object.keys ignores that late Symbol.
Passing the whole descriptor map to defineProperties would copy an unvisited
value or accessor. That earlier design was rejected. The implemented loop
uses only the same string keys.

V1 avoided inherited get/set descriptor attributes with a private null-prototype
descriptor. V2 does not construct a property descriptor for each assignment.
The output itself has prototype null until completion, so assignment creates
own data properties, including __proto__, without invoking inherited setters.
Restoring its prototype does not read those properties or call their setters.

### Mutable references and errors

Bulk capture freezes property descriptors and their value references, not the
referenced graphs. If a first array child's index getter replaces parent.later,
the later visit still uses the captured old reference. A mutation inside that
old object before its visit must remain visible. The builder does not pre-copy
or freeze children.

Validation stays interleaved with recursion. A cycle or exception in the first
child wins over an accessor in a later sibling. Any partially constructed
output remains private and cannot escape when that recursion fails.

Null-prototype input objects continue to normalize to ordinary output objects.
Property attributes normalize to enumerable/writable/configurable data, as
with Object.fromEntries. Aliases still copy independently by path; cycles,
unsupported values and accessors retain the existing errors. The array branch,
including index getters and inherited iteration behavior, is unchanged.

## Retained controls and empty-object extension — five cases

All controls run through openLocalStore via the existing withStores/seed/warm
fixture and an actual mutable dashboard transaction. They never call or export
copyValue directly.

| Cases | Control | Required observation |
|---:|---|---|
|2|Ordinary and null-prototype Proxies; current and inherited nested reads|The entire existing trap/order/late-Symbol/__proto__/flags/isolation control remains. A separate empty object of each input prototype is copied through both paths; its output must have Object.prototype, no keys and a distinct identity.|
|1|First-child index getter replaces a sibling and mutates the old graph|First copy keeps the captured old reference but sees its new nested value; the next observation sees the replacement; original Array.from getter executes exactly once per copy.|
|1|First-child cycle followed by an accessor|The cycle error wins, later getter stays uncalled, and nested transaction work is never admitted.|
|1|Inherited get/set descriptor attributes and inherited data-key setter|Actual target copying invokes none of them, emits own normalized data, keeps distinct values and restores every prior prototype property.|

The inherited-attribute test changes Object.prototype only in a synchronous
try/finally region. It performs no await or assertion while the temporary
properties exist. Its setup/restore descriptors have prototype null too.
It uses currentSnapshot("dashboard") so an unrelated non-target plan's
undefined-value repair cannot affect the copy-builder control. The same
cloneSnapshot/copyValue implementation is exercised through that public
LocalStore API.

The file now contains 40 direct expect calls and still expands to five tests.
The three added expects run for both input prototypes and for currentSnapshot
and the inherited nested transaction. They close the risk that an empty object
could return before restoring its prototype; they do not assert an allocation
strategy or execution time. It adds no retry, skip, deadline, mock provider or
fabricated grant.

## Existing coverage and proposed qualification selection

The following complete original files formed the V1 qualification selection.
They have not been run on this V2 candidate:

1. `modules/sucafina/Sucafinav1/test/local-store.test.ts`:
   39 declared tests, including the two original UID-dependent skipIf cases at
   lines 609–623. Normalization and mutable copy controls are at 78–138;
   rejection and metadata checks at 141–177.
2. `modules/sucafina/Sucafinav1/test/product/runtime-fresh-copy-cost/fresh-copies.test.ts`:
   seven tests. Covers all three targets, independence, metadata, aliases,
   transactionAll, invalid values and plan fallback.
3. `modules/sucafina/Sucafinav1/test/product/runtime-readonly-root/runtime.test.ts`:
   23 tests covering readonly-root boundaries and lifetime.

Together these are 69 declared original tests plus the five retained controls:
74 declared. The two existing UID-dependent skips must remain unchanged and
be reported when applicable; zero skips must not be required indiscriminately.
All original budgets and assertions must remain intact.

Cold review of this exact diff is required before any compiler or test trigger.
No performance improvement may be inferred from a functional pass alone.

## Composition boundary

This branch is based strictly on cb1c (whose product parent is 6c630), not on
any diagnostic observer tree.
The future composition overlaps LocalStore with Native candidate 677ca9d2.
Do not copy this entire old-base LocalStore blob over that candidate: apply the
reviewed copyValue delta while preserving Native's independently reviewed
readonly capabilities and all other changes.

The broader composition also has existing source-lifecycle overlap from the
Reports repair and Native work. This candidate does not edit source-lifecycle.
That overlap still requires an explicit composition review. No runtime blob
from this isolated branch is authorized for audit-one integration by this file.

## Restoration check

Replacing only V2's object-builder block with V1's block reconstructs blob
2dff8e2d8073c2ffe01fbc59b7b76ab84c1bd587 byte for byte. Replacing it with the
original fromEntries block reconstructs blob
83f513c9b9c3c9a7f4497eea80c9e4aa896c9be9 byte for byte. Building the V2 source
from either predecessor gives exactly the same text: 35,832 characters and 690
newline-terminated lines, with 22 await tokens, 19 async tokens and the same 23
SQL sites. Queue/lock bodies, exports and array/guard/finally boundaries remain
literal. Removing only the empty-object setup and three new expects restores
the entire V1 test file byte for byte. There are no other runtime or test paths
in this three-path preparation; the third path is this historical manifest.
