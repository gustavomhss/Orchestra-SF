# Independent source review of W5 owner consumption

Reviewer: `/root`. This is a source review and composition check, not a product execution or CI pass.

## C12 reconciliation restoration

The exact prior PR23/W1 producer blob `927ae5bd892412d7025bde5e9acf274087d71fd9` already refreshed the cases storage CAS after the atomic domain/receipt write. The Finance producer `fed7feb25d9af2fecebba8d2b1d2e2a6b1a3e0ac` added review binding but replaced that block with the earlier CAS. W4's H02/H03/H05 failures and H06 successful replay are consistent with that source regression; the log did not print the response reason, which is a source inference.

The proposed union `4bdd12ac162d61465557363953e25dfd99fad5e8` restores the published block verbatim. It reloads cases, requires full case equality, rereads and matches the authoritative receipt, rechecks current case/application/host authority, then writes with the refreshed storage CAS and repeats full case equality inside the write. It preserves all new Finance real-review checks, producer revalidation, persistent receipt binding and mismatch handling. It does not weaken authority, identity or concurrency checks and does not change domain policy or state semantics.

This repairs an Operations intake regression by composing two existing published deltas. It is communicated to the Finance/Compose owners together with the source pins and focused proof; it is not an independently invented shared-runtime change.

## OPS-HOST-01B

The three published owner hunks (one type import, lazy `prepareDossierProcurement`, two calls) produce `9aee116a091c684ba467f81316d2fb915b3f8758` from the Operations business-services blob `41a795e5a2c05600741e694efca19f0ab329db55`. They match the owner implementation at Compose `8f760659279567d2c169691c3e57cf19be10417d`, without consuming its unrelated broad changes or optionalizing procurementEvidenceWrites.

Preparation retains the original projection producer, obtains actual sourcing evidence, requires matching Request version/context/nonempty source refs/comparison and current host authorization, and passes the complete sourcing value. The existing final revalidation now calls the same wrapper and compares all material, excluding only the preexisting clock-derived ageDays projection. The consumer does not calculate a score, choice, FX or policy. New H01 assertions exercise this second consumer directly; the separate WP06 dossier-runtime cases exercise the first CLI consumer and must not be misattributed to this wrapper.

## OPS-CONSUMER-03

Interface `a29565f763ddd90bc5bc3b8d298afb47ad84008d` publishes UI blob `2e6c081ad2a5282654707f7fc7278183e7dfb20d`. Relative to Operations `3bee0f4326c1a65d3c0573695c3e4a1609b6c480`, it includes the owner's earlier busy/uncertainty/revocation controls as well as the real reviewDigest. The entire file is consumed verbatim, with no new dependency beyond its unchanged imports.

The consumer only enables explicit confirmation for a matching planned review with scalar fields, no existing receipt, and a valid 64-hex proof. It freezes the full application body and idempotency key for an uncertain retry, prevents another review/application from replacing that intention, validates receipt identity before reload, and clears private data and controls on 401/403 or the access-revoked event. The digest comes from the actual review response. Source review found no material defect; hosted browser/real Procurement HTTP validation remains required.

The shared Dashboard/Planner HTTP binding and wider owner fixtures have independent dependencies. This intake does not claim that those generic host paths are integrated or validated by the Procurement proof. They remain astra-compose responsibility.
