# AM02 C16 reopen selection identity

Unproven. No product change. Tests and CI were not run.

## Failure

Run `44329483839`, job `sf/test-CI-SF-7` (`134890490891`), head `2e5839eebb`.

`modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:160`

```
expect(freshSeries.selectionRef).not.toBe(series.selectionRef)
Expected: not "sf-source:53a4559a-de4e-4d29-a01a-44ff65202836:1"
```

The same collapse would hit line 161 for `budgetMetrics`. Those two lines are the distinction. Do not weaken them.

## What the assertion requires

After `fixture.reopen()`, `issue(["budgetSeries"])` and `issue(["budgetMetrics"])` must return selection refs that are not the pre-restart refs. The same dashboard snapshot, including `sfSources`, must still equal the snapshot taken after the first issue (`:149` immediately after reopen, `:174` after the generation-2 reads).

Session id and loaded message id are a separate distinction (`:169`–`:170`) and did not fail.

## Cause

`createDashboardSourceIssuer` publishes `dashboardSourceSelector(current.incarnation, current.version)`. That string is the durable scoped-source identity, not a host observation.

`fixture.reopen()` disposes the SQLite driver, opens the same `product` file, rotates `hostId`, and increments `providerGeneration`. It does not change page, fields, period, role map, or projected input. `readScopedSnapshot` therefore keeps the prior scope: `prior.sourceIncarnation === source.incarnation` and the input digest is unchanged, so version stays `1`. The selector is identical. CI observed `sf-source:53a4559a-de4e-4d29-a01a-44ff65202836:1` on both sides.

`hostId` is the only restart-local value that changes without writing the snapshot. It is not part of the scope key or the selector. `resolveDashboardSource` accepts only `sf-source:${incarnation}:${version}` and requires that version to be the current durable version.

## Why a local patch is not proven

- Writing a new incarnation or version makes the selector differ and commits `snapshot.sfSources`. That fails `:149` or `:174`.
- Returning any other selector fails resolve (`source-unavailable` or `source-replaced-or-changed`), so the generation-2 dashboard, KPI, and BI reads cannot succeed.
- Widening `sf-source:${incarnation}:${version}` collides with `selectionRef === evidence.refId` and the source-fence equality in `product/imports/source-fences.ts`.

The sibling reopen assertion in `native-capabilities.test.ts` is not this case. It follows a role-map revision and an `opexOwners` mutation, either of which already bumps the scoped version. AM02 does not mutate data. Reopen alone must create the distinction. It does not.

No files under `modules/sucafina` were changed.
