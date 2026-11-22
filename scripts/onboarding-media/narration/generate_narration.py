#!/usr/bin/env python3
"""Generate English chapter WAVs with verified Kokoro assets; media only."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import re
import urllib.request
import wave

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1"
ASSETS = {
    "kokoro-v1.0.onnx": {
        "bytes": 325505369,
        "sha256": "beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a",
    },
    "voices-v1.0.bin": {
        "bytes": 28214398,
        "sha256": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
    },
}
UPSTREAM = "3596b26764286a7de9d90c363e988d50578918e5"

def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def get_assets(folder):
    folder.mkdir(parents=True, exist_ok=True)
    records = []
    for name, expected in ASSETS.items():
        path = folder / name
        url = RELEASE + "/" + name
        if not path.exists():
            partial = path.with_suffix(path.suffix + ".download")
            request = urllib.request.Request(url, headers={"User-Agent": "Orchestra-SF-media/1.0"})
            with urllib.request.urlopen(request, timeout=60) as response, partial.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            if partial.stat().st_size != expected["bytes"] or sha256(partial) != expected["sha256"]:
                partial.unlink(missing_ok=True)
                raise RuntimeError("Downloaded asset failed verification: " + name)
            partial.replace(path)
        if path.stat().st_size != expected["bytes"] or sha256(path) != expected["sha256"]:
            raise RuntimeError("Existing asset failed verification: " + name)
        records.append({"file": name, "url": url, **expected})
    return records

def wav_writer(path, sample_rate):
    result = wave.open(str(path), "wb")
    result.setnchannels(1)
    result.setsampwidth(2)
    result.setframerate(sample_rate)
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--voice", choices=["af_heart", "af_bella"], default="af_heart")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--limit", type=int, default=0, help="Generate only the first N scenes; 0 means all.")
    args = parser.parse_args()
    if not 0.85 <= args.speed <= 1.15:
        parser.error("--speed must be between 0.85 and 1.15.")
    if args.limit < 0:
        parser.error("--limit cannot be negative.")
    scenes = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(scenes, list) or not scenes:
        parser.error("Input must be a nonempty JSON array of {id, text} objects.")
    seen = set()
    for scene in scenes:
        if not isinstance(scene, dict):
            parser.error("Each scene must be an object.")
        scene_id, text = scene.get("id"), scene.get("text")
        if not isinstance(scene_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,79}", scene_id):
            parser.error("Scene IDs must use lowercase letters, numbers, hyphens or underscores.")
        if scene_id in seen:
            parser.error("Duplicate scene ID: " + scene_id)
        seen.add(scene_id)
        if not isinstance(text, str) or not text.strip() or len(text) > 5000:
            parser.error("Each scene requires 1–5000 characters of narration.")
    if args.limit:
        scenes = scenes[:args.limit]
    args.output.mkdir(parents=True, exist_ok=True)
    asset_records = get_assets(args.assets)
    os.environ["ONNX_PROVIDER"] = "CPUExecutionProvider"
    import numpy as np
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    if "CPUExecutionProvider" not in ort.get_available_providers():
        raise RuntimeError("CPUExecutionProvider is not available.")
    narrator = Kokoro(
        str(args.assets / "kokoro-v1.0.onnx"),
        str(args.assets / "voices-v1.0.bin"),
    )
    sample_rate = 24000
    lead_seconds, tail_seconds = 0.15, 0.25
    combined_path = args.output / "narration.wav"
    manifest = {
        "purpose": "Neural English narration for actual-UI onboarding; video timing is aligned separately.",
        "voice": args.voice,
        "language": "en-us",
        "speed": args.speed,
        "sample_rate_hz": sample_rate,
        "format": "PCM16 mono WAV",
        "runtime": {"python": platform.python_version(), "platform": platform.platform()},
        "packages": {
            name: importlib.metadata.version(name)
            for name in ["kokoro-onnx", "onnxruntime", "numpy", "espeakng-loader", "phonemizer"]
        },
        "upstream_source_commit": UPSTREAM,
        "input_sha256": sha256(args.input),
        "generator_sha256": sha256(Path(__file__)),
        "assets": asset_records,
        "licenses": {
            "kokoro-onnx": "MIT",
            "Kokoro-82M model and bundled English voice tensors": "Apache-2.0, as published by hexgrad",
        },
        "timing_note": "Offsets below refer to concatenated narration.wav, not to the edited video.",
        "clips": [],
    }
    elapsed_samples = 0
    with wav_writer(combined_path, sample_rate) as combined:
        for index, scene in enumerate(scenes, start=1):
            samples, actual_rate = narrator.create(
                scene["text"].strip(),
                voice=args.voice,
                speed=args.speed,
                lang="en-us",
                trim=True,
                sentence_pause=0.25,
                clause_pause=0.1,
                continuous=False,
            )
            values = np.asarray(samples, dtype=np.float32).reshape(-1)
            if actual_rate != sample_rate or values.size == 0 or not np.isfinite(values).all():
                raise RuntimeError("Invalid audio output for " + scene["id"])
            peak = float(np.max(np.abs(values)))
            rms = float(np.sqrt(np.mean(values.astype(np.float64) ** 2)))
            if peak <= 0 or rms < 0.00001:
                raise RuntimeError("Silent audio output for " + scene["id"])
            gain = min(1.0, 0.98 / peak)
            values = values * gain
            lead = np.zeros(round(lead_seconds * sample_rate), dtype=np.float32)
            tail = np.zeros(round(tail_seconds * sample_rate), dtype=np.float32)
            padded = np.concatenate([lead, values, tail])
            pcm = np.round(np.clip(padded, -1, 1) * 32767).astype("<i2").tobytes()
            filename = f"{index:02d}_{scene['id']}.wav"
            clip_path = args.output / filename
            with wav_writer(clip_path, sample_rate) as output:
                output.writeframes(pcm)
            combined.writeframes(pcm)
            duration = padded.size / sample_rate
            manifest["clips"].append({
                "clip_index": index,
                "id": scene["id"],
                "chapter": scene.get("chapter", scene["id"]),
                "file": filename,
                "text": scene["text"].strip(),
                "display_text": scene.get("display_text", scene["text"].strip()),
                "text_sha256": hashlib.sha256(scene["text"].strip().encode()).hexdigest(),
                "audio_sha256": sha256(clip_path),
                "duration_seconds": round(duration, 6),
                "narration_start_seconds": round(elapsed_samples / sample_rate, 6),
                "speech_start_seconds": round(elapsed_samples / sample_rate + lead_seconds, 6),
                "speech_end_seconds": round((elapsed_samples + len(lead) + len(values)) / sample_rate, 6),
                "narration_end_seconds": round((elapsed_samples + len(padded)) / sample_rate, 6),
                "raw_peak": peak,
                "raw_rms": rms,
                "gain_applied": gain,
            })
            elapsed_samples += len(padded)
            print(json.dumps({"clip": filename, "duration_seconds": round(duration, 3)}), flush=True)
    manifest["total_duration_seconds"] = round(elapsed_samples / sample_rate, 6)
    manifest["combined_audio_sha256"] = sha256(combined_path)
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"clips": len(scenes), "duration_seconds": manifest["total_duration_seconds"]}), flush=True)

if __name__ == "__main__":
    main()

