import cueManifest from './safety-cues.json';

/** Versioned offline cue-manifest contract shared with analyze_flashing.py. */
export type SafetyCueType =
  | 'candidate_flashing_pattern'
  | 'candidate_brightness_change'
  | 'simulated_flash_risk';

export type SafetyCue = {
  startSeconds: number;
  endSeconds: number;
  type: SafetyCueType;
  severity: 'unclassified';
  action: 'review' | 'show_warning';
  evidence?: {
    transitionTimesSeconds?: number[];
    brightnessDifferences?: number[];
    sampleFps?: number;
    directionReversals?: number;
  };
};

export type SafetyCueManifest = {
  schemaVersion: 1;
  source: 'synthetic_demo' | 'automated_screening' | 'human_review';
  analysis: {
    algorithmVersion: string;
    method?: string;
    sampleFps: number;
    threshold: number;
    minDurationSeconds: number;
    durationSeconds: number;
    sourceFps?: number;
    frameCount?: number;
    width?: number;
    height?: number;
    repetitionMinTransitions?: number;
    flashWindowSeconds?: number;
    limitations: string[];
  };
  cues: SafetyCue[];
};

/** The bundled analyzer output was generated for this development fixture only. */
export const FLINCH_SCREENED_MEDIA_ID = 'flinch-test-video';

const MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;
const MAX_CUES = 5000;
const MAX_EVIDENCE_POINTS = 10000;
const MAX_LIMITATIONS = 100;
const MAX_TEXT_LENGTH = 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isBoundedNumber = (
  value: unknown,
  minimum: number,
  maximum: number,
): value is number =>
  isFiniteNumber(value) && value >= minimum && value <= maximum;

const isBoundedInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
): value is number =>
  Number.isSafeInteger(value) &&
  typeof value === 'number' &&
  value >= minimum &&
  value <= maximum;

const isShortText = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= MAX_TEXT_LENGTH;

const isSafetyCueType = (value: unknown): value is SafetyCueType =>
  value === 'candidate_flashing_pattern' ||
  value === 'candidate_brightness_change' ||
  value === 'simulated_flash_risk';

const isCueEvidence = (
  value: unknown,
  durationSeconds: number,
): value is NonNullable<SafetyCue['evidence']> => {
  if (!isRecord(value)) return false;

  const times = value.transitionTimesSeconds;
  const differences = value.brightnessDifferences;
  if (
    times !== undefined &&
    (!Array.isArray(times) ||
      times.length > MAX_EVIDENCE_POINTS ||
      !times.every(time => isBoundedNumber(time, 0, durationSeconds)))
  ) {
    return false;
  }
  if (
    differences !== undefined &&
    (!Array.isArray(differences) ||
      differences.length > MAX_EVIDENCE_POINTS ||
      !differences.every(difference =>
        isBoundedNumber(difference, -1.001, 1.001),
      ))
  ) {
    return false;
  }
  if (
    Array.isArray(times) &&
    Array.isArray(differences) &&
    times.length !== differences.length
  ) {
    return false;
  }
  if (
    value.sampleFps !== undefined &&
    !isBoundedNumber(value.sampleFps, 0.001, 1000)
  ) {
    return false;
  }
  if (
    value.directionReversals !== undefined &&
    !isBoundedInteger(value.directionReversals, 0, MAX_EVIDENCE_POINTS)
  ) {
    return false;
  }
  return true;
};

const isSafetyCue = (
  value: unknown,
  source: SafetyCueManifest['source'],
  durationSeconds: number,
): value is SafetyCue => {
  if (!isRecord(value)) return false;
  if (
    !isFiniteNumber(value.startSeconds) ||
    !isFiniteNumber(value.endSeconds) ||
    value.startSeconds < 0 ||
    value.endSeconds <= value.startSeconds ||
    value.endSeconds > durationSeconds ||
    !isSafetyCueType(value.type) ||
    value.severity !== 'unclassified' ||
    (value.action !== 'review' && value.action !== 'show_warning')
  ) {
    return false;
  }
  if (
    source === 'automated_screening' &&
    (value.type === 'simulated_flash_risk' || value.action !== 'review')
  ) {
    return false;
  }
  if (
    source === 'synthetic_demo' &&
    (value.type !== 'simulated_flash_risk' || value.action !== 'show_warning')
  ) {
    return false;
  }
  return (
    value.evidence === undefined ||
    isCueEvidence(value.evidence, durationSeconds)
  );
};

const isAnalysis = (value: unknown): value is SafetyCueManifest['analysis'] => {
  if (!isRecord(value)) return false;
  if (
    !isShortText(value.algorithmVersion) ||
    !isBoundedNumber(value.sampleFps, 0, 1000) ||
    !isBoundedNumber(value.threshold, 0, 1) ||
    !isBoundedNumber(value.minDurationSeconds, 0, MAX_DURATION_SECONDS) ||
    !isBoundedNumber(value.durationSeconds, 0.001, MAX_DURATION_SECONDS) ||
    !Array.isArray(value.limitations) ||
    value.limitations.length > MAX_LIMITATIONS ||
    !value.limitations.every(isShortText)
  ) {
    return false;
  }
  if (value.method !== undefined && !isShortText(value.method)) return false;
  if (
    value.sourceFps !== undefined &&
    !isBoundedNumber(value.sourceFps, 0, 1000)
  ) {
    return false;
  }
  if (
    value.frameCount !== undefined &&
    !isBoundedInteger(value.frameCount, 1, 1_000_000_000)
  ) {
    return false;
  }
  if (
    value.width !== undefined &&
    !isBoundedInteger(value.width, 1, 100_000)
  ) {
    return false;
  }
  if (
    value.height !== undefined &&
    !isBoundedInteger(value.height, 1, 100_000)
  ) {
    return false;
  }
  if (
    value.repetitionMinTransitions !== undefined &&
    !isBoundedInteger(value.repetitionMinTransitions, 2, MAX_EVIDENCE_POINTS)
  ) {
    return false;
  }
  return (
    value.flashWindowSeconds === undefined ||
    isBoundedNumber(value.flashWindowSeconds, 0.001, MAX_DURATION_SECONDS)
  );
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
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  const source = value.source;
  if (
    source !== 'synthetic_demo' &&
    source !== 'automated_screening' &&
    source !== 'human_review'
  ) {
    return false;
  }
  const analysis = value.analysis;
  if (!isAnalysis(analysis)) return false;
  const cues = value.cues;
  if (!Array.isArray(cues) || cues.length > MAX_CUES) return false;
  return cues.every(cue => isSafetyCue(cue, source, analysis.durationSeconds));
};

/** Invalid or unsupported manifests fail closed and remain explicitly unavailable. */
export const SAFETY_CUE_MANIFEST: SafetyCueManifest | null =
  isSafetyCueManifest(cueManifest) ? cueManifest : null;

export const getSafetyCueManifestForMedia = (
  mediaId: string,
): SafetyCueManifest | null =>
  mediaId === FLINCH_SCREENED_MEDIA_ID ? SAFETY_CUE_MANIFEST : null;

/** The sample's optional playback-reporting integration excludes the Flinch fixture. */
export const shouldReportPlaybackEvent = (
  mediaId: string,
  reportingEnabled: boolean,
): boolean => reportingEnabled && mediaId !== FLINCH_SCREENED_MEDIA_ID;

const cuePriority = (type: SafetyCueType): number => {
  switch (type) {
    case 'candidate_flashing_pattern':
      return 3;
    case 'candidate_brightness_change':
      return 2;
    case 'simulated_flash_risk':
      return 1;
  }
};

export const findSafetyCueAtTime = (
  cues: readonly SafetyCue[],
  playbackTime: number,
): SafetyCue | null => {
  if (!Number.isFinite(playbackTime) || playbackTime < 0) return null;
  return (
    cues
      .filter(
        cue =>
          playbackTime >= cue.startSeconds && playbackTime < cue.endSeconds,
      )
      .sort(
        (a, b) =>
          cuePriority(b.type) - cuePriority(a.type) ||
          a.startSeconds - b.startSeconds ||
          a.endSeconds - b.endSeconds,
      )[0] ?? null
  );
};

/** Resolve the cue for the same media events listened to by PlayerScreen. */
export const getSafetyCueForMediaEvent = (
  cues: readonly SafetyCue[],
  playbackTime: number,
  eventType?: string,
): SafetyCue | null => {
  if (eventType === 'ended') return null;
  return findSafetyCueAtTime(cues, playbackTime);
};
