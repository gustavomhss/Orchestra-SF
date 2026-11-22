# Prepared narration timing pass

**Status: prepared for review; no acoustic inference or Actions run performed.**

This folder contains a small CPU pipeline for aligning the exact approved spoken
text to unchanged narration WAVs. `source-clips.json` is parent-owned;
`caption-word-map.json` is editorial-owned. They are inputs, not modified here.

## Files to publish after review

| Prepared file | Temporary repository path |
|---|---|
| `onboarding-alignment.yml` | `.github/workflows/onboarding-alignment.yml` |
| `align_narration.py` | `scripts/onboarding-media/narration-alignment/align_narration.py` |
| `download_sources.py` | `scripts/onboarding-media/narration-alignment/download_sources.py` |
| `requirements-cpu.txt` | `scripts/onboarding-media/narration-alignment/requirements-cpu.txt` |
| `SOURCES.md` | `scripts/onboarding-media/narration-alignment/SOURCES.md` |
| `source-clips.json` | `scripts/onboarding-media/narration-alignment/source-clips.json` |
| `caption-word-map.json` | `scripts/onboarding-media/narration-alignment/caption-word-map.json` |

No product PR, runtime, test or build changes are required. The workflow's push
trigger is limited to these media paths on `onboarding-recording`. Root may
publish this isolated media job only after its independent review.

## Review contract

- Match each result's source text/audio SHA256 to the frozen input manifest.
- Match result `canonical_words` to the editorial map. Canonical indexes are
  zero-based; word ends and text-character ends are exclusive.
- Read `alignment-summary.json` before using any clip. A partial or failed run
  does not imply that missing clips were aligned.
- Read `greedy_audit` and word flags. The first automatic results still need
  editorial acceptance of uncertain words, especially product names/acronyms.
- Preserve exact per-word intervals and confidence in the final provenance.
- Map captions/focus from those words with the separate editorial mapper. Use
  `original WAV time + actual audio placement offset`; no second speech margin.

## Main output shape

Each `clips/<id>.json` contains original source identity, hashes, duration,
sample rates, frame resolution, canonical words, character spans, greedy audit
and analysis duration. A word record has:

```json
{
  "word_index": 0,
  "text": "Welcome",
  "normalized": "WELCOME",
  "source_char_start": 0,
  "source_char_end": 7,
  "start_seconds": "measured number, not prepared",
  "end_seconds": "measured number, not prepared",
  "start_frame": "measured integer, not prepared",
  "end_frame": "measured integer, not prepared",
  "confidence": "measured uncalibrated acoustic score",
  "minimum_character_confidence": "measured acoustic score",
  "flags": []
}
```

The sample above documents names and semantics only; no timings are invented.
`provenance.json` binds the model bytes, package versions, script, manifest,
caption map and Actions execution. The downloader's `source-artifacts.json`
binds the earlier narration runs and artifacts.

## Local input-only inspection

`align_narration.py --validate-only` can verify prepared WAV/text hashes and
canonical tokens without importing Torch, downloading a model or running
inference. Its audio-root layout is `<batch>/<original-file>.wav`. This does not
qualify the acoustic implementation; only the reviewed Actions run will do that.

See `SOURCES.md` for official APIs, model license, bounded calibration, confidence
limitations and the exact observed-versus-estimated timing boundary.
