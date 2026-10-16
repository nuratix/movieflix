import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const PRIVACY_POLICY_URL = 'https://mws.wallpaperdomain.xyz/privacy';

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

      {/* Clean Minimal Top Header Bar */}
      <View style={[styles.headerBar, { paddingTop: topInset + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>MovieFlix</Text>

          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* Clean Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 36 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Title Header */}
          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>Privacy Policy</Text>
            <Text style={styles.pageSubtitle}>
              Last updated: October 2026 · Built on 100% User Privacy
            </Text>
            <Text style={styles.statementText}>
              MovieFlix is built on a simple promise: we do not collect, track, monetize, or sell your personal data. Your entertainment belongs to you, and your activity remains strictly on your device.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Section 1 */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>1. Zero Personal Data Collected</Text>
            <Text style={styles.paragraph}>
              We do not request, collect, or store personal information. Specifically:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>No Names or IDs:</Text> We never ask for your real name, identity documents, or government IDs.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>No Phone Numbers or Contacts:</Text> We do not require or access your phone number or contacts list.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>No Financial Data:</Text> We do not collect or store credit cards, bank accounts, or financial payment credentials.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>No Precise Location Tracking:</Text> We do not track or request your GPS or cellular location.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>No Hardware Fingerprinting:</Text> We do not collect IMEI numbers, MAC addresses, or hardware serials.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section 2 */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>2. Minimal Account Credentials (Optional)</Text>
            <Text style={styles.paragraph}>
              Creating an account is completely optional. If you choose to register:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Email Address:</Text> Stored only as your account identifier for sign-in and session recovery. We never send marketing emails or sell your email.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Encrypted Passwords:</Text> Passwords are cryptographically salted and hashed. We cannot view your plain-text password.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section 3 */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>3. 100% Local Device Storage</Text>
            <Text style={styles.paragraph}>
              All user preferences and media state operate on a local-first model:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Watch History &amp; Progress:</Text> Stored locally in your device sandbox (AsyncStorage / local storage). This data is never uploaded to analytics servers.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>My List:</Text> Your saved favorites live only on your physical device.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Offline Downloads (Mobile App):</Text> Downloaded media files are stored locally in your app&apos;s isolated directory and are completely inaccessible to external servers.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section 4 */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>4. Safe &amp; Anonymous Streaming</Text>
            <Text style={styles.paragraph}>
              All video streams are transmitted through encrypted HTTPS connections. MovieFlix does not log, monitor, or profile which movies or TV series you watch.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Section 5 */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>5. Zero Third-Party Tracking & Surveillance</Text>
            <Text style={styles.paragraph}>
              We do not integrate surveillance tracking SDKs, Facebook Pixel, or cross-app analytics surveillance. We do not sell, trade, or share user activity with data brokers.
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Section 6 */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>6. User Control &amp; Data Deletion</Text>
            <Text style={styles.paragraph}>
              You retain full control over all your data:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Clear History:</Text> Tap &quot;Clear All&quot; in the Watch History tab to wipe all watch history from your device.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Delete Downloads:</Text> Remove any downloaded video instantly with a single tap.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={styles.boldText}>Sign Out / Uninstall:</Text> Signing out or uninstalling the app purges all local storage immediately.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Section 7 */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>7. Public Verification</Text>
            <Text style={styles.paragraph}>
              This Privacy Policy is publicly hosted and verifiable online at our official website:
            </Text>
            <TouchableOpacity
              style={styles.cleanActionCard}
              onPress={handleExternalLink}
              activeOpacity={0.75}
            >
              <Text style={styles.cleanActionTitle}>{PRIVACY_POLICY_URL}</Text>
              {!isWeb && (
                <Text style={styles.cleanActionSub}>Opens in your device browser</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Minimal Return Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.minimalReturnBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.minimalReturnBtnText}>Return to MovieFlix</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    width: '100%',
    height: Platform.OS === 'web' ? '100vh' : '100%',
  },
  headerBar: {
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#171717',
  },
  backBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  contentWrapper: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  titleSection: {
    marginBottom: 20,
  },
  pageTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    color: '#71717a',
    fontSize: 13,
    marginBottom: 14,
  },
  statementText: {
    color: '#d4d4d8',
    fontSize: 14,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#1f1f23',
    marginVertical: 18,
  },
  sectionBlock: {
    marginBottom: 4,
  },
  sectionHeading: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  paragraph: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  bulletList: {
    gap: 8,
    marginTop: 4,
  },
  bulletItem: {
    color: '#a1a1aa',
    fontSize: 13.5,
    lineHeight: 20,
  },
  boldText: {
    color: '#f4f4f5',
    fontWeight: '600',
  },
  cleanActionCard: {
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#26262b',
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
  },
  cleanActionTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600',
  },
  cleanActionSub: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 2,
  },
  bottomBar: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1c1c1e',
    alignItems: 'center',
  },
  minimalReturnBtn: {
    backgroundColor: '#e50914',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  minimalReturnBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
