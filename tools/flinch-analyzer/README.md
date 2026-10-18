# Flinch analyzer

From the repository root, create an isolated environment using Python 3.14 and install the pinned dependencies:

```sh
python3.14 -m venv .venv-flinch
. .venv-flinch/bin/activate
python -m pip install -r tools/flinch-analyzer/requirements.txt
```

The analyzer uses OpenCV and NumPy; its unit tests use Python standard-library `unittest`:

```sh
python tools/flinch-analyzer/create_test_video.py
python -m unittest discover -s tools/flinch-analyzer/tests -v
```

Generate the controlled clip with `python create_test_video.py`; analyze it with `python analyze_flashing.py test-flashes.mp4 --output safety-cues.json`. Options: `--sample-fps`, `--threshold`, `--min-duration`, `--repetition-min`, and `--flash-window`. `sample-fps` sets target temporal sampling; `threshold` is the minimum absolute normalized grayscale-mean change between adjacent samples; `repetition-min` sets the minimum number of significant transitions; `flash-window` is the maximum gap allowed between neighboring transitions in a group; and `min-duration` filters repeated groups whose first-to-last detected transition span is shorter than that duration. Isolated significant changes remain `candidate_brightness_change` cues. Output is deterministic schemaVersion 1 JSON marked `automated_screening`, with unclassified candidates, transition timestamps, signed brightness differences, and settings. The algorithm samples the frame-wide mean of grayscale-converted pixels. It does not measure localized regions, spatial area, contrast geometry, color patterns, or validate a hazard threshold. Candidate intervals begin one sampling period before the first transition and end at the last transition.

This is offline preprocessing on the developer host. Review the manifest before packaging it at `src/flinch/safety-cues.json` in the Vega app. Do not leave the synthetic-demo source marker on analyzer results. The app must bundle the manifest; no host filesystem, Python runtime, or network analysis service is assumed on Vega.

The method samples frame-wide grayscale luminance and detects large changes, grouping repeated direction reversals within a configurable time window. It can miss local flashing, miss changes between samples, and flag camera motion, cuts, or exposure changes. It is not a medical assessment or an evaluated accessibility-standard implementation.

## Synthetic evaluation

Run `python evaluate_flashing.py` after generating the existing reference clip with `python create_test_video.py`. The runner generates temporary synthetic ramp, stable, cut, single-transition, slow-alternation, and short-alternation clips, compares outputs with `evaluation-set.json`, and writes `evaluation-results.json` and `evaluation-results.md`. The clips are generated in a temporary directory and are not retained. The checked-in result files record the current run.

The evaluation is a small, deterministic synthetic check, not a representative corpus. Brightness-changing scene cuts are expected to produce isolated candidates because the algorithm has no scene semantics; those are false-positive warnings in the cut case. Synthetic results do not establish real-world accuracy, clinical safety, or standards conformance.

Latest synthetic run (`evaluation-results.md`): 6/7 expected outcomes matched, with 3 false-positive isolated brightness-change cues on the ordinary-cut clip and no missed expected detections. Expected-event interval IoU was 0.9676 for the reference clip, 0.9835 for slower alternation, and 0.9227 for the short burst; all began one sample (0.067 s) early and ended on the last detected transition. These figures describe only these generated clips. The cut result demonstrates that the analyzer lacks scene semantics and should not be treated as an accuracy estimate.
