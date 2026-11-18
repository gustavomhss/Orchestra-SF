# Procurement queue lane

Job `134890490309` of run `44329483839` (`sf/procurement-queue-integration`).

## First failing test

`first visit to Procurement Requests on an empty installation renders a real empty queue, never 503`

File: `modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts:34`

```
error: expect(received).toBe(expected)
Expected: 200
Received: 503
```

The three later tests in that file passed. No assertion was weakened. `runtime/procurement.ts` and `runtime/contract.ts` were not edited (owned by `sf-typecheck`).

## Cause

The fixture leaves `snapshot.data.store` unset (`before.store` is undefined) after `initializeSources("procurement")`. The Requests GET is `business.procurementQueueView`, which is `createProcurementQueuePageView`.

That page admits `sf_request_read`, then `createSelection` calls `contextFor`. `contextFor` (`apps/cli/src/sucafina-product/business-services.ts`) reads `domain.view(...).data.formSettings.currency` and returns `{ status: "unavailable", reason: "procurement-context-unavailable" }` when the currency is missing or blank. `queue-page.ts` maps every non-denied, non-stale failure to HTTP 503 `{ status, reason: "procurement-queue-unavailable" }`.

`domain.view` (`runtime/procurement.ts`) always `load()`s the snapshot. `load()` does `object(snapshot.data.store)` and `object(stored.settings)`. `contract.object` turns a missing store into `{}`, so `formSettings.currency` is absent. `initial()` / `initialProcurementSettings()` (currency `USD`) is applied only on a settings `reset`, not when the store has never been written.

An incomplete persisted store (`{}`, `{ settings: {} }`, `{ issued: { pr: [], po: [] } }`) is supposed to 503. That second test passed. The empty installation is the same `load()` path, so the first visit cannot render a real empty queue without a change in `runtime/procurement.ts`. A workaround outside that file still fails the later `formSettings.currency` comparison in `product/procurement/sources.ts`.
