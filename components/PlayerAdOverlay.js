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
import { useVideoPlayer, VideoView } from 'expo-video';
import { getCleanDomain, recordClick } from '../adService';

/**
 * PlayerAdOverlay - Fullscreen Video Player Ad Interstitial
 * Supports:
 * - 16:9 and 9:16 Poster Images
 * - 16:9 and 9:16 Video Ads (with countdown skip timer)
 * - Video completion blur state with center "Try Now" button (does not replay)
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

  const isVideo = ad?.media_type === 'video' || Boolean(ad?.video_url);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Number(ad?.skip_seconds) || initialSkipSeconds
  );
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const webVideoRef = useRef(null);

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
    const startSec = Number(ad?.skip_seconds) || initialSkipSeconds;
    setRemainingSeconds(startSec);
    if (startSec <= 0) return;

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
  }, [ad?.skip_seconds, initialSkipSeconds]);

  // Native Video Player setup (for iOS / Android APK)
  const videoSource = isVideo && ad?.video_url ? { uri: ad.video_url } : null;
  const nativePlayer = useVideoPlayer(videoSource, (p) => {
    if (!p) return;
    try {
      p.loop = false; // Do not replay when video ends
      p.play();
    } catch (_) {}
  });

  useEffect(() => {
    if (!nativePlayer || Platform.OS === 'web') return;
    const endSub = nativePlayer.addListener('playToEnd', () => {
      setIsVideoEnded(true);
      try { nativePlayer.pause(); } catch (_) {}
    });
    return () => {
      try { endSub?.remove?.(); } catch (_) {}
    };
  }, [nativePlayer]);

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
  const isShortsRatio = ad.aspect_ratio === '9:16';
  const isLandscape = windowWidth > windowHeight;

  // Calculate responsive dimensions (16:9 or 9:16)
  let frameWidth = 0;
  let frameHeight = 0;

  if (isShortsRatio) {
    // 9:16 Vertical frame
    const maxH = windowHeight - Math.max(insets.top, 16) - Math.max(insets.bottom, 16) - 120;
    frameHeight = Math.min(Math.max(maxH, 240), 480);
    frameWidth = Math.round(frameHeight * (9 / 16));
  } else if (isLandscape) {
    // 16:9 Landscape frame
    const maxAvailableHeight = windowHeight - Math.max(insets.top, 16) - Math.max(insets.bottom, 16) - 130;
    frameHeight = Math.min(Math.max(maxAvailableHeight, 180), 380);
    frameWidth = Math.round(frameHeight * (16 / 9));
    if (frameWidth > windowWidth * 0.88) {
      frameWidth = Math.round(windowWidth * 0.88);
      frameHeight = Math.round(frameWidth * (9 / 16));
    }
  } else {
    // 16:9 Portrait frame
    frameWidth = Math.min(windowWidth - 32, 540);
    frameHeight = Math.round(frameWidth * (9 / 16));
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
            <Text style={styles.sponsoredText}>
              {isVideo ? 'SPONSORED VIDEO' : 'SPONSORED'}
            </Text>
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

      {/* ─── Center: 16:9 or 9:16 Ad Card ─── */}
      <View style={styles.cardWrapper}>
        <TouchableWithoutFeedback onPress={handlePressAd}>
          <View
            style={[
              styles.posterFrame,
              { width: frameWidth, height: frameHeight },
            ]}
          >
            {isVideo && ad.video_url ? (
              // Video Ad Player
              Platform.OS === 'web' ? (
                <video
                  ref={webVideoRef}
                  src={ad.video_url}
                  poster={ad.poster_url || ''}
                  autoPlay
                  playsInline
                  controls={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    filter: isVideoEnded ? 'blur(16px)' : 'none',
                    transition: 'filter 0.4s ease',
                  }}
                  onEnded={() => setIsVideoEnded(true)}
                />
              ) : (
                <VideoView
                  style={[
                    StyleSheet.absoluteFill,
                    isVideoEnded && { opacity: 0.3 },
                  ]}
                  player={nativePlayer}
                  nativeControls={false}
                  contentFit="cover"
                />
              )
            ) : (
              // Poster Image Ad
              <ExpoImage
                source={{ uri: ad.poster_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            )}

            {/* Video Completed State: Blurred Video with Center "Try Now" Button (Does not replay) */}
            {Boolean(isVideo && isVideoEnded) && (
              <View style={styles.videoEndedOverlay}>
                <TouchableOpacity
                  style={styles.centerTryNowBtn}
                  onPress={handlePressAd}
                  activeOpacity={0.85}
                >
                  <Text style={styles.centerTryNowText}>Try Now</Text>
                  <Feather name="arrow-up-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
                <Text style={styles.centerTryNowTitle} numberOfLines={1}>
                  {ad.name || 'Learn More'}
                </Text>
                {Boolean(cleanDomain) && (
                  <View style={styles.centerDomainPill}>
                    <Feather name="globe" size={11} color="#9CA3AF" style={{ marginRight: 4 }} />
                    <Text style={styles.centerDomainText}>{cleanDomain}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Subtle Gradient Vignette & Tap Indicator when not ended */}
            {!isVideoEnded && (
              <View style={styles.posterOverlayGlow}>
                <View style={styles.posterTapHint}>
                  <Feather name="external-link" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={styles.posterTapHintText}>Tap to visit</Text>
                </View>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* ─── Bottom Ad Details & Call-To-Action Row ─── */}
        <View style={[styles.bottomInfoBar, { width: frameWidth }]}>
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

          {/* "Get Started" / "Try Now" CTA Button */}
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handlePressAd}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>
              {isVideo ? 'Try Now' : 'Get Started'}
            </Text>
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
    position: 'relative',
  },
  posterOverlayGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 10,
    pointerEvents: 'none',
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
  videoEndedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 20,
  },
  centerTryNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 10,
  },
  centerTryNowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  centerTryNowTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  centerDomainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  centerDomainText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
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
