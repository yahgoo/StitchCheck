#!/usr/bin/env python3
"""
StitchCheck — Kokoro Voice Generation Script
Generates one WAV per scene using kokoro-onnx with voice af_heart.

Usage:
    cd <workspace-root>
    PHONEMIZER_ESPEAK_LIBRARY="/opt/homebrew/lib/libespeak-ng.dylib" \
    ESPEAK_DATA_PATH="/opt/homebrew/share/espeak-ng-data" \
    .tts-venv/bin/python scripts/generate-stitchcheck-voice.py

Requirements:
    - .tts-venv with kokoro-onnx and soundfile installed
    - eSpeak-ng installed via Homebrew
    - Kokoro model and voice files in ~/.cache/hyperframes/tts/
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Resolve paths ──
WORKSPACE = Path(__file__).resolve().parent.parent
VOICE_DIR = WORKSPACE / "output" / "demo-artifacts" / "stitchcheck-video" / "voice"
MODEL_PATH = Path.home() / ".cache" / "hyperframes" / "tts" / "models" / "kokoro-v1.0.onnx"
VOICES_PATH = Path.home() / ".cache" / "hyperframes" / "tts" / "voices" / "voices-v1.0.bin"

# ── Configuration ──
VOICE = "af_heart"
SPEED = 0.95
LANG = "en-us"
SAMPLE_RATE = 24000  # Kokoro output sample rate

# ── Scene definitions ──
SCENES = [
    {"id": "scene-01", "text_file": "scene-01.txt", "wav_file": "scene-01.wav", "visual_start": 0},
    {"id": "scene-02", "text_file": "scene-02.txt", "wav_file": "scene-02.wav", "visual_start": 20},
    {"id": "scene-03", "text_file": "scene-03.txt", "wav_file": "scene-03.wav", "visual_start": 40},
    {"id": "scene-04", "text_file": "scene-04.txt", "wav_file": "scene-04.wav", "visual_start": 60},
    {"id": "scene-05", "text_file": "scene-05.txt", "wav_file": "scene-05.wav", "visual_start": 80},
    {"id": "scene-06", "text_file": "scene-06.txt", "wav_file": "scene-06.wav", "visual_start": 100},
]


def check_prerequisites():
    """Verify all prerequisites before generation."""
    errors = []

    if not MODEL_PATH.exists():
        errors.append(f"Kokoro model not found: {MODEL_PATH}")
    if not VOICES_PATH.exists():
        errors.append(f"Kokoro voices not found: {VOICES_PATH}")

    # Check eSpeak-ng
    espeak_lib = os.environ.get("PHONEMIZER_ESPEAK_LIBRARY", "")
    if not espeak_lib or not Path(espeak_lib).exists():
        errors.append(
            f"eSpeak-ng library not found at: {espeak_lib or '(PHONEMIZER_ESPEAK_LIBRARY not set)'}"
        )

    espeak_data = os.environ.get("ESPEAK_DATA_PATH", "")
    if not espeak_data or not Path(espeak_data).exists():
        errors.append(
            f"eSpeak-ng data not found at: {espeak_data or '(ESPEAK_DATA_PATH not set)'}"
        )

    # Check text files exist
    for scene in SCENES:
        text_path = VOICE_DIR / scene["text_file"]
        if not text_path.exists():
            errors.append(f"Text file missing: {text_path}")

    if errors:
        print("PREREQUISITE CHECK FAILED:")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)

    print("All prerequisites verified.")


def generate_wav(kokoro, text: str) -> tuple:
    """Generate audio samples from text using Kokoro."""
    samples, sr = kokoro.create(text, voice=VOICE, speed=SPEED, lang=LANG)
    return samples, sr


def validate_wav(samples, scene_id: str, max_duration: float):
    """Validate generated audio meets quality requirements."""
    import numpy as np

    duration = len(samples) / SAMPLE_RATE
    peak = float(np.max(np.abs(samples)))
    rms = float(np.sqrt(np.mean(samples ** 2)))

    issues = []

    if duration < 0.5:
        issues.append(f"too short ({duration:.2f}s < 0.5s)")
    if duration > max_duration:
        issues.append(f"too long ({duration:.2f}s > {max_duration:.2f}s)")
    if peak < 0.01:
        issues.append("near-silent (peak < 0.01)")
    if peak > 0.99:
        issues.append(f"potentially clipped (peak = {peak:.4f})")
    if rms < 0.005:
        issues.append(f"abnormally quiet (rms = {rms:.6f})")

    return {
        "duration": round(duration, 3),
        "peak_amplitude": round(peak, 4),
        "rms_amplitude": round(rms, 6),
        "samples": len(samples),
        "sample_rate": SAMPLE_RATE,
        "issues": issues,
        "valid": len(issues) == 0,
    }


def main():
    print("=" * 60)
    print("StitchCheck Kokoro Voice Generation")
    print(f"Voice: {VOICE} | Speed: {SPEED} | Lang: {LANG}")
    print(f"Output: {VOICE_DIR}")
    print("=" * 60)

    # Check prerequisites
    check_prerequisites()

    # Import after prerequisite check
    from kokoro_onnx import Kokoro
    import soundfile as sf

    # Initialize Kokoro
    print(f"\nLoading model: {MODEL_PATH}")
    print(f"Loading voices: {VOICES_PATH}")
    kokoro = Kokoro(str(MODEL_PATH), str(VOICES_PATH))
    print("Kokoro initialized successfully.\n")

    # Ensure output directory exists
    VOICE_DIR.mkdir(parents=True, exist_ok=True)

    manifest_entries = []
    generation_ts = datetime.now(timezone.utc).isoformat()
    all_valid = True

    for scene in SCENES:
        scene_id = scene["id"]
        text_path = VOICE_DIR / scene["text_file"]
        wav_path = VOICE_DIR / scene["wav_file"]

        # Read narration text
        text = text_path.read_text().strip()
        print(f"[{scene_id}] Generating from: {scene['text_file']}")
        print(f"  Text: {text[:80]}...")

        # Generate audio
        t0 = time.time()
        samples, sr = generate_wav(kokoro, text)
        gen_time = time.time() - t0

        # Validate
        max_dur = 20.0 - 1.5  # scene duration (20s) minus 1.5s safety margin
        validation = validate_wav(samples, scene_id, max_dur)

        print(f"  Duration: {validation['duration']}s | Peak: {validation['peak_amplitude']} | "
              f"RMS: {validation['rms_amplitude']} | Gen time: {gen_time:.2f}s")

        if not validation["valid"]:
            print(f"  ✗ VALIDATION FAILED: {', '.join(validation['issues'])}")
            all_valid = False
        else:
            print(f"  ✓ Validation passed")

        # Write WAV
        sf.write(str(wav_path), samples, sr)
        file_size = wav_path.stat().st_size
        print(f"  Written: {wav_path.name} ({file_size} bytes)")

        # Build manifest entry
        manifest_entries.append({
            "sceneId": scene_id,
            "sourceTextPath": str(text_path.relative_to(WORKSPACE)),
            "wavPath": str(wav_path.relative_to(WORKSPACE)),
            "voice": VOICE,
            "locale": LANG,
            "speed": SPEED,
            "measuredDuration": validation["duration"],
            "fileSize": file_size,
            "peakAmplitude": validation["peak_amplitude"],
            "rmsAmplitude": validation["rms_amplitude"],
            "validationStatus": "pass" if validation["valid"] else "fail",
            "validationIssues": validation["issues"],
            "generationTimestamp": generation_ts,
            "externalTtsCalls": False,
        })
        print()

    # Write manifest
    manifest = {
        "generationTimestamp": generation_ts,
        "voice": VOICE,
        "locale": LANG,
        "speed": SPEED,
        "modelPath": str(MODEL_PATH),
        "voicesPath": str(VOICES_PATH),
        "kokoroOnnxVersion": _get_kokoro_version(),
        "externalTtsCalls": False,
        "scenes": manifest_entries,
        "overallStatus": "pass" if all_valid else "fail",
    }

    manifest_path = VOICE_DIR / "voice-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Manifest written: {manifest_path}")

    if not all_valid:
        print("\n✗ Some scenes failed validation. Review voice-manifest.json.")
        sys.exit(1)
    else:
        print(f"\n✓ All {len(SCENES)} scenes generated and validated successfully.")


def _get_kokoro_version() -> str:
    try:
        import importlib.metadata
        return importlib.metadata.version("kokoro-onnx")
    except Exception:
        return "unknown"


if __name__ == "__main__":
    main()
