# Flinch demo script (2–3 minutes)

This version presents the implementation and its automated evidence. It does not claim that a warning was visually demonstrated: the Vega device is currently unavailable and playback has not been observed.

## 0:00–0:25 — The problem

“Reviewing long videos for repeated brightness changes can be tedious. Flinch explores an offline screening aid that points a reviewer to candidate intervals. A candidate is a prompt to review, not a medical judgment.”

## 0:25–0:55 — Show the workflow

Show the analyzer command and the active `src/flinch/safety-cues.json` manifest. Explain that Python, OpenCV, and NumPy sample global grayscale brightness offline. The generated manifest is bundled into the React Native/TypeScript Vega app; the app uses media time to choose which cue is active. Mention that the synthetic demo cue is kept in a separate manifest.

## 0:55–1:30 — Show what the app is set up to do

Show the `PlayerScreen` event listeners and cue banner implementation, then the focused cue test output. The active analyzer cue begins at 1.933 seconds inclusive and ends at 4.0 seconds exclusive. The tests exercise the shared resolver before, at, within, and after those boundaries, as well as seek, pause/resume, end, and cue wording. State clearly that this is automated state verification; it is not a device playback or rendered-pixel demonstration.

If presenting on a working Vega device, replace this section with a recording or live playback from the exact package. Show playback time before 1.933 seconds, within the interval (for example 2.5 seconds), and at or after 4.0 seconds. Show the package hash and device identity. Do not imply this device demo has happened until the captures exist.

## 1:30–2:10 — Report the evaluation honestly

Show the seven-clip synthetic evaluation summary: six expected outcomes matched, no missed expected clips, and three false-positive isolated brightness-change cues on the ordinary-scene-cut clip. Repeated-pattern interval IoU was 0.9676 for the reference clip, 0.9835 for slow alternation, and 0.9227 for short alternation; detections started 0.067 seconds early and ended at the labeled end in these cases.

Explain that repeated-pattern candidates and isolated brightness transitions are separately typed and worded. Scene cuts can still produce isolated review cues because the method has no scene semantics.

## 2:10–2:30 — Close with limits and next step

“This is offline preprocessing and a prototype integration. Synthetic results do not establish real-world accuracy or clinical safety. The next demonstration step is to install the package on a working Vega device and capture the warning at the three playback positions. The next evaluation step is testing against a representative, labeled real-video set.”
