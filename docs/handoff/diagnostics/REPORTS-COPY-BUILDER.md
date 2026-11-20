# Reports mutable snapshot copy builder — isolated candidate

## Status and evidence

Prepared over product `6c6303f5a52cd6123762f8875b33822ba28e1ed8`, tree
`a88331c0e06fccdaf41e946a30a7ce8f0b93d3a1`. No compiler, component, performance,
browser or sf-ci run has been started for this candidate. Runtime behavior and
performance are not yet qualified.

The retained installed create diagnostic is run 44684328393, head
`5b12edd86f91c5458f57ad23964360596c7c471b`, observer candidatea354 on product 6c.
[Exact records and phase analysis](https://github.com/gustavomhss/Orchestra-SF/blob/4d0c4fd3c6638bc9297f70a7c3ae2ef025b2beef/docs/handoff/diagnostics/REPORTS-CREATE-PROFILE.md)
show that the real create Request 42 reached the server and remained inside
mutationFence in the retained prefix. Of95240.13313899998 ms observed elapsed,
cloneSnapshot recorded 8366 calls/48118.00314600009 ms inclusive. Canonical and
materialization measured 20285.547882009356 ms and1273.9611839983845 ms respectively.
These are overlapping inclusive observations, not an exhaustive CPU partition.
There was no retained server abort, final thread C08 or settlement event.

The only runtime change here targets object construction in the measured
cloneSnapshot -> copyValue path. It is a hypothesis about temporary allocation:
it removes the map result array and one pair array per copied object property.
It adds native defineProperty calls and one private normalized descriptor per
object. Those costs could cancel or exceed the saved allocations. There is no
claim that this closes the client 30000 ms deadline or any Reports gate.

## Exact scope

Only `modules/sucafina/Sucafinav1/runtime/local-store.ts`, original blob
`83f513c9b9c3c9a7f4497eea80c9e4aa896c9be9`, has a runtime delta, within
copyValue at original lines 580–585.

No cache, snapshot plan, capacity, producer registry, callback, authority rule,
source observation, hash, C05/C08 fence, Request binding, SQL, queue, lock,
timeout or persisted format changes. copyValue remains private. No diagnostic
observer, workflow, request or harness is included in this candidate.

All existing tests and their assertions remain byte-identical. The added
`test/product/runtime-fresh-copy-cost/copy-builder-boundaries.test.ts` imports
the existing real LocalStore fixture, without changing it or granting authority.

## Builder and semantic boundaries

The existing getOwnPropertyDescriptors(value) bulk capture is retained. Its
Object.keys list is captured before any child is visited. The replacement
iterates only those same string keys, checks the same own value descriptor,
and recurses exactly once per key in the same order. A fresh private output
object receives each copied value through a captured defineProperty intrinsic.
One private output descriptor is reused per object; it has prototype null and
own enumerable/writable/configurable flags set totrue.

All code before the descriptor construction, including primitive handling,
ancestor/cycle guards, prototype checks, own-symbol check and Array.from, stays
literal. The existing finally.delete and outer validateSnapshot stay literal.
There is no up-front validation pass over all property descriptors.

The reasoning assumes standard JavaScript intrinsics. Capturing the new
definition primitive before visiting children avoids repeated global lookups;
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

ToPropertyDescriptor must also not invoke get/set attributes inherited from
Object.prototype. The reused output descriptor has prototype null. Defining
own data properties, including __proto__, does not invoke an inherited setter.

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

## Added controls — five cases

All controls run through openLocalStore via the existing withStores/seed/warm
fixture and an actual mutable dashboard transaction. They never call or export
copyValue directly.

| Cases | Control | Required observation |
|---:|---|---|
|2|Ordinary and null-prototype Proxies; current and inherited nested reads|Exact prototype/ownKeys/descriptor trap order, including one versus two getPrototypeOf calls; late Symbol ignored; own __proto__ and normalized attributes preserved; independent output and actual nested callback.|
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

The new file contains 37 direct expect calls and expands to five tests.
It adds no retry, skip, deadline, mock provider or fabricated grant.

## Existing coverage and proposed qualification selection

The following complete original files were selected by the independent review.
They have not been run on this candidate:

1. `modules/sucafina/Sucafinav1/test/local-store.test.ts`:
   39 declared tests, including the two original UID-dependent skipIf cases at
   lines 609–623. Normalization and mutable copy controls are at 78–138;
   rejection and metadata checks at 141–177.
2. `modules/sucafina/Sucafinav1/test/product/runtime-fresh-copy-cost/fresh-copies.test.ts`:
   seven tests. Covers all three targets, independence, metadata, aliases,
   transactionAll, invalid values and plan fallback.
3. `modules/sucafina/Sucafinav1/test/product/runtime-readonly-root/runtime.test.ts`:
   23 tests covering readonly-root boundaries and lifetime.

Together these are 69 declared original tests plus the five new controls:
74 declared. The two existing UID-dependent skips must remain unchanged and
be reported when applicable; zero skips must not be required indiscriminately.
All original budgets and assertions must remain intact.

Cold review of this exact diff is required before any compiler or test trigger.
No performance improvement may be inferred from a functional pass alone.

## Composition boundary

This branch is based strictly on 6c630, not on any diagnostic observer tree.
The future composition overlaps LocalStore with Native candidate 677ca9d2.
Do not copy this entire old-base LocalStore blob over that candidate: apply the
reviewed copyValue delta while preserving Native's independently reviewed
readonly capabilities and all other changes.

The broader composition also has existing source-lifecycle overlap from the
Reports repair and Native work. This candidate does not edit source-lifecycle.
That overlap still requires an explicit composition review. No runtime blob
from this isolated branch is authorized for audit-one integration by this file.

## Restoration check

Replacing only the new object-builder block with its original six-line block
reconstructs LocalStore blob 83f513c9 exactly. All 22 await tokens remain, as do
the SQL and queue/lock bodies. The seven array/guard/finally boundaries surrounding
the builder are unchanged. There are no other runtime paths in this delta.
