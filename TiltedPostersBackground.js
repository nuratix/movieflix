import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { LOCAL_POSTERS } from './assets/posters';

const CARD_WIDTH = 130;
const CARD_HEIGHT = 195;
const GAP = 14;

export default function TiltedPostersBackground() {
  const scrollAnim1 = useRef(new Animated.Value(0)).current;
  const scrollAnim2 = useRef(new Animated.Value(0)).current;
  const scrollAnim3 = useRef(new Animated.Value(0)).current;

  // Split 12 posters into 3 rows (and duplicate each row for seamless endless scroll)
  const row1 = [...LOCAL_POSTERS.slice(0, 4), ...LOCAL_POSTERS.slice(0, 4), ...LOCAL_POSTERS.slice(0, 4)];
  const row2 = [...LOCAL_POSTERS.slice(4, 8), ...LOCAL_POSTERS.slice(4, 8), ...LOCAL_POSTERS.slice(4, 8)];
  const row3 = [...LOCAL_POSTERS.slice(8, 12), ...LOCAL_POSTERS.slice(8, 12), ...LOCAL_POSTERS.slice(8, 12)];

  const loopDistance = (CARD_WIDTH + GAP) * 4;

  useEffect(() => {
    // Row 1 & 3: drift left
    const anim1 = Animated.loop(
      Animated.timing(scrollAnim1, {
        toValue: -loopDistance,
        duration: 35000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    // Row 2: drift right
    const anim2 = Animated.loop(
      Animated.timing(scrollAnim2, {
        toValue: loopDistance,
        duration: 40000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const anim3 = Animated.loop(
      Animated.timing(scrollAnim3, {
        toValue: -loopDistance,
        duration: 38000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]} pointerEvents="none">
      {/* Container tilted diagonally */}
      <View style={styles.tiltedContainer}>
        {/* Row 1 */}
        <Animated.View
          style={[
            styles.row,
            { transform: [{ translateX: scrollAnim1 }] },
          ]}
        >
          {row1.map((source, i) => (
            <View key={`r1-${i}`} style={styles.posterCard}>
              <ExpoImage source={source} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>

        {/* Row 2 */}
        <Animated.View
          style={[
            styles.row,
            { transform: [{ translateX: scrollAnim2 }] },
          ]}
        >
          {row2.map((source, i) => (
            <View key={`r2-${i}`} style={styles.posterCard}>
              <ExpoImage source={source} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>

        {/* Row 3 */}
        <Animated.View
          style={[
            styles.row,
            { transform: [{ translateX: scrollAnim3 }] },
          ]}
        >
          {row3.map((source, i) => (
            <View key={`r3-${i}`} style={styles.posterCard}>
              <ExpoImage source={source} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Dark Vignette Overlay */}
      <LinearGradient
        colors={[
          'rgba(10,10,10,0.65)',
          'rgba(10,10,10,0.85)',
          '#0a0a0a',
        ]}
        locations={[0, 0.45, 0.95]}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tiltedContainer: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ rotate: '-7deg' }, { scale: 1.25 }],
    justifyContent: 'center',
    opacity: 0.38,
  },
  row: {
    flexDirection: 'row',
    marginBottom: GAP,
  },
  posterCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: GAP,
    backgroundColor: '#1b1b1f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
});
