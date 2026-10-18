import cueManifest from './safety-cues.json';

/** Versioned offline cue-manifest contract shared with analyze_flashing.py. */
export type SafetyCue = {
  startSeconds: number;
  endSeconds: number;
  type: 'candidate_flashing_pattern' | 'candidate_brightness_change' | 'simulated_flash_risk';
  severity: 'unclassified';
  action: 'review' | 'show_warning';
  evidence?: {
    transitionTimesSeconds?: number[];
    brightnessDifferences?: number[];
    sampleFps?: number;
  };
};

export type SafetyCueManifest = {
  schemaVersion: 1;
  source: 'synthetic_demo' | 'automated_screening' | 'human_review';
  analysis: {
    algorithmVersion: string;
    sampleFps: number;
    threshold: number;
    minDurationSeconds: number;
    durationSeconds: number;
    limitations: string[];
  };
  cues: SafetyCue[];
};

export const getSafetyCuePresentation = (
  cue: SafetyCue,
  source: SafetyCueManifest['source'],
): { title: string; body: string } => {
  if (source === 'synthetic_demo' || cue.type === 'simulated_flash_risk') {
    return {
      title: 'SIMULATED DEMO CUE',
      body: 'This controlled test cue marks a simulated flashing pattern.',
    };
  }
  if (cue.type === 'candidate_brightness_change') {
    return {
      title: 'ISOLATED BRIGHTNESS CHANGE',
      body: 'A single global brightness transition was flagged for review. Scene cuts or exposure changes can cause this; it is not a repeated-pattern finding.',
    };
  }
  return {
    title: 'VIDEO SCREENING CANDIDATE',
    body: 'A repeated global-brightness pattern candidate was flagged for review. Scene changes and exposure shifts can produce similar measurements.',
  };
};

export const isSafetyCueManifest = (value: unknown): value is SafetyCueManifest => {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<SafetyCueManifest>;
  return (
    manifest.schemaVersion === 1 &&
    Array.isArray(manifest.cues) &&
    manifest.cues.every(
      cue =>
        Number.isFinite(cue?.startSeconds) &&
        Number.isFinite(cue?.endSeconds) &&
        cue.startSeconds >= 0 &&
        cue.endSeconds > cue.startSeconds &&
        typeof cue.type === 'string',
    )
  );
};

export const findSafetyCueAtTime = (
  cues: SafetyCue[],
  playbackTime: number,
): SafetyCue | null => {
  if (!Number.isFinite(playbackTime) || playbackTime < 0) return null;
  return (
    cues.find(
      cue => playbackTime >= cue.startSeconds && playbackTime < cue.endSeconds,
    ) ?? null
  );
};

/** Resolve the cue for the same media events listened to by PlayerScreen. */
export const getSafetyCueForMediaEvent = (
  cues: SafetyCue[],
  playbackTime: number,
  eventType?: string,
): SafetyCue | null => {
  if (eventType === 'ended') return null;
  return findSafetyCueAtTime(cues, playbackTime);
};

const EMPTY_MANIFEST: SafetyCueManifest = {
  schemaVersion: 1,
  source: 'synthetic_demo',
  analysis: {
    algorithmVersion: 'unknown',
    sampleFps: 0,
    threshold: 0,
    minDurationSeconds: 0,
    durationSeconds: 0,
    limitations: ['Cue manifest is invalid; no warnings will be displayed.'],
  },
  cues: [],
};

export const SAFETY_CUE_MANIFEST = isSafetyCueManifest(cueManifest)
  ? cueManifest
  : EMPTY_MANIFEST;
