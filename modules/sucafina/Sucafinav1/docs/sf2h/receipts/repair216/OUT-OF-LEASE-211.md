# PATCH INERTE PARA 211 — REV208-NEW-002 (consumer sparse projection)

**Status:** INERT_ONLY; no write to the consumer path, the integrator branch, or any foreign lease. This is a complete source-context patch for the authorized S0 integrator. It must be reconciled and applied to the same C candidate before claiming end-to-end acceptance.

- **Owner/destination:** mission 211, branch `sf-closure-bundle` / PR #191.
- **Out-of-lease file:** `modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts`
- **Observed source preimage blob:** `f68e20ef62f14c98ca9ccda9e2fec0a5c579b4de` at mission216 HEAD `f9aca032271d1b683647b701f2c02c703eaaea20`.
- **Proposed postimage:** one exact-line replacement plus explanatory comments below. New blob/commit SHA is assigned only when mission 211 applies it; it is not an existing committed result.
- **Apply guard:** verify the actual source line and the current blob first. If 211 has changed this file, reconcile against its active source, never force-reset or apply the observed preimage blindly.

```diff
--- a/modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts
+++ b/modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts
@@
         approved.push({ id, event, envelope, resolutions, entry: { ...record.entry, ref: record.entry.ref } })
       }
       if (selection && !approved.length || !await authorized()) return { status: "unavailable" as const }
-      const filtered = createSfAtlasDurableMemory({ events: approved.map((item) => [item.id, item.event]) })
+      // The complete physical Atlas journal was already validated above.
+      // This authorized subset can be sparse, so renumber only its ephemeral
+      // read projection, never the persisted events or their content identities.
+      const filtered = createSfAtlasDurableMemory({ events: approved.map((item, index) => [item.id, { ...item.event, seq: index + 1 }]) })
       const recalled = createMemoryRead({ store: filtered, actor: owner }).recall({ kind: "task", owner })
       const records = approved.flatMap((item) => recalled.some((record) => digestSfValue(record) === digestSfValue(item.event.payload)) ? [{ envelope: item.envelope, entry: item.entry, resolutions: item.resolutions, case: found.value, recordDigest: digestSfValue(item.event.payload) }] : [])
```

## Causal dependency

`atlas-store.ts` now enforces ordinal = physical append position (1..N), rejecting gaps, duplicates and reordered/tampered ordinals. The production reader in `atlas-memory.ts` first validates the **entire** persisted partition (`loaded = createSfAtlasDurableMemory(partition).read()`, refuses on `loaded.rejected`), then authorizes linked records and sometimes narrows `approved` to one envelope for `readOriginalRecords` / idempotent lost-response C09 retry.

The old `approved.map((item) => [item.id, item.event])` creates a separate one-event adapter with the **original** persisted `seq=2`, which now correctly rejects a journal starting at 2; a legitimate idempotent retry could fail. The proposed postimage preserves original authorization, envelope id, canonical record digest and every historical persisted ordinal. The ONLY renumbering is inside the already-approved, transient **read-only subset**; physical C08 journal remains untouched, unsorted and independently verified. It uses the genuine `createSfAtlasDurableMemory` and `createMemoryRead` code; no stub, bypass, catch-and-succeed or mock.

## Integration acceptance

1. Verify all `partition.events` first using the strict store; no sorted/normalized repair of persisted data.
2. Apply the exact diff above only with 211's authority and a verified current preimage.
3. Validate same-C full two-event recall, sparse `readOriginalRecords` / C09 `already-committed` retry after SQLite restart, monotonic third append; see mission216 regression selector.
4. Re-run 208 causal check on true malformed physical ordinals; pre/post digest proof and rejected C08/outbox append.

**State:** REQUESTED_FROM_211, NOT_APPLIED, NOT_TESTED. This file is deliberately not modified by 216.
