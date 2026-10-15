import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Linking,
  Platform,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { getCleanDomain, recordClick } from '../adService';

/**
 * PlayerAdOverlay - Fullscreen Video Player Ad Interstitial
 * Displays a 16:9 ad poster, ad title, clean URL badge, Get Started CTA, and countdown Skip button.
 */
export default function PlayerAdOverlay({
  ad,
  initialSkipSeconds = 10,
  onSkip,
  onOpenAd,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [remainingSeconds, setRemainingSeconds] = useState(initialSkipSeconds);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Countdown timer for Skip button
  useEffect(() => {
    setRemainingSeconds(initialSkipSeconds);
    if (initialSkipSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [initialSkipSeconds]);

  const canSkip = remainingSeconds <= 0;

  // Handle opening destination ad URL
  const handlePressAd = async () => {
    if (!ad) return;
    recordClick(ad);
    if (onOpenAd) {
      onOpenAd(ad);
    }

    const target = ad.target_url || '';
    if (target) {
      const fullUrl = target.startsWith('http://') || target.startsWith('https://') ? target : `https://${target}`;
      try {
        await Linking.openURL(fullUrl);
      } catch (err) {
        console.warn('[AdOverlay] Failed to open URL:', err?.message);
      }
    }
  };

  const handleSkip = () => {
    if (!canSkip) return;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      if (onSkip) onSkip();
    });
  };

  if (!ad) return null;

  const cleanDomain = getCleanDomain(ad.target_url);

  // Calculate responsive 16:9 dimensions
  const isLandscape = windowWidth > windowHeight;
  let posterWidth = 0;
  let posterHeight = 0;

  if (isLandscape) {
    // In landscape: height is constrained so controls fit comfortably
    const maxAvailableHeight = windowHeight - Math.max(insets.top, 16) - Math.max(insets.bottom, 16) - 130;
    posterHeight = Math.min(Math.max(maxAvailableHeight, 180), 380);
    posterWidth = Math.round(posterHeight * (16 / 9));
    if (posterWidth > windowWidth * 0.88) {
      posterWidth = Math.round(windowWidth * 0.88);
      posterHeight = Math.round(posterWidth * (9 / 16));
    }
  } else {
    // In portrait: width is constrained
    posterWidth = Math.min(windowWidth - 32, 540);
    posterHeight = Math.round(posterWidth * (9 / 16));
  }

  return (
    <Animated.View
      style={[
        styles.overlayContainer,
        StyleSheet.absoluteFillObject,
        { opacity: fadeAnim },
      ]}
    >
      {/* ─── Top Bar: Sponsored Badge & Skip Ad Button ─── */}
      <View
        style={[
          styles.topBar,
          {
            top: Math.max(insets.top, 14),
            left: Math.max(insets.left, 18),
            right: Math.max(insets.right, 18),
          },
        ]}
      >
        <View style={styles.topBarLeftGroup}>
          {Boolean(onClose) && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={styles.sponsoredBadge}>
            <MaterialIcons name="campaign" size={15} color="#e50914" style={{ marginRight: 5 }} />
            <Text style={styles.sponsoredText}>SPONSORED</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.skipButton,
            canSkip ? styles.skipButtonActive : styles.skipButtonDisabled,
          ]}
          onPress={handleSkip}
          disabled={!canSkip}
          activeOpacity={0.8}
        >
          {canSkip ? (
            <View style={styles.skipContentRow}>
              <Text style={styles.skipTextActive}>Skip Ad</Text>
              <Feather name="chevrons-right" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </View>
          ) : (
            <View style={styles.skipContentRow}>
              <Feather name="clock" size={13} color="#A3A3A3" style={{ marginRight: 5 }} />
              <Text style={styles.skipTextDisabled}>
                {`Ad · Skip in ${remainingSeconds}s`}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Center: 16:9 Ad Card (Clickable Poster) ─── */}
      <View style={styles.cardWrapper}>
        <TouchableWithoutFeedback onPress={handlePressAd}>
          <View
            style={[
              styles.posterFrame,
              { width: posterWidth, height: posterHeight },
            ]}
          >
            <ExpoImage
              source={{ uri: ad.poster_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />

            {/* Subtle Gradient Vignette & Tap Indicator */}
            <View style={styles.posterOverlayGlow}>
              <View style={styles.posterTapHint}>
                <Feather name="external-link" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.posterTapHintText}>Tap to visit</Text>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* ─── Bottom Ad Details & Call-To-Action Row ─── */}
        <View style={[styles.bottomInfoBar, { width: posterWidth }]}>
          <View style={styles.infoLeftCol}>
            {/* Ad Title / Message */}
            <Text style={styles.adTitleText} numberOfLines={1}>
              {ad.name || 'Sponsored Promotion'}
            </Text>

            {/* Clean URL Button */}
            {Boolean(cleanDomain) && (
              <TouchableOpacity
                style={styles.cleanUrlButton}
                onPress={handlePressAd}
                activeOpacity={0.75}
              >
                <Feather name="globe" size={11} color="#9CA3AF" style={{ marginRight: 5 }} />
                <Text style={styles.cleanUrlText} numberOfLines={1}>
                  {cleanDomain}
                </Text>
                <Feather name="external-link" size={10} color="#9CA3AF" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
          </View>

          {/* "Get Started" CTA Button */}
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handlePressAd}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Feather name="arrow-up-right" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    backgroundColor: 'rgba(5, 5, 5, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  topBar: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topBarLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  sponsoredText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonDisabled: {
    backgroundColor: 'rgba(18, 18, 18, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  skipButtonActive: {
    backgroundColor: '#e50914',
    borderWidth: 1,
    borderColor: '#ff333f',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  skipContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipTextDisabled: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  skipTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFrame: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#171717',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 10,
  },
  posterOverlayGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 10,
  },
  posterTapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  posterTapHintText: {
    color: '#F3F4F6',
    fontSize: 10,
    fontWeight: '600',
  },
  bottomInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  infoLeftCol: {
    flex: 1,
    marginRight: 12,
  },
  adTitleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cleanUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cleanUrlText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 220,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 3,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
