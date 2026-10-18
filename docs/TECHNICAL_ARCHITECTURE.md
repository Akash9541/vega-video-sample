# Flinch technical architecture

## Data flow

```text
Input video
   │
   ▼
Offline Python analyzer (OpenCV + NumPy)
   │ sample frames at configured rate
   │ grayscale each frame; compute frame-wide mean
   ▼
Significant adjacent-sample transitions
   │ group by time window and direction reversals
   ├── repeated group ──► candidate_flashing_pattern
   └── ungrouped change ► candidate_brightness_change
   │
   ▼
Version 1 JSON manifest (source: automated_screening)
   │ reviewed and copied to src/flinch/safety-cues.json
   ▼
React Native / TypeScript bundle in Vega Debug VPKG
   │ import and validate manifest in safetyCues.ts
   ▼
PlayerScreen media events + currentTime
   │ timeupdate, seeking, seeked, play, pause, ended
   ▼
Shared resolver selects cue for [startSeconds, endSeconds)
   │
   ▼
Candidate-specific on-screen review wording
```

## Analyzer

The analyzer is in `tools/flinch-analyzer/analyze_flashing.py`. Its current algorithm version is 1.1.0. It samples frame-wide grayscale means, records changes whose absolute normalized difference meets the threshold, then groups neighboring transitions within `flash_window`. A group meeting the transition count and direction-reversal requirement can produce a `candidate_flashing_pattern`; transitions outside such a group produce `candidate_brightness_change` cues. Both use `severity: unclassified` and `action: review`.

The version 1 manifest includes analysis parameters, source video dimensions and duration, limitations, cue intervals, and transition evidence. Candidate intervals are generated offline; timestamps are rounded to milliseconds. Sampling and interval construction introduce timing imprecision. This method does not understand scene content, spatial extent, clinical risk, or accessibility standards.

## App integration

`src/flinch/safety-cues.json` is the active analyzer-generated input imported by `src/flinch/safetyCues.ts`. The TypeScript contract validates version 1 cue intervals and treats malformed data as unavailable. `getSafetyCueForMediaEvent` resolves the current media time and clears cue state on `ended`. `PlayerScreen` listens for media events and displays presentation text selected by cue type. The active cue interval is 1.933 seconds inclusive through 4.0 seconds exclusive.

`src/flinch/synthetic-safety-cues.json` has source `synthetic_demo` and type `simulated_flash_risk`; it remains separate from the active app manifest. The generated `test-flashes.mp4` is used by the analyzer workflow and is not included as app playback media. Since the manifest is time-based, an in-app video needs to be available and long enough to demonstrate the interval.

## Build and checks

The client is the existing Vega React Native application written in TypeScript. Its package ID is `com.amazondeveloper.keplervideoapp`, version `3.24.0`, and the player component ID is `com.amazondeveloper.keplervideoapp.main` (from `manifest.toml` and `package.json`). The VPKG packages the JavaScript bundle and imported manifest. The aarch64 Debug package path is:

```text
build/private/kepler/@amazon-devices/keplervideoapp/0.1/vega/aarch64/Debug/@amazon-devices/keplervideoapp_aarch64.vpkg
```

Python `unittest` checks analyzer behavior. `src/flinch/safetyCues.test.ts` uses Jest to check the shared resolver against the imported active manifest. TypeScript type checking checks app source. Build/package inspection confirms the manifest is bundled, but none of these checks confirms visible rendering. In the latest attempt the virtual device reported ready and then `running:false`, with no device listed; install, launch, and visual playback remain unverified.

## Known limits and next work

- The ordinary-scene-cut synthetic clip produced three isolated brightness-change candidates despite its no-candidate label.
- The seven-clip evaluation is synthetic only and cannot establish real-world accuracy.
- Global averages miss localized events; sparse sampling can miss transitions; cuts, camera motion, and exposure shifts can generate candidates.
- The analyzer test clip is not available in the app as playback media.
- Next: capture actual playback on a supported Vega device, then evaluate on a representative real-video set with labeled intervals and report misses, false positives, and timing errors.
