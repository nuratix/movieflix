import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { LOCAL_POSTERS } from './assets/posters';

const CARD_WIDTH = 115;
const CARD_HEIGHT = 170;
const GAP = 10;
const SEQ_LEN = 6;
const LOOP_DISTANCE = (CARD_WIDTH + GAP) * SEQ_LEN; // 750px

export default function TiltedPostersBackground() {
  const scrollLeftAnim1 = useRef(new Animated.Value(0)).current;
  const scrollRightAnim2 = useRef(new Animated.Value(-LOOP_DISTANCE)).current;
  const scrollLeftAnim3 = useRef(new Animated.Value(0)).current;
  const scrollRightAnim4 = useRef(new Animated.Value(-LOOP_DISTANCE)).current;
  const scrollLeftAnim5 = useRef(new Animated.Value(0)).current;
  const scrollRightAnim6 = useRef(new Animated.Value(-LOOP_DISTANCE)).current;

  // 6 diverse sequences of 6 posters each
  const s1 = [LOCAL_POSTERS[0], LOCAL_POSTERS[1], LOCAL_POSTERS[2], LOCAL_POSTERS[3], LOCAL_POSTERS[4], LOCAL_POSTERS[5]];
  const s2 = [LOCAL_POSTERS[6], LOCAL_POSTERS[7], LOCAL_POSTERS[8], LOCAL_POSTERS[9], LOCAL_POSTERS[10], LOCAL_POSTERS[11]];
  const s3 = [LOCAL_POSTERS[2], LOCAL_POSTERS[4], LOCAL_POSTERS[6], LOCAL_POSTERS[8], LOCAL_POSTERS[10], LOCAL_POSTERS[0]];
  const s4 = [LOCAL_POSTERS[1], LOCAL_POSTERS[3], LOCAL_POSTERS[5], LOCAL_POSTERS[7], LOCAL_POSTERS[9], LOCAL_POSTERS[11]];
  const s5 = [LOCAL_POSTERS[0], LOCAL_POSTERS[2], LOCAL_POSTERS[5], LOCAL_POSTERS[8], LOCAL_POSTERS[1], LOCAL_POSTERS[7]];
  const s6 = [LOCAL_POSTERS[11], LOCAL_POSTERS[9], LOCAL_POSTERS[7], LOCAL_POSTERS[5], LOCAL_POSTERS[3], LOCAL_POSTERS[1]];

  // Repeat each sequence 4 times (24 cards per row = 3000px wide, zero gaps)
  const row1 = [...s1, ...s1, ...s1, ...s1];
  const row2 = [...s2, ...s2, ...s2, ...s2];
  const row3 = [...s3, ...s3, ...s3, ...s3];
  const row4 = [...s4, ...s4, ...s4, ...s4];
  const row5 = [...s5, ...s5, ...s5, ...s5];
  const row6 = [...s6, ...s6, ...s6, ...s6];

  useEffect(() => {
    // Left drifting rows: 0 -> -LOOP_DISTANCE
    const startLeftAnim = (val, duration) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: -LOOP_DISTANCE,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    // Right drifting rows: -LOOP_DISTANCE -> 0 (never leaves left side blank!)
    const startRightAnim = (val, duration) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 0,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: -LOOP_DISTANCE,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = startLeftAnim(scrollLeftAnim1, 36000);
    const a2 = startRightAnim(scrollRightAnim2, 40000);
    const a3 = startLeftAnim(scrollLeftAnim3, 34000);
    const a4 = startRightAnim(scrollRightAnim4, 42000);
    const a5 = startLeftAnim(scrollLeftAnim5, 38000);
    const a6 = startRightAnim(scrollRightAnim6, 39000);

    a1.start();
    a2.start();
    a3.start();
    a4.start();
    a5.start();
    a6.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      a4.stop();
      a5.stop();
      a6.stop();
    };
  }, []);

  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]} pointerEvents="none">
      {/* Tilted full-screen grid extending far outside all bounds */}
      <View style={styles.tiltedContainer}>
        {/* Row 1 (Left) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollLeftAnim1 }] }]}>
          {row1.map((src, i) => (
            <View key={`r1-${i}`} style={styles.posterCard}>
              <ExpoImage source={src} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>

        {/* Row 2 (Right) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollRightAnim2 }] }]}>
          {row2.map((src, i) => (
            <View key={`r2-${i}`} style={styles.posterCard}>
              <ExpoImage source={src} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>

        {/* Row 3 (Left) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollLeftAnim3 }] }]}>
          {row3.map((src, i) => (
            <View key={`r3-${i}`} style={styles.posterCard}>
              <ExpoImage source={src} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>

        {/* Row 4 (Right) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollRightAnim4 }] }]}>
          {row4.map((src, i) => (
            <View key={`r4-${i}`} style={styles.posterCard}>
              <ExpoImage source={src} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>

        {/* Row 5 (Left) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollLeftAnim5 }] }]}>
          {row5.map((src, i) => (
            <View key={`r5-${i}`} style={styles.posterCard}>
              <ExpoImage source={src} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>

        {/* Row 6 (Right) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollRightAnim6 }] }]}>
          {row6.map((src, i) => (
            <View key={`r6-${i}`} style={styles.posterCard}>
              <ExpoImage source={src} style={styles.posterImage} contentFit="cover" />
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Dark Vignette Overlay so text and buttons on top pop clearly */}
      <LinearGradient
        colors={[
          'rgba(10,10,10,0.65)',
          'rgba(10,10,10,0.80)',
          'rgba(10,10,10,0.95)',
        ]}
        locations={[0, 0.5, 0.98]}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tiltedContainer: {
    position: 'absolute',
    top: '-30%',
    left: '-35%',
    width: '170%',
    height: '160%',
    transform: [{ rotate: '-7deg' }],
    justifyContent: 'center',
    opacity: 0.42,
  },
  row: {
    flexDirection: 'row',
    marginBottom: GAP,
  },
  posterCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
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
