import {
  getSafetyCuePresentation,
  getSafetyCueForMediaEvent,
  getSafetyCueManifestForMedia,
  isSafetyCueManifest,
  SAFETY_CUE_MANIFEST as importedSafetyCueManifest,
  SafetyCue,
  SafetyCueManifest,
  shouldReportPlaybackEvent,
} from './safetyCues';
import syntheticCueManifest from './synthetic-safety-cues.json';

const activeManifest = importedSafetyCueManifest;
if (!activeManifest) {
  throw new Error('Expected the checked-in analyzer manifest to validate');
}
const SAFETY_CUE_MANIFEST: SafetyCueManifest = activeManifest;

const cloneManifest = (): SafetyCueManifest =>
  JSON.parse(JSON.stringify(SAFETY_CUE_MANIFEST)) as SafetyCueManifest;

describe('analyzer manifest cue timing', () => {
  const cue = SAFETY_CUE_MANIFEST.cues[0];

  it('uses the expected analyzer-generated cue manifest', () => {
    expect(SAFETY_CUE_MANIFEST.source).toBe('automated_screening');
    expect(cue.type).toBe('candidate_flashing_pattern');
    expect(cue.startSeconds).toBe(1.933);
    expect(cue.endSeconds).toBe(4.0);
  });

  it('validates both actual manifests and fails closed on malformed data', () => {
    expect(isSafetyCueManifest(SAFETY_CUE_MANIFEST)).toBe(true);
    expect(isSafetyCueManifest(syntheticCueManifest)).toBe(true);
    expect(isSafetyCueManifest(null)).toBe(false);
    expect(isSafetyCueManifest([])).toBe(false);

    const invalidCueType = cloneManifest();
    (invalidCueType.cues[0] as any).type = 'trusted_safe';
    expect(isSafetyCueManifest(invalidCueType)).toBe(false);

    const nonFiniteTimestamp = cloneManifest();
    (nonFiniteTimestamp.cues[0] as any).startSeconds = Number.NaN;
    expect(isSafetyCueManifest(nonFiniteTimestamp)).toBe(false);

    const outOfBoundsInterval = cloneManifest();
    outOfBoundsInterval.cues[0].endSeconds =
      outOfBoundsInterval.analysis.durationSeconds + 1;
    expect(isSafetyCueManifest(outOfBoundsInterval)).toBe(false);

    const missingRequiredAction = cloneManifest();
    delete (missingRequiredAction.cues[0] as any).action;
    expect(isSafetyCueManifest(missingRequiredAction)).toBe(false);

    const invalidEvidence = cloneManifest();
    invalidEvidence.cues[0].evidence!.brightnessDifferences![0] = 3;
    expect(isSafetyCueManifest(invalidEvidence)).toBe(false);

    const unsupportedVersion = cloneManifest();
    (unsupportedVersion as any).schemaVersion = 2;
    expect(isSafetyCueManifest(unsupportedVersion)).toBe(false);
  });

  it('does not apply the bundled analysis to unrelated videos', () => {
    expect(getSafetyCueManifestForMedia('flinch-test-video')).toBe(
      SAFETY_CUE_MANIFEST,
    );
    expect(getSafetyCueManifestForMedia('another-video')).toBeNull();
  });

  it('keeps the Flinch fixture out of the optional playback-reporting path', () => {
    expect(shouldReportPlaybackEvent('flinch-test-video', true)).toBe(false);
    expect(shouldReportPlaybackEvent('another-video', false)).toBe(false);
    expect(shouldReportPlaybackEvent('another-video', true)).toBe(true);
  });

  it('uses playback position at the start, inside, and end boundaries', () => {
    const mediaEvent = 'timeupdate';
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.startSeconds - 0.001,
        mediaEvent,
      ),
    ).toBeNull();
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.startSeconds,
        mediaEvent,
      ),
    ).toBe(cue);
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.startSeconds + 0.5,
        mediaEvent,
      ),
    ).toBe(cue);
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.endSeconds,
        mediaEvent,
      ),
    ).toBeNull();
  });

  it('updates cue state for seeks into and out of the interval', () => {
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.startSeconds + 0.25,
        'seeking',
      ),
    ).toBe(cue);
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.startSeconds + 0.25,
        'seeked',
      ),
    ).toBe(cue);
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.endSeconds + 0.25,
        'seeking',
      ),
    ).toBeNull();
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.endSeconds + 0.25,
        'seeked',
      ),
    ).toBeNull();
  });

  it('keeps cue state aligned to position across pause and resume', () => {
    const inside = cue.startSeconds + 0.5;
    const outside = cue.endSeconds + 0.5;
    expect(
      getSafetyCueForMediaEvent(SAFETY_CUE_MANIFEST.cues, inside, 'pause'),
    ).toBe(cue);
    expect(
      getSafetyCueForMediaEvent(SAFETY_CUE_MANIFEST.cues, outside, 'play'),
    ).toBeNull();
    expect(
      getSafetyCueForMediaEvent(SAFETY_CUE_MANIFEST.cues, inside, 'play'),
    ).toBe(cue);
    expect(
      getSafetyCueForMediaEvent(SAFETY_CUE_MANIFEST.cues, outside, 'pause'),
    ).toBeNull();
  });

  it('clears cue state when playback ends, even if its last position is in range', () => {
    expect(
      getSafetyCueForMediaEvent(
        SAFETY_CUE_MANIFEST.cues,
        cue.startSeconds + 0.5,
        'ended',
      ),
    ).toBeNull();
  });

  it('chooses the repeated-pattern candidate deterministically when cues overlap', () => {
    const isolated: SafetyCue = {
      ...cue,
      type: 'candidate_brightness_change',
      startSeconds: 2,
      endSeconds: 3,
    };
    const repeated: SafetyCue = {
      ...cue,
      startSeconds: 2.5,
      endSeconds: 3.5,
    };
    expect(
      getSafetyCueForMediaEvent([isolated, repeated], 2.75, 'timeupdate'),
    ).toBe(repeated);
    expect(
      getSafetyCueForMediaEvent([repeated, isolated], 2.75, 'timeupdate'),
    ).toBe(repeated);
  });

  it('describes isolated transitions separately from repeated patterns', () => {
    const isolated = getSafetyCuePresentation(
      {
        ...cue,
        type: 'candidate_brightness_change',
      },
      'automated_screening',
    );
    expect(isolated.title).toBe('ISOLATED BRIGHTNESS CHANGE');
    expect(isolated.body).toContain('not a repeated-pattern finding');

    const repeated = getSafetyCuePresentation(
      { ...cue, type: 'candidate_flashing_pattern' },
      'automated_screening',
    );
    expect(repeated.body).toContain('repeated global-brightness pattern candidate');
    expect(repeated.body).toContain('Scene changes');
  });
});
