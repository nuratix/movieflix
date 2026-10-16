import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Linking,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { recordClick } from '../adService';

/**
 * PlayerAdOverlay - Fullscreen Video Player Ad Interstitial HUD
 * Rendered directly on top of the main movie player's VideoView!
 * Features:
 * - Uses the SAME native video player (no second VideoView or ExoPlayer collision)
 * - Transparent overlay: Ad video shines through full screen seamlessly
 * - Skip timer countdown (unlocked after skip_seconds)
 * - Mute/Unmute sound toggle directly controlling the player
 * - Top sponsored badge and "Go Ad-Free" CTA
 * - Bottom glass pill with Ad Title & "Get Started" button
 * - End overlay with center "Get Started" button when video ends
 * - Clean full-screen fallback for static image ads
 */
export default function PlayerAdOverlay({
  ad,
  player,
  isVideoEnded = false,
  initialSkipSeconds = 30,
  onSkip,
  onOpenAd,
  onClose,
  onGoAdFree,
}) {
  const insets = useSafeAreaInsets();
  const isVideo = Boolean(ad?.media_type === 'video' || ad?.video_url);
  const rawSec = Number(ad?.skip_seconds);
  const effectiveStartSec = !isNaN(rawSec) && rawSec > 0 ? Math.max(30, rawSec) : initialSkipSeconds;
  const [remainingSeconds, setRemainingSeconds] = useState(effectiveStartSec);
  const [isMuted, setIsMuted] = useState(false);

  // Sync initial mute state if player exists
  useEffect(() => {
    if (player && typeof player.muted === 'boolean') {
      setIsMuted(player.muted);
    }
  }, [player]);

  const toggleMute = (e) => {
    e?.stopPropagation?.();
    const next = !isMuted;
    setIsMuted(next);
    if (player) {
      try {
        player.muted = next;
      } catch (_) {}
    }
  };

  // If video ends, unlock skip immediately so user is never stuck
  useEffect(() => {
    if (isVideoEnded) {
      setRemainingSeconds(0);
    }
  }, [isVideoEnded]);

  // Countdown timer for Skip button (minimum 30 seconds enforced)
  useEffect(() => {
    if (isVideoEnded) {
      setRemainingSeconds(0);
      return;
    }
    const rawSkip = Number(ad?.skip_seconds);
    const startSec = !isNaN(rawSkip) && rawSkip > 0 ? Math.max(30, rawSkip) : initialSkipSeconds;
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
  }, [ad?.skip_seconds, initialSkipSeconds, isVideoEnded]);

  const canSkip = remainingSeconds <= 0 || isVideoEnded;

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

  const handleSkip = (e) => {
    e?.stopPropagation?.();
    if (!canSkip) return;
    if (onSkip) onSkip();
  };

  if (!ad) return null;

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {/* ─── FULLSCREEN BACKGROUND MEDIA (ONLY FOR STATIC IMAGE ADS OR END STATE) ─── */}
      <TouchableWithoutFeedback onPress={handlePressAd}>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {/* Static Image Ads: Render full-screen poster image since no video is streaming */}
          {!isVideo && (
            Boolean(ad?.poster_url) ? (
              <ExpoImage
                source={{ uri: ad.poster_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.fallbackAdCard]}>
                <MaterialIcons name="campaign" size={60} color="#e50914" />
                <Text style={styles.fallbackAdTitle}>{ad.name || 'Sponsored Promotion'}</Text>
              </View>
            )
          )}

          {/* Video Completed State: Blurred Overlay with Center "Get Started" Button (Does not replay) */}
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
        pointerEvents="box-none"
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
          {/* VISIT NOW BUTTON IN TOP LEFT CORNER FROM AD STARTING */}
          <TouchableOpacity
            style={styles.topVisitNowBtn}
            onPress={handlePressAd}
            activeOpacity={0.8}
          >
            <Feather name="external-link" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={styles.topVisitNowText}>Visit Now</Text>
          </TouchableOpacity>

          <View style={styles.sponsoredBadge}>
            <MaterialIcons name="campaign" size={15} color="#e50914" style={{ marginRight: 6 }} />
            <Text style={styles.sponsoredText}>
              {isVideo ? 'SPONSORED VIDEO' : 'SPONSORED'}
            </Text>
          </View>
          {Boolean(isVideo) && (
            <TouchableOpacity
              style={styles.soundBtn}
              onPress={toggleMute}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={15} color="#FFFFFF" />
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
              <MaterialIcons name="workspace-premium" size={14} color="#fbbf24" style={{ marginRight: 4 }} />
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

      {/* ─── BOTTOM FLOATING BAR: ONLY GET STARTED BUTTON & TITLE ─── */}
      {!isVideoEnded && (
        <View
          style={[
            styles.bottomFloatingBar,
            {
              bottom: Math.max(insets.bottom, 16),
              left: Math.max(insets.left, 20),
              right: Math.max(insets.right, 20),
            },
          ]}
          pointerEvents="box-none"
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
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
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
  topVisitNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ff333f',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  topVisitNowText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  soundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
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
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  goAdFreeText: {
    color: '#fbbf24',
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
  bottomFloatingBar: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bottomInfoLeft: {
    flex: 1,
    marginRight: 16,
  },
  adTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  videoEndedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
  fallbackAdCard: {
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackAdTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
});
