import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Image,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND_LOGO = require('./assets/movieflix_brand_logo.png');
export const PRIVACY_POLICY_URL = 'https://movieflix-pi-six.vercel.app/privacy';

export default function PrivacyScreen({ onClose }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const topInset = Math.max(insets?.top || 0, Platform.OS === 'android' ? 24 : 16);
  const bottomInset = Math.max(insets?.bottom || 0, 24);

  const handleExternalLink = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch((err) => {
      console.warn('Could not open privacy URL:', err);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

      {/* Top Header Bar */}
      <View style={[styles.headerBar, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          <Image source={BRAND_LOGO} style={styles.headerLogo} resizeMode="contain" />

          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* Scrollable Privacy Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Hero Banner */}
          <View style={styles.heroSection}>
            <View style={styles.shieldBadge}>
              <Feather name="shield" size={18} color="#10b981" />
              <Text style={styles.shieldBadgeText}>ZERO PERSONAL DATA COLLECTED</Text>
            </View>

            <Text style={styles.pageTitle}>Privacy Policy</Text>
            <Text style={styles.pageSubtitle}>
              Last updated: October 2026 · Committed to 100% User Privacy
            </Text>

            <View style={styles.calloutCard}>
              <View style={styles.calloutIconCircle}>
                <Feather name="lock" size={24} color="#10b981" />
              </View>
              <View style={styles.calloutTextCol}>
                <Text style={styles.calloutTitle}>Your Privacy Is Absolute</Text>
                <Text style={styles.calloutDesc}>
                  MovieFlix is engineered from the ground up to protect you. We do{' '}
                  <Text style={styles.boldWhite}>NOT</Text> track you, we do{' '}
                  <Text style={styles.boldWhite}>NOT</Text> sell your data, we do{' '}
                  <Text style={styles.boldWhite}>NOT</Text> collect personal identifiers, and we
                  do <Text style={styles.boldWhite}>NOT</Text> profile your streaming activity.
                </Text>
              </View>
            </View>
          </View>

          {/* Core Highlights Grid */}
          <View style={styles.highlightsGrid}>
            <View style={styles.highlightCard}>
              <View style={[styles.highlightIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Feather name="user-x" size={20} color="#ef4444" />
              </View>
              <Text style={styles.highlightTitle}>No Personal Info</Text>
              <Text style={styles.highlightDesc}>
                No names, no phone numbers, no physical addresses, no billing or payment cards.
              </Text>
            </View>

            <View style={styles.highlightCard}>
              <View style={[styles.highlightIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Feather name="hard-drive" size={20} color="#10b981" />
              </View>
              <Text style={styles.highlightTitle}>100% Local Storage</Text>
              <Text style={styles.highlightDesc}>
                Watch history, continue watching, and offline downloads stay strictly on your device.
              </Text>
            </View>

            <View style={styles.highlightCard}>
              <View style={[styles.highlightIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Feather name="eye-off" size={20} color="#3b82f6" />
              </View>
              <Text style={styles.highlightTitle}>Zero Tracking</Text>
              <Text style={styles.highlightDesc}>
                No third-party advertising trackers, no surveillance cookies, and no data brokers.
              </Text>
            </View>

            <View style={styles.highlightCard}>
              <View style={[styles.highlightIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Feather name="check-circle" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.highlightTitle}>Full User Control</Text>
              <Text style={styles.highlightDesc}>
                Clear your history, delete offline downloads, or log out anytime with a single tap.
              </Text>
            </View>
          </View>

          {/* Section 1 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionNumberBadge}>
                <Text style={styles.sectionNumberText}>1</Text>
              </View>
              <Text style={styles.sectionTitle}>Information We DO NOT Collect</Text>
            </View>
            <Text style={styles.paragraph}>
              Unlike most commercial streaming and media services, MovieFlix does not gather or store
              sensitive personal data. Specifically:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Feather name="x" size={16} color="#ef4444" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>No Real Names:</Text> We do not ask for, record, or
                  store your real name or identity documents.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="x" size={16} color="#ef4444" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>No Phone Numbers or Contacts:</Text> We never
                  request access to your address book, contacts, or phone number.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="x" size={16} color="#ef4444" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>No Financial or Billing Data:</Text> MovieFlix is
                  free. We never collect credit cards, debit cards, bank accounts, or billing
                  addresses.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="x" size={16} color="#ef4444" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>No Precise Location Data:</Text> We never access
                  your GPS, cellular tower positioning, or precise location sensors.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="x" size={16} color="#ef4444" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>No Hardware Fingerprinting:</Text> We do not collect
                  IMEI numbers, MAC addresses, or persistent hardware identifiers to profile you.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 2 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionNumberBadge}>
                <Text style={styles.sectionNumberText}>2</Text>
              </View>
              <Text style={styles.sectionTitle}>Minimal Account Usage (Optional)</Text>
            </View>
            <Text style={styles.paragraph}>
              Account creation is entirely optional. If you choose to create an account, we collect
              the absolute bare minimum required to enable multi-device authentication:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Feather name="check" size={16} color="#10b981" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>Email Address:</Text> Used solely as your account
                  login identifier and session recovery. We never send marketing spam or sell your
                  email.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="check" size={16} color="#10b981" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>Encrypted Password Hash:</Text> Passwords are
                  hashed with industry-standard cryptographic salts before storage. We can never see
                  your plain-text password.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 3 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionNumberBadge}>
                <Text style={styles.sectionNumberText}>3</Text>
              </View>
              <Text style={styles.sectionTitle}>100% Local Device Storage</Text>
            </View>
            <Text style={styles.paragraph}>
              MovieFlix operates on a local-first philosophy. Your private viewing data stays right
              inside your device sandbox:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Feather name="corner-down-right" size={15} color="#e50914" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>Watch History &amp; Progress:</Text> Stored locally
                  via encrypted device storage (AsyncStorage on mobile, localStorage in browser). It is
                  never transmitted to analytics servers.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="corner-down-right" size={15} color="#e50914" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>My List Bookmarks:</Text> Saved locally on your device
                  for instant access without external profiling.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="corner-down-right" size={15} color="#e50914" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>Offline Downloads (Mobile App):</Text> Downloaded
                  videos and subtitle files are saved directly in your device’s isolated app sandbox.
                  No external entity has access to your local media.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 4 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionNumberBadge}>
                <Text style={styles.sectionNumberText}>4</Text>
              </View>
              <Text style={styles.sectionTitle}>Safe &amp; Anonymous Streaming</Text>
            </View>
            <Text style={styles.paragraph}>
              All content streaming is transmitted over encrypted HTTPS/TLS protocols directly from
              public video distribution networks. MovieFlix does not inspect, log, or sell your
              stream data. We do not monitor which specific movies or episodes you watch.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionNumberBadge}>
                <Text style={styles.sectionNumberText}>5</Text>
              </View>
              <Text style={styles.sectionTitle}>Zero Third-Party Advertising Trackers</Text>
            </View>
            <Text style={styles.paragraph}>
              We do not include advertising SDKs, cross-app trackers, Facebook Pixel, or Google
              AdSense surveillance tools in our software. You can watch movies without third-party
              marketing firms profiling your digital footprint.
            </Text>
          </View>

          {/* Section 6 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionNumberBadge}>
                <Text style={styles.sectionNumberText}>6</Text>
              </View>
              <Text style={styles.sectionTitle}>Your Rights &amp; Data Deletion</Text>
            </View>
            <Text style={styles.paragraph}>
              You have complete ownership over your data at all times:
            </Text>
            <View style={styles.bulletList}>
              <View style={styles.bulletRow}>
                <Feather name="trash-2" size={15} color="#10b981" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>Clear All History:</Text> Tap &quot;Clear All&quot; in
                  the Watch History tab to permanently wipe all stored history from your device.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="trash-2" size={15} color="#10b981" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>Remove Downloads:</Text> Delete any downloaded title
                  instantly with the trash icon.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="log-out" size={15} color="#10b981" style={styles.bulletIcon} />
                <Text style={styles.bulletText}>
                  <Text style={styles.boldWhite}>Sign Out / Uninstall:</Text> Signing out or
                  uninstalling the app purges all local cached data immediately.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 7 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionNumberBadge}>
                <Text style={styles.sectionNumberText}>7</Text>
              </View>
              <Text style={styles.sectionTitle}>Public Website Verification</Text>
            </View>
            <Text style={styles.paragraph}>
              This Privacy Policy is publicly hosted and verifiable online at our official website:
            </Text>
            <TouchableOpacity
              style={styles.websiteLinkCard}
              onPress={handleExternalLink}
              activeOpacity={0.8}
            >
              <Feather name="globe" size={18} color="#e50914" style={{ marginRight: 10 }} />
              <Text style={styles.websiteLinkText}>{PRIVACY_POLICY_URL}</Text>
              <Feather name="external-link" size={16} color="#737373" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            {!isWeb && (
              <Text style={styles.nativeNotice}>
                Note: In the mobile APK, tapping the Privacy Policy button opens this official link in
                your device&apos;s external web browser.
              </Text>
            )}
          </View>

          {/* Bottom Action Button */}
          <View style={styles.bottomActionBox}>
            <TouchableOpacity
              style={styles.returnBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Feather name="arrow-left" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.returnBtnText}>Return to MovieFlix</Text>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              MovieFlix · Free Movies &amp; TV Series Without Surveillance
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
    width: '100%',
    height: Platform.OS === 'web' ? '100vh' : '100%',
  },
  headerBar: {
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  headerLogo: {
    width: 110,
    height: 30,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  contentWrapper: {
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    marginBottom: 24,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  shieldBadgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  pageSubtitle: {
    color: '#a3a3a3',
    fontSize: 14,
    marginBottom: 16,
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  calloutIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  calloutTextCol: {
    flex: 1,
  },
  calloutTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  calloutDesc: {
    color: '#d4d4d8',
    fontSize: 13,
    lineHeight: 19,
  },
  boldWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  highlightCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    padding: 14,
  },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  highlightTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  highlightDesc: {
    color: '#8e8e93',
    fontSize: 12,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e50914',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  paragraph: {
    color: '#a3a3a3',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  bulletList: {
    marginTop: 6,
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletIcon: {
    marginTop: 3,
    marginRight: 8,
    flexShrink: 0,
  },
  bulletText: {
    color: '#a3a3a3',
    fontSize: 13.5,
    lineHeight: 19,
    flex: 1,
  },
  websiteLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  websiteLinkText: {
    color: '#e50914',
    fontSize: 13,
    fontWeight: '600',
  },
  nativeNotice: {
    color: '#737373',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
  bottomActionBox: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 12,
  },
  returnBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerNote: {
    color: '#52525b',
    fontSize: 12,
    textAlign: 'center',
  },
});
