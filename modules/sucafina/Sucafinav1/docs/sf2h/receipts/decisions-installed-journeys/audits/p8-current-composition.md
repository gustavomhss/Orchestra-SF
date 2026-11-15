# Mission52 P8 — final C35 / W11 identity audit

**PASS identity and textual composition. No unresolved preimage conflict.** This does not qualify the complete nominal journey.

| Item | Commit | Tree |
|---|---|---|
| Candidate base C35 | `e87e22d163924635bf0b41785c9bc80bf780ac0a` | `be4dec9ee1960b572b6bfc4dee9e0a7d21b2c60c` |
| W11 | `fb9ed54674e7792008e8d1bd7425adc7effe8c09` | `b5263a5eec18bfc8bcd98e3128f9ee9fce202a89` |
| S11 | `f0b9c4c92c74072b86484fcbdd0f8aff1d990f05` | `6411bd0a39a393c89969a932b0287d3afbe073ec` |

The immutable C32 trees resolve all 35 audited paths. Of the original 33 overlays, 23 preimages are unchanged, 9 Runtime59 postimages are already integrated, and only host-context changed. Its current `297a4050323d80648684725f9c7e9a8680aa318f` preimage composes to `46d3a77a819f4127b073cb8f5572838824019075`. The original mission52 edits and intervening Native64 edits remain byte-identical.

The complete C32→C34 comparison lists 145 paths and C34→C35 lists 77. Both are below the 300-file GitHub compare cap, with zero intersection across all 35 audited paths, including the historical55 map. This extends the established preimage and integrated Runtime59 identities to C35.

The actual remote C35→W11 comparison contains exactly 25 paths: 10 owned, 14 shared proposals and 1 unit proposal. Independent Git tree reads confirm every postimage and `100644` mode. S11 preserves all 43 W root entries; its sole addition is `.ci-run.json`, blob `3619f1fd8b14262b0c89ee9830269f2b05356aaf`, containing the unchanged five-journey request.

All 25 cumulative patch sections reconstruct their complete postimages from their current base preimages. The full patch is 131,513 bytes, SHA256 `3df2b368e8a229d419848af816ac31eb5c1e8029afa9a10754e23a78131e9682`. The material is 795,934 bytes, SHA256 `8613336fe34f033e4c798778c4897dc8a9ec154617f26f622589f124ad37de1a`. Runtime59 is recorded as 9 integrated dependencies and contributes no patch delta.

Nominal11 run `43672508561` reported **3 PASS, 2 FAIL**. J1 reached real choice/recovery and durable history before the source revision, then failed discovery after the actual 2400→3600 change. The financial journey remained blocked at Requests HTTP 503. No complete acceptance, integration authority or GLOBAL_RELEASE is claimed.

The material is `/workspace/scratch/fec39c0682b3/m52-work/p8-cumulative-material.json`; patches, manifests and complete pre/post files are under `/workspace/scratch/fec39c0682b3/m52-work/p8-delivery/`. No local product execution, test, compilation, dispatch or remote mutation was performed in this audit.
