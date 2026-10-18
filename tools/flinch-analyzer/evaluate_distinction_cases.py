#!/usr/bin/env python3
"""Evaluate brightness-transition versus repeated-pattern synthetic cases."""
import argparse, json, sys, tempfile
from pathlib import Path
import cv2
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_flashing import analyze_video
FPS, SIZE = 30, (64, 64)
CASES = [
    ("single_large_transition", "candidate_brightness_change", "40 gray then 230 gray at 3s"),
    ("repeated_scene_cuts", "candidate_brightness_change", "textured scenes at means 60/220/60/220/60/220; first scene 2s then cuts every 0.5s"),
    ("genuine_high_amplitude_alternation", "candidate_flashing_pattern", "gray 240/20 alternation every 0.5s, 2s-6s"),
    ("genuine_low_amplitude_alternation", "candidate_flashing_pattern", "gray 140/84 alternation every 0.5s, 2s-6s"),
    ("scene_cut_adjacent_to_pattern", "candidate_flashing_pattern", "single transition at 1.5s immediately before 220/30 alternation from 2s-4s"),
]
def write(path, segments, texture=False):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, SIZE)
    if not writer.isOpened(): raise RuntimeError("OpenCV mp4v encoder unavailable")
    yy, xx = np.indices((64, 64)); pattern = np.where((xx // 8 + yy // 8) % 2 == 0, -24, 24)
    for value, duration in segments:
        image = np.clip(value + pattern, 0, 255).astype(np.uint8) if texture else np.full((64,64), value, np.uint8)
        frame = np.stack([image] * 3, axis=2)
        for _ in range(round(duration * FPS)): writer.write(frame)
    writer.release()
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=str(Path(__file__).with_name("distinction-results.json")))
    args = parser.parse_args()
    definitions = [
        [(40,3),(230,5)],
        [(60,2),(220,.5),(60,.5),(220,.5),(60,.5),(220,.5),(80,3)],
        [(80,2)]+[(v,.5) for v in [240,20]*4]+[(80,2)],
        [(80,2)]+[(v,.5) for v in [140,84]*4]+[(80,2)],
        [(80,1.5),(220,.5),(30,.5),(220,.5),(30,.5),(220,.5),(30,.5),(80,4)],
    ]
    results=[]
    with tempfile.TemporaryDirectory(prefix="flinch-distinction-") as directory:
        for (name, expected, description), segments in zip(CASES, definitions):
            path=Path(directory)/(name+".mp4"); write(path,segments,texture=name=="repeated_scene_cuts")
            result=analyze_video(path); cues=result["cues"]; actual=[c["type"] for c in cues]
            row={"id":name,"groundTruth":expected,"description":description,"detected":actual,"match":expected in actual,"cues":cues}
            if name=="scene_cut_adjacent_to_pattern" and cues and cues[0]["type"]=="candidate_flashing_pattern":
                pred=[cues[0]["startSeconds"],cues[0]["endSeconds"]]; gt=[2.,4.]
                inter=max(0,min(pred[1],gt[1])-max(pred[0],gt[0])); union=max(pred[1],gt[1])-min(pred[0],gt[0])
                row["groundTruthInterval"]=gt; row["detectedInterval"]=pred; row["iou"]=round(inter/union,4); row["startErrorSeconds"]=round(pred[0]-gt[0],3)
            results.append(row)
    report = {"algorithmVersion":"1.1.0","evaluation":"synthetic-only, not real-world validation","results":results}
    Path(args.output).write_text(json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Distinction evaluation complete: {Path(args.output).resolve()}")
    print(json.dumps({"cases":len(results),"typeMatches":sum(row["match"] for row in results),"typeMismatches":sum(not row["match"] for row in results)},sort_keys=True))
if __name__ == "__main__": main()
