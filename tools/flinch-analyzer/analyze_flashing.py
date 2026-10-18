#!/usr/bin/env python3
"""Offline global-luminance screening; not a medical risk classifier."""
import argparse, json, math, sys
from pathlib import Path
import cv2
import numpy as np

ALGORITHM_VERSION = "1.1.0"
LIMITATIONS = ["Global brightness can miss localized flashing regions.", "Camera motion, cuts, and exposure changes can create candidates.", "Sampling can miss events between sampled frames.", "Candidates are not medical assessments or accessibility-standard evaluations."]

def analyze_video(video_path, sample_fps=15.0, threshold=0.20, min_duration=0.2, repetition_min=3, flash_window=1.0):
    path = Path(video_path)
    if not path.is_file(): raise FileNotFoundError(f"Input video does not exist or is not a file: {path}")
    if not math.isfinite(sample_fps) or sample_fps <= 0: raise ValueError("sample_fps must be finite and greater than zero")
    if not math.isfinite(threshold) or not 0 < threshold <= 1: raise ValueError("threshold must be greater than zero and at most one")
    if not math.isfinite(min_duration) or min_duration < 0: raise ValueError("min_duration must be finite and nonnegative")
    if repetition_min < 2 or not math.isfinite(flash_window) or flash_window <= 0: raise ValueError("repetition_min must be >= 2 and flash_window positive")
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        cap.release()
        raise RuntimeError(f"Could not open video or codec is unsupported: {path}")
    try:
        fps, count = float(cap.get(cv2.CAP_PROP_FPS)), float(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if not math.isfinite(fps) or fps <= 0 or not math.isfinite(count) or count <= 0 or width <= 0 or height <= 0:
            raise RuntimeError("Video has invalid frame-rate, frame-count, or dimensions metadata")
        duration, interval, next_sample, index = count / fps, 1.0 / sample_fps, 0.0, 0
        samples = []
        while True:
            ok, frame = cap.read()
            if not ok: break
            t = index / fps
            if t + 1e-9 >= next_sample:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                samples.append((t, float(np.mean(gray, dtype=np.float64)) / 255.0))
                next_sample += interval
            index += 1
        if index == 0 or not samples: raise RuntimeError("Video decoder returned no readable frames")
    finally:
        cap.release()
    transitions = []
    for (_, b0), (t1, b1) in zip(samples, samples[1:]):
        delta = b1 - b0
        if abs(delta) >= threshold:
            transitions.append({"timeSeconds": round(t1, 3), "fromBrightness": round(b0, 4), "toBrightness": round(b1, 4), "difference": round(delta, 4), "direction": "brightening" if delta > 0 else "darkening"})
    cues, consumed, i = [], set(), 0
    while i < len(transitions):
        group, j = [i], i + 1
        while j < len(transitions) and transitions[j]["timeSeconds"] - transitions[group[-1]]["timeSeconds"] <= flash_window:
            group.append(j); j += 1
        dirs = [transitions[k]["direction"] for k in group]
        reversals = sum(a != b for a, b in zip(dirs, dirs[1:]))
        if len(group) >= repetition_min and reversals >= repetition_min - 1:
            selected, kind = group, "candidate_flashing_pattern"
        else: selected, kind = [], ""
        if selected:
            consumed.update(selected)
            ts = [transitions[k]["timeSeconds"] for k in selected]
            # Apply the configured minimum span to repeated patterns. Transitions
            # in a too-short repeated cluster are consumed, not re-emitted as
            # multiple isolated brightness-change candidates.
            if ts[-1] - ts[0] >= min_duration:
                start, end = max(0.0, ts[0] - interval), min(duration, ts[-1])
                cues.append({"startSeconds": round(start, 3), "endSeconds": round(max(start + .001, end), 3), "type": kind, "severity": "unclassified", "action": "review", "evidence": {"transitionTimesSeconds": ts, "brightnessDifferences": [transitions[k]["difference"] for k in selected], "sampleFps": sample_fps, "directionReversals": reversals}})
        i = max(i + 1, j)
    for idx, tr in enumerate(transitions):
        if idx in consumed: continue
        t = tr["timeSeconds"]; start = max(0.0, t - interval)
        cues.append({"startSeconds": round(start, 3), "endSeconds": round(min(duration, max(t, start + .001)), 3), "type": "candidate_brightness_change", "severity": "unclassified", "action": "review", "evidence": {"transitionTimesSeconds": [t], "brightnessDifferences": [tr["difference"]], "sampleFps": sample_fps}})
    cues.sort(key=lambda c: (c["startSeconds"], c["endSeconds"]))
    return {"schemaVersion": 1, "source": "automated_screening", "analysis": {"algorithmVersion": ALGORITHM_VERSION, "method": "sampled_global_luminance_transitions", "sampleFps": sample_fps, "threshold": threshold, "minDurationSeconds": min_duration, "repetitionMinTransitions": repetition_min, "flashWindowSeconds": flash_window, "sourceFps": round(fps, 3), "frameCount": int(count), "width": width, "height": height, "durationSeconds": round(duration, 3), "limitations": LIMITATIONS}, "cues": cues}

def main(argv=None):
    p = argparse.ArgumentParser(description="Screen video for candidate global brightness patterns")
    p.add_argument("video"); p.add_argument("--output", default="safety-cues.json"); p.add_argument("--sample-fps", type=float, default=15.0); p.add_argument("--threshold", type=float, default=.20); p.add_argument("--min-duration", type=float, default=.2); p.add_argument("--repetition-min", type=int, default=3); p.add_argument("--flash-window", type=float, default=1.0)
    a = p.parse_args(argv)
    try:
        result = analyze_video(a.video, a.sample_fps, a.threshold, a.min_duration, a.repetition_min, a.flash_window)
        Path(a.output).write_text(json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
        print(f"Analysis complete: {Path(a.output).resolve()} ({len(result['cues'])} candidate cues)"); return 0
    except (OSError, ValueError, RuntimeError) as e:
        print(f"Analysis failed: {e}", file=sys.stderr); return 2

if __name__ == "__main__": raise SystemExit(main())
