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
import { recordClick } from '../adService';

/**
 * PlayerAdOverlay - Fullscreen Video Player Ad Interstitial
 * Features:
 * - Full landscape screen coverage (no small center box)
 * - Clean interface: NO URLs displayed anywhere
 * - Only "Get Started" call-to-action button
 * - Video completion blur state with center "Get Started" button (does not replay)
 * - Skip timer countdown (unlocked after skip_seconds)
 */
export default function PlayerAdOverlay({
  ad,
  initialSkipSeconds = 10,
  onSkip,
  onOpenAd,
  onClose,
  onGoAdFree,
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const isVideo = (ad?.media_type === 'video' || Boolean(ad?.video_url)) && !mediaError;
  const [mediaError, setMediaError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
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
      p.loop = false; // Never replay when video ends
      p.play();
    } catch (_) {}
  });

  useEffect(() => {
    if (!nativePlayer || Platform.OS === 'web') return;
    const endSub = nativePlayer.addListener('playToEnd', () => {
      setIsVideoEnded(true);
      try { nativePlayer.pause(); } catch (_) {}
    });
    const statusSub = nativePlayer.addListener?.('statusChange', (status) => {
      if (status?.status === 'error') {
        console.warn('[PlayerAdOverlay] Native ad video playback error, switching to poster');
        setMediaError(true);
      }
    });
    return () => {
      try { endSub?.remove?.(); } catch (_) {}
      try { statusSub?.remove?.(); } catch (_) {}
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

  const fallbackPoster = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1920&q=80';
  const effectivePoster = ad.poster_url || fallbackPoster;

  return (
    <Animated.View
      style={[
        styles.overlayContainer,
        StyleSheet.absoluteFillObject,
        { opacity: fadeAnim },
      ]}
    >
      {/* ─── FULLSCREEN LANDSCAPE BACKGROUND MEDIA (POSTER OR VIDEO) ─── */}
      <TouchableWithoutFeedback onPress={handlePressAd}>
        <View style={StyleSheet.absoluteFillObject}>
          {isVideo && ad.video_url ? (
            // Fullscreen Video Player with muted autoplay so browsers NEVER block it!
            Platform.OS === 'web' ? (
              <video
                ref={webVideoRef}
                src={ad.video_url}
                poster={effectivePoster}
                autoPlay
                playsInline
                muted={isMuted}
                controls={false}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  filter: isVideoEnded ? 'blur(22px) brightness(0.45)' : 'none',
                  transition: 'filter 0.45s ease',
                }}
                onError={() => {
                  console.warn('[PlayerAdOverlay] HTML5 video error, falling back to poster');
                  setMediaError(true);
                }}
                onEnded={() => setIsVideoEnded(true)}
              />
            ) : (
              <VideoView
                style={[
                  StyleSheet.absoluteFill,
                  isVideoEnded && { opacity: 0.35 },
                ]}
                player={nativePlayer}
                nativeControls={false}
                contentFit="cover"
              />
            )
          ) : (
            // Fullscreen Poster Image
            <ExpoImage
              source={{ uri: effectivePoster }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          )}

          {/* Vignettes for readability of top bar & bottom CTA */}
          <View style={styles.topVignette} pointerEvents="none" />
          <View style={styles.bottomVignette} pointerEvents="none" />

          {/* Video Completed State: Blurred Video with Center "Get Started" Button (Does not replay) */}
          {Boolean(isVideo && isVideoEnded) && (
            <View style={styles.videoEndedOverlay}>
              <TouchableOpacity
                style={styles.centerTryNowBtn}
                onPress={handlePressAd}
                activeOpacity={0.85}
              >
                <Text style={styles.centerTryNowText}>Get Started</Text>
                <Feather name="arrow-up-right" size={20} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
              <Text style={styles.centerTryNowTitle} numberOfLines={2}>
                {ad.name || 'Sponsored Promotion'}
              </Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* ─── TOP BAR: SPONSORED BADGE & SKIP AD BUTTON ─── */}
      <View
        style={[
          styles.topBar,
          {
            top: Math.max(insets.top, 16),
            left: Math.max(insets.left, 20),
            right: Math.max(insets.right, 20),
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
            <MaterialIcons name="campaign" size={15} color="#e50914" style={{ marginRight: 6 }} />
            <Text style={styles.sponsoredText}>
              {isVideo ? 'SPONSORED VIDEO' : 'SPONSORED'}
            </Text>
          </View>
          {Boolean(isVideo && Platform.OS === 'web') && (
            <TouchableOpacity
              style={styles.muteBtn}
              onPress={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                if (webVideoRef.current) {
                  webVideoRef.current.muted = nextMuted;
                }
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name={isMuted ? "volume-x" : "volume-2"} size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.topBarRightGroup}>
          {Boolean(onGoAdFree) && (
            <TouchableOpacity
              style={styles.goAdFreeBtn}
              onPress={onGoAdFree}
              activeOpacity={0.8}
            >
              <MaterialIcons name="workspace-premium" size={14} color="#e50914" style={{ marginRight: 4 }} />
              <Text style={styles.goAdFreeText}>Go Ad-Free ($1)</Text>
            </TouchableOpacity>
          )}

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
      </View>

      {/* ─── BOTTOM FLOATING BAR: ONLY GET STARTED BUTTON & TITLE (NO URL) ─── */}
      {!isVideoEnded && (
        <View
          style={[
            styles.bottomFloatingBar,
            {
              bottom: Math.max(insets.bottom, 22),
              left: Math.max(insets.left, 24),
              right: Math.max(insets.right, 24),
            },
          ]}
        >
          <View style={styles.bottomInfoLeft}>
            <Text style={styles.adTitleText} numberOfLines={1}>
              {ad.name || 'Sponsored Promotion'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handlePressAd}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Feather name="arrow-up-right" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  topBar: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 30,
  },
  topBarLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sponsoredText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  topBarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goAdFreeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.55)',
  },
  goAdFreeText: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipButtonActive: {
    backgroundColor: '#e50914',
    borderWidth: 1,
    borderColor: '#ff333f',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 5,
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
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 5,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 5,
  },
  bottomFloatingBar: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 25,
  },
  bottomInfoLeft: {
    flex: 1,
    marginRight: 16,
  },
  adTitleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  videoEndedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  centerTryNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 12,
  },
  centerTryNowText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  centerTryNowTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    maxWidth: '85%',
  },
  muteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
