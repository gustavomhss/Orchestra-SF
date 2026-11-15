# 133/e3 — patch integral de correção para 132

Source pinned to C64/e2. Apply only to verified current preimages, preserving unrelated writers. The code commit is `304cbf337f15d9dff59fa25bd0c31f6ab62bc3cb`; regression extension is `a202422d2d1a318ae3291165b75fa326b8d5f65f`. The diff below is complete relative to source `379222754bf4928268b923b51325d5edaf4b8b30` for the two product/test paths, not a proposed rewrite of other files.

```diff
--- a/packages/schema/src/sucafina/planner.ts
+++ b/packages/schema/src/sucafina/planner.ts
@@ -12,8 +12,8 @@
 const Optional = Schema.optionalKey
 const NullableAmount = Schema.Union([Schema.Finite, Schema.Null])
 const EditableAmount = Schema.Union([Schema.String, NullableAmount])
-const Amounts = Schema.Array(Schema.Finite).check(Schema.isBetweenLength(12, 12))
+const Amounts = Schema.Array(Schema.Finite).check(Schema.isMinLength(12)).check(Schema.isMaxLength(12))
-const NullableAmounts = Schema.Array(NullableAmount).check(Schema.isBetweenLength(12, 12))
+const NullableAmounts = Schema.Array(NullableAmount).check(Schema.isMinLength(12)).check(Schema.isMaxLength(12))
 const RecordVersion = Schema.Struct({ version: NonNegativeInt })
 const ContextStamp = Schema.Struct({
   installationId: NonEmpty, projectId: NonEmpty, hostId: NonEmpty,
@@ -252,8 +252,8 @@
   })
 }
 const DraftCell = Schema.Struct({ measure: Schema.Literals(["budget","actual","forecast"]), month: Month, text: Schema.String })
-const Draft = Schema.Struct({ rowId: NonEmpty, revision: NonNegativeInt, cells: Schema.Array(DraftCell).check(Schema.isBetweenLength(1, 36)) })
+const Draft = Schema.Struct({ rowId: NonEmpty, revision: NonNegativeInt, cells: Schema.Array(DraftCell).check(Schema.isMinLength(1)).check(Schema.isMaxLength(36)) })
-const MonthlyRequest = Schema.Struct({ page: Schema.Literals(["OPEX","CAPEX"]), versionId: NonEmpty, drafts: Schema.Array(Draft).check(Schema.isBetweenLength(1, 500)) })
+const MonthlyRequest = Schema.Struct({ page: Schema.Literals(["OPEX","CAPEX"]), versionId: NonEmpty, drafts: Schema.Array(Draft).check(Schema.isMinLength(1)).check(Schema.isMaxLength(500)) })
 const MonthlyRow = Schema.Struct({
   draft: Draft, errors: Schema.Array(Schema.Struct({ cell: Optional(DraftCell), reason: Schema.String })),
   result: Optional(LegacyResult),
--- a/modules/sucafina/Sucafinav1/test/native-ui-contract/planner.test.ts
+++ b/modules/sucafina/Sucafinav1/test/native-ui-contract/planner.test.ts
@@ -160,0 +161,99 @@
+
+test("A02 C64: Effect beta.83 enforces exactly 12 periods and retains zero versus null", () => {
+  const input = SfPlanner.operations["domain.command.CAP18.save"].input
+  const values = {
+    versionId: "plan",
+    b: Array(12).fill(0),
+    a: [0, ...Array(11).fill(null)],
+    f: Array(12).fill(null),
+  }
+  const command = { page: "OPEX", action: "save", id: "line", version: 7, values }
+  const decode = Schema.decodeUnknownSync(input, { onExcessProperty: "error" })
+  expect(decode(command)).toEqual(command)
+  for (const field of ["b", "a", "f"] as const) {
+    for (const count of [0, 11, 13]) {
+      expect(() => decode({
+        ...command, values: { ...values, [field]: Array(count).fill(field === "b" ? 0 : null) },
+      })).toThrow()
+    }
+  }
+  expect(() => decode({
+    ...command, values: { ...values, b: Array(12).fill(null) },
+  })).toThrow()
+})
+
+test("A02 C64: monthly preview/apply retain closed 1..36 cells, 1..500 rows and 1..12 host months", () => {
+  const cell = (month: number) => ({ measure: "budget" as const, month, text: "0" })
+  const draft = (row: number, cells: ReturnType<typeof cell>[]) => ({
+    rowId: `row-${row}`, revision: 0, cells,
+  })
+  for (const operation of ["planner.monthly.preview", "planner.monthly.apply"] as const) {
+    const decode = Schema.decodeUnknownSync(SfPlanner.operations[operation].input, { onExcessProperty: "error" })
+    const action = operation === "planner.monthly.preview" ? "preview" : "apply"
+    const request = (drafts: ReturnType<typeof draft>[]) => ({
+      action, input: { page: "OPEX", versionId: "plan", drafts },
+    })
+    const valid = request([draft(1, [cell(1), cell(12)])])
+    expect(decode(valid)).toEqual(valid)
+    expect(() => decode(request([]))).toThrow()
+    expect(() => decode(request([draft(1, [])]))).toThrow()
+    expect(() => decode(request([draft(1, Array(37).fill(cell(1)))]))).toThrow()
+    expect(() => decode(request([draft(1, [cell(0)])]))).toThrow()
+    expect(() => decode(request([draft(1, [cell(13)])]))).toThrow()
+    const maximum = request(Array.from({ length: 500 }, (_, i) => draft(i, [cell(1)])))
+    expect(() => decode(maximum)).not.toThrow()
+    expect(() => decode(request([...maximum.input.drafts, draft(501, [cell(1)])]))).toThrow()
+  }
+})
+
+test("A02 C64: authorized page projections preserve 12 slots and nullable financial output", () => {
+  const context = {
+    installationId: "installation", projectId: "project", hostId: "host",
+    principalRef: "principal", policyVersion: "policy", accessRevision: "access",
+  }
+  const summary = {
+    total: 0, actualYTD: null, fullYear: 0, hrTotal: null, fte: 0,
+    budget: [0, ...Array(11).fill(null)],
+    actual: Array(12).fill(null),
+    outlook: Array(12).fill(0),
+    warnings: [],
+  }
+  const overview = {
+    status: "ok", context,
+    value: {
+      capabilityId: "CAP17", selection: { year: 2026 },
+      data: { versions: [], comparisons: [], summary },
+      versions: {}, allowedActionIds: [],
+    },
+  }
+  const overviewDecode = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP17"].output)
+  expect(overviewDecode(overview)).toEqual(overview)
+  for (const count of [0, 11, 13]) {
+    expect(() => overviewDecode({
+      ...overview,
+      value: { ...overview.value, data: { ...overview.value.data,
+        summary: { ...summary, budget: Array(count).fill(null) } } },
+    })).toThrow()
+  }
+
+  const positions = [{
+    id: "position", name: "Engineer", revision: 0,
+    months: [0, ...Array(11).fill(null)],
+  }]
+  const headcount = {
+    status: "ok", context,
+    value: {
+      capabilityId: "CAP20", selection: { year: 2026 },
+      data: { versions: [], positions }, versions: {}, allowedActionIds: [],
+    },
+  }
+  const headcountDecode = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP20"].output)
+  expect(headcountDecode(headcount)).toEqual(headcount)
+  expect(() => headcountDecode({
+    ...headcount,
+    value: { ...headcount.value, data: {
+      ...headcount.value.data,
+      positions: [{ ...positions[0], months: Array(13).fill(null) }],
+    } },
+  })).toThrow()
+})
```

Consumer at drafting: `sf2-stack@fc8840207377a363d4e6844aab496b4f1521f83c`, Planner schema blob `30cd40e03ffb3d557243e26f772bdb3c7d5ae50c`. Reconfirm target HEAD/preimage before applying, do not reset/overwrite integration. No shared/router/exports/generated edits by 133.
