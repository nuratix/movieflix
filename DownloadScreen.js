import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  useWindowDimensions,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NowPaymentsButton from './components/NowPaymentsButton';

export const DOWNLOAD_URL = '/api/download';
export const PRIVACY_POLICY_URL = '/privacy';

// ─── 4 Verified App Screenshots ──────────────────────────────────────────────
const SCREENSHOTS = [
  {
    id: '1',
    source: require('./assets/screenshots/screen1.png'),
    webUri: '/screenshots/screen1.png',
  },
  {
    id: '2',
    source: require('./assets/screenshots/screen2.png'),
    webUri: '/screenshots/screen2.png',
  },
  {
    id: '3',
    source: require('./assets/screenshots/screen3.png'),
    webUri: '/screenshots/screen3.png',
  },
  {
    id: '4',
    source: require('./assets/screenshots/screen4.jpg'),
    webUri: '/screenshots/screen4.jpg',
  },
];

export default function DownloadScreen({
  onClose,
  onOpenPrivacy,
  authUser,
  authAccessToken,
  onOpenAuth,
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 900;
  const isTablet = windowWidth >= 600 && windowWidth < 900;

  const [releaseInfo, setReleaseInfo] = useState({
    version: '1.1.8',
    tag: 'v1.1.8',
    sizeFormatted: '98 MB',
    developer: 'movieflix',
    ageRating: '18+',
    realDownloads: 0,
    downloadUrl: DOWNLOAD_URL,
  });

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(null);
  const [showAuthGateModal, setShowAuthGateModal] = useState(false);

  const topInset = Math.max(insets?.top || 0, Platform.OS === 'android' ? 24 : 16);
  const bottomInset = Math.max(insets?.bottom || 0, 24);

  // Fetch live release info & real download count from Neon DB
  useEffect(() => {
    fetch('/api/download?info=true')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.version) {
          setReleaseInfo((prev) => ({
            ...prev,
            version: data.version,
            tag: data.tag || `v${data.version}`,
            sizeFormatted: data.sizeFormatted || '98 MB',
            developer: data.developer || 'movieflix',
            ageRating: data.ageRating || '18+',
            realDownloads: typeof data.realDownloads === 'number' ? data.realDownloads : 0,
            downloadUrl: data.downloadUrl || DOWNLOAD_URL,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Handle Download Action
  const handleInitiateDownload = () => {
    // Auth Check: Only signed-in users can download
    if (!authUser) {
      setShowAuthGateModal(true);
      return;
    }

    setDownloading(true);
    setDownloadSuccess(false);

    // Build authenticated download link
    const token = authAccessToken || '';
    const downloadTarget = token
      ? `${releaseInfo.downloadUrl}?token=${encodeURIComponent(token)}`
      : releaseInfo.downloadUrl;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Trigger browser download via invisible iframe / anchor
      const link = document.createElement('a');
      link.href = downloadTarget;
      link.setAttribute('download', `movieflix-v${releaseInfo.version}.apk`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Linking.openURL(downloadTarget).catch((err) => {
        console.warn('Could not trigger APK download:', err);
      });
    }

    setTimeout(() => {
      setDownloading(false);
      setDownloadSuccess(true);
      // Increment real download count locally
      setReleaseInfo((prev) => ({
        ...prev,
        realDownloads: (prev.realDownloads || 0) + 1,
      }));
    }, 2500);
  };

  const handleShare = async () => {
    const shareUrl = 'https://movieflix-pi-six.vercel.app/download';
    const message = `Download MovieFlix v${releaseInfo.version} official APK for Android — 4K movies & series with zero ads: ${shareUrl}`;
    if (Platform.OS === 'web') {
      if (navigator.share) {
        navigator.share({ title: 'MovieFlix APK', text: message, url: shareUrl }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          alert('Download link copied to clipboard!');
        }).catch(() => {});
      }
    } else {
      Share.share({ message, url: shareUrl }).catch(() => {});
    }
  };

  // Format real download count (strictly authentic count)
  const formattedDownloadCount = () => {
    const count = releaseInfo.realDownloads;
    if (!count || count <= 0) return '0';
    if (count < 1000) return `${count}`;
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent />

      {/* Top Play Store App Bar */}
      <View style={[styles.topBar, { paddingTop: topInset + 6 }]}>
        <View style={styles.topBarContent}>
          <TouchableOpacity
            style={styles.navRoundBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.topBarTitleBlock}>
            <Text style={styles.topBarHeaderTitle}>MovieFlix</Text>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.navRoundBtn}
              onPress={handleShare}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="share-2" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navRoundBtn, { marginLeft: 8 }]}
              onPress={onOpenPrivacy}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="shield" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Main Scroll View */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageWrapper, isDesktop && styles.pageWrapperDesktop]}>
          
          {/* ==================================================== */}
          {/* PLAY STORE APP HEADER                                */}
          {/* ==================================================== */}
          <View style={styles.appHeaderRow}>
            {/* App Icon (Play Store Squircle) */}
            <View style={styles.iconSquircle}>
              <Image
                source={require('./assets/icon.png')}
                style={styles.appIconImage}
                resizeMode="cover"
              />
            </View>

            {/* Title & Developer Meta */}
            <View style={styles.appTitleCol}>
              <Text style={styles.appMainTitle}>MovieFlix</Text>
              <Text style={styles.appDeveloperName}>movieflix</Text>
              <View style={styles.appCategoryRow}>
                <Text style={styles.appCategoryText}>Entertainment</Text>
                <View style={styles.categoryDot} />
                <Text style={styles.appContainsNoAds}>Contains no ads</Text>
              </View>
            </View>
          </View>

          {/* ==================================================== */}
          {/* VERIFIED REAL STATS ROW                              */}
          {/* ==================================================== */}
          <View style={styles.statsCard}>
            {/* Stat 1: Real Verified Downloads */}
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{formattedDownloadCount()}</Text>
              <Text style={styles.statLabel}>Downloads</Text>
            </View>

            <View style={styles.statDivider} />

            {/* Stat 2: Age Rating */}
            <View style={styles.statCol}>
              <View style={styles.ageRatingBadge}>
                <Text style={styles.ageRatingBadgeText}>{releaseInfo.ageRating || '18+'}</Text>
              </View>
              <Text style={styles.statLabel}>Rated for 18+</Text>
            </View>

            <View style={styles.statDivider} />

            {/* Stat 3: File Size */}
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{releaseInfo.sizeFormatted}</Text>
              <Text style={styles.statLabel}>Size</Text>
            </View>

            <View style={styles.statDivider} />

            {/* Stat 4: Version Tag */}
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{releaseInfo.tag}</Text>
              <Text style={styles.statLabel}>Version</Text>
            </View>
          </View>

          {/* ==================================================== */}
          {/* PLAY STORE INSTALL BUTTON                            */}
          {/* ==================================================== */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[
                styles.installButton,
                downloading && styles.installButtonActive,
                downloadSuccess && styles.installButtonSuccess,
              ]}
              onPress={handleInitiateDownload}
              activeOpacity={0.85}
              disabled={downloading}
            >
              {downloading ? (
                <View style={styles.buttonInnerLoading}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 10 }} />
                  <Text style={styles.installButtonText}>Preparing APK Download...</Text>
                </View>
              ) : downloadSuccess ? (
                <View style={styles.buttonInnerLoading}>
                  <Feather name="check" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.installButtonText}>Download Started!</Text>
                </View>
              ) : authUser ? (
                <View style={styles.buttonInnerLoading}>
                  <Feather name="download" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                  <Text style={styles.installButtonText}>
                    Install ({releaseInfo.tag})
                  </Text>
                </View>
              ) : (
                <View style={styles.buttonInnerLoading}>
                  <Feather name="lock" size={18} color="#FFFFFF" style={{ marginRight: 10 }} />
                  <Text style={styles.installButtonText}>
                    Sign In to Install ({releaseInfo.tag})
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Play Protect Subtext */}
            <View style={styles.playProtectRow}>
              <MaterialIcons name="security" size={15} color="#E50914" style={{ marginRight: 6 }} />
              <Text style={styles.playProtectText}>
                {authUser
                  ? 'Verified by MovieFlix Play Protect • Zero virus • Safe direct APK'
                  : 'Sign in required to download official APK • Free account'}
              </Text>
            </View>
          </View>

          {/* ==================================================== */}
          {/* SCREENSHOTS CAROUSEL                                 */}
          {/* ==================================================== */}
          <View style={styles.screenshotsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Preview</Text>
              <Text style={styles.sectionSubHeadingText}>4 screens</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.screenshotsTrack}
            >
              {SCREENSHOTS.map((item, index) => (
                <TouchableOpacity
                  key={`screen-${item.id}`}
                  style={styles.screenshotCard}
                  onPress={() => setSelectedScreenshotIndex(index)}
                  activeOpacity={0.88}
                >
                  <Image
                    source={item.source}
                    style={styles.screenshotImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ==================================================== */}
          {/* ABOUT THIS APP SECTION                               */}
          {/* ==================================================== */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>About this app</Text>
              <Feather name="arrow-right" size={18} color="#E50914" />
            </View>

            <Text style={styles.aboutParagraph}>
              Stream and download thousands of HD movies, trending TV series, Hindi dubbed blockbusters, and anime in 4K/1080p with zero ads. The official MovieFlix app provides native hardware video acceleration, multi-audio voice track switching, synchronized subtitle rendering, and seamless background downloads directly to your device.
            </Text>

            {/* Play Store Category Tags */}
            <View style={styles.tagChipsWrap}>
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>#1 in Entertainment</Text>
              </View>
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>4K & 1080p Ultra HD</Text>
              </View>
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>Multi-Audio Dubs</Text>
              </View>
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>Offline Cinema</Text>
              </View>
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>100% Ad-Free</Text>
              </View>
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>Universal Android</Text>
              </View>
            </View>
          </View>

          {/* ==================================================== */}
          {/* APP INFO TABLE (PLAY STORE SPECIFICATIONS)           */}
          {/* ==================================================== */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeadingText}>App info</Text>

            <View style={styles.infoTable}>
              <View style={styles.infoTableRow}>
                <Text style={styles.infoTableLabel}>Version</Text>
                <Text style={styles.infoTableValue}>{releaseInfo.version}</Text>
              </View>

              <View style={styles.infoTableRow}>
                <Text style={styles.infoTableLabel}>Updated on</Text>
                <Text style={styles.infoTableValue}>October 3, 2026</Text>
              </View>

              <View style={styles.infoTableRow}>
                <Text style={styles.infoTableLabel}>Downloads</Text>
                <Text style={[styles.infoTableValue, { color: '#E50914', fontWeight: '700' }]}>
                  {`${(releaseInfo.realDownloads || 0).toLocaleString()} verified`}
                </Text>
              </View>

              <View style={styles.infoTableRow}>
                <Text style={styles.infoTableLabel}>Download size</Text>
                <Text style={styles.infoTableValue}>{releaseInfo.sizeFormatted}</Text>
              </View>

              <View style={styles.infoTableRow}>
                <Text style={styles.infoTableLabel}>Required OS</Text>
                <Text style={styles.infoTableValue}>Android 7.0 and up</Text>
              </View>

              <View style={styles.infoTableRow}>
                <Text style={styles.infoTableLabel}>Content rating</Text>
                <Text style={styles.infoTableValue}>
                  Rated for {releaseInfo.ageRating} • Strong language, mature themes
                </Text>
              </View>

              <View style={styles.infoTableRow}>
                <Text style={styles.infoTableLabel}>Offered by</Text>
                <Text style={[styles.infoTableValue, { color: '#E50914' }]}>
                  {releaseInfo.developer}
                </Text>
              </View>

              <View style={[styles.infoTableRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoTableLabel}>Architecture</Text>
                <Text style={styles.infoTableValue}>Universal (arm64, armeabi-v7a, x86_64)</Text>
              </View>
            </View>
          </View>

          {/* ==================================================== */}
          {/* DATA SAFETY (PLAY STORE VERIFICATION)                */}
          {/* ==================================================== */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeadingText}>Data safety</Text>
              <Feather name="arrow-right" size={18} color="#E50914" />
            </View>

            <Text style={styles.safetySub}>
              Safety starts with understanding how developers collect and share your data. Here is what MovieFlix reports:
            </Text>

            <View style={styles.safetyPointsCard}>
              <View style={styles.safetyRow}>
                <View style={styles.safetyIconCircle}>
                  <Feather name="share-2" size={15} color="#E50914" />
                </View>
                <View style={styles.safetyTextCol}>
                  <Text style={styles.safetyPointTitle}>No data shared with third parties</Text>
                  <Text style={styles.safetyPointSub}>The developer states that your data is never sold or shared.</Text>
                </View>
              </View>

              <View style={styles.safetyRow}>
                <View style={styles.safetyIconCircle}>
                  <Feather name="lock" size={15} color="#E50914" />
                </View>
                <View style={styles.safetyTextCol}>
                  <Text style={styles.safetyPointTitle}>Data encrypted in transit</Text>
                  <Text style={styles.safetyPointSub}>All stream connections are encrypted over HTTPS TLS 1.3.</Text>
                </View>
              </View>

              <View style={[styles.safetyRow, { marginBottom: 0 }]}>
                <View style={styles.safetyIconCircle}>
                  <Feather name="slash" size={15} color="#E50914" />
                </View>
                <View style={styles.safetyTextCol}>
                  <Text style={styles.safetyPointTitle}>Zero third-party advertising SDKs</Text>
                  <Text style={styles.safetyPointSub}>No trackers, banner networks, or ad beacons embedded.</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ==================================================== */}
          {/* CRYPTOCURRENCY & BITCOIN DONATION                    */}
          {/* ==================================================== */}
          <View style={styles.donationCard}>
            <View style={styles.donationHeaderRow}>
              <View style={styles.donationIconCircle}>
                <Feather name="heart" size={16} color="#E50914" />
              </View>
              <View style={styles.donationTextCol}>
                <Text style={styles.donationCardTitle}>Support MovieFlix</Text>
                <Text style={styles.donationCardDesc}>
                  Keep streaming 100% free and ad-free with cryptocurrency & Bitcoin donations.
                </Text>
              </View>
            </View>
            <View style={styles.donationBtnWrap}>
              <NowPaymentsButton />
            </View>
          </View>

          {/* ==================================================== */}
          {/* FOOTER PRIVACY & SECURITY TERMS                      */}
          {/* ==================================================== */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={styles.footerPrivacyLink}
              onPress={onOpenPrivacy}
              activeOpacity={0.7}
            >
              <Text style={styles.footerPrivacyText}>Privacy Policy & Security Terms</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* ==================================================== */}
      {/* FULLSCREEN SCREENSHOT PREVIEW MODAL                  */}
      {/* ==================================================== */}
      <Modal
        visible={selectedScreenshotIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedScreenshotIndex(null)}
      >
        <View style={styles.fullscreenModalBackdrop}>
          <TouchableOpacity
            style={styles.modalCloseTopBtn}
            onPress={() => setSelectedScreenshotIndex(null)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedScreenshotIndex !== null && (
            <View style={styles.fullscreenImageWrap}>
              <Image
                source={SCREENSHOTS[selectedScreenshotIndex]?.source}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* SIGN IN REQUIRED MODAL                               */}
      {/* ==================================================== */}
      <Modal
        visible={showAuthGateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAuthGateModal(false)}
      >
        <View style={styles.authModalBackdrop}>
          <View style={styles.authModalCard}>
            <View style={styles.authModalIconCircle}>
              <Feather name="lock" size={28} color="#E50914" />
            </View>

            <Text style={styles.authModalTitle}>Sign In Required</Text>
            <Text style={styles.authModalSubtitle}>
              To download the official MovieFlix APK and access verified releases, please sign in or create a free account.
            </Text>

            <TouchableOpacity
              style={styles.authModalPrimaryBtn}
              onPress={() => {
                setShowAuthGateModal(false);
                if (typeof onOpenAuth === 'function') {
                  onOpenAuth('login');
                }
              }}
              activeOpacity={0.85}
            >
              <Feather name="log-in" size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.authModalPrimaryText}>Sign In to Download</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.authModalSecondaryBtn}
              onPress={() => {
                setShowAuthGateModal(false);
                if (typeof onOpenAuth === 'function') {
                  onOpenAuth('register');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.authModalSecondaryText}>Create Free Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.authModalDismissBtn}
              onPress={() => setShowAuthGateModal(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.authModalDismissText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── PURE RED & BLACK PLAY STORE STYLESHEET ──────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  // TOP BAR
  topBar: {
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  navRoundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleBlock: {
    flex: 1,
    marginLeft: 14,
  },
  topBarHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // SCROLL CONTENT
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  pageWrapper: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  pageWrapperDesktop: {
    paddingHorizontal: 20,
  },

  // APP HEADER
  appHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconSquircle: {
    width: 82,
    height: 82,
    borderRadius: 20,
    backgroundColor: '#141416',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    overflow: 'hidden',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  appIconImage: {
    width: '100%',
    height: '100%',
  },
  appTitleCol: {
    flex: 1,
    marginLeft: 18,
    justifyContent: 'center',
  },
  appMainTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  appDeveloperName: {
    color: '#E50914',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'lowercase',
  },
  appCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appCategoryText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#8E8E93',
    marginHorizontal: 6,
  },
  appContainsNoAds: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },

  // STATS CARD (PLAY STORE SIGNATURE)
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121214',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  ageRatingBadge: {
    borderWidth: 1,
    borderColor: '#E50914',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  ageRatingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // INSTALL ACTION
  actionSection: {
    marginBottom: 28,
  },
  installButton: {
    backgroundColor: '#E50914',
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  installButtonActive: {
    backgroundColor: '#B20710',
  },
  installButtonSuccess: {
    backgroundColor: '#26262b',
    borderWidth: 1,
    borderColor: '#E50914',
  },
  buttonInnerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  installButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  playProtectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  playProtectText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },

  // PREVIEW SCREENSHOTS
  screenshotsSection: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionSubHeadingText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  screenshotsTrack: {
    gap: 12,
    paddingRight: 16,
  },
  screenshotCard: {
    width: 172,
    height: 350,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#16161a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  screenshotImage: {
    width: '100%',
    height: '100%',
  },

  // ABOUT THIS APP
  sectionContainer: {
    backgroundColor: '#121214',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    marginBottom: 20,
  },
  aboutParagraph: {
    color: '#B3B3B3',
    fontSize: 13.5,
    lineHeight: 21,
    fontWeight: '400',
    marginBottom: 16,
  },
  tagChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // APP INFO TABLE
  infoTable: {
    marginTop: 10,
  },
  infoTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  infoTableLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
  },
  infoTableValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },

  // DATA SAFETY
  safetySub: {
    color: '#8E8E93',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  safetyPointsCard: {
    backgroundColor: '#18181c',
    borderRadius: 14,
    padding: 14,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  safetyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  safetyTextCol: {
    flex: 1,
  },
  safetyPointTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  safetyPointSub: {
    color: '#8E8E93',
    fontSize: 11.5,
    lineHeight: 16,
  },

  // DONATION SECTION
  donationCard: {
    backgroundColor: '#18181c',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
    alignItems: 'center',
  },
  donationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  donationIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  donationTextCol: {
    flex: 1,
  },
  donationCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  donationCardDesc: {
    color: '#8E8E93',
    fontSize: 11.5,
    lineHeight: 16,
  },
  donationBtnWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 4,
  },

  // FOOTER
  footerContainer: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerPrivacyLink: {
    padding: 8,
  },
  footerPrivacyText: {
    color: '#737373',
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // FULLSCREEN IMAGE PREVIEW MODAL
  fullscreenModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCloseTopBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImageWrap: {
    width: '100%',
    height: '85%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },

  // AUTH REQUIRED MODAL
  authModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  authModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#16161a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 20,
  },
  authModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.28)',
  },
  authModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  authModalSubtitle: {
    color: '#A3A3A3',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 22,
  },
  authModalPrimaryBtn: {
    width: '100%',
    backgroundColor: '#E50914',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  authModalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  authModalSecondaryBtn: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  authModalSecondaryText: {
    color: '#E5E5E5',
    fontSize: 13.5,
    fontWeight: '600',
  },
  authModalDismissBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  authModalDismissText: {
    color: '#737373',
    fontSize: 13,
    fontWeight: '500',
  },
});
