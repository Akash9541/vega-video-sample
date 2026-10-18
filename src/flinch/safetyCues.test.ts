import {
  getSafetyCuePresentation,
  getSafetyCueForMediaEvent,
  SAFETY_CUE_MANIFEST,
} from './safetyCues';

describe('analyzer manifest cue timing', () => {
  const cue = SAFETY_CUE_MANIFEST.cues[0];

  it('uses the expected analyzer-generated cue manifest', () => {
    expect(SAFETY_CUE_MANIFEST.source).toBe('automated_screening');
    expect(cue.type).toBe('candidate_flashing_pattern');
    expect(cue.startSeconds).toBe(1.933);
    expect(cue.endSeconds).toBe(4.0);
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
