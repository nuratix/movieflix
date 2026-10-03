import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { MOVIEFLIX_SVG_XML } from '../widget/widgetData';
import { AppleSpringPressable } from './AppleSpringPressable';
import { triggerHaptic } from '../hapticService';

/**
 * MovieFlix In-App Widget (2x4)
 * 100% exact replica of the user-provided clean minimal HTML widget.
 * Features:
 * - 15/8 aspect ratio, max width 360px
 * - Pure black with red radial/ambient glow gradient
 * - 22px rounded corners
 * - Exact MovieFlix vector SVG logo (width 88, height 18)
 * - "Trending now" label (11px, weight 500, letterSpacing 0.2)
 * - 3 local app posters with 10px rounded corners and cover scaling
 * - Apple spring physics and tactile haptic feedback on interaction
 */
export function MovieFlixInAppWidget({
  posters = [],
  onPressPoster,
  onPressWidget,
  style,
}) {
  const displayPosters = posters.length >= 3 ? posters.slice(0, 3) : posters;

  return (
    <View style={[styles.outerWrapper, style]}>
      <AppleSpringPressable
        scaleTo={0.97}
        haptic="light"
        onPress={onPressWidget}
        style={styles.widgetCard}
      >
        {/* Ambient Red Glow Gradient */}
        <LinearGradient
          colors={['rgba(229, 9, 20, 0.16)', 'rgba(229, 9, 20, 0.05)', 'transparent']}
          locations={[0, 0.45, 0.75]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.85 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Header: Exact SVG Logo + "Trending now" text */}
        <View style={styles.head}>
          <SvgXml xml={MOVIEFLIX_SVG_XML} width={88} height={18} />
          <Text style={styles.headText}>Trending now</Text>
        </View>

        {/* 3 Posters Grid: 10px rounded, cover scaling */}
        <View style={styles.posters}>
          {displayPosters.map((item, index) => (
            <AppleSpringPressable
              key={item.id ? `widget-inapp-${item.id}` : `widget-inapp-${index}`}
              scaleTo={0.94}
              haptic="light"
              style={styles.p}
              onPress={() => {
                triggerHaptic('light');
                if (onPressPoster) onPressPoster(item);
              }}
            >
              <Image
                source={item.poster || { uri: item.fallback }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            </AppleSpringPressable>
          ))}
        </View>
      </AppleSpringPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetCard: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 15 / 8,
    backgroundColor: '#000000',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    position: 'relative',
  },
  head: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 20,
    flexShrink: 0,
    zIndex: 2,
  },
  headText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  posters: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
  },
  p: {
    flex: 1,
    minHeight: 0,
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1a1a',
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
});
