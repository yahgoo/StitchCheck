#!/usr/bin/env python3
"""
StitchCheck Hackathon Submission — Kokoro Voice Generation (7 segments)
Generates one WAV per segment using kokoro-onnx with voice af_heart.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent
VOICE_DIR = WORKSPACE / "output" / "demo-artifacts" / "stitchcheck-video" / "hackathon-submission" / "voice"
MODEL_PATH = Path.home() / ".cache" / "hyperframes" / "tts" / "models" / "kokoro-v1.0.onnx"
VOICES_PATH = Path.home() / ".cache" / "hyperframes" / "tts" / "voices" / "voices-v1.0.bin"

VOICE = "af_heart"
SPEED = 0.95
LANG = "en-us"
SAMPLE_RATE = 24000

SEGMENTS = [
    {"id": "seg-01-hook",     "text_file": "seg-01-hook.txt",     "wav_file": "seg-01-hook.wav"},
    {"id": "seg-02-input",    "text_file": "seg-02-input.txt",    "wav_file": "seg-02-input.wav"},
    {"id": "seg-03-human",    "text_file": "seg-03-human.txt",    "wav_file": "seg-03-human.wav"},
    {"id": "seg-04-risk",     "text_file": "seg-04-risk.txt",     "wav_file": "seg-04-risk.wav"},
    {"id": "seg-05-provider", "text_file": "seg-05-provider.txt", "wav_file": "seg-05-provider.wav"},
    {"id": "seg-06-decision", "text_file": "seg-06-decision.txt", "wav_file": "seg-06-decision.wav"},
    {"id": "seg-07-decision", "text_file": "seg-07-decision.txt", "wav_file": "seg-07-decision.wav"},
    {"id": "seg-08-close",    "text_file": "seg-08-close.txt",    "wav_file": "seg-08-close.wav"},
]


def check_prerequisites():
    errors = []
    if not MODEL_PATH.exists():
        errors.append(f"Kokoro model not found: {MODEL_PATH}")
    if not VOICES_PATH.exists():
        errors.append(f"Kokoro voices not found: {VOICES_PATH}")
    espeak_lib = os.environ.get("PHONEMIZER_ESPEAK_LIBRARY", "")
    if not espeak_lib or not Path(espeak_lib).exists():
        errors.append(f"eSpeak-ng library not found at: {espeak_lib or '(PHONEMIZER_ESPEAK_LIBRARY not set)'}")
    espeak_data = os.environ.get("ESPEAK_DATA_PATH", "")
    if not espeak_data or not Path(espeak_data).exists():
        errors.append(f"eSpeak-ng data not found at: {espeak_data or '(ESPEAK_DATA_PATH not set)'}")
    for seg in SEGMENTS:
        text_path = VOICE_DIR / seg["text_file"]
        if not text_path.exists():
            errors.append(f"Text file missing: {text_path}")
    if errors:
        print("PREREQUISITE CHECK FAILED:")
        for e in errors:
            print(f"  X {e}")
        sys.exit(1)
    print("All prerequisites verified.")


def main():
    print("=" * 60)
    print("StitchCheck Hackathon Submission — Kokoro Voice (8 segments)")
    print(f"Voice: {VOICE} | Speed: {SPEED} | Lang: {LANG}")
    print(f"Output: {VOICE_DIR}")
    print("=" * 60)

    check_prerequisites()

    from kokoro_onnx import Kokoro
    import soundfile as sf
    import numpy as np

    print(f"\nLoading model: {MODEL_PATH}")
    print(f"Loading voices: {VOICES_PATH}")
    kokoro = Kokoro(str(MODEL_PATH), str(VOICES_PATH))
    print("Kokoro initialized successfully.\n")

    VOICE_DIR.mkdir(parents=True, exist_ok=True)

    manifest_entries = []
    generation_ts = datetime.now(timezone.utc).isoformat()
    all_valid = True

    for seg in SEGMENTS:
        seg_id = seg["id"]
        text_path = VOICE_DIR / seg["text_file"]
        wav_path = VOICE_DIR / seg["wav_file"]

        text = text_path.read_text().strip()
        print(f"[{seg_id}] Generating from: {seg['text_file']}")
        print(f"  Text ({len(text.split())} words): {text[:80]}...")

        t0 = time.time()
        samples, sr = kokoro.create(text, voice=VOICE, speed=SPEED, lang=LANG)
        gen_time = time.time() - t0

        duration = len(samples) / SAMPLE_RATE
        peak = float(np.max(np.abs(samples)))
        rms = float(np.sqrt(np.mean(samples ** 2)))

        issues = []
        if duration < 0.5:
            issues.append(f"too short ({duration:.2f}s)")
        if peak < 0.01:
            issues.append("near-silent")
        if peak > 0.99:
            issues.append(f"potentially clipped (peak={peak:.4f})")
        if rms < 0.005:
            issues.append(f"abnormally quiet (rms={rms:.6f})")

        print(f"  Duration: {duration:.3f}s | Peak: {peak:.4f} | RMS: {rms:.6f} | Gen: {gen_time:.2f}s")

        if issues:
            print(f"  X ISSUES: {', '.join(issues)}")
            all_valid = False
        else:
            print(f"  OK Validation passed")

        sf.write(str(wav_path), samples, sr)
        file_size = wav_path.stat().st_size
        print(f"  Written: {wav_path.name} ({file_size} bytes)")

        manifest_entries.append({
            "segmentId": seg_id,
            "sourceTextPath": str(text_path.relative_to(WORKSPACE)),
            "wavPath": str(wav_path.relative_to(WORKSPACE)),
            "voice": VOICE,
            "locale": LANG,
            "speed": SPEED,
            "measuredDuration": round(duration, 3),
            "fileSize": file_size,
            "peakAmplitude": round(peak, 4),
            "rmsAmplitude": round(rms, 6),
            "validationStatus": "pass" if not issues else "fail",
            "validationIssues": issues,
            "generationTimestamp": generation_ts,
            "externalTtsCalls": False,
        })
        print()

    manifest = {
        "generationTimestamp": generation_ts,
        "voice": VOICE,
        "locale": LANG,
        "speed": SPEED,
        "modelPath": str(MODEL_PATH),
        "voicesPath": str(VOICES_PATH),
        "kokoroOnnxVersion": _get_kokoro_version(),
        "externalTtsCalls": False,
        "segments": manifest_entries,
        "overallStatus": "pass" if all_valid else "fail",
    }

    manifest_path = VOICE_DIR / "voice-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Manifest written: {manifest_path}")

    total_audio = sum(e["measuredDuration"] for e in manifest_entries)
    print(f"\nTotal audio duration: {total_audio:.3f}s across {len(SEGMENTS)} segments")

    if not all_valid:
        print("\nX Some segments had issues. Review voice-manifest.json.")
        sys.exit(1)
    else:
        print(f"\nOK All {len(SEGMENTS)} segments generated and validated successfully.")


def _get_kokoro_version() -> str:
    try:
        import importlib.metadata
        return importlib.metadata.version("kokoro-onnx")
    except Exception:
        return "unknown"


if __name__ == "__main__":
    main()
