# Sucafina for Orchestra-SF

The Sucafina module belongs to the Orchestra-SF workspace. Its intended user interface is the native Orchestra chapter at `/orchestra/sucafina`, using the app shell and V2 components.

The existing transactional business engine is preserved in `Sucafinav1/`, with the procurement decision account in `porta/`. This layout preserves their import relationships while the native interface is integrated. The previous HTML renderer remains a parity reference; it is not the native chapter.

The native shared contract lives in `packages/schema/src/sucafina.ts` and `packages/protocol/src/groups/sucafina.ts`. Client code is generated from that contract with `bun run generate` in `packages/client`. Frontend code must not import the business engine or server.

## Integration status

Workspace registration and the initial typed contract are present. The private installation service, native screens, installation isolation and end-to-end acceptance are still being implemented. The temporary server handler reports unconfigured and rejects business operations. It must not be presented as a completed integration.

## Data and authority

Private configuration, databases, keys and attachment bytes stay outside this repository. An explicit installation supplies authentication, persistence, directory, scanner and keys. There is no implicit administrator, invented corporate group or substitute dataset. Microsoft setup remains deferred until a real application exists.

Reads must cross the authorized domain view. Writes must cross the existing transaction and permission boundary, including record-specific versions, audit, notices and procurement decisions. HTTP failures preserve their status; a conflict does not silently overwrite a colleague's change.

## Verification

Run package typechecks with `bun typecheck`. Run tests only on GitHub through the repository's `bun run test:ci sucafina <exact test files>` command. CI snapshots are restricted to the exact Orchestra-SF repository identity. A passing typecheck or scaffold test does not establish native feature completeness.
