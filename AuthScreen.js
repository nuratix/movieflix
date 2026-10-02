import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TiltedPostersBackground from './TiltedPostersBackground';

const BRAND_LOGO = require('./assets/movieflix_brand_logo.png');

export default function AuthScreen({
  initialMode = 'login',
  authError = '',
  authLoading = false,
  onSubmit,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const displayError = authError || localError;

  const handleSubmit = () => {
    setLocalError('');
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setLocalError('Please enter both email and password.');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (mode === 'register' && trimmedPassword.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }

    if (onSubmit) {
      onSubmit(trimmedEmail, trimmedPassword, mode);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0a0a0a" translucent />

      {/* Tilted Moving Posters Background */}
      <TiltedPostersBackground />

      {/* Close / Back to browse button */}
      {onClose && (
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 16 }]}
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 50, paddingBottom: insets.bottom + 30 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Floating Glass Card */}
          <View style={styles.card}>
            {/* Brand Logo */}
            <View style={styles.brandRow}>
              <Image
                source={BRAND_LOGO}
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
            </View>

            {/* Segment Switcher Tabs */}
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentTab, mode === 'login' && styles.segmentTabActive]}
                onPress={() => {
                  setMode('login');
                  setLocalError('');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentTab, mode === 'register' && styles.segmentTabActive]}
                onPress={() => {
                  setMode('register');
                  setLocalError('');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cardSubtitle}>
              {mode === 'login'
                ? 'Sign in with your email to start streaming'
                : 'Instant access — no email confirmation required'}
            </Text>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={16} color="#777" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#555"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setLocalError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={16} color="#777" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder={mode === 'register' ? 'Password (min 8 chars)' : 'Password'}
                placeholderTextColor="#555"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  setLocalError('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name={showPassword ? 'eye' : 'eye-off'} size={16} color="#777" />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {!!displayError && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#e50914" style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, authLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={authLoading}
              activeOpacity={0.88}
            >
              {authLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'Sign In' : 'Create Free Account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Bottom Toggle Note */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setLocalError('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleNote}>
                {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
                <Text style={styles.toggleHighlight}>
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
    height: Platform.OS === 'web' ? '100vh' : '100%',
    maxHeight: Platform.OS === 'web' ? '100vh' : '100%',
    width: '100%',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(20, 20, 24, 0.88)',
    borderRadius: 26,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
    elevation: 25,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandLogoImage: {
    width: 210,
    height: 44,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  segmentTabActive: {
    backgroundColor: '#e50914',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  segmentText: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  cardSubtitle: {
    color: '#8e8e93',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 34, 0.95)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    padding: 0,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
  },
  errorText: {
    color: '#e50914',
    fontSize: 13,
    flex: 1,
    lineHeight: 17,
  },
  submitBtn: {
    backgroundColor: '#e50914',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 18,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toggleRow: {
    alignItems: 'center',
  },
  toggleNote: {
    color: '#777',
    fontSize: 13,
  },
  toggleHighlight: {
    color: '#e50914',
    fontWeight: '700',
  },
});
