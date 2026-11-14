# W15 — stable labels for real recipient selection

Parent product W14: `edefb5b66706aea866ee45c7e8e76332c27c342a`, tree `294c7bd28795119a014190c34a643fe85616e0ac`.

## Executed reason for the change

[W14 product43592240575](../runs/43592240575.json) completed with 47 passes and two failures. Both failures occurred in the real recipient consumer after the canonical directory returned HTTP200 and its principal option appeared in the DOM. The exact-label locator never resolved; the log did not reach an enabled/disabled or option actionability check. Recipient selection and the downstream logout proof therefore remained incomplete.

The original HTML nested each select and all of its changing options inside its label. The published Playwright1.59.1 label-selector implementation reads descendant label text. The finding records the primary source and the distinction between this static causal mechanism and the observed timeout.

## Material product repair and preservation

The product change is limited to `caseQuestionForm`: Record and Recipient now have separate, stable label elements associated with select IDs unique to that form. Visible wording, field names and routing remain the same. Every script after that function is byte-identical to W14, including the question/replay and destination access controls.

The same two real tests retain their exact-label locators, selectOption calls, original 25 assertion lines, HTTP/directory/identity/storage producers and time bounds. Nine additional assertions check stable explicit label association, unique IDs, the separate Record control and enabled Recipient controls. No CSS or force substitute, timeout increase, mocked directory or new authority grant was introduced.

[Own manifest](w15-recipient-label-own.json) · [completed independent peer](w15-recipient-label-peer-read.json) · [causal finding](../findings/w15-recipient-label.md).

## Surgical validation and dependencies

The next product request contains only `wp01/browser-startup.test.ts`, `wp01/question-recipients.test.ts` and `wp01/browser-lifecycle.test.ts`. It is a new material candidate, not a retry of the unchanged failing snapshot. The other 45 complete consumer passes and two harness passes in W14 remain attached to their original SHA; they are not rerun as a group suite.

Static validation uses the same package bun typechecks and repository guards in Actions. The [W14 static receipt](../runs/43592242039.static.json) reports only nine foreign locations: five retained host result-narrowing callers and four WP07 ReviewHost fixture callers, with no own diagnostic. Their owner-only patches remain published and unapplied to foreign source paths.

Compose was reconciled again at `00304ac25cc82ffd87ebd3096bd2f5cfec5222e1`: state755639, ReviewHost fixture77ef3 and held BCS4b024 remain unchanged. Its Hot Topic domain fix now matches the5e0b80a already retained here. No new foreign input is taken in W15; the outstanding static, C05/C12/F04 and WorkSignals/destination composition boundaries are unchanged.

The W14 receipts and [independent preservation audit](w14-preservation-audit.json) are published with this increment. They retain 24 recovered ancestors,32 original receipts,65 verified foreign pins and all protected boundaries. No product test, typecheck, guard or browser ran locally. No Protocol/Server HttpApi definition changed. This increment makes no native/global acceptance or DONE declaration; S0 retains final integration and epic after all groups.
