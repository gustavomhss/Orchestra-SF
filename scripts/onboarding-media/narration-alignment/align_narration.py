#!/usr/bin/env python3
"""Align unchanged narration WAVs; never generate, trim, or rewrite speech."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import sys
import time
import wave

SCHEMA = "sf-narration-word-alignment-v1"
BUNDLE = "WAV2VEC2_ASR_BASE_960H"
MODEL_FILE = "wav2vec2_fairseq_base_ls960_asr_ls960.pth"
MODEL_URL = "https://download.pytorch.org/torchaudio/models/" + MODEL_FILE
WORD_RE = re.compile(r"[A-Z]+(?:'[A-Z]+)*")
PROPER_NAMES = {"ORCHESTRA", "SUCAFINA", "MAESTRO", "HUGR", "CLAW", "OPENCLAW", "ATLAS", "QWEN", "GUARDRAIL"}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def canonical_words(text: str) -> list[dict]:
    """Character offsets refer to the exact original text (Python Unicode indexes)."""
    unsupported = [char for char in text if char.isdigit() or (char.isalpha() and not char.isascii())]
    if unsupported:
        raise ValueError("Transcript contains digits/non-ASCII letters; require an explicit reviewed spoken transcript")
    normalized = text.replace("\u2019", "'").replace("\u2018", "'").upper()
    words = [
        {
            "word_index": index,
            "text": text[match.start():match.end()],
            "normalized": match.group(),
            "source_char_start": match.start(),
            "source_char_end": match.end(),
        }
        for index, match in enumerate(WORD_RE.finditer(normalized))
    ]
    if not words:
        raise ValueError("Empty spoken transcript")
    return words


def check_inputs(manifest_path: Path, audio_root: Path, word_map_path: Path | None) -> tuple[dict, list[dict], dict | None]:
    source = json.loads(manifest_path.read_text(encoding="utf-8"))
    if source.get("schema") != "sf-narration-alignment-input-v1":
        raise ValueError("Unsupported input manifest schema")
    clips = source.get("clips", [])
    if not 1 <= len(clips) <= 100 or len({clip["id"] for clip in clips}) != len(clips):
        raise ValueError("Expected 1–100 uniquely named clips")
    sources = {item["folder"]: item for item in source["sources"]}
    if len(sources) != len(source["sources"]):
        raise ValueError("Duplicate source folder")
    word_map = json.loads(word_map_path.read_text(encoding="utf-8")) if word_map_path else None
    mapped = {clip["id"]: clip for clip in word_map["clips"]} if word_map else {}
    checked = []
    for clip in clips:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", clip["id"]):
            raise ValueError("Unsafe clip id")
        if Path(clip["file"]).name != clip["file"] or clip["batch"] not in sources:
            raise ValueError(f"Invalid source identity for {clip['id']}")
        audio_path = audio_root / clip["batch"] / clip["file"]
        if sha256_bytes(clip["text"].encode("utf-8")) != clip["text_sha256"]:
            raise ValueError(f"Spoken text hash mismatch for {clip['id']}")
        if sha256_file(audio_path) != clip["audio_sha256"]:
            raise ValueError(f"Audio hash mismatch for {clip['id']}")
        with wave.open(str(audio_path), "rb") as wav:
            if wav.getcomptype() != "NONE" or wav.getsampwidth() != 2 or wav.getnchannels() != 1:
                raise ValueError(f"Require unchanged mono PCM16 WAV: {clip['id']}")
            duration = wav.getnframes() / wav.getframerate()
            sample_rate = wav.getframerate()
        if abs(duration - clip["duration_seconds"]) > 0.002:
            raise ValueError(f"Duration mismatch for {clip['id']}")
        if not 0.1 < duration <= 90:
            raise ValueError(f"Clip duration outside bounded pass: {clip['id']}")
        words = canonical_words(clip["text"])
        if word_map:
            entry = mapped.get(clip["id"])
            if not entry or entry["canonical_words"] != [word["normalized"] for word in words]:
                raise ValueError(f"Caption-map canonical words disagree for {clip['id']}")
            if (entry["text_sha256"], entry["audio_sha256"]) != (clip["text_sha256"], clip["audio_sha256"]):
                raise ValueError(f"Caption-map source hashes disagree for {clip['id']}")
        checked.append({**clip, "audio_path": audio_path, "sample_rate": sample_rate, "words": words, "source": sources[clip["batch"]]})
    return source, checked, word_map


def greedy_audit(reference: list[str], hypothesis: list[str]) -> dict:
    """Word edit distance from the same acoustic pass; never changes the reference."""
    rows, columns = len(reference), len(hypothesis)
    distance = [[0] * (columns + 1) for _ in range(rows + 1)]
    for index in range(rows + 1):
        distance[index][0] = index
    for index in range(columns + 1):
        distance[0][index] = index
    for row in range(1, rows + 1):
        for column in range(1, columns + 1):
            distance[row][column] = min(
                distance[row - 1][column] + 1,
                distance[row][column - 1] + 1,
                distance[row - 1][column - 1] + (reference[row - 1] != hypothesis[column - 1]),
            )
    edits = []
    row, column = rows, columns
    while row or column:
        if row and column and distance[row][column] == distance[row - 1][column - 1] + (reference[row - 1] != hypothesis[column - 1]):
            edits.append({"operation": "equal" if reference[row - 1] == hypothesis[column - 1] else "substitution", "word_index": row - 1, "reference": reference[row - 1], "hypothesis": hypothesis[column - 1]})
            row -= 1
            column -= 1
        elif row and distance[row][column] == distance[row - 1][column] + 1:
            edits.append({"operation": "deletion", "word_index": row - 1, "reference": reference[row - 1], "hypothesis": None})
            row -= 1
        else:
            edits.append({"operation": "insertion", "before_word_index": row, "reference": None, "hypothesis": hypothesis[column - 1]})
            column -= 1
    edits.reverse()
    return {"enabled": True, "transcript": " ".join(hypothesis), "word_error_rate": distance[rows][columns] / max(1, rows), "edit_distance": distance[rows][columns], "edits": edits, "interpretation": "Independent greedy decoding of the same emissions; disagreement flags a review, not a proven narration error."}


def read_pcm_tensor(path: Path, torch):
    if sys.byteorder != "little":
        raise RuntimeError("This bounded implementation requires a little-endian runner")
    with wave.open(str(path), "rb") as wav:
        sample_rate = wav.getframerate()
        pcm = bytearray(wav.readframes(wav.getnframes()))
    waveform = torch.frombuffer(pcm, dtype=torch.int16).to(dtype=torch.float32).div_(32768.0).unsqueeze(0)
    return waveform, sample_rate


def align_clip(clip: dict, model, bundle, torch, functional, low_score: float, include_greedy: bool) -> dict:
    started = time.monotonic()
    waveform, source_rate = read_pcm_tensor(clip["audio_path"], torch)
    model_rate = int(bundle.sample_rate)
    if source_rate != model_rate:
        waveform = functional.resample(waveform, source_rate, model_rate)
    labels = bundle.get_labels()
    dictionary = {label: index for index, label in enumerate(labels)}
    if labels[0] != "-" or "|" not in dictionary or "'" not in dictionary:
        raise RuntimeError("Unexpected official English CTC alphabet")
    target_text = "|".join(word["normalized"] for word in clip["words"])
    target_ids = [dictionary[character] for character in target_text]
    with torch.inference_mode():
        emissions, _ = model(waveform)
        log_probabilities = emissions.log_softmax(-1).contiguous()
        targets = torch.tensor([target_ids], dtype=torch.int32)
        path, log_scores = functional.forced_align(log_probabilities, targets, blank=0)
    if not bool(torch.isfinite(log_scores).all()):
        raise RuntimeError("Non-finite alignment scores")
    spans = functional.merge_tokens(path[0], log_scores[0].exp(), blank=0)
    if [span.token for span in spans] != target_ids:
        raise RuntimeError("Forced path does not reconstruct the exact canonical transcript")
    emission_frames = int(log_probabilities.shape[1])
    seconds_per_frame = waveform.shape[-1] / model_rate / emission_frames
    characters = []
    word_characters = [[] for _ in clip["words"]]
    word_index = 0
    for target_index, (character, span) in enumerate(zip(target_text, spans, strict=True)):
        record = {"target_index": target_index, "label": character, "start_frame": int(span.start), "end_frame": int(span.end), "start_seconds": round(span.start * seconds_per_frame, 6), "end_seconds": round(span.end * seconds_per_frame, 6), "confidence": round(float(span.score), 6)}
        characters.append(record)
        if character == "|":
            word_index += 1
        else:
            word_characters[word_index].append(record)
    if include_greedy:
        raw_ids = log_probabilities[0].argmax(-1).tolist()
        collapsed = [token for index, token in enumerate(raw_ids) if token != 0 and (index == 0 or raw_ids[index - 1] != token)]
        hypothesis = "".join(labels[token] for token in collapsed).replace("|", " ").split()
        audit = greedy_audit([word["normalized"] for word in clip["words"]], hypothesis)
    else:
        audit = {"enabled": False, "edits": []}
    disagreements = {edit["word_index"] for edit in audit["edits"] if edit["operation"] in ("substitution", "deletion")}
    words = []
    for source_word, parts in zip(clip["words"], word_characters, strict=True):
        if not parts:
            raise RuntimeError("Canonical word lacks aligned characters")
        frame_count = sum(part["end_frame"] - part["start_frame"] for part in parts)
        confidence = sum(part["confidence"] * (part["end_frame"] - part["start_frame"]) for part in parts) / frame_count
        start, end = parts[0]["start_seconds"], parts[-1]["end_seconds"]
        flags = []
        if source_word["normalized"] in PROPER_NAMES:
            flags.append("proper_name_review")
        if len(source_word["normalized"]) == 1 and source_word["normalized"] not in ("A", "I"):
            flags.append("spoken_letter_review")
        if confidence < low_score:
            flags.append("low_acoustic_score")
        if source_word["word_index"] in disagreements:
            flags.append("greedy_disagreement")
        if end - start > 2.5:
            flags.append("long_word_span_review")
        if end <= start:
            raise RuntimeError("Non-positive word interval")
        if words and start < words[-1]["end_seconds"]:
            raise RuntimeError("Overlapping canonical word intervals")
        words.append({**source_word, "start_seconds": start, "end_seconds": end, "start_frame": parts[0]["start_frame"], "end_frame": parts[-1]["end_frame"], "confidence": round(confidence, 6), "minimum_character_confidence": min(part["confidence"] for part in parts), "flags": flags})
    if sha256_file(clip["audio_path"]) != clip["audio_sha256"]:
        raise RuntimeError("Source WAV changed during analysis")
    return {
        "schema": SCHEMA,
        "id": clip["id"],
        "status": "aligned_requires_review" if any(word["flags"] for word in words) else "aligned",
        "text": clip["text"],
        "display_text": clip.get("display_text", clip["text"]),
        "text_sha256": clip["text_sha256"],
        "display_text_sha256": sha256_bytes(clip.get("display_text", clip["text"]).encode("utf-8")),
        "audio_sha256": clip["audio_sha256"],
        "source": {**clip["source"], "file": clip["file"], "relative_audio_path": f"{clip['batch']}/{clip['file']}"},
        "duration_seconds": clip["duration_seconds"],
        "source_sample_rate": source_rate,
        "analysis_sample_rate": model_rate,
        "emission_frames": emission_frames,
        "seconds_per_emission_frame": seconds_per_frame,
        "time_origin": "Original WAV t=0, including recorded leading silence. Add only the compositor's actual audio placement offset.",
        "timing_method": "CTC frame indexes scaled by resampled waveform duration / emission frame count; approximate acoustic boundaries, not sample-exact truth.",
        "confidence_definition": "Duration-weighted mean posterior across aligned nonblank character frames; uncalibrated acoustic score, not a correctness probability.",
        "low_score_threshold": low_score,
        "canonical_words": [word["normalized"] for word in words],
        "words": words,
        "character_spans": characters,
        "greedy_audit": audit,
        "analysis_wall_seconds": round(time.monotonic() - started, 3),
        "source_audio_unchanged_after_analysis": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--audio-root", type=Path, required=True)
    parser.add_argument("--word-map", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model-cache", type=Path, required=True)
    parser.add_argument("--expected-model-sha256")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--analysis-budget-seconds", type=int, default=600)
    parser.add_argument("--low-score", type=float, default=0.5)
    parser.add_argument("--no-greedy-audit", action="store_true")
    parser.add_argument("--validate-only", action="store_true", help="Verify local files and canonical mapping without importing or downloading a model")
    args = parser.parse_args()
    source, clips, word_map = check_inputs(args.input, args.audio_root, args.word_map)
    args.output.mkdir(parents=True, exist_ok=True)
    input_proof = {"input_sha256": sha256_file(args.input), "word_map_sha256": sha256_file(args.word_map) if args.word_map else None, "clip_count": len(clips), "total_audio_seconds": sum(clip["duration_seconds"] for clip in clips), "all_input_audio_and_text_hashes_verified": True, "canonical_mapping_verified": bool(word_map)}
    write_json(args.output / "input-validation.json", input_proof)
    if args.validate_only:
        print(json.dumps({"status": "input_validated_no_inference", **input_proof}), flush=True)
        return 0
    if not 1 <= args.analysis_budget_seconds <= 600 or not 0 < args.low_score < 1:
        raise ValueError("Budget/threshold outside this reviewed bounded pass")
    import torch
    import torchaudio
    if torch.__version__.split("+")[0] != "2.8.0" or torchaudio.__version__.split("+")[0] != "2.8.0":
        raise RuntimeError("Require pinned torch/torchaudio 2.8.0")
    if torch.version.cuda is not None:
        raise RuntimeError("Require CPU-only PyTorch distribution")
    cpus = len(os.sched_getaffinity(0)) if hasattr(os, "sched_getaffinity") else (os.cpu_count() or 1)
    threads = min(max(1, args.threads), cpus, 4)
    torch.set_num_threads(threads)
    torch.set_num_interop_threads(1)
    torch.manual_seed(0)
    bundle = getattr(torchaudio.pipelines, BUNDLE)
    args.model_cache.mkdir(parents=True, exist_ok=True)
    model_path = args.model_cache / MODEL_FILE
    if args.expected_model_sha256 and model_path.exists() and sha256_file(model_path) != args.expected_model_sha256:
        raise RuntimeError("Cached official model hash differs from the expected reviewed bytes")
    load_started = time.monotonic()
    model = bundle.get_model(dl_kwargs={"model_dir": str(args.model_cache), "progress": False, "weights_only": True}).cpu().eval()
    model_sha = sha256_file(model_path)
    if args.expected_model_sha256 and model_sha != args.expected_model_sha256:
        raise RuntimeError("Downloaded official model hash differs from the expected reviewed bytes")
    provenance = {"schema": "sf-narration-alignment-provenance-v1", "input": input_proof, "python": platform.python_version(), "torch": torch.__version__, "torchaudio": torchaudio.__version__, "device": "cpu", "threads": threads, "available_cpu_count": cpus, "bundle": BUNDLE, "model_url": MODEL_URL, "model_sha256": model_sha, "model_hash_check": "predeclared_sha256" if args.expected_model_sha256 else "official_bundle_origin_and_first_run_sha256_recorded", "model_load_seconds": round(time.monotonic() - load_started, 3), "analysis_budget_seconds": args.analysis_budget_seconds, "script_sha256": sha256_file(Path(__file__)), "normalization": "ASCII uppercase [A-Z]+(?:'[A-Z]+)*; curly apostrophes mapped one-for-one; punctuation/hyphens split words; no numeric expansion", "audio_writes": False, "run_id": os.environ.get("GITHUB_RUN_ID"), "execution_revision": os.environ.get("GITHUB_SHA")}
    write_json(args.output / "provenance.json", provenance)
    # Calibrate with the longest and a typical clip; retain their genuine outputs.
    ordered = sorted(clips, key=lambda clip: clip["duration_seconds"], reverse=True)
    calibration = [ordered[0]]
    if len(ordered) > 1:
        calibration.append(ordered[len(ordered) // 2])
    ids = {clip["id"] for clip in calibration}
    ordered = calibration + [clip for clip in clips if clip["id"] not in ids]
    completed, failures = {}, []
    started = time.monotonic()
    processed_audio = 0.0
    status, stop_reason = "running", None

    def summary() -> dict:
        return {"schema": "sf-narration-alignment-summary-v1", "status": status, "stop_reason": stop_reason, "input": input_proof, "model_sha256": model_sha, "analysis_elapsed_seconds": round(time.monotonic() - started, 3), "completed_clip_count": len(completed), "failed_clip_count": len(failures), "remaining_clip_ids": [clip["id"] for clip in clips if clip["id"] not in completed and not any(error["id"] == clip["id"] for error in failures)], "clips": [completed[clip["id"]] for clip in clips if clip["id"] in completed], "failures": failures, "missing_clip_ids_from_source": source.get("missing_clip_ids", [])}

    write_json(args.output / "alignment-summary.json", summary())
    for index, clip in enumerate(ordered):
        elapsed = time.monotonic() - started
        if elapsed >= args.analysis_budget_seconds:
            status, stop_reason = "partial_budget_stop", "Measured analysis wall time reached the reviewed budget"
            break
        if index == len(calibration):
            remaining_audio = sum(item["duration_seconds"] for item in ordered[index:])
            projected = elapsed + (elapsed / max(processed_audio, 0.01)) * remaining_audio * 1.2
            write_json(args.output / "calibration.json", {"calibration_clip_ids": [item["id"] for item in calibration], "elapsed_seconds": elapsed, "processed_audio_seconds": processed_audio, "remaining_audio_seconds": remaining_audio, "projected_total_with_20_percent_margin_seconds": projected, "budget_seconds": args.analysis_budget_seconds})
            if projected > args.analysis_budget_seconds:
                status, stop_reason = "partial_calibration_stop", "Measured initial throughput projects beyond the reviewed budget; no blind long run"
                break
        try:
            result = align_clip(clip, model, bundle, torch, torchaudio.functional, args.low_score, not args.no_greedy_audit)
            write_json(args.output / "clips" / f"{clip['id']}.json", result)
            completed[clip["id"]] = {"id": clip["id"], "file": f"clips/{clip['id']}.json", "result_sha256": sha256_file(args.output / "clips" / f"{clip['id']}.json"), "status": result["status"], "word_count": len(result["words"]), "flagged_word_count": sum(bool(word["flags"]) for word in result["words"]), "greedy_word_error_rate": result["greedy_audit"].get("word_error_rate"), "analysis_wall_seconds": result["analysis_wall_seconds"]}
            processed_audio += clip["duration_seconds"]
            print(json.dumps({"event": "clip_aligned", **completed[clip["id"]]}), flush=True)
        except Exception as error:
            failures.append({"id": clip["id"], "error_type": type(error).__name__, "message": str(error)[:400]})
            print(json.dumps({"event": "clip_failed", "id": clip["id"], "error_type": type(error).__name__}), flush=True)
        write_json(args.output / "alignment-summary.json", summary())
    if status == "running":
        status = "completed_with_failures" if failures else "completed_requires_editorial_review"
    write_json(args.output / "alignment-summary.json", summary())
    print(json.dumps({"status": status, "completed_clip_count": len(completed), "failed_clip_count": len(failures)}), flush=True)
    return 0 if len(completed) == len(clips) and not failures else 3


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "alignment_failed", "error_type": type(error).__name__, "message": str(error)[:400]}), file=sys.stderr)
        raise SystemExit(2)
