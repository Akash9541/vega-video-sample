# Flinch project overview

## Problem

People reviewing video may want to find sections with repeated brightness changes. Manually scanning long videos takes time. A screening aid can point to intervals for review, provided it communicates uncertainty and does not present a candidate as a safety determination.

## Solution

Flinch analyzes a video offline and emits a versioned JSON manifest of unclassified candidate intervals. The Vega app bundles that manifest and displays a cue when playback time falls within an interval. The app does not analyze frames during playback.

## Architecture and current capabilities

- The analyzer is included in [`tools/flinch-analyzer/`](../tools/flinch-analyzer/README.md). Python with pinned OpenCV and NumPy dependencies samples frames and measures global grayscale mean brightness.
- Large adjacent-sample changes become transitions. Repeated direction reversals grouped within the configured window can form a `candidate_flashing_pattern`; ungrouped changes remain `candidate_brightness_change` cues.
- The generated schema version 1 manifest is copied into [`src/flinch/safety-cues.json`](../src/flinch/safety-cues.json). [`src/flinch/safetyCues.ts`](../src/flinch/safetyCues.ts) validates the manifest and resolves cues at media positions. [`src/screens/PlayerScreen.tsx`](../src/screens/PlayerScreen.tsx) listens for time updates, seek, play, pause, and end events and renders the corresponding wording.
- [`src/flinch/synthetic-safety-cues.json`](../src/flinch/synthetic-safety-cues.json) remains a separate simulated demo fixture. The analyzer test clip is not packaged as app playback media.
- The client is the existing React Native and TypeScript Vega video sample app, using Vega's W3C media player integration. Jest tests cover the cue resolver; Python `unittest` covers analyzer behavior.

## Evaluation evidence

The analyzer 1.1.0 synthetic evaluation has seven labeled generated clips. Six expected outcomes matched; none of the expected candidate clips was missed. Three isolated brightness-change candidates on one ordinary-scene-cut clip were false positives. Repeated-pattern interval IoU was 0.9676 on the reference clip, 0.9835 on slow alternation, and 0.9227 on short alternation. In these cases, intervals began 0.067 seconds early and ended at the labeled end. By clip, binary any-candidate counts are TP 4, FP 1, FN 0, TN 2 (precision 0.80, recall 1.00); this does not assess cue-type correctness. Full details are recorded in [`tools/flinch-analyzer/evaluation-results.md`](../tools/flinch-analyzer/evaluation-results.md) and the adjacent JSON.

The five distinction cases had four expected cue-category matches; repeated scene cuts were classified as a repeated-pattern candidate. Their exact output is recorded in [`tools/flinch-analyzer/distinction-results.json`](../tools/flinch-analyzer/distinction-results.json).

These generated clips are preliminary deterministic checks, not a representative real-video corpus. Global brightness can miss localized changes and may respond to scene cuts, camera motion, or exposure changes. Sampling can miss events between sampled frames. No clinical assessment, clinical validation, real-world accuracy, or accessibility-standard certification has been established.

## Verification status

The latest recorded checks are 365 Jest tests passed and 4 skipped across 64 passing suites and 1 skipped suite, 11 analyzer tests passed, 6 focused cue tests passed, TypeScript type checking, and a Debug VPKG build and package inspection. The automated cue tests validate position-to-cue resolution using the active analyzer-generated manifest; they do not mount the player or inspect rendered pixels. The latest package was not installed or launched because the Vega virtual device was unavailable. Visual playback remains unverified.

## Next milestones

1. Install and launch the identified VPKG on a working Vega device and capture the cue before, during, and after its interval.
2. Evaluate on a labeled, representative set of ordinary video with expert-reviewed expected outcomes, especially scene cuts and localized brightness changes.
3. Measure detection misses, false-positive rates, and timing error before making claims about performance.
4. Review user-facing language and intended use with accessibility and photosensitivity experts before considering any safety or standards claims.
