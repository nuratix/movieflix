import React from 'react';
import {
  FlexWidget,
  TextWidget,
  SvgWidget,
  ImageWidget,
} from 'react-native-android-widget';
import { MOVIEFLIX_SVG_XML, OFFICIAL_WIDGET_POSTERS } from './widgetData';

/**
 * 2x4 MovieFlix Android Home Screen Widget
 * Replicates the clean minimal HTML widget layout with 100% fidelity.
 */
export function MovieFlixAndroidWidget({ posters = [] }) {
  const displayPosters = posters && posters.length >= 3 ? posters.slice(0, 3) : OFFICIAL_WIDGET_POSTERS;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#080808',
        backgroundGradient: {
          from: '#3a0408',
          to: '#050505',
          orientation: 'TL_BR',
        },
        borderRadius: 22,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 10,
        flexDirection: 'column',
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
          marginBottom: 8,
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
            color: '#B3B3B3',
            letterSpacing: 0.2,
          }}
        />
      </FlexWidget>

      {/* Posters Row: 3 columns taking full remaining vertical space */}
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          height: 'match_parent',
          flexDirection: 'row',
        }}
      >
        {displayPosters.map((item, index) => (
          <FlexWidget
            key={item.id ? `widget-poster-${item.id}` : `widget-poster-${index}`}
            style={{
              flex: 1,
              height: 'match_parent',
              borderRadius: 10,
              backgroundColor: '#161616',
              overflow: 'hidden',
              marginLeft: index === 0 ? 0 : 3,
              marginRight: index === displayPosters.length - 1 ? 0 : 3,
            }}
            clickAction="OPEN_APP"
          >
            <ImageWidget
              image={item.poster || item.fallback}
              style={{
                width: 'match_parent',
                height: 'match_parent',
              }}
              imageWidth={160}
              imageHeight={240}
              radius={10}
              resizeMode="cover"
            />
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
