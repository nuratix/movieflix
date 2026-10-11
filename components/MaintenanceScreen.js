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

export default function MaintenanceScreen({ onRefresh, isChecking }) {
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
        {/* Animated Brand Halo Icon */}
        <View style={styles.iconHalo}>
          <View style={styles.iconCircle}>
            <Feather name="tool" size={42} color="#E50914" />
          </View>
        </View>

        {/* Brand Tag */}
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>MOVIEFLIX SYSTEM STATUS</Text>
        </View>

        {/* Title & Body */}
        <Text style={styles.title}>Site Under Maintenance</Text>
        <Text style={styles.subtitle}>
          Our site is currently undergoing scheduled maintenance to upgrade streaming capacity and optimize performance.
        </Text>
        <Text style={styles.note}>
          Please check back shortly or try again later.
        </Text>

        {/* Status indicator pill */}
        <View style={styles.statusPill}>
          <View style={styles.statusPulseDot} />
          <Text style={styles.statusPillText}>Maintenance Mode Active</Text>
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
              <Feather name="refresh-cw" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.refreshButtonText}>
              {isChecking ? 'Checking System...' : 'Check Status'}
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
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.28)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 14,
  },
  brandBadgeText: {
    color: '#e50914',
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
    marginBottom: 10,
  },
  note: {
    color: '#71717a',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    marginBottom: 28,
  },
  statusPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#eab308',
    marginRight: 8,
  },
  statusPillText: {
    color: '#eab308',
    fontSize: 12,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 180,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
