# Neural narration production sources

This package is a media-only handoff. No narration has been generated or auditioned in the authoring environment. The first Action run qualifies the voice with the 104-word sample; listen before committing to the full narration.

## Runtime

Target: Ubuntu 24.04 x86_64, CPython 3.12, CPUExecutionProvider. The exact Python patch version is recorded in manifest.json. WAV format is mono PCM16, 24000 Hz. The generated manifest contains scene text, display text, numbered WAV filenames, durations, checksums, and offsets in the concatenated narration.wav. These offsets are not yet the edited video's timeline.

The workflow deliberately installs only media dependencies. No Orchestra-SF application build, application test, server start, secret, external account, or paid speech API is required.

## Sources and pinned versions

- Official wrapper: https://github.com/thewh1teagle/kokoro-onnx
- Source inspected: https://github.com/thewh1teagle/kokoro-onnx/tree/3596b26764286a7de9d90c363e988d50578918e5
- Upstream dependency lock: https://github.com/thewh1teagle/kokoro-onnx/blob/3596b26764286a7de9d90c363e988d50578918e5/uv.lock
- Package and wheel checksum: https://pypi.org/project/kokoro-onnx/0.6.1/
- Official inference example: https://github.com/thewh1teagle/kokoro-onnx/blob/3596b26764286a7de9d90c363e988d50578918e5/examples/save.py
- Provider selection: https://github.com/thewh1teagle/kokoro-onnx/blob/3596b26764286a7de9d90c363e988d50578918e5/src/kokoro_onnx/session.py
- Public model release: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1
- Release API used for exact asset digests: https://api.github.com/repos/thewh1teagle/kokoro-onnx/releases/tags/model-files-v1.1
- Official model and published Apache-2.0 license: https://huggingface.co/hexgrad/Kokoro-82M
- Official voice table: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md

requirements-cpu.txt pins the complete required Python dependency set for the selected Linux/Python wheel platform, with SHA256 hashes. Runtime versions and wheel hashes follow upstream's pinned uv.lock; kokoro-onnx's wheel hash comes from the official PyPI release. dependency-sources.json records each wheel URL or release page. Install with --require-hashes --only-binary=:all:. The job also emits pip's install report and resolved versions.

## Model assets

Both files come from the model-files-v1.1 release, not the older model-files-v1.0 release.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| kokoro-v1.0.onnx | 325505369 | beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a |
| voices-v1.0.bin | 28214398 | bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d |

The generator refuses missing, damaged, or changed assets after download. Model files remain separate from the small narration artifact.

## Voice and license

The wrapper is published under MIT; Kokoro-82M is published under Apache-2.0, including the English voice tensor set in that model repository. The selected voice is af_heart (American English), identified as grade A by the model author's voice table. That is an upstream assessment, not an audition performed here. af_bella is an available alternative in the script. Neither option clones the user or another named person.

Espeak is used only to obtain pronunciation/phonemes. The synthesized waveform is produced by the Kokoro neural model, not by Espeak or Flite. The generator uses the upstream supported English path and does not need Misaki/spaCy downloads.

The workflow retains the full Apache-2.0 model license in the model artifact and the wrapper MIT license in the narration artifact. LICENSE-KOKORO-MODEL.txt is the standard license text retrieved from the official model author's source repository at https://github.com/hexgrad/kokoro/blob/dfb907a02bba8152ca444717ca5d78747ccb4bec/LICENSE, matching the Apache-2.0 license published on the model card. LICENSE-KOKORO-ONNX.txt was retrieved from the pinned wrapper source commit above. The narration output does not bundle model weights.

## Publication mapping

Root owns GitHub mutations. Suggested branch-only paths:

- onboarding-narration.yml -> .github/workflows/onboarding-narration.yml
- other files in this directory -> scripts/onboarding-media/narration/

The workflow runs on matching pushes to onboarding-recording, and supports workflow_dispatch where GitHub makes it available. Default source is audition.json. Add chapters.json when the script and actual UI evidence are final, then select source=chapters. Do not merge this media-production branch into a product branch merely to run narration.

## Qualification

First verify the small generated WAV, real duration and levels, then listen to voice, pacing, brand pronunciation, and sentence endings. The supplied sample has 104 spoken words, so its actual duration must be measured, not assumed to be exactly 45–60 seconds. Keep spoken text and canonical display_text separate. The supplied expansion of HuGR Claw is provisional wording from the parent task, pending source confirmation.

For the full video, use short scene paragraphs, numbered clips and enough time to observe real actions. Do not stretch a screenshot montage to imply interaction. Do not claim an AI analysis ran successfully unless the UI recording proves it. Root will independently align the final chapter narration to the real UI footage.

