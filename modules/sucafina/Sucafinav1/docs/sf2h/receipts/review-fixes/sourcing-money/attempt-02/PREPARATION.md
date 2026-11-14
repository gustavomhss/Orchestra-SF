# Sourcing-money — attempt 02 preparation

Reason for a new check: the first closing check found a type mismatch in this mission's assertion and an independent inherited WP14 fixture error. The functional run43625920456 was58 pass/0 fail/377 assertions. CLI typecheck and guards passed; Sucafina package typecheck failed with two diagnostics.

The own assertion now narrows C02 baseAmount to number or null before comparing it with the numeric queue amount. The equality assertion remains; malformed nonnumeric C02 output now fails explicitly. Product monetary.ts and fixture.ts are unchanged from aa5d8c0ee49777ea82bc707df8c976d311728292.

Validation is narrowed to the modified sourcing-stage.test.ts (five tests). The other53 passing tests have identical blobs, product/config/fixture inputs and are not repeated. The official existing check workflow must use its full mode because its restricted modes do not admit this namespace. A new package typecheck is necessary to demonstrate the own TS2769 is resolved; repeated attempts at the unchanged WP14 error are not authorized by this receipt.

Record a new W and request-only S for this changed test input. No new test was run locally, no deadline increased, no equivalent test run duplicated, no product change outside monetary.ts applied. Both external owner patches remain documentary only.

Original evidence is preserved in attempt-01/RESULT.json. Applicable criteria and functional scenarios remain as recorded in attempt-01/PREPARATION.md.
