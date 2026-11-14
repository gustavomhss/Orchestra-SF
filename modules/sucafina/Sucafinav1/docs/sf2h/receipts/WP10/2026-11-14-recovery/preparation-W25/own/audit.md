# W25 — explicit public callback types

The W24 hosted CHECK reports two own TS7006 sites, each in both SF and WP10 type checks, and13 unique foreign sites. W25 adds only type imports for Snapshot and BlobTransaction and annotates the two actual callback arguments. Removing exactly those additions reproduces the complete W24 fixture byte-for-byte, preserving every test, assertion, deadline, callback call and product helper. No local product execution or compilation occurred. Success requires the successor hosted CHECK; no functional or native acceptance is inferred.
