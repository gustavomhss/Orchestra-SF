# Fix174 / complete inert integration instructions for 162

Source: `packages/schema/src/sucafina/planner.ts`
- Source preimage: `8ecb147aacd13e089ee0a39824fc823e9801bd41` at `056f1ac648466630a276cc2d7977ebcf70bfdbff` (tree `9017930ad69e3c48a55a5d4ecd2217d1c89cd1fb`).
- Source postimage: `0a85a3f33bc384196100ee75c974102e04f9868a` (this commit; read back its exact tree).
- Consumer preimage: `8ecb147aacd13e089ee0a39824fc823e9801bd41` at sf2-stack `913b6b8f143e6c3e869eee293d02f04259c7cdd1` (tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb`).
- Consumer postimage: PENDING; may be asserted only after 162 CAS/adopts the exact released source blob.
- No shared registry, host, route, transport, client, generated, test, or engine file is changed.

## Full source patch

```diff
--- a/packages/schema/src/sucafina/planner.ts
+++ b/packages/schema/src/sucafina/planner.ts
@@ helper: legacyInput / capability keyed input
-function legacyInput<P extends keyof typeof CommandValues, A extends keyof (typeof CommandValues)[P] & string>(
-  page: string, action: A, values: (typeof CommandValues)[P][A],
-) {
-  return Schema.Struct({
-    page: Schema.Literal(page), action: Schema.Literal(action),
-    id: Optional(NonEmpty), version: NonNegativeInt, values,
-    confirmed: Optional(Schema.Boolean),
-  })
-}
+// The selected capability fixes both the source page and the legal action set.
+// Values stays a concrete Schema.Top subtype, not the entire command catalog.
+const PageByCapability = {
+  CAP17: "Overview",
+  CAP18: "OPEX",
+  CAP19: "CAPEX",
+  CAP20: "Headcount",
+  CAP21: "Entities & allocations",
+  CAP22: "FX rates",
+  CAP23: "Versions",
+} as const
+function legacyInput<
+  P extends keyof typeof CommandValues,
+  A extends keyof (typeof CommandValues)[P] & string,
+  Values extends Schema.Top,
+>(capability: P, action: A, values: Values & (typeof CommandValues)[P][A]) {
+  return Schema.Struct({
+    page: Schema.Literal(PageByCapability[capability]), action: Schema.Literal(action),
+    id: Optional(NonEmpty), version: NonNegativeInt, values,
+    confirmed: Optional(Schema.Boolean),
+  })
+}
@@ CAP17.import-workbook
-  input: legacyInput("Overview", "import-workbook", CommandValues.CAP17["import-workbook"]),
+  input: legacyInput("CAP17", "import-workbook", CommandValues.CAP17["import-workbook"]),
@@ CAP18.save
-  input: legacyInput("OPEX", "save", CommandValues.CAP18["save"]),
+  input: legacyInput("CAP18", "save", CommandValues.CAP18["save"]),
@@ CAP18.delete
-  input: legacyInput("OPEX", "delete", CommandValues.CAP18["delete"]),
+  input: legacyInput("CAP18", "delete", CommandValues.CAP18["delete"]),
@@ CAP18.spread
-  input: legacyInput("OPEX", "spread", CommandValues.CAP18["spread"]),
+  input: legacyInput("CAP18", "spread", CommandValues.CAP18["spread"]),
@@ CAP18.reset
-  input: legacyInput("OPEX", "reset", CommandValues.CAP18["reset"]),
+  input: legacyInput("CAP18", "reset", CommandValues.CAP18["reset"]),
@@ CAP18.import-workbook
-  input: legacyInput("OPEX", "import-workbook", CommandValues.CAP18["import-workbook"]),
+  input: legacyInput("CAP18", "import-workbook", CommandValues.CAP18["import-workbook"]),
@@ CAP19.save
-  input: legacyInput("CAPEX", "save", CommandValues.CAP19["save"]),
+  input: legacyInput("CAP19", "save", CommandValues.CAP19["save"]),
@@ CAP19.delete
-  input: legacyInput("CAPEX", "delete", CommandValues.CAP19["delete"]),
+  input: legacyInput("CAP19", "delete", CommandValues.CAP19["delete"]),
@@ CAP19.spread
-  input: legacyInput("CAPEX", "spread", CommandValues.CAP19["spread"]),
+  input: legacyInput("CAP19", "spread", CommandValues.CAP19["spread"]),
@@ CAP19.reset
-  input: legacyInput("CAPEX", "reset", CommandValues.CAP19["reset"]),
+  input: legacyInput("CAP19", "reset", CommandValues.CAP19["reset"]),
@@ CAP19.import-workbook
-  input: legacyInput("CAPEX", "import-workbook", CommandValues.CAP19["import-workbook"]),
+  input: legacyInput("CAP19", "import-workbook", CommandValues.CAP19["import-workbook"]),
@@ CAP20.save
-  input: legacyInput("Headcount", "save", CommandValues.CAP20["save"]),
+  input: legacyInput("CAP20", "save", CommandValues.CAP20["save"]),
@@ CAP20.delete
-  input: legacyInput("Headcount", "delete", CommandValues.CAP20["delete"]),
+  input: legacyInput("CAP20", "delete", CommandValues.CAP20["delete"]),
@@ CAP20.sync
-  input: legacyInput("Headcount", "sync", CommandValues.CAP20["sync"]),
+  input: legacyInput("CAP20", "sync", CommandValues.CAP20["sync"]),
@@ CAP20.import-workbook
-  input: legacyInput("Headcount", "import-workbook", CommandValues.CAP20["import-workbook"]),
+  input: legacyInput("CAP20", "import-workbook", CommandValues.CAP20["import-workbook"]),
@@ CAP21.save
-  input: legacyInput("Entities & allocations", "save", CommandValues.CAP21["save"]),
+  input: legacyInput("CAP21", "save", CommandValues.CAP21["save"]),
@@ CAP21.delete
-  input: legacyInput("Entities & allocations", "delete", CommandValues.CAP21["delete"]),
+  input: legacyInput("CAP21", "delete", CommandValues.CAP21["delete"]),
@@ CAP21.common
-  input: legacyInput("Entities & allocations", "common", CommandValues.CAP21["common"]),
+  input: legacyInput("CAP21", "common", CommandValues.CAP21["common"]),
@@ CAP21.import-workbook
-  input: legacyInput("Entities & allocations", "import-workbook", CommandValues.CAP21["import-workbook"]),
+  input: legacyInput("CAP21", "import-workbook", CommandValues.CAP21["import-workbook"]),
@@ CAP22.save
-  input: legacyInput("FX rates", "save", CommandValues.CAP22["save"]),
+  input: legacyInput("CAP22", "save", CommandValues.CAP22["save"]),
@@ CAP22.delete
-  input: legacyInput("FX rates", "delete", CommandValues.CAP22["delete"]),
+  input: legacyInput("CAP22", "delete", CommandValues.CAP22["delete"]),
@@ CAP22.import-workbook
-  input: legacyInput("FX rates", "import-workbook", CommandValues.CAP22["import-workbook"]),
+  input: legacyInput("CAP22", "import-workbook", CommandValues.CAP22["import-workbook"]),
@@ CAP23.save
-  input: legacyInput("Versions", "save", CommandValues.CAP23["save"]),
+  input: legacyInput("CAP23", "save", CommandValues.CAP23["save"]),
@@ CAP23.copy
-  input: legacyInput("Versions", "copy", CommandValues.CAP23["copy"]),
+  input: legacyInput("CAP23", "copy", CommandValues.CAP23["copy"]),
@@ CAP23.official
-  input: legacyInput("Versions", "official", CommandValues.CAP23["official"]),
+  input: legacyInput("CAP23", "official", CommandValues.CAP23["official"]),
@@ CAP23.lock
-  input: legacyInput("Versions", "lock", CommandValues.CAP23["lock"]),
+  input: legacyInput("CAP23", "lock", CommandValues.CAP23["lock"]),
@@ CAP23.unlock
-  input: legacyInput("Versions", "unlock", CommandValues.CAP23["unlock"]),
+  input: legacyInput("CAP23", "unlock", CommandValues.CAP23["unlock"]),
@@ CAP23.delete
-  input: legacyInput("Versions", "delete", CommandValues.CAP23["delete"]),
+  input: legacyInput("CAP23", "delete", CommandValues.CAP23["delete"]),
@@ CAP23.import-workbook
-  input: legacyInput("Versions", "import-workbook", CommandValues.CAP23["import-workbook"]),
+  input: legacyInput("CAP23", "import-workbook", CommandValues.CAP23["import-workbook"]),
```

Only the existing 29 `legacyInput` callsites are modified. All exact source validators and producer fields/limits, 12-month constraints, optional/null/zero, CAS/version, forecast/output, transport/client and 39 operation descriptors remain untouched. This text is an inert patch and a complete source-diff record, not authorization for this worker to modify 162-owned paths.

162: Apply `packages/schema/src/sucafina/planner.ts` from this exact source commit after live consumer HEAD/owner preimage reconciliation; if current blob is already `0a85a3f33bc384196100ee75c974102e04f9868a`, record CONSUMED_WITH_PROOF_POINTER instead. No extra branch or dispatcher. After successful 162 composition, route fresh causally changed product W to 163 for scoped compiler/typechecks/SDK/guards and to 164 for the unchanged hosted `planner.test.ts` selector. Never reuse the failed old W/S as new proof.
