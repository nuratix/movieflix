import React from 'react';
import {
  FlexWidget,
  TextWidget,
  SvgWidget,
  ImageWidget,
} from 'react-native-android-widget';
import { MOVIEFLIX_SVG_XML } from './widgetData';

/**
 * 2x4 MovieFlix Android Home Screen Widget
 * Replicates the clean minimal HTML widget layout with 100% fidelity.
 */
export function MovieFlixAndroidWidget({ posters = [] }) {
  const displayPosters = posters.length >= 3 ? posters.slice(0, 3) : posters;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#000000',
        borderRadius: 22,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_APP"
    >
      {/* Header Row: MovieFlix SVG Logo + "Trending now" */}
      <FlexWidget
        style={{
          height: 20,
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SvgWidget
          svg={MOVIEFLIX_SVG_XML}
          style={{
            width: 88,
            height: 18,
          }}
        />
        <TextWidget
          text="Trending now"
          style={{
            fontSize: 11,
            fontWeight: '500',
            color: '#FFFFFF',
            letterSpacing: 0.2,
          }}
        />
      </FlexWidget>

      {/* Posters Row: 3 columns matching grid-template-columns: repeat(3, minmax(0, 1fr)) */}
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        {displayPosters.map((item, index) => (
          <FlexWidget
            key={item.id ? `widget-poster-${item.id}` : `widget-poster-${index}`}
            style={{
              flex: 1,
              height: 'match_parent',
              borderRadius: 10,
              backgroundColor: '#1a1a1a',
              overflow: 'hidden',
              marginHorizontal: index === 1 ? 4 : 0,
            }}
            clickAction="OPEN_APP"
          >
            <ImageWidget
              image={item.poster || item.fallback}
              imageWidth={104}
              imageHeight={140}
              radius={10}
              resizeMode="cover"
            />
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
