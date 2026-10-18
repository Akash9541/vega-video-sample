#!/usr/bin/env python3
"""Generate a small labeled synthetic set and report analyzer outcomes."""
import argparse
import json
import tempfile
from pathlib import Path

import cv2
import numpy as np

from analyze_flashing import ALGORITHM_VERSION, analyze_video

ROOT = Path(__file__).resolve().parent
LABELS = ROOT / "evaluation-set.json"
FPS = 30
DURATION = 8
SIZE = (64, 64)


def write_clip(path, levels):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, SIZE)
    if not writer.isOpened():
        raise RuntimeError(f"OpenCV mp4v encoder unavailable: {path}")
    try:
        for value in levels:
            if np.isscalar(value):
                frame = np.full((SIZE[1], SIZE[0], 3), int(value), dtype=np.uint8)
            else:
                frame = np.asarray(value, dtype=np.uint8)
            writer.write(frame)
    finally:
        writer.release()


def make_clips(directory):
    n = FPS * DURATION
    write_clip(directory / "single-transition.mp4", [40] * (3 * FPS) + [220] * (5 * FPS))
    write_clip(directory / "gradual-ramp.mp4", np.linspace(40, 220, n).astype(int))
    write_clip(directory / "stable-gray.mp4", [80] * n)
    cuts = []
    yy, xx = np.indices((SIZE[1], SIZE[0]))
    texture = np.where((xx // 8 + yy // 8) % 2 == 0, -24, 24)
    for level in (60, 220, 80, 200):
        scene = np.clip(level + texture, 0, 255).astype(np.uint8)
        frame = np.stack([scene, scene, scene], axis=2)
        cuts.extend([frame] * (2 * FPS))
    write_clip(directory / "ordinary-scene-cuts.mp4", cuts)
    slow = [80] * (2 * FPS)
    for level in (240, 20) * 4:
        slow.extend([level] * (FPS // 2))
    slow.extend([80] * (2 * FPS))
    write_clip(directory / "slow-alternation.mp4", slow)
    short = [80] * (2 * FPS)
    for level in (240, 20, 240, 20):
        short.extend([level] * 6)
    short.extend([80] * (5 * FPS + 6))
    write_clip(directory / "short-alternation.mp4", short)


def interval_iou(a, b):
    intersection = max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
    union = max(a[1], b[1]) - min(a[0], b[0])
    return intersection / union if union > 0 else 1.0


def evaluate_clip(label, path):
    result = analyze_video(path)
    expected = label["expected"]
    cues = result["cues"]
    types = [cue["type"] for cue in cues]
    if expected == "no_candidate":
        matched = len(cues) == 0
        missed = False
        false_positive = len(cues) > 0
    else:
        matched = expected in types
        missed = not matched
        false_positive = any(kind != expected for kind in types)
    record = {
        "id": label["id"], "expected": expected, "actualCueTypes": types,
        "detectedExpected": matched, "falsePositive": false_positive,
        "missed": missed, "cues": cues,
    }
    gt = label.get("groundTruthInterval")
    if gt:
        matching = next((cue for cue in cues if cue["type"] == expected), None)
        if matching:
            pred = [matching["startSeconds"], matching["endSeconds"]]
            record["intervalMetrics"] = {
                "groundTruth": gt, "detected": pred,
                "intersectionOverUnion": round(interval_iou(gt, pred), 4),
                "startErrorSeconds": round(pred[0] - gt[0], 3),
                "endErrorSeconds": round(pred[1] - gt[1], 3),
            }
    transitions = label.get("expectedTransitionSeconds")
    if transitions:
        found = sorted(t for cue in cues for t in cue.get("evidence", {}).get("transitionTimesSeconds", []))
        record["transitionComparison"] = {
            "expectedSeconds": transitions, "detectedSeconds": found,
            "absoluteErrorsSeconds": [round(min((abs(t - x) for x in found), default=float("inf")), 3) for t in transitions],
        }
    record["falsePositiveKinds"] = [kind for kind in types if expected == "no_candidate" or kind != expected]
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=str(ROOT / "evaluation-results.json"))
    parser.add_argument("--labels", default=str(LABELS))
    parser.add_argument("--reference-video", default=str(ROOT / "test-flashes.mp4"))
    args = parser.parse_args()
    labels = json.loads(Path(args.labels).read_text(encoding="utf-8"))
    ref = Path(args.reference_video)
    if not ref.is_file():
        raise SystemExit(f"Missing existing generated reference clip: {ref}; run create_test_video.py first")
    with tempfile.TemporaryDirectory(prefix="flinch-eval-") as temp:
        directory = Path(temp)
        make_clips(directory)
        records = []
        for label in labels["clips"]:
            path = ref if label["id"] == "repeat_reference" else directory / label["file"]
            records.append(evaluate_clip(label, path))
    expected_positive = [row["expected"] != "no_candidate" for row in records]
    detected_positive = [bool(row["actualCueTypes"]) for row in records]
    true_positives = sum(expected and detected for expected, detected in zip(expected_positive, detected_positive))
    false_positives = sum(not expected and detected for expected, detected in zip(expected_positive, detected_positive))
    false_negatives = sum(expected and not detected for expected, detected in zip(expected_positive, detected_positive))
    true_negatives = sum(not expected and not detected for expected, detected in zip(expected_positive, detected_positive))
    output = Path(args.output)
    report = {
        "evaluationVersion": labels["evaluationVersion"],
        "algorithmVersion": ALGORITHM_VERSION,
        "note": "Synthetic screening evaluation only; not a real-world accuracy or safety validation.",
        "summary": {"clips": len(records), "expectedOutcomeMatches": sum(r["detectedExpected"] for r in records), "falsePositiveClips": sum(r["falsePositive"] for r in records), "falsePositiveCandidates": sum(len(r["falsePositiveKinds"]) for r in records), "missedExpectedClips": sum(r["missed"] for r in records), "binaryAnyCandidate": {"truePositives": true_positives, "falsePositives": false_positives, "falseNegatives": false_negatives, "trueNegatives": true_negatives, "precision": round(true_positives / (true_positives + false_positives), 4) if true_positives + false_positives else None, "recall": round(true_positives / (true_positives + false_negatives), 4) if true_positives + false_negatives else None}},
        "results": records,
    }
    output.write_text(json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    markdown = ["# Synthetic analyzer evaluation", "", report["note"], "", f"Algorithm: `{ALGORITHM_VERSION}`", "", "| Clip | Expected | Detected | Expected match | False positive | Missed | Interval IoU / timing |", "|---|---|---|---:|---:|---:|---|"]
    for row in records:
        metric = row.get("intervalMetrics", {})
        timing = f"IoU {metric['intersectionOverUnion']}; start {metric['startErrorSeconds']}s; end {metric['endErrorSeconds']}s" if metric else "—"
        markdown.append(f"| {row['id']} | {row['expected']} | {', '.join(row['actualCueTypes']) or 'none'} | {row['detectedExpected']} | {row['falsePositive']} | {row['missed']} | {timing} |")
    binary = report["summary"]["binaryAnyCandidate"]
    markdown.extend(["", f"Summary: {report['summary']['expectedOutcomeMatches']}/{report['summary']['clips']} expected outcomes matched; {report['summary']['falsePositiveCandidates']} false-positive cue(s) across {report['summary']['falsePositiveClips']} clip(s); {report['summary']['missedExpectedClips']} missed expected clip(s).", "", f"Binary any-candidate counts by clip: TP {binary['truePositives']}, FP {binary['falsePositives']}, FN {binary['falseNegatives']}, TN {binary['trueNegatives']}; precision {binary['precision']}, recall {binary['recall']}. This metric treats any cue as positive and does not measure cue-type correctness or real-world performance.", "", "Full cue evidence and transition comparisons are in the adjacent JSON report."])
    output.with_suffix(".md").write_text("\n".join(markdown) + "\n", encoding="utf-8")
    print(f"Evaluation complete: {output.resolve()}")
    print(json.dumps(report["summary"], sort_keys=True))

if __name__ == "__main__": main()
