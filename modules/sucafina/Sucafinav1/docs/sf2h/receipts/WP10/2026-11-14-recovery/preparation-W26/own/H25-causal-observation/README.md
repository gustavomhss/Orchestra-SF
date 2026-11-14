# W25 H — terminal scoped observation

Product `3d59829e5d9e438cbb443428a9479d7f63b5bf31`; snapshot `c4e212a3970be85fc639007a31e156e9ef5883b7`; run `43616586837`, test job `132512863120`.

The strict existing data-only normalizer completed: **42 pass, 1 fail, 43 tests, 3 files, 429 expectations, 239.74 seconds**, no skips or unhandled errors. WP10 Procurement case-scope has 16/16 passes; scenario-operation-access has 19/19. WP04 host integration has 7/8. The run remains failed.

H05 fails at `host-integration.test.ts:262`: expected HTTP409, received200, after an authorized concurrent objective/version edit following the durable receipt. It finishes in11.34116s, inside its15s budget. Later assertions in that failing body are not credited. Exact WP04/WP11 pins and the static producer semantics are recorded in `triage.json`; no foreign fixture or assertion has been edited.

The real case-scope counter shows two independent invocations preserving one canonical case reader, two canonical contexts and four resolutions. Each observed scoped invocation reports333 Persistence calls and1 root API transaction, compared with516 and336 in its canonical baseline. These are API counters, not physical connections/commits. Measured timings and all WP04 phase records are preserved verbatim as JSON data in the triage.

Omni explicitly reports not applicable, no declaring test, no spawn and no delegation. This grants no native acceptance. Cleanup job132514395471 and snapshot-branch deletion succeeded. Artifacts API returned an empty list; no ZIP is inferred.

Raw86215bytes/86213characters/960LF/0CRLF exactly matches the captured tool content. SHA256: `826e36dfbc4515fe5f6ff9c21a10004e4a7af3b01dc216e93f35142ca2b15013`.

Normalized records: `evidence/W25/normalized/H-procurement-scope/{entry,terminal,test-observations}.json`. Config: `evidence/W25/observe-H.json`. The original parent capture is unchanged. Results belong only to W25 and are not relabeled as W26 or global/independent acceptance.
