# Narration alignment: sources and scope

Prepared for the Orchestra–Sucafina onboarding film on 2026-11-22. This media step
measures unchanged, previously generated English narration. It does not execute
the product, generate speech, change the approved transcript, or infer that a
product action occurred.

## Dependency and model choice

- Python 3.11 with **PyTorch 2.8.0 CPU** and **TorchAudio 2.8.0**. The official
  installation matrix supplies the CPU wheel index and matching package versions:
  <https://pytorch.org/get-started/previous-versions/#v280>.
- Official **WAV2VEC2_ASR_BASE_960H** English base bundle. The authors' model is
  redistributed under the MIT license. It is an English ASR model, not a model
  trained specifically on this product vocabulary:
  <https://docs.pytorch.org/audio/2.8/generated/torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H.html>.
- Versioned bundle implementation identifies the model filename, English labels,
  16 kHz analysis sample rate, and 12-layer base architecture:
  <https://docs.pytorch.org/audio/2.8/_modules/torchaudio/pipelines/_wav2vec2/impl.html>.
- Official weight URL selected by that bundle:
  <https://download.pytorch.org/torchaudio/models/wav2vec2_fairseq_base_ls960_asr_ls960.pth>.
  The source filename has no published SHA256 suffix. The first approved run
  records the actual downloaded bytes' SHA256; subsequent reproduction can pass
  `--expected-model-sha256`. No unverified digest is invented in the prepared
  code. Loading uses `weights_only=True` through the bundle's documented download
  keyword argument interface.
- The bundle API documents the blank, word separator, capital-letter and
  apostrophe alphabet and in-memory resampling contract:
  <https://docs.pytorch.org/audio/2.8/generated/torchaudio.pipelines.Wav2Vec2ASRBundle.html>.

The two direct Python dependencies are version pinned. Transitive dependencies
are resolved by the official CPU index at installation, and their exact wheel
URLs/hashes and installed versions are retained in `install-report.json` and
`requirements-resolved.txt`. This is an observed installation receipt, not a
claim that the prepared requirements constitute a complete transitive hash lock.

## Alignment and audit method

1. Verify the exact existing audio and UTF-8 spoken-text SHA256 values supplied
   in the reviewed input manifest. Verify the original narration batch manifest
   agrees with the selected clip. No gain, trimming, or WAV write is performed.
2. Decode mono PCM16 in memory and resample to the bundle's 16 kHz analysis input.
3. Run one acoustic emission pass. Normalize emissions with `log_softmax`.
4. Align the exact canonical characters using the compiled CPU
   `torchaudio.functional.forced_align` implementation, then merge token repeats.
   Reconstructing a different target sequence is a hard failure.
5. Derive word times from the aligned nonblank characters. Run greedy decoding
   from the same emissions for an additional transcript-disagreement audit.
   Greedy output never replaces the approved transcript.

Primary algorithm/API references:

- <https://docs.pytorch.org/audio/2.8/tutorials/forced_alignment_tutorial.html>
- <https://docs.pytorch.org/audio/2.8/tutorials/ctc_forced_alignment_api_tutorial.html>
- <https://docs.pytorch.org/audio/2.8/generated/torchaudio.functional.forced_align.html>
- <https://docs.pytorch.org/audio/2.8/generated/torchaudio.functional.merge_tokens.html>

The official API documents a batch-size-one restriction and sufficient frames
for the target/repeated tokens. The 2.8 APIs are deprecated and removed in 2.9;
the explicit 2.8 pins preserve this bounded, established implementation rather
than relying on a changed newer interface. The much larger multilingual MMS
checkpoint is unnecessary for this English-only film.

### Honest confidence and timing scope

`confidence` is the duration-weighted mean posterior across aligned nonblank
character frames. It is **not a calibrated probability of correctness**.
The initial `0.5` review threshold is an editorial heuristic, recorded in each
result. A high score is not a substitute for listening to a proper noun or
checking a visible product field.

Times are acoustic frame boundaries scaled by actual resampled duration divided
by the emission-frame count, following the tutorial convention. They have roughly
one-frame resolution, not sample-exact certainty. The actual seconds-per-frame
value is recorded for each WAV.

Time zero is the **start of the original WAV**, including its leading silence.
The final film currently places narration at scene time +0.3 seconds. Add that
placement offset once; do not add the old estimated +0.15 speech-start margin.
Caption aliases and display-chunk spans are owned by `caption-word-map.json` and
the separate editorial mapper, not silently expanded by this aligner.

Proper names, spoken letters, low acoustic scores, greedy disagreement, and long
word spans are flagged for review. A successful job proves that all declared
WAVs were processed and conserved. It does not automatically approve every word
boundary, pronunciation, caption, or focus box.

## Original narration artifacts

The reviewed `source-clips.json` is the authority for the actual selected clips,
text/audio hashes and source filenames. The initial 33-clip set references:

| Batch | Actions run | Exact narration head |
|---|---:|---|
| stable | 45042278245 | d7117ac72f7618519dc99692a4897ed790fa2539 |
| results | 45042972351 | 9a7daf1819980a0b23e2e8ca5ad77dccc7156b36 |
| visible-review | 45043272692 | 01619a1b6654afa607a88e4ec5a7359052380447 |

The downloader requires the exact successful run/head, one unexpired artifact of
the declared name, a matching original batch manifest, and matching WAV bytes.
GitHub's reported artifact digest is retained as metadata; the tool separately
verifies each extracted WAV against the predeclared SHA256 and does not claim to
have recomputed an archive digest it did not receive.

- Official artifact metadata/access documentation:
  <https://docs.github.com/en/rest/actions/artifacts?apiVersion=2022-11-28>
- Official CLI artifact download interface:
  <https://cli.github.com/manual/gh_run_download>

`gh` owns the authenticated download. The Python wrapper uses argument arrays,
does not print CLI error bodies, and never records signed URLs, authorization
headers, tokens, or credentials. The workflow grants `contents: read` and
`actions: read` only, reuses the already reviewed narration action pins, and
disables persistent checkout credentials.

## Bounded execution and portability

The prepared workflow is a media-only job on an isolated recording branch.
Publication and launch remain with the parent agent. No local inference or new
Actions run is authorized by this preparation alone.

The first longest and median clips calibrate actual CPU throughput; their valid
results are retained. A projected total over 600 seconds, including a 20% margin,
stops further inference. The script also checks its analysis budget between
clips, writes each completed result atomically, and preserves partial summaries.
An outer 720-second process bound includes model load/download and covers a
stuck native call; the complete job is capped at 18 minutes including dependency
and artifact transfers. This is a bound, not a promise of the runner's speed.

Only result JSON, input/map copies, package receipts and this source note are
uploaded. Original narration WAVs remain unchanged in their existing artifacts;
model weights, environments, product source, credentials and private logs are
excluded. A later one-clip answer batch can use the same scripts with a reviewed
new manifest and matching canonical word map.
