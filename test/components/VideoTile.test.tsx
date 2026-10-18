// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { jest as jestGlobals } from '@jest/globals';
import '@testing-library/jest-native/extend-expect';
import * as ReactNative from 'react-native';

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import VideoTile from '../../src/components/VideoTile';
import { getFlinchTestVideos } from '../../src/data/local/trends';
import { TitleData } from '../../src/types/TitleData';
import { useNavigation } from '@amazon-devices/react-navigation__native';

jestGlobals.mock('../../src/components/navigation/AppStack', () => ({
  __esModule: true,

  Screen: { DETAILS_SCREEN: 'detail-screen' },
}));

jestGlobals.mock(
  '../../src/personalization/mock/ContentPersonalizationMocks',
  () => ({
    __esModule: true,

    getMockContentID: jest.fn(),
    getMockContentInteraction: jest.fn(),
  }),
);

jestGlobals.mock('@amazon-devices/react-navigation__native', () => ({
  __esModule: true,

  useNavigation: jest.fn(),
}));

jestGlobals.mock('@amazon-devices/kepler-content-personalization', () => ({
  __esModule: true,

  ContentPersonalizationServer: jest.fn(),
  ContentInteractionType: jest.fn(),
  ContentIdNamespaces: jest.fn(),
}));

const createVideoTitle = (
  id: string,
  title: string,
  description: string,
): TitleData => {
  return {
    id: id,
    title: title,
    description: description,
    duration: 86,
    thumbnail: 'https://example.com/thumbnail.jpg',
    posterUrl: '',
    uri: 'https://example.com/video.mp4',
    categories: ['Category 1', 'Category 2'],
    releaseDate: '2023-01-01',
    channelID: 'XXXXX',
    rating: '4.5',
    mediaType: 'video',
    mediaSourceType: 'url',
    format: 'MP4',
    secure: false,
    uhd: true,
    rentAmount: '',
  };
};

describe('VideoTile tests', () => {
  jestGlobals.useFakeTimers();
  const navigationPush = jest.fn();

  // @ts-ignore ts(2540): Animated.timing is read-only, but we
  // must overwrite it to make it work for our test.
  ReactNative.Animated.timing = (value: any, config: any) => {
    return {
      start: (callback: any) => {
        value.setValue(config.toValue);
        callback && callback();
      },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({ push: navigationPush });
    jest
      .spyOn(require('../../src/config/AppConfig'), 'isContentPersonalizationEnabled')
      .mockReturnValue(false);
  });

  it('should match the snapshot on first render', async () => {
    const title = createVideoTitle('1', 'Title 1', 'Description 1');
    const renderedTile = render(<VideoTile index={0} data={title} />);

    expect(renderedTile.toJSON()).toMatchSnapshot();
  });

  it('passes the Flinch test video unchanged to Details navigation', () => {
    const flinchVideo = getFlinchTestVideos()[0];
    const { getByTestId } = render(
      <VideoTile index={0} data={flinchVideo} row={0} />,
    );

    fireEvent.press(getByTestId('cardflinch-test-video'));

    expect(navigationPush).toHaveBeenCalledWith('Details', {
      data: flinchVideo,
      focusId: flinchVideo.id,
    });
    expect(navigationPush.mock.calls[0][1].data.uri).toBe(
      'http://127.0.0.1:8081/test-flashes-h264.mp4',
    );
  });
});
