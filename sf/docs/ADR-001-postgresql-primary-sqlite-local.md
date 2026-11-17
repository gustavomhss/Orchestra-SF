# ADR-001 — PostgreSQL corporate primary, SQLite local adapter

**Status:** PROPOSED / NOT IMPLEMENTED / NO DEPLOYMENT APPROVED  
**Date:** 2026-11-17  
**Scope:** Orchestra-SF / Sucafina business persistence on Azure Linux  
**Owners:** product, data, Azure AZ-03 and independent release reviewers

## Decision

Use PostgreSQL as the **target primary business store for corporate Azure deployments**, while retaining SQLite as a **mutually exclusive local/development/operator backend** behind the existing persistence contract. Do **not** implement automatic fallback on connection failure, transparent dual writes, asynchronous promotion of a stale SQLite copy, or two simultaneous authorities.

**This is an architectural target, not a claim that PostgreSQL is already live.** Until the new driver and migration are qualified, the running SQLite remains authoritative; do not change the production default simply by setting an environment variable.

At startup, a deployment must select **exactly one** business driver (future explicit setting: `SF_BUSINESS_DB_DRIVER=postgres|sqlite`). Azure production must fail closed if its selected PostgreSQL configuration is absent, inaccessible or inconsistent. It must never silently instantiate an empty SQLite database. Local operator installations may continue to choose SQLite explicitly. Failover in production, if later required, belongs to PostgreSQL HA/recovery, not SQLite.

**Two existing persistence domains:**
- Business: `modules/sucafina/Sucafinav1/runtime/local-store.ts` implements the Sucafina `LocalStore` interface, with SQLite `snapshots`, `blobs`, authentication tables and transactional audit/versions/sequences. The Microsoft profile opens `<installation-config-dir>/business-microsoft/installation.sqlite`.
- Orchestra host: `packages/core/src/database/database.ts` uses a separate Drizzle/Effect SQLite database, default `orchestra.db`, with SQLite-specific migrations and PRAGMAs. **Do not include this core engine in the first PostgreSQL migration.** Migrate it only under a separate inventory, compatibility and benefit decision. Until then, Azure backups must cover BOTH domains.

This narrower scope reduces the migration from a rewrite of all Orchestra storage to one Sucafina business adapter, with conformance against the current contract.

## Why no automatic SQLite fallback

If PostgreSQL becomes unavailable after accepting writes, a local SQLite copy cannot be assumed current. Automatically writing to it would split decisions, purchase identifiers, budget revisions, documents, permissions and receipts into incompatible histories. Silent fallback also masks operational outages. Therefore:
- PostgreSQL unavailable => bounded timeout, 503/unavailable, alert; **no business writes**.
- Local SQLite is a separately configured mode, NOT a live backup or failover replica.
- Restore/rollback only under an explicit maintenance window and verified source/version, never based on mere connection failure.
- No automatic dual-write, background synchronization or conflict reconciliation system in this ADR.

## Cost and compute — decision not yet approved

Reference public list prices checked 2026-11-17; actual subscription/region, storage type, reserved terms, taxes, FX, networking and HA can change costs. These are **not invoices or Brazil South quotations**:

| Azure Database for PostgreSQL Flexible Server | vCPU / RAM | Public reference compute, ~730 h/month |
| --- | --- | --- |
| Burstable B1ms | 1 vCore / 2 GiB | USD 12.41/month |
| Burstable B2s | 2 vCores / 4 GiB | USD 49.64/month |
| General Purpose D2ds v5 | 2 vCores / 8 GiB | approximately USD 130/month |

Reference Premium SSD 32 GiB: about USD 3.68/month at published USD 0.115/GiB-month, **excluding any regional premium or extra provisioned IOPS**, and network/overage. Backups up to the provisioned data-storage capacity are included in the publicly described service pricing; excess backup storage incurs charges. Regional third-party indicative Brazil South rates can be materially higher than these public reference prices; obtain an exact quote in the actual resource group region and subscription. HA adds a standby with its own compute and storage bill. Burstable CPU credits can exhaust under sustained load; Microsoft positions it primarily for dev/test, not production with sustained performance demands.

Sources:
- https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/
- https://learn.microsoft.com/en-us/azure/postgresql/compute-storage/concepts-compute
- https://learn.microsoft.com/en-us/azure/reliability/reliability-postgresql-flexible-server

Compare three **mutually exclusive** operating choices:
1. **Keep the current SQLite initially:** no new DB compute charge; fastest route to qualifying today's real VM with AZ-03 recovery proofs. Increases need for careful WAL, file backups, single-writer and performance observation.
2. **PostgreSQL on the SAME Azure VM:** no new fixed VM SKU, but database competes for host CPU/RAM/disk IOPS, shares failure domain, and creates Linux patching, WAL archive/PITR, restore and monitoring ownership. Not a free HA solution. Avoid treating this as an automatic improvement over SQLite.
3. **Managed Azure PostgreSQL:** extra fixed monthly DB compute and network/storage charges, less CPU/RAM consumed by the app VM, built-in database backup/PITR and separate fault boundary. Prefer for sustained multiuser corporate production **if measured load and approved budget justify it**. Start without HA until SLO/RTO/RPO require it; never claim HA from backups alone.

**Decision gate:** collect actual Azure region, VM SKU, app memory/CPU/IOPS headroom, observed concurrent users/writers, p50/p95 request and commit latency, database size and monthly budget. Compare a realistic workload on SQLite vs managed PostgreSQL using the same candidate and data distribution. Don't introduce extra compute or add a second active driver unless the measurement and operational goals justify it.

## Minimal PostgreSQL business adapter

Implement `PgBusinessStore` behind the current `LocalStore = Persistence & AssetPersistence & { secrets, dispose }` interface; no Prisma, no second ORM, no generic multi-database abstraction framework. A single narrow selector creates either the existing SQLite store or the PostgreSQL store at boot. Use a bounded connection pool and same-region/private network/TLS. Keep PostgreSQL credentials server-only via approved Azure identity/secret mechanism; never put credentials in the renderer, CI receipts or logs.

Start with the **existing snapshot wire format as TEXT** rather than attempting simultaneous full relational normalization. Store binary attachments in PostgreSQL `BYTEA` initially; preserve `surface`, `key`, size/type and generations. Authentication records stay separate from exported business snapshots, but share the same DB transaction and key boundaries. Preserve the canonical `encodeSnapshot/decodeSnapshot` behavior, including `undefined`, audit, notices, versions, source revisions, sequences and copy isolation.

Conformance requirements before selection:
- Atomic commit of snapshot + blobs; rollback after abort, callback exception and commit failure, no re-invoked callback or leaked bytes.
- CAS conflicts, same-record and cross-record concurrency across **independent** server instances; no lost updates, replay or duplicate PR/PO numbers.
- `transactionAll`, `readSnapshotRoot`, nested-read rules, generation and access fences, dispose/cancel semantics and key/credential issuance/revocation.
- Lock ordering / `SELECT ... FOR UPDATE` on pre-existing per-surface rows, bounded transaction/statement timeout, no deadlocks; validate that external awaits inside a transaction don't consume connection pool capacity excessively.
- Replay/restore compatibility with host source fences, side effects, identity and audit after restart and after migration.

Do not promise better throughput automatically. The existing snapshot-per-surface writes may be a larger cost than the database engine. Observe snapshot size, allocations/encoding, lock hold time and round trips before optimizing or normalizing individual hot fields.

## P0 now — protect the existing real data (AZ-03 ownership; no duplicate implementation)

Existing AZ-03 runbooks: draft PR #248 (`sf/azure/runbooks/AZ-03-LINUX-DATA-RECOVERY.md`) and `sf/ci/PENDING-WORK.md`. Coordinate with that owner; this ADR neither replaces nor claims the Azure proof.

Before any DB migration or runtime change:
1. Identify exact currently running artifact SHA, `SUCAFINA_MICROSOFT_CONFIG` path, both DB files, WAL siblings, UID/modes, canonical actual mount and Azure managed disk; ensure **both database paths are on the intended persistent data disk**, not `/opt`, root OS disk or `/tmp`. Configuration and data can live under the approved private installation dir on that mounted disk; `/etc/orchestra-sf` operator config is a distinct authority. Do not infer VM paths from checked-in examples.
2. Take an application-consistent, independently retained checkpoint covering BOTH DBs, keys/authorized recovery material and attached files, with write admission drained; copying a live SQLite main file alone in WAL mode does not suffice. Preserve provenance/hashes without leaking secrets.
3. Verify SQLite integrity in a safely quiesced copy, Azure Backup `operation=Backup`, `status=Completed`, actual recovery point, and isolated restore with real read/write/CAS and restart proofs. A configured policy or a GitHub green test alone is not proof.
4. Fix/verify business-store periodic backup and monitoring in Microsoft mode. Current `local/entry.ts` creates jobs with `schedule: !!operator`: the timer does not run for Microsoft; successful POST may trigger `jobs.runOnce()` but is not a reliable time-based schedule. Verify the exact VM's external backup/retention before introducing another scheduler; use one owner/monitor and avoid duplicate backups.
5. Recheck degraded state, stale restore, authentication separation, file permissions, source authorization, maintenance errors and health/alerts; never silently weaken existing security gates.

All of this stays a release blocker until demonstrated on the installed Azure candidate. Never mark NOT_RUN as PASS.

## Migration order and rollback

1. Freeze a specific source schema + commit SHA, capture live baseline and metrics in a test/staging clone, and build the PG adapter/tests on its own leased branch.
2. On the clone, export canonical business snapshots + blobs with versions/generations/audit/receipts, validate row counts/length/SHA-256 and semantic equality after import into PG. Keep current auth keys private; decide revocation/re-login of sessions explicitly, with no forged login authority.
3. Run the existing conformance suite against **both real drivers** through GitHub Actions, plus restart, corruption, lock, rollback, connection-loss and load tests. Do not run prohibited local Bun test suites or relax guards/skips to force green.
4. For approved cutover, take fresh proven Azure+app backups; stop/drain writes/Task/Relay, migrate final delta offline or perform full re-import, compare hashes and revisions, switch exactly one driver and run Entra/Planner/Procurement/Decisions and CAS smoke on the installed host.
5. A rollback to original SQLite is safe **only before accepting a new PostgreSQL business write**. Afterwards SQLite is stale; retain PG as authority or perform a separately reviewed reverse migration/recovery. No silent revert to an old SQLite file.
6. Release only after independent review and same-SHA CI, F04/AM and AZ-03 credentials/backup/restore/rollback evidence. No changes here to `sf-release`, protected paths or Azure infrastructure.

## Explicit exclusions / no-go conditions

- No live PostgreSQL provisioning, Azure resource changes, SQLite deletion, release promotion, CI gate modifications or merges by this ADR.
- No parallel split-brain writes, silent SQLite failover, automatic schema conversion on startup or cross-database saga infrastructure.
- No claim that this ADR migrates core `orchestra.db`; that store remains SQLite until separately planned and protected.
- No production default switch if managed service cost is not approved, if CPU/network benchmarks regress beyond the accepted SLO, or if Azure restore/backup remains unverified.
