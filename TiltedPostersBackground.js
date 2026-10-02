import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LOCAL_POSTERS, POSTER_FALLBACKS } from './assets/posters';

const CARD_WIDTH = 118;
const CARD_HEIGHT = 170;
const GAP = 12;
const CARD_STRIDE = CARD_WIDTH + GAP; // 130px
const SEQ_LEN = 6;
const LOOP_DISTANCE = CARD_STRIDE * SEQ_LEN; // 780px

const PosterCard = React.memo(function PosterCard({ src, fallbackUri }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const imageSource = loadFailed && fallbackUri ? { uri: fallbackUri } : src;

  return (
    <View style={styles.posterCard}>
      <Image
        source={imageSource}
        style={styles.posterImage}
        resizeMode="cover"
        onError={() => setLoadFailed(true)}
      />
    </View>
  );
});

export default function TiltedPostersBackground() {
  const scrollLeftAnim1 = useRef(new Animated.Value(0)).current;
  const scrollRightAnim2 = useRef(new Animated.Value(-LOOP_DISTANCE)).current;
  const scrollLeftAnim3 = useRef(new Animated.Value(0)).current;
  const scrollRightAnim4 = useRef(new Animated.Value(-LOOP_DISTANCE)).current;
  const scrollLeftAnim5 = useRef(new Animated.Value(0)).current;
  const scrollRightAnim6 = useRef(new Animated.Value(-LOOP_DISTANCE)).current;
  const scrollLeftAnim7 = useRef(new Animated.Value(0)).current;
  const scrollRightAnim8 = useRef(new Animated.Value(-LOOP_DISTANCE)).current;

  // 8 diverse sequences of 6 items each
  const createSeq = (indices) =>
    indices.map((idx) => ({
      src: LOCAL_POSTERS[idx % LOCAL_POSTERS.length],
      fallback: POSTER_FALLBACKS ? POSTER_FALLBACKS[idx % POSTER_FALLBACKS.length] : null,
    }));

  const s1 = createSeq([0, 1, 2, 3, 4, 5]);
  const s2 = createSeq([6, 7, 8, 9, 10, 11]);
  const s3 = createSeq([2, 4, 6, 8, 10, 0]);
  const s4 = createSeq([1, 3, 5, 7, 9, 11]);
  const s5 = createSeq([11, 8, 5, 2, 9, 6]);
  const s6 = createSeq([0, 3, 6, 9, 1, 4]);
  const s7 = createSeq([7, 10, 1, 4, 8, 11]);
  const s8 = createSeq([5, 2, 11, 8, 3, 0]);

  // Repeat each sequence 4 times (24 cards per row = 3120px wide, no blanks)
  const row1 = [...s1, ...s1, ...s1, ...s1];
  const row2 = [...s2, ...s2, ...s2, ...s2];
  const row3 = [...s3, ...s3, ...s3, ...s3];
  const row4 = [...s4, ...s4, ...s4, ...s4];
  const row5 = [...s5, ...s5, ...s5, ...s5];
  const row6 = [...s6, ...s6, ...s6, ...s6];
  const row7 = [...s7, ...s7, ...s7, ...s7];
  const row8 = [...s8, ...s8, ...s8, ...s8];

  useEffect(() => {
    // Left drifting loop: 0 -> -LOOP_DISTANCE
    const startLeftAnim = (val, duration) => {
      val.setValue(0);
      const anim = Animated.loop(
        Animated.timing(val, {
          toValue: -LOOP_DISTANCE,
          duration,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      anim.start();
      return anim;
    };

    // Right drifting loop: -LOOP_DISTANCE -> 0
    const startRightAnim = (val, duration) => {
      val.setValue(-LOOP_DISTANCE);
      const anim = Animated.loop(
        Animated.timing(val, {
          toValue: 0,
          duration,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      anim.start();
      return anim;
    };

    const a1 = startLeftAnim(scrollLeftAnim1, 35000);
    const a2 = startRightAnim(scrollRightAnim2, 41000);
    const a3 = startLeftAnim(scrollLeftAnim3, 33000);
    const a4 = startRightAnim(scrollRightAnim4, 43000);
    const a5 = startLeftAnim(scrollLeftAnim5, 36000);
    const a6 = startRightAnim(scrollRightAnim6, 39000);
    const a7 = startLeftAnim(scrollLeftAnim7, 34000);
    const a8 = startRightAnim(scrollRightAnim8, 42000);

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      a4.stop();
      a5.stop();
      a6.stop();
      a7.stop();
      a8.stop();
    };
  }, []);

  return (
    <View style={styles.outerContainer} pointerEvents="none">
      {/* Tilted full-screen grid centered and scaled to cover all viewports */}
      <View style={styles.tiltedContainer}>
        {/* Row 1 (Left) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollLeftAnim1 }] }]}>
          {row1.map((item, i) => (
            <PosterCard key={`r1-${i}`} src={item.src} fallbackUri={item.fallback} />
          ))}
        </Animated.View>

        {/* Row 2 (Right) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollRightAnim2 }] }]}>
          {row2.map((item, i) => (
            <PosterCard key={`r2-${i}`} src={item.src} fallbackUri={item.fallback} />
          ))}
        </Animated.View>

        {/* Row 3 (Left) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollLeftAnim3 }] }]}>
          {row3.map((item, i) => (
            <PosterCard key={`r3-${i}`} src={item.src} fallbackUri={item.fallback} />
          ))}
        </Animated.View>

        {/* Row 4 (Right) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollRightAnim4 }] }]}>
          {row4.map((item, i) => (
            <PosterCard key={`r4-${i}`} src={item.src} fallbackUri={item.fallback} />
          ))}
        </Animated.View>

        {/* Row 5 (Left) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollLeftAnim5 }] }]}>
          {row5.map((item, i) => (
            <PosterCard key={`r5-${i}`} src={item.src} fallbackUri={item.fallback} />
          ))}
        </Animated.View>

        {/* Row 6 (Right) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollRightAnim6 }] }]}>
          {row6.map((item, i) => (
            <PosterCard key={`r6-${i}`} src={item.src} fallbackUri={item.fallback} />
          ))}
        </Animated.View>

        {/* Row 7 (Left) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollLeftAnim7 }] }]}>
          {row7.map((item, i) => (
            <PosterCard key={`r7-${i}`} src={item.src} fallbackUri={item.fallback} />
          ))}
        </Animated.View>

        {/* Row 8 (Right) */}
        <Animated.View style={[styles.row, { transform: [{ translateX: scrollRightAnim8 }] }]}>
          {row8.map((item, i) => (
            <PosterCard key={`r8-${i}`} src={item.src} fallbackUri={item.fallback} />
          ))}
        </Animated.View>
      </View>

      {/* Gentle Vignette: keeps posters bright, rich & visible across whole screen while ensuring text readability */}
      <LinearGradient
        colors={[
          'rgba(10,10,10,0.22)',
          'rgba(10,10,10,0.48)',
          'rgba(10,10,10,0.88)',
        ]}
        locations={[0, 0.48, 0.96]}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    zIndex: 0,
    elevation: 0,
  },
  tiltedContainer: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ rotate: '-8deg' }, { scale: 1.3 }],
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.88,
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
    borderColor: 'rgba(255,255,255,0.12)',
  },
  posterImage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
  },
});
