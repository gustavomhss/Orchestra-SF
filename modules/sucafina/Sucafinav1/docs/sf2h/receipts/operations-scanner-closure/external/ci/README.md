# Patch for45/60 — real Operations63 ClamD service

**PREPARED_NOT_APPLIED_OR_EXECUTED.** This directory is an inert owner patch. Mission63 does not write `.github/workflows/test-ci.yml`, the compiler/check refs or `sf2-stack`.

`test-ci.yml.preimage.txt` is the complete workflow read at `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85`, Git blob `9f078f4e37b758691bcd073e5590f05d5444392a`. `test-ci.yml.postimage.txt` and `test-ci.patch` contain the complete proposed change. `MANIFEST.json` fixes the exact hashes and dependencies.

Apply only after reconciling the current workflow preimage. The existing test job remains `contents: read`; the existing cleanup job and its branch-deletion permission are unchanged. The normal request validator/env allowlists, matrix, test command, Omni controls, artifact uploads and budgets remain unchanged. No credentials, Azure, deployment, system service installation or new platform is introduced.

The patch introduces a selection check and one bounded setup/cleanup pair only for `ci-run-linux-operations63-*` and the exact live scanner or five-journey Operations requests. It derives the loopback ports from the setup it just verified. It does not admit a request-supplied scanner endpoint or enable a broader env key.

Required sequence after owner materialization:

1. Publish the actual composed W with the scripts, live check, all five unchanged original nominal identities and this workflow input; record tree/preimages/postimages.
2. Execute the explicit real ClamD check through the existing `.ci-run.json`/MCP lane. Its DOWN proof stops only the recorded error daemon after the live scan/error controls. Preserve setup, product test, Omni, cleanup and artifact results separately.
3. Execute the five-case Operations nominal request on the same composed product. Keep retries0, workers1, original assertions and original journey deadlines.
4. Keep the seven existing auxiliary cases and protocol checks in their own surgical request without enabling the external service. Reuse actual results only when W/tree/config/dependencies are identical.
5. Preserve W/S/run/job/request and all failures. Only `.ci-run.json` differs from W to S. A successful provisioning control is neither a product-adapter result nor completed human/browser/native acceptance.

## Verified sources and pending capability

The official release metadata was retrieved through GitHub MCP from `https://api.github.com/repos/Cisco-Talos/clamav/releases/latest` and resolved to `clamav-1.5.4`; the canonical pinned release endpoint is `https://api.github.com/repos/Cisco-Talos/clamav/releases/tags/clamav-1.5.4`.

The observed `.deb` digest is `28d6efc5b4423e7830c3559339552eb53870a9eac51ac4efb37d60530d329886`, size105819396bytes. The annotated tag object `2cbd122d3a401b9bded52ef6bf201bff605af474` points to source commit `fa59fca15872bb8a914ba4c68188bcc8a502cbdf`. The tool lock records exact blobs for official install layout, RPATH, binaries and configuration definitions. No Docker image digest is invented.

Official references: [install source](https://github.com/Cisco-Talos/clamav/blob/fa59fca15872bb8a914ba4c68188bcc8a502cbdf/INSTALL.md), [ClamD config](https://github.com/Cisco-Talos/clamav/blob/fa59fca15872bb8a914ba4c68188bcc8a502cbdf/etc/clamd.conf.sample), [FreshClam config](https://github.com/Cisco-Talos/clamav/blob/fa59fca15872bb8a914ba4c68188bcc8a502cbdf/etc/freshclam.conf.sample), [INSTREAM protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html).

Metadata and source inspection establish the tool definition, not runtime availability. Download/checksum/relocation, certificate loading, official database access, sufficient memory, two live daemons, scanner product controls and browser results remain pending until the authorized hosted job records them. Setup fails closed for each missing prerequisite.
