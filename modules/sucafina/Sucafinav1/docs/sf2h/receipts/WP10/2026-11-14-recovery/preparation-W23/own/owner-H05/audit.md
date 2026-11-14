# C12 H05 — published reconciliation contracts disagree

**OPEN — owner decision required (WP04 / WP11 / S0).** No foreign file was changed.

W21 B, run **43605495862**, job **132479126824**, observed HTTP 200 from decision-apply where H05 expected 409. The whole case also exceeded its existing 15-second budget (16,942 ms). The additional asynchronous assertion error belongs to H05, not H06.

The fixture makes a real C08 case edit after the durable domain receipt: it increases the case version and changes the objective. Its expected result is `stale / case-changed-after-application`, leaving the prepared change planned and the case receipt list empty.

The published `decisions/apply.ts` intentionally accepts a newer case version, checks the prepared change is unchanged, reopens and confirms the authoritative receipt, then reconciles onto `...fresh` with the latest storage version. That producer contains no `case-changed-after-application` outcome. This source mechanism is consistent with the observed HTTP 200.

The failed HTTP assertion prevented the later objective/receipt assertions from running. **This receipt does not claim those final values were observed or accepted.** The performance correction and the contract decision remain separate.

`audit.json` pins all three foreign files and their source commits. `hosted-H05-excerpt.txt` preserves the relevant terminal log lines; the complete raw-log SHA256 is `37c9dad034c51ee8c0fc1ccf84639468f5d035df26f484c1272efecc7fdf14da`.

WP04 and WP11 must publish a coherent producer/test pair after agreeing the expected behavior; S0 resolves any policy disagreement. WP10 can then compose those exact blobs and rerun the complete hosted file. A local wrapper that manufactures the expected HTTP 409 would hide the contract disagreement and is not part of this correction.
