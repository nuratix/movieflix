import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Linking,
  Image,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const DOWNLOAD_URL = '/api/download';
export const TELEGRAM_URL = 'https://t.me/movieflixlol';
export const PRIVACY_POLICY_URL = '/privacy';

export default function DownloadScreen({ onClose, onOpenPrivacy }) {
  const insets = useSafeAreaInsets();
  const [releaseInfo, setReleaseInfo] = useState({
    version: '1.1.5',
    tag: 'v1.1.5',
    sizeFormatted: '~98 MB',
    downloadUrl: DOWNLOAD_URL,
  });
  const [downloading, setDownloading] = useState(false);

  const topInset = Math.max(insets?.top || 0, Platform.OS === 'android' ? 24 : 16);
  const bottomInset = Math.max(insets?.bottom || 0, 28);

  useEffect(() => {
    // Optionally fetch dynamic release metadata
    fetch('/api/download?info=true')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.version) {
          const mb = data.sizeBytes ? (data.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '~98 MB';
          setReleaseInfo({
            version: data.version,
            tag: data.tag || `v${data.version}`,
            sizeFormatted: mb,
            downloadUrl: data.downloadUrl || DOWNLOAD_URL,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = releaseInfo.downloadUrl;
    } else {
      Linking.openURL(releaseInfo.downloadUrl).catch((err) => {
        console.warn('Could not trigger download:', err);
      });
    }
    setTimeout(() => setDownloading(false), 4000);
  };

  const handleTelegramLink = () => {
    Linking.openURL(TELEGRAM_URL).catch((err) => {
      console.warn('Could not open Telegram URL:', err);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.backBtnText}>Home</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>MovieFlix</Text>

          <TouchableOpacity
            style={styles.headerTelegramBtn}
            onPress={handleTelegramLink}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="send" size={15} color="#29B6F6" style={{ marginRight: 4 }} />
            <Text style={styles.headerTelegramText}>Telegram</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.iconContainer}>
              <Image
                source={require('./assets/icon.png')}
                style={styles.appIcon}
                resizeMode="cover"
              />
              <View style={styles.badgeLatest}>
                <Text style={styles.badgeLatestText}>{releaseInfo.tag}</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>MovieFlix for Android</Text>
            <Text style={styles.heroSubtitle}>
              Stream & download thousands of movies and TV shows in 4K, 1080p, and multi-audio with zero ads.
            </Text>

            {/* Badges Row */}
            <View style={styles.badgeRow}>
              <View style={styles.infoBadge}>
                <Feather name="check-circle" size={12} color="#46D369" style={{ marginRight: 4 }} />
                <Text style={styles.infoBadgeText}>Official Build</Text>
              </View>
              <View style={styles.infoBadge}>
                <Feather name="shield" size={12} color="#46D369" style={{ marginRight: 4 }} />
                <Text style={styles.infoBadgeText}>Virus Free · Safe</Text>
              </View>
              <View style={styles.infoBadge}>
                <Feather name="slash" size={12} color="#E50914" style={{ marginRight: 4 }} />
                <Text style={styles.infoBadgeText}>100% Ad-Free</Text>
              </View>
            </View>

            {/* Main Download Button */}
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={handleDownload}
              activeOpacity={0.85}
            >
              <Feather
                name={downloading ? 'check' : 'download'}
                size={22}
                color="#FFFFFF"
                style={{ marginRight: 10 }}
              />
              <View>
                <Text style={styles.downloadButtonText}>
                  {downloading ? 'Starting Download...' : `Download APK (${releaseInfo.tag})`}
                </Text>
                <Text style={styles.downloadButtonSubtext}>
                  Android 7.0+ · {releaseInfo.sizeFormatted} · Direct Download
                </Text>
              </View>
            </TouchableOpacity>

            {/* Telegram Channel Button */}
            <TouchableOpacity
              style={styles.telegramButton}
              onPress={handleTelegramLink}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="send" size={18} color="#29B6F6" style={{ marginRight: 8 }} />
              <Text style={styles.telegramButtonText}>Join Our Telegram for Releases & Updates</Text>
            </TouchableOpacity>
          </View>

          {/* Why Download APK (Comparison) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Why Install the Android App?</Text>
            <Text style={styles.sectionSubtitle}>
              The native Android application gives you the ultimate streaming experience that browsers cannot provide:
            </Text>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Feather name="download-cloud" size={18} color="#E50914" />
                </View>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureItemTitle}>Offline Downloads</Text>
                  <Text style={styles.featureItemDesc}>
                    Save movies and series straight to your storage. Watch offline while traveling or without internet.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Feather name="zap" size={18} color="#E50914" />
                </View>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureItemTitle}>Native Hardware Acceleration</Text>
                  <Text style={styles.featureItemDesc}>
                    Zero browser stutter, instant seeking, adaptive bitrate, and true 1080p full-screen playback.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Feather name="volume-2" size={18} color="#E50914" />
                </View>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureItemTitle}>Multi-Audio & Dub Switching</Text>
                  <Text style={styles.featureItemDesc}>
                    Seamlessly switch between Hindi, English, Tamil, Telugu, and other regional voice tracks.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Feather name="message-square" size={18} color="#E50914" />
                </View>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureItemTitle}>Synchronized Subtitles</Text>
                  <Text style={styles.featureItemDesc}>
                    Multiple subtitle languages with customizable size and real-time synchronization.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Feather name="lock" size={18} color="#E50914" />
                </View>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureItemTitle}>100% Private & Ad-Free</Text>
                  <Text style={styles.featureItemDesc}>
                    No annoying popups, no redirects, no third-party trackers, and no user registration required.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Simple 3-Step Install Guide */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>How to Install (3 Easy Steps)</Text>

            <View style={styles.stepsContainer}>
              <View style={styles.stepRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepTextWrapper}>
                  <Text style={styles.stepTitle}>Download the APK</Text>
                  <Text style={styles.stepDesc}>
                    Tap the red <Text style={{ color: '#E50914', fontWeight: '700' }}>Download APK</Text> button at the top of this page.
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepTextWrapper}>
                  <Text style={styles.stepTitle}>Allow Installation</Text>
                  <Text style={styles.stepDesc}>
                    Open the downloaded file. If your phone asks to allow installs from your browser, tap <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Settings</Text> and enable <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>"Allow from this source"</Text>.
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepTextWrapper}>
                  <Text style={styles.stepTitle}>Install and Enjoy</Text>
                  <Text style={styles.stepDesc}>
                    Tap <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Install</Text>. Once complete, open MovieFlix and start watching your favorite titles immediately.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Secondary Download Call to Action */}
          <View style={styles.bottomCtaSection}>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={handleDownload}
              activeOpacity={0.85}
            >
              <Feather name="download" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.downloadButtonText}>Download APK ({releaseInfo.tag})</Text>
            </TouchableOpacity>

            <View style={styles.footerLinksRow}>
              {onOpenPrivacy && (
                <TouchableOpacity onPress={onOpenPrivacy} activeOpacity={0.7} style={{ marginHorizontal: 8 }}>
                  <Text style={styles.footerLinkText}>Privacy Policy</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.footerLinkDivider}>·</Text>
              <TouchableOpacity onPress={handleTelegramLink} activeOpacity={0.7} style={{ marginHorizontal: 8 }}>
                <Text style={styles.footerLinkText}>Telegram Support</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerCopyright}>
              MovieFlix · Free Movies & Series Streaming · Official Release
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerBar: {
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222222',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#161616',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#E50914',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerTelegramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(41, 182, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(41, 182, 246, 0.25)',
  },
  headerTelegramText: {
    color: '#29B6F6',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  contentWrapper: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
    textAlign: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  appIcon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeLatest: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  badgeLatestText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#A0A0A0',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 480,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  infoBadgeText: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '500',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    width: '100%',
    maxWidth: 440,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  downloadButtonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  telegramButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41, 182, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(41, 182, 246, 0.3)',
    width: '100%',
    maxWidth: 440,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  telegramButtonText: {
    color: '#29B6F6',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#0E0E0E',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: '#8A8A8A',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  featureItemDesc: {
    color: '#888888',
    fontSize: 12.5,
    lineHeight: 18,
  },
  stepsContainer: {
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepTextWrapper: {
    flex: 1,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDesc: {
    color: '#888888',
    fontSize: 12.5,
    lineHeight: 18,
  },
  bottomCtaSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  footerLinkText: {
    color: '#777777',
    fontSize: 12,
  },
  footerLinkDivider: {
    color: '#444444',
    fontSize: 12,
  },
  footerCopyright: {
    color: '#444444',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
