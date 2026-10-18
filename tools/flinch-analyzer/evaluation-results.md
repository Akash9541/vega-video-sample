# Synthetic analyzer evaluation

Synthetic screening evaluation only; not a real-world accuracy or safety validation.

Algorithm: `1.1.0`

| Clip | Expected | Detected | Expected match | False positive | Missed | Interval IoU / timing |
|---|---|---|---:|---:|---:|---|
| repeat_reference | candidate_flashing_pattern | candidate_flashing_pattern | True | False | False | IoU 0.9676; start -0.067s; end 0.0s |
| single_transition | candidate_brightness_change | candidate_brightness_change | True | False | False | — |
| gradual_ramp | no_candidate | none | True | False | False | — |
| stable_gray | no_candidate | none | True | False | False | — |
| ordinary_scene_cuts | no_candidate | candidate_brightness_change, candidate_brightness_change, candidate_brightness_change | False | True | False | — |
| slow_alternation | candidate_flashing_pattern | candidate_flashing_pattern | True | False | False | IoU 0.9835; start -0.067s; end 0.0s |
| short_alternation | candidate_flashing_pattern | candidate_flashing_pattern | True | False | False | IoU 0.9227; start -0.067s; end 0.0s |

Summary: 6/7 expected outcomes matched; 3 false-positive cue(s) across 1 clip(s); 0 missed expected clip(s).

Binary any-candidate counts by clip: TP 4, FP 1, FN 0, TN 2; precision 0.8, recall 1.0. This metric treats any cue as positive and does not measure cue-type correctness or real-world performance.

Full cue evidence and transition comparisons are in the adjacent JSON report.
