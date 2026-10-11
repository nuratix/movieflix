import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NowPaymentsButton from './NowPaymentsButton';

export default function ServerCrashDonateScreen({ onRefresh, isChecking }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070707" translucent />
      <View
        style={[
          styles.contentWrapper,
          {
            paddingTop: Math.max(insets.top, 24) + 20,
            paddingBottom: Math.max(insets.bottom, 24) + 20,
            maxWidth: isDesktop ? 540 : '100%',
          },
        ]}
      >
        {/* Animated Server Alert Icon */}
        <View style={styles.iconHalo}>
          <View style={styles.iconCircle}>
            <Feather name="alert-triangle" size={42} color="#E50914" />
          </View>
        </View>

        {/* Brand Tag */}
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>SERVER EMERGENCY ALERT</Text>
        </View>

        {/* Title & Body */}
        <Text style={styles.title}>Our Server Has Crashed</Text>
        <Text style={styles.subtitle}>
          Due to unexpected heavy traffic and infrastructure costs, our streaming servers went down.
        </Text>
        <Text style={styles.urgentNote}>
          Please donate to help us keep MovieFlix alive for everyone! Every cryptocurrency contribution directly restores high-speed servers and prevents shutdowns.
        </Text>

        {/* NOWPayments Donation Card */}
        <View style={styles.donationCard}>
          <View style={styles.donationHeader}>
            <View style={styles.heartCircle}>
              <Feather name="heart" size={18} color="#E50914" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.donationTitle}>Support Community Servers</Text>
              <Text style={styles.donationSub}>Instant crypto donations via Bitcoin & 300+ coins</Text>
            </View>
          </View>

          <View style={styles.donationBtnWrap}>
            <NowPaymentsButton />
          </View>
        </View>

        {/* Refresh / Check Status Button */}
        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.85}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Feather name="refresh-cw" size={15} color="#d4d4d8" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.refreshButtonText}>
              {isChecking ? 'Checking Server Status...' : 'Check If Server Is Back'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070707',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  iconHalo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#121216',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 14,
  },
  brandBadgeText: {
    color: '#ef4444',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#d4d4d8',
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  urgentNote: {
    color: '#f87171',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  donationCard: {
    width: '100%',
    backgroundColor: '#111115',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    padding: 18,
    marginBottom: 24,
    alignItems: 'center',
  },
  donationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
  },
  heartCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  donationTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  donationSub: {
    color: '#a1a1aa',
    fontSize: 11.5,
    lineHeight: 16,
  },
  donationBtnWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 6,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 200,
  },
  refreshButtonText: {
    color: '#e4e4e7',
    fontSize: 13.5,
    fontWeight: '600',
  },
});
