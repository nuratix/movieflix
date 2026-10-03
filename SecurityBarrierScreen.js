import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND_LOGO = require('./assets/header_icon.png');
const OFFICIAL_DOWNLOAD_URL = 'https://movieflix-pi-six.vercel.app/download';

export default function SecurityBarrierScreen({
  securityStatus,
  onReverify,
}) {
  const insets = useSafeAreaInsets();
  const [reverifying, setReverifying] = useState(false);

  const handleDownload = () => {
    Linking.openURL(OFFICIAL_DOWNLOAD_URL).catch(() => {});
  };

  const handleRecheck = async () => {
    if (reverifying || !onReverify) return;
    setReverifying(true);
    try {
      await onReverify();
    } finally {
      setReverifying(false);
    }
  };

  const detectionReason =
    securityStatus?.message ||
    'Unauthorized runtime code injection or package modification was detected.';
  const reasonCode = securityStatus?.reason || 'CODE_INJECTION_DETECTED';

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#070707" translucent />

      {/* Background Top Ambient Red Glow */}
      <View style={styles.topGlow} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets?.top || 0, 24) + 16,
            paddingBottom: Math.max(insets?.bottom || 0, 24) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <ExpoImage
            source={BRAND_LOGO}
            style={styles.logo}
            contentFit="contain"
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SECURITY INTEGRITY SYSTEM</Text>
          </View>
        </View>

        {/* Hero Warning Shield Visual */}
        <View style={styles.shieldWrapper}>
          <View style={styles.shieldPulseOuter}>
            <View style={styles.shieldPulseInner}>
              <Feather name="shield-off" size={48} color="#e50914" />
            </View>
          </View>
        </View>

        {/* Headline & Body */}
        <Text style={styles.title}>Unofficial App Detected</Text>
        <Text style={styles.subtitle}>
          Access to MovieFlix has been blocked. A modified, untrusted, or injected
          runtime environment was detected on this device.
        </Text>

        {/* Detection Details Box */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Feather
              name="alert-triangle"
              size={16}
              color="#ef4444"
              style={styles.detailIcon}
            />
            <View style={styles.detailTextWrapper}>
              <Text style={styles.detailLabel}>Security Violation</Text>
              <Text style={styles.detailValue}>
                {reasonCode === 'CODE_INJECTION_DETECTED'
                  ? 'Runtime Hook Injection (Frida / Xposed)'
                  : 'Untrusted Package Modification'}
              </Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Feather
              name="info"
              size={16}
              color="#f59e0b"
              style={styles.detailIcon}
            />
            <View style={styles.detailTextWrapper}>
              <Text style={styles.detailLabel}>Detection Details</Text>
              <Text style={styles.detailDesc}>{detectionReason}</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Feather
              name="lock"
              size={16}
              color="#9ca3af"
              style={styles.detailIcon}
            />
            <View style={styles.detailTextWrapper}>
              <Text style={styles.detailLabel}>Access Restriction</Text>
              <Text style={styles.detailDesc}>
                Home streaming, search, player, and account features are
                disabled to protect your credentials and streams.
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleDownload}
            activeOpacity={0.85}
          >
            <Feather
              name="download"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.primaryBtnText}>Download Official Version</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleRecheck}
            activeOpacity={0.7}
            disabled={reverifying}
          >
            {reverifying ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Feather
                name="refresh-cw"
                size={16}
                color="#b3b3b3"
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={styles.secondaryBtnText}>
              {reverifying ? 'Verifying...' : 'Re-verify App Integrity'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070707',
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    left: '10%',
    right: '10%',
    height: 320,
    backgroundColor: 'rgba(229, 9, 20, 0.22)',
    borderRadius: 200,
    filter: Platform.OS === 'web' ? 'blur(90px)' : undefined,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 140,
    height: 36,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderColor: 'rgba(229, 9, 20, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#e50914',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  shieldWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldPulseOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
  },
  shieldPulseInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(229, 9, 20, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.5)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    color: '#a3a3a3',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 26,
    paddingHorizontal: 8,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: 'rgba(18, 18, 22, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 16,
    marginBottom: 28,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  detailTextWrapper: {
    flex: 1,
  },
  detailLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  detailDesc: {
    color: '#e5e5e5',
    fontSize: 12,
    lineHeight: 18,
  },
  detailDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: '#e50914',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#d4d4d4',
    fontSize: 14,
    fontWeight: '600',
  },
});
