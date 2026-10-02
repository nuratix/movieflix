import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TiltedPostersBackground from './TiltedPostersBackground';

const LOCAL_HEADER_ICON = require('./assets/header_icon.png');

export default function WelcomeScreen({ onGetStarted }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0a0a0a" translucent />

      {/* Moving tilted poster wall background */}
      <TiltedPostersBackground />

      {/* Content Container */}
      <View style={[styles.content, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 36 }]}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoHalo}>
            <ExpoImage source={LOCAL_HEADER_ICON} style={styles.logoImage} contentFit="contain" />
          </View>
          <Text style={styles.brandTitle}>Movieflix</Text>
        </View>

        {/* Hero Copy */}
        <View style={styles.heroCenter}>
          <Text style={styles.mainHeading}>
            Unlimited Movies,{'\n'}TV Shows & More.
          </Text>
          <Text style={styles.subHeading}>
            Watch anywhere. Discover blockbuster entertainment, live series, anime, and offline downloads.
          </Text>

          {/* Quick Perks */}
          <View style={styles.perksRow}>
            <View style={styles.perkBadge}>
              <Feather name="check" size={13} color="#e50914" style={{ marginRight: 5 }} />
              <Text style={styles.perkText}>4K Streaming</Text>
            </View>
            <View style={styles.perkBadge}>
              <Feather name="check" size={13} color="#e50914" style={{ marginRight: 5 }} />
              <Text style={styles.perkText}>Multi-Audio</Text>
            </View>
            <View style={styles.perkBadge}>
              <Feather name="check" size={13} color="#e50914" style={{ marginRight: 5 }} />
              <Text style={styles.perkText}>No Ads</Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.getStartedBtn}
            onPress={onGetStarted}
            activeOpacity={0.88}
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
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
  },
  logoHalo: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  brandTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroCenter: {
    alignItems: 'center',
    marginVertical: 'auto',
  },
  mainHeading: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  subHeading: {
    color: '#a3a3a3',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 340,
    marginBottom: 24,
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  perkText: {
    color: '#f5f5f1',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    width: '100%',
  },
  getStartedBtn: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 14,
  },
  getStartedText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerNote: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});
