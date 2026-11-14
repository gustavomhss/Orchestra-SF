# W26 X — hosted exact-threshold observation

The immutable W26 candidate failed its one selected exact-threshold test. The actual host evaluate/store phase reached the existing 285000 ms cooperative deadline after 275640 ms in that phase. Fixture setup completed in 9640 ms. The terminal Bun summary is complete: 0 pass, 1 fail, 1 test, 1 file, 3 expectations, 285.82 seconds, zero additional errors.

The test never reached its exact-threshold, durable readback, recomposed reader, retry, or revoked-authority assertions. These remain unproved. The log records 1934 environment API invocations during evaluate/store (2054 total); those are not physical persistence or connection counts. The log does not identify the expensive internal call by itself.

W: a1434e7ea7340aa1d1c8ce6bb48958b724218170. Snapshot: 4650ebf5948747a49f04120070765aa6317e6fd8. Run 43619479808; test job 132521664604. Cleanup job 132523530424 and snapshot-branch deletion succeeded. GitHub returned zero artifacts. The Omni hook explicitly reports not applicable, no declaring test, zero spawns and zero delegations.

Raw UTF-8 capture preserves the MCP-returned bytes, including LF and BOM. The strict data normalizer needed a one-line successor for Bun's singular “1 test” / “1 file” grammar. The original normalizer and all previous seals remain unchanged. Every identity, inventory and count validation still executes.

No product was executed locally, no remote mutation occurred, and no native, global, criterion or independent-review acceptance is inferred.
