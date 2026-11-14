# W23 C12 V2 — preserve pre-eligibility case/C08 refusals

V1 remains archived byte-for-byte at `agents/c17/W23-procurement-read-scope`. This V2 contains the same two own product paths, three additional full-file tests, and the unchanged central integration patch. The source manifest records V1 hashes, each V1-to-V2 diff and the whole final file bytes. No central or foreign file was edited by this builder.

## Root finding and exact correction

V1 classified any unsuccessful C08 selection as `unavailable / procurement-case-read-changed`. That happened before eligibility and unintentionally changed the outcome for absent cases, incarnation mismatch, nonparticipants and C08 refusals. The canonical case-port.read returns `denied / case-access-unavailable` for a valid-authority missing/nonparticipant case and propagates C08 failure reasons through failure(read). The existing foreign renewal-choice-history test explicitly expects that denied reason for an outsider. The actual C08 provider returns `invalid-product-state` for an invalid stored schema, `product-state-uninitialized` for absence, and `product-access-unavailable` when its namespace access is denied.

V2 first checks the complete current Request/header/binding/input/selection/reader pin after the real state.read. If the C08 result is not ok or no case was selected, it revalidates actual host authority and checks the pin again. Only while those remain valid does it return the private unsupported sentinel. The LocalStore transaction then ends and the real canonical case reader runs once outside the owned scope, producing its own status/reason. It neither copies the preflight outcome nor synthesizes a canonical refusal.

Request/header/lease changes, a failed real host revalidation, a thrown/poisoned store scope and every refusal after the canonical invocation continue to fail closed with no retry. All planned-change/current-source eligibility, complete C08/source proofs, canonical passes, result cloning and final egress checks from V1 are unchanged. No new await was added after transaction release to suggest atomicity outside C08.

## Added real counterproofs

Each additional test starts with the actual prepared Procurement positive from the existing SQLite/C08/authority/source/producer fixture. The missing-case test admits a valid sf_case_read intent for an absent selector. The nonparticipant test removes Bob through a real authorized C08 mutation, then admits Bob under valid UI grants and a separately selected canonical period. The invalid-C08 test changes the actual stored schema and checks that the UI authority itself remains valid.

All three obtain the expected outcome by executing the actual canonical reader, assert the relevant literal contract, reset observation counters, then require the wrapped read to return exactly that actual result. The wrapper must call canonical once with no already-held snapshot and without BCS calls for these early refusals.

The missing-case test additionally wraps only the actual C08 state.read boundary to replace a Request header after its real undefined selection. It returns the real C08 result unchanged. The wrapped read must then refuse with procurement-case-read-changed, invoke canonical zero times, and leave ordinary host authorization valid. That counterproof distinguishes changed Request identity material from an otherwise valid missing-case refusal.

The full file now declares 16 tests. Removing the three V2 cases and their one type import reproduces the V1 file byte-for-byte: the original 13 tests, assertions and budgets remain intact. No local tests, typecheck, build, import, product execution or browser were run. Static signatures, relative import paths, diffs and whitespace were inspected; qualification must occur in hosted CI on the published successor.

## Unchanged limits

The original W21 B evidence and performance interpretation remain at the V1 package. W23 gain is not measured. The helper still admits only real planned Procurement prepared cases without receipts; chosen/unprepared cases preserve their canonical fences and write interleavings. Histories, mixed/native/Planner/timed cases, already applied outcomes and whole apply transactions remain outside this optimization. H05 expected409/received200 remains a producer/test semantic disagreement. Root must reconcile the central patch and three independent reviewers must assess the published bytes and hosted evidence; this builder review grants no independent, native or global acceptance.
