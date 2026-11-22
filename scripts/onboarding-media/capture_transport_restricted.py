#!/usr/bin/env python3
"""Package short, traceable excerpts of one actual focused Chat recording.

Media processing only. Read one original continuous-video and an explicit proof
whitelist from its Playwright test-results directory. Preserve proof bytes and
the complete original artifact; never inspect traces, credentials or auth files.
"""

from __future__ import annotations

import argparse
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess


EXAMPLE = "C-chat-restricted-context"
EDGE_SECONDS = 120
PROOF_NAMES = (
    EXAMPLE + "-film-report.json",
    EXAMPLE + "-video-source.json",
    "local-model-setup-started.json",
    "local-model-ready.json",
    "local-model-chat-proof.json",
    "local-model-failure.json",
    "restricted-agent-configuration.json",
    "restricted-agent-confirmation.json",
    "actual-chat-answer-identity.json",
)
MAX_PROOF_BYTES = 16 * 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def confined_file(path: Path, root: Path) -> Path:
    """Do not follow an attachment path or a symlink outside test-results."""
    relative = path.relative_to(root)
    cursor = root
    for part in relative.parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise ValueError("Symlinks are not accepted in capture inputs")
    if not stat.S_ISREG(path.stat().st_mode) or path.resolve() != path:
        raise ValueError("Expected an original regular capture file")
    return path


def read_proof(path: Path, root: Path) -> tuple[bytes, dict]:
    confined_file(path, root)
    if path.stat().st_size > MAX_PROOF_BYTES:
        raise ValueError("Original proof exceeds the bounded JSON size")
    raw = path.read_bytes()
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Original proof must be a JSON object")
    return raw, value


def run_media(arguments: list[str], timeout: int) -> str:
    result = subprocess.run(arguments, stdin=subprocess.DEVNULL, capture_output=True,
                            text=True, timeout=timeout, check=False)
    if result.returncode:
        raise RuntimeError("Media command failed: " + result.stderr[-2000:].strip())
    return result.stdout


def probe(video: Path) -> dict:
    value = json.loads(run_media([
        "ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe",
        "-show_entries", "format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,nb_frames",
        "-of", "json", str(video),
    ], timeout=60))
    videos = [stream for stream in value.get("streams", []) if stream.get("codec_type") == "video"]
    if len(videos) != 1 or any(stream.get("codec_type") != "video" for stream in value.get("streams", [])):
        raise ValueError("Expected the single silent original browser video stream")
    stream = videos[0]
    duration = float(value["format"]["duration"])
    rate = Fraction(stream["r_frame_rate"])
    average = Fraction(stream["avg_frame_rate"])
    if not math.isfinite(duration) or duration <= 0 or rate <= 0 or rate != average:
        raise ValueError("Expected a finite constant-frame-rate browser recording")
    if stream["width"] != 1920 or stream["height"] != 1080 or rate != 25:
        raise ValueError("Focused recording differs from its original native 1920x1080/25fps contract")
    return {"durationSeconds": duration, "width": stream["width"], "height": stream["height"],
            "frameRate": str(rate), "codec": stream["codec_name"],
            "frameCount": int(stream["nb_frames"]) if str(stream.get("nb_frames", "")).isdigit() else None}


def select_capture(root: Path) -> tuple[Path, Path, dict[str, tuple[bytes, dict]]]:
    candidates = list(root.glob("*/transport-proof/" + EXAMPLE + "-film-report.json"))
    if len(candidates) != 1:
        raise ValueError("Expected exactly one focused Chat film report; refusing ambiguous captures")
    report_path = confined_file(candidates[0], root)
    test_root = report_path.parent.parent
    if not test_root.name.startswith("sucafina-onboarding-ai-"):
        raise ValueError("Unexpected Playwright test directory for focused Chat")
    proofs = {}
    for name in PROOF_NAMES:
        candidate = test_root / "transport-proof" / name
        if candidate.exists():
            proofs[name] = read_proof(candidate, root)
    required = {EXAMPLE + "-film-report.json", EXAMPLE + "-video-source.json"}
    if not required.issubset(proofs):
        raise ValueError("Original film and video-source proofs are required")
    film = proofs[EXAMPLE + "-film-report.json"][1]
    source = proofs[EXAMPLE + "-video-source.json"][1]
    if film.get("schema") != "sf-onboarding-film-v1" or film.get("installationExample") != EXAMPLE:
        raise ValueError("Unexpected original film identity")
    if film.get("videoAttachment") != EXAMPLE + "-continuous-video" or source.get("attachment") != film["videoAttachment"]:
        raise ValueError("Original video attachment identity does not match the film report")
    if not isinstance(film.get("beats"), list) or any(beat.get("id") not in {"04-chat-request", "06-chat-response"} for beat in film["beats"]):
        raise ValueError("Transport accepts only the actual focused Chat beats")
    videos = list((test_root / "continuous-video").glob("*.webm"))
    if len(videos) != 1:
        raise ValueError("Expected exactly one original continuous browser recording")
    video = confined_file(videos[0], root)
    reported = PurePosixPath(str(source.get("path", "")))
    # The reported CI absolute path is evidence only. Never open it. Bind its
    # original filename to the one physical continuous-video inside this test.
    if reported.parts[-2:] != ("continuous-video", video.name):
        raise ValueError("Video-source proof does not name the selected original recording")
    if video.stat().st_size == 0:
        raise ValueError("Original continuous recording is empty")
    return test_root, video, proofs


def encode_excerpt(source: Path, destination: Path, start_frame: int, frames: int, rate: Fraction) -> dict:
    start = Fraction(start_frame, 1) / rate
    run_media([
        "ffmpeg", "-v", "error", "-nostdin", "-n", "-protocol_whitelist", "file,pipe",
        "-ss", f"{float(start):.9f}", "-i", str(source), "-map", "0:v:0", "-an", "-sn", "-dn",
        # The original Playwright source is exactly 25fps. Retain every decoded
        # frame at that cadence; an explicit encoder clock gives the final MP4
        # frame its full 40ms duration instead of dropping it from the container.
        "-frames:v", str(frames), "-vf", f"setpts=N/({rate}*TB)", "-r", str(rate), "-fps_mode", "cfr",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-threads", "4",
        "-pix_fmt", "yuv420p", "-map_metadata", "-1", "-movflags", "+faststart", str(destination),
    ], timeout=360)
    actual = probe(destination)
    expected_duration = float(Fraction(frames, 1) / rate)
    if actual["frameCount"] != frames or abs(actual["durationSeconds"] - expected_duration) > float(1 / rate) / 4:
        raise ValueError("Excerpt frame count or normal-playback duration differs from the mapped source range")
    return actual


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test-results", type=Path, default=Path("packages/app-shell/e2e/test-results"))
    parser.add_argument("--output", type=Path, default=Path("test-ci-evidence/onboarding-chat-transport"))
    args = parser.parse_args()
    if args.test_results.is_symlink() or not args.test_results.is_dir():
        raise ValueError("Expected the real Playwright test-results directory")
    root = args.test_results.resolve(strict=True)
    destination = args.output.absolute()
    if destination.exists() or destination.is_symlink() or destination.resolve() != destination:
        raise ValueError("Transport output must be a new physical directory")
    if destination.is_relative_to(root):
        raise ValueError("Transport output must remain separate from original test-results")
    for executable in ("ffmpeg", "ffprobe"):
        if not shutil.which(executable):
            raise ValueError("Required media executable is unavailable: " + executable)
    test_root, video, proofs = select_capture(root)
    original = probe(video)
    rate = Fraction(original["frameRate"])
    source_frames_float = original["durationSeconds"] * float(rate)
    source_frames = round(source_frames_float)
    if abs(source_frames_float - source_frames) > 0.01:
        raise ValueError("Original duration is not aligned to its native frame grid")
    edge_frames = int(EDGE_SECONDS * rate)
    if source_frames <= 2 * edge_frames:
        ranges = [("continuous.mp4", 0, source_frames)]
    else:
        ranges = [("beginning.mp4", 0, edge_frames), ("ending.mp4", source_frames - edge_frames, source_frames)]
    original_sha = sha256_file(video)
    destination.mkdir(parents=True)
    proof_records = []
    for name, (raw, _) in proofs.items():
        target = destination / name
        with target.open("xb") as stream:
            stream.write(raw)
        proof_records.append({"file": name, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
                              "unchangedOriginalAttachmentBytes": True})
    excerpts = []
    for filename, first, end in ranges:
        target = destination / filename
        actual = encode_excerpt(video, target, first, end - first, rate)
        excerpts.append({"file": filename, "sha256": sha256_file(target), "bytes": target.stat().st_size,
                         "sourceStartFrameInclusive": first, "sourceEndFrameExclusive": end,
                         "sourceStartSeconds": float(Fraction(first, 1) / rate),
                         "sourceEndSecondsExclusive": float(Fraction(end, 1) / rate),
                         "excerptStartSeconds": 0, "excerptEndSecondsExclusive": actual["durationSeconds"],
                         "playbackSpeed": 1, "media": actual})
    film = proofs[EXAMPLE + "-film-report.json"][1]
    manifest = {
        "schema": "sf-onboarding-capture-transport-v1", "installationExample": EXAMPLE,
        "sourceRevision": film.get("sourceRevision"), "executionRevision": film.get("executionRevision"),
        "original": {"pathWithinTestResults": str(video.relative_to(root)), "sha256": original_sha,
                     "bytes": video.stat().st_size, "media": original, "completeOriginalRetained": True},
        "excerpts": excerpts, "proofs": proof_records,
        "selection": {"edgeSeconds": EDGE_SECONDS, "shortRecordingCopiedAsOneContinuousExcerpt": len(excerpts) == 1,
                      "rangesOverlap": False, "videoSource": "one original continuous browser recording",
                      "mediaProcessing": "H.264 transcode at native dimensions/frame rate and normal playback; no overlays or synthetic frames"},
        "clock": {"sourceVideoSeconds": "container timeline starting at zero",
                  "filmClock": film.get("clock"), "firstNavigationMs": film.get("firstNavigationMs"),
                  "alignment": "film markers retain their original independent clock; align first navigation to the actual first visible frame"},
        "qualification": "Transport does not qualify an AI answer; inspect unchanged model proof and the real rendered response.",
        "missingOptionalProofs": [name for name in PROOF_NAMES[2:] if name not in proofs],
    }
    (destination / "transport-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"schema": manifest["schema"], "originalSha256": original_sha,
                      "originalDurationSeconds": original["durationSeconds"], "excerptCount": len(excerpts),
                      "excerptSeconds": sum(item["media"]["durationSeconds"] for item in excerpts),
                      "unchangedProofFiles": len(proof_records)}))


if __name__ == "__main__":
    main()
