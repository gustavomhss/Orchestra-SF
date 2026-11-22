# Teams checkpoint and clone integrity

`teams-checkpoint.py` implements the file-backup portion of G10 against the current
Entra installer. It inventories every file and directory under
`/var/lib/orchestra-sf` and `/etc/orchestra-sf`, validates settled SQLite stores,
streams a private archive, checks every archived byte against the inventory, and
can restore that archive into an empty directory on a different reserved Azure VM.
The clone retains private permissions and is never activated by this command.

The host CLI imports `sf/azure/vm/install-factory-distribution.py`. It uses the
actual installer lock, stopped-service/maintenance preflight and immutable release
verification. It compares the observed `.a7-source.json` and manifest with the
G07 receipt's candidate and inner tar hash. It also checks the current Azure IMDS
resource ID against the isolated environment reservation. It does not replace
these checks with the filesystem fixtures used by the component tests.

## Scope of the receipt

The checkpoint receipt has schema `orchestra-sf.teams-checkpoint.v2`; the clone
receipt has schema `orchestra-sf.teams-clone-integrity.v2`. Both explicitly retain
`releaseQualified: false`, `businessRecovery: NOT_RUN` and `keyDecryption: NOT_RUN`.
The checkpoint binds the candidate SHA/tree, installed inner tar and manifest,
VM identity, reservation digest and writer-fence evidence. Writer drain is an
operator attestation; service inactivity and installation bytes are observations.

An available key is read only to establish that it is nonempty and included in the
private inventory. This is not a successful credential-decryption proof. The full
G10 rehearsal still needs the admitted migration, real Teams sessions, external
monotonic authority, business effect after checkpoint, real restart/retry and
compatible code rollback. The file clone cannot substitute for these obligations.

## Operator inputs

The reservation is a root-owned regular JSON file with mode `0600`, stored through
the authorized private operations channel. It records an existing reservation;
creating the file does not grant authority. Its schema is
`orchestra-sf.g10-reservation.v1` and its common fields are:

- `action`: exactly `checkpoint` or `verify-clone`.
- `environment`: `isolated-qa`; `disposable`: true; `productionCutover`: false.
- `authorizationRef`, `authorizedBy`, `expiresAtUtc`: the actual authorization and
  expiry of this reserved operation, not values supplied by a synthetic test.
- `vmResourceId`: exact Azure resource ID of the host executing this action.
- `fqdn`: the reserved ingress checked by the installed maintenance preflight.
- `candidate`: `{ "sha": "<C>", "tree": "<T>" }` and `archiveSha256`: inner G07 tar hash.

For `checkpoint`, also provide `externalRegisterPath`, `keyFile`, `writesBlocked`,
`taskRelayDrained` and `writerFenceEvidenceSha256`. The independent monotonic
register must exist outside both restored roots. The key must exist inside the
complete private inventory. The backup directory must already be root-owned
`0700`, outside both source roots and on a different volume from durable state.
The G07 receipt must be the actual verified `sf-g07-package-v1` receipt, stored
privately with mode `0600`.

For `verify-clone`, provide `sourceVmResourceId`, `networkEgressFenced: true` and
`credentialsDisabled: true`. The current VM must be different from the source VM.
The clone must have its own foundation, data mount, stopped service and maintenance
ingress. The target must be an existing empty root-owned `0700` directory outside
the live state and configuration trees. Only `target/restored` and a private clone
receipt are created; service start and live-data replacement are unavailable.

## Commands

These commands require observed private inputs. They are not a production-window
approval or a placeholder recipe that can be executed without the reservation.

```sh
python3 -B sf/azure/recovery/teams-checkpoint.py checkpoint \
  --reservation "$G10_CHECKPOINT_RESERVATION" \
  --g07-receipt "$G10_G07_RECEIPT" \
  --output-dir "$G10_INDEPENDENT_BACKUP_DIRECTORY"

python3 -B sf/azure/recovery/teams-checkpoint.py verify-clone \
  --reservation "$G10_CLONE_RESERVATION" \
  --archive "$G10_PRIVATE_CHECKPOINT_TAR" \
  --receipt "$G10_PRIVATE_CHECKPOINT_RECEIPT" \
  --target "$G10_EMPTY_CLONE_DIRECTORY"
```

No archive, raw inventory, reservation, key, private path or configuration belongs
in a public Actions artifact. Publish only the minimized gate receipt and hashes
after the private proof is reviewed. The component workflow publishes only
synthetic filesystem test output and its explicit component-class receipt.

## Failure behavior and component controls

The adapter refuses unsettled SQLite journals, unknown/missing databases, unsafe
paths, links/special files, nested mounts, changed source files, archive hash or
roster mismatches, missing/extra/duplicate members, invalid payload hashes and
nonempty clone destinations. Limits bound member count, manifest size and expanded
bytes. A failed restore removes only its own staging directory and does not change
the source. A service remains stopped throughout the operational path.

The `go-live-recovery-controls` workflow runs the exact source SHA on hosted Linux.
It creates real temporary SQLite databases, attachments and private directories;
tests restore bytes and real filesystem fault cases; and runs the canonical guards.
This proves the adapter's file mechanism. It does not claim Azure IMDS, real host
preflight, key decryption, installed Teams or final G10 acceptance.
