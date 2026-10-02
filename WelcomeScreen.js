import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TiltedPostersBackground from './TiltedPostersBackground';

const BRAND_LOGO = require('./assets/movieflix_brand_logo.png');

export default function WelcomeScreen({ onGetStarted }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0a0a0a" translucent />

      {/* Moving tilted poster wall background */}
      <TiltedPostersBackground />

      {/* Scrollable Content Container to ensure button is always reachable */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header with real wide logo */}
        <View style={styles.header}>
          <ExpoImage
            source={BRAND_LOGO}
            style={styles.brandLogoImage}
            contentFit="contain"
          />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 20,
  },
  brandLogoImage: {
    width: 230,
    height: 48,
  },
  heroCenter: {
    alignItems: 'center',
    marginVertical: 20,
  },
  mainHeading: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subHeading: {
    color: '#a3a3a3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
    marginBottom: 20,
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
    paddingTop: 10,
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
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 12,
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
