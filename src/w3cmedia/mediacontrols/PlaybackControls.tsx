import {
  ContentPersonalizationServer,
  PlaybackState,
} from '@amazon-devices/kepler-content-personalization';
import { VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { isContentPersonalizationEnabled } from '../../config/AppConfig';
import { getMockPlaybackEventForVideo } from '../../personalization/mock/ContentPersonalizationMocks';
import { areComponentPropsEqual } from '../../utils/lodashHelper';
import { shouldReportPlaybackEvent } from '../../flinch/safetyCues';
import { PLAYER_BUTTON_SIZE } from '../../utils/videoPlayerValues';
import PlayerButton from './PlayerButton';
import PlayPauseButton from './PlayPauseButton';

const DEFAULT_SEEK_TIME = 10;

export interface PlaybackControlsProps {
  videoRef: React.MutableRefObject<VideoPlayer | null>;
  mediaId?: string;
  onBlur?: () => void;
  playerControlType?: string;
}

export const seek = (
  seekSeconds: number,
  videoRef: React.MutableRefObject<VideoPlayer | null>,
) => {
  if (typeof videoRef.current?.currentTime === 'number') {
    const { currentTime, duration } = videoRef.current;
    let newTime = currentTime + seekSeconds;
    if (newTime > duration) {
      newTime = duration;
    } else if (newTime < 0) {
      newTime = 0;
    }
    videoRef.current.currentTime = newTime;
    if (videoRef.current.paused) {
      videoRef.current.play();
    }
  } else {
    return;
  }
};

const seekForward = (videoRef: React.MutableRefObject<VideoPlayer | null>) => {
  seek(DEFAULT_SEEK_TIME, videoRef);
};
const seekBackward = (videoRef: React.MutableRefObject<VideoPlayer | null>) => {
  seek(-DEFAULT_SEEK_TIME, videoRef);
};

export let throttling = false;
export const throttleSeek = (func: () => void, delay: number) => {
  if (!throttling) {
    throttling = true;
    func();
    setTimeout(() => {
      throttling = false;
    }, delay);
  }
};

const PlaybackControls = ({ videoRef, mediaId = '' }: PlaybackControlsProps) => {
  const playPauseRef = useRef<any>(null);
  const skipBackwardRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);
  const skipForwardRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);

  const onBlurPlayPause = () => {
    playPauseRef?.current?.blur();
  };
  const onBlurBackwardSeek = () => {
    skipBackwardRef?.current?.blur();
  };

  const onBlurForwardSeek = () => {
    skipForwardRef?.current?.blur();
  };
  useEffect(() => {
    playPauseRef?.current?.requestTVFocus();
  }, []);

  const handleSeekBackward = useCallback(() => {
    console.info('k_content_per: calling seekBackward');
    throttleSeek(() => {
      seekBackward(videoRef);
    }, 500);
    try {
      if (shouldReportPlaybackEvent(mediaId, isContentPersonalizationEnabled())) {
        const playbackEvent = getMockPlaybackEventForVideo(
          videoRef,
          videoRef.current!.currentSrc,
          PlaybackState.PLAYING,
        );
        ContentPersonalizationServer.reportNewPlaybackEvent(playbackEvent);
      }
    } catch {
      console.error('Unable to report playback event.');
    }
  }, [mediaId, videoRef]);

  const handleSeekForward = useCallback(() => {
    console.info('k_content_per: calling seekForward');
    throttleSeek(() => {
      seekForward(videoRef);
    }, 500);
    try {
      if (shouldReportPlaybackEvent(mediaId, isContentPersonalizationEnabled())) {
        const playbackEvent = getMockPlaybackEventForVideo(
          videoRef,
          videoRef.current!.currentSrc,
          PlaybackState.PLAYING,
        );
        ContentPersonalizationServer.reportNewPlaybackEvent(playbackEvent);
      }
    } catch {
      console.error('Unable to report playback event.');
    }
  }, [mediaId, videoRef]);
  return (
    <View style={styles.playbackControls}>
      <PlayerButton
        key={'player-btn-seek-backward'}
        ref={skipBackwardRef}
        onBlur={onBlurBackwardSeek}
        onPress={handleSeekBackward}
        icon={'replay-10'}
        testID="player-btn-seek-backward"
        size={PLAYER_BUTTON_SIZE}
      />

      <PlayPauseButton
        videoRef={videoRef}
        mediaId={mediaId}
        hasTVPreferredFocus
        onBlur={onBlurPlayPause}
        size={PLAYER_BUTTON_SIZE}
      />
      <PlayerButton
        key={'player-btn-seek-forward'}
        onPress={handleSeekForward}
        icon={'forward-10'}
        testID="player-btn-seek-forward"
        size={PLAYER_BUTTON_SIZE}
        ref={skipForwardRef}
        onBlur={onBlurForwardSeek}
      />
    </View>
  );
};

export const arePlaybackControlsPropsEqual = (
  prevProps: PlaybackControlsProps,
  nextProps: PlaybackControlsProps,
) => {
  return (
    areComponentPropsEqual(prevProps.videoRef, nextProps.videoRef) &&
    prevProps.mediaId === nextProps.mediaId
  );
};
export default React.memo(PlaybackControls, arePlaybackControlsPropsEqual);

const styles = StyleSheet.create({
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
