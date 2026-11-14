# Independent source review — Procurement C12 review proof

Reviewer: root, independent of the WP04 consumer implementation author. This review covers the proposed changes to `product/procurement/decision-host.ts`, `product/procurement/decision-http.ts`, and the two owned WP04 test files. It is a source review, not an executed-test result.

## Contract and source provenance

The consumer uses the four unmodified WP11 producers from Finance PR35 W2 `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`: prepared review, prepared application, application reconciliation and receipt/review binding. The intake manifest records each exact blob. `decisions/receipts.ts` is unchanged between the old Operations candidate and this producer pin. No additional human actions or grants are required: the existing human authority binds an arbitrary admitted payload and already recognizes `decisions.apply`.

## Reviewed behavior

The HTTP adapter accepts an exact application body containing case identity/version, choice, prepared change and a lowercase hexadecimal review digest of length 64. It obtains the human grant for that complete parsed body. A missing, malformed or extra field is rejected before admission. Review requests keep their separate existing purpose and shape.

The consumer caches only an actual successful review producer result, together with the full prepared-change digest and a five-minute expiration. The first application requires the observed review and the same digest, then invokes the real review producer again through WP11 before applying. Domain source changes therefore cannot be accepted merely because the browser retained a valid-looking digest.

The private `ReviewDigestFor` callback requires the active Request/context, unchanged binding, exact base request, complete admitted human intent and the same proposal material. Only `state` and `receipt` are normalized when comparing the proposal because WP11 changes those fields during reconciliation; target, command, identity, authority and all other proposal fields remain compared. The callback is neither a constant nor a model-supplied capability.

Replay uses WP11's persistent receipt/review binding before the new-producer check. The same original request and proof can recover the recorded receipt after the volatile review cache is cleared. A different proof conflicts. Current principal, ACL/policy revision and physical target incarnation remain required for lookup and replay. The source does not manufacture a new review to authorize a previously recorded receipt.

The lower-level component fixture derives its digest with the real domain review and WP11's canonical digest producer. Its admitted human flag remains a documented component premise. The host integration tests exercise the actual HTTP, human authority, business services and SQLite paths, preserving the prior cases and adding changed/expired proof and changed-source cases. Clearing a service cache is not claimed as a full process restart.

## Finding and required validation

No new defect was confirmed in the reviewed consumer changes. Hosted typechecks and affected tests remain required for the exact published candidate. The old W1 run is not evidence that these new bytes passed.

The shared UI still needs to carry the real `reviewDigest` returned by the producer and retain it in the identical retry body. OPS-CONSUMER-03 is an owner patch for astra-compose, not applied to Operations. Until that owner increment is consumed and its browser path is proved, the shared UI's complete C12 journey remains pending. Native parity, human acceptance and the final bundle gates remain unqualified.
