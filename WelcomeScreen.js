import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TiltedPostersBackground from './TiltedPostersBackground';

const BRAND_LOGO = require('./assets/movieflix_brand_logo.png');

export default function WelcomeScreen({ onGetStarted }) {
  const insets = useSafeAreaInsets();
  const { height } = Dimensions.get('window');
  const isCompact = height < 720;

  const topPadding = (insets && insets.top ? insets.top : 24) + (isCompact ? 10 : 18);
  const bottomPadding = (insets && insets.bottom ? insets.bottom : 20) + (isCompact ? 12 : 20);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent />

      {/* 1. Moving tilted poster wall in background */}
      <TiltedPostersBackground />

      {/* 2. Rich dark gradient overlay so logo, text, and buttons stand out vividly */}
      <LinearGradient
        colors={[
          'rgba(10,10,10,0.72)',
          'rgba(10,10,10,0.48)',
          'rgba(10,10,10,0.92)',
        ]}
        locations={[0, 0.45, 0.90]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* 3. Top-level UI layer firmly anchored on top of posters - 100% visible immediately */}
      <View
        style={[
          styles.foreground,
          {
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        {/* Top: MovieFlix Full Brand Logo */}
        <View style={styles.header}>
          <Image
            source={BRAND_LOGO}
            style={[styles.brandLogoImage, isCompact && { width: 190, height: 40 }]}
            resizeMode="contain"
          />
        </View>

        {/* Center: Hero Copy */}
        <View style={styles.heroCenter}>
          <Text style={[styles.mainHeading, isCompact && { fontSize: 26, lineHeight: 33, marginBottom: 8 }]}>
            Unlimited Movies,{'\n'}TV Shows & More.
          </Text>
          <Text style={[styles.subHeading, isCompact && { fontSize: 13, lineHeight: 19, marginBottom: 14 }]}>
            Watch anywhere. Discover blockbusters, live series, anime, and offline downloads.
          </Text>

          {/* Feature Badges */}
          <View style={styles.perksRow}>
            <View style={styles.perkBadge}>
              <Feather name="check" size={13} color="#e50914" style={{ marginRight: 6 }} />
              <Text style={styles.perkText}>4K Streaming</Text>
            </View>
            <View style={styles.perkBadge}>
              <Feather name="check" size={13} color="#e50914" style={{ marginRight: 6 }} />
              <Text style={styles.perkText}>Multi-Audio</Text>
            </View>
            <View style={styles.perkBadge}>
              <Feather name="check" size={13} color="#e50914" style={{ marginRight: 6 }} />
              <Text style={styles.perkText}>No Ads</Text>
            </View>
          </View>
        </View>

        {/* Bottom: Always Visible Get Started Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.getStartedBtn, isCompact && { paddingVertical: 14 }]}
            onPress={onGetStarted}
            activeOpacity={0.82}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Feather name="arrow-right" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            Instant free access • No credit card required
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  foreground: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 100,
    elevation: 25,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
  },
  brandLogoImage: {
    width: 220,
    height: 46,
  },
  heroCenter: {
    alignItems: 'center',
    marginVertical: 10,
  },
  mainHeading: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subHeading: {
    color: '#f0f0f0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 340,
    marginBottom: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  perksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  perkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 22, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 3,
  },
  perkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 4,
  },
  getStartedBtn: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 10,
  },
  getStartedText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerNote: {
    color: '#d0d0d0',
    fontSize: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
