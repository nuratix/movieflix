import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotFoundScreen({ path = '', onGoHome, onOpenDownload }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets?.top || 0, Platform.OS === 'android' ? 24 : 16);
  const bottomInset = Math.max(insets?.bottom || 0, 24);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent />

      {/* Top Header Bar */}
      <View style={[styles.headerBar, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.headerHomeBtn}
            onPress={onGoHome}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.headerHomeBtnText}>Home</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>MovieFlix</Text>

          <TouchableOpacity
            style={styles.headerApkBtn}
            onPress={onOpenDownload}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-android" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.headerApkBtnText}>APK</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Centered Minimal 404 Content */}
      <ScrollView
        contentContainerStyle={[styles.contentWrap, { paddingBottom: bottomInset + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.badge404}>
            <Text style={styles.number404}>404</Text>
          </View>

          <Text style={styles.title}>Page Not Found</Text>

          <Text style={styles.desc}>
            The link you followed may be broken, or the title or page has been removed.
          </Text>

          {path ? (
            <View style={styles.pathPill}>
              <Feather name="alert-circle" size={13} color="#888888" style={{ marginRight: 6 }} />
              <Text style={styles.pathText} numberOfLines={1}>
                {path}
              </Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onGoHome}
              activeOpacity={0.85}
            >
              <Feather name="home" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Go to Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onOpenDownload}
              activeOpacity={0.85}
            >
              <Feather name="download" size={15} color="#e50914" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryBtnText}>Get Android APK</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Stream free HD movies & series on MovieFlix with zero ads
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerBar: {
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  headerHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#e50914',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headerApkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  headerApkBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  contentWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: 'rgba(18, 18, 18, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  badge404: {
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 8,
    marginBottom: 16,
  },
  number404: {
    color: '#e50914',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  desc: {
    color: '#999999',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  pathPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 24,
    maxWidth: '90%',
  },
  pathText: {
    color: '#777777',
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
  },
  actionRow: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  footerNote: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  footerText: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
  },
});
