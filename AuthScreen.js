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
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND_LOGO = require('./assets/movieflix_brand_logo.png');

export default function AuthScreen({
  initialMode = 'login',
  authError = '',
  authLoading = false,
  onSubmit,
  onClose,
  onOpenPrivacy,
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

  const handlePrivacyPress = () => {
    if (onOpenPrivacy) {
      onOpenPrivacy();
    } else if (Platform.OS !== 'web') {
      Linking.openURL('https://movieflix-pi-six.vercel.app/privacy').catch(() => {});
    }
  };

  const topInset = Math.max(insets?.top || 0, Platform.OS === 'android' ? 24 : 16);
  const bottomInset = Math.max(insets?.bottom || 0, 16);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

      {/* Atmospheric Red Shine Glow */}
      <View style={styles.topRedShine} pointerEvents="none">
        <LinearGradient
          colors={[
            'rgba(229, 9, 20, 0.35)',
            'rgba(229, 9, 20, 0.14)',
            'rgba(229, 9, 20, 0.03)',
            'rgba(0, 0, 0, 0)',
          ]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.redGlowOrb} />
      </View>

      {/* Top Header Bar */}
      <View style={[styles.headerBar, { paddingTop: topInset + 8 }]}>
        {onClose ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={24} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        <Image
          source={BRAND_LOGO}
          style={styles.headerLogo}
          resizeMode="contain"
        />

        <View style={styles.backBtnPlaceholder} />
      </View>

      {/* Main Full-Screen Form */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomInset + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            {/* Title & Subtitle */}
            <Text style={styles.title}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in with your email to start streaming'
                : 'Watch unlimited movies, TV shows, and series'}
            </Text>

            {/* Segment Switcher */}
            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, mode === 'login' && styles.segmentBtnActive]}
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
                style={[styles.segmentBtn, mode === 'register' && styles.segmentBtnActive]}
                onPress={() => {
                  setMode('register');
                  setLocalError('');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputBox}>
                <Feather name="mail" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
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
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputBox}>
                <Feather name="lock" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
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
                  style={styles.eyeBtn}
                >
                  <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Banner */}
            {!!displayError && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#e50914" style={{ marginRight: 8, marginTop: 1 }} />
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
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'Sign In' : 'Create Free Account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Mode Switch Helper */}
            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setLocalError('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.switchNote}>
                {mode === 'login' ? "New to MovieFlix? " : 'Already have an account? '}
                <Text style={styles.switchHighlight}>
                  {mode === 'login' ? 'Sign up now' : 'Sign in'}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Privacy Policy Assurance */}
            <TouchableOpacity
              style={styles.privacyRow}
              onPress={handlePrivacyPress}
              activeOpacity={0.7}
            >
              <Feather name="shield" size={12} color="#10b981" style={{ marginRight: 5 }} />
              <Text style={styles.privacyNote}>
                Zero data collected · <Text style={styles.privacyHighlight}>Privacy Policy</Text>
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
    backgroundColor: '#000000',
    width: '100%',
    height: Platform.OS === 'web' ? '100vh' : '100%',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#000000',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  headerLogo: {
    width: 170,
    height: 38,
  },
  keyboardView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  formContainer: {
    width: '100%',
    maxWidth: 420,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    lineHeight: 20,
    marginBottom: 24,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#16161a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#242428',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: '#e50914',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8e8e93',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cccccc',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#25252a',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: '#e50914',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 20,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  switchRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchNote: {
    fontSize: 14,
    color: '#8e8e93',
  },
  switchHighlight: {
    color: '#ffffff',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 6,
  },
  privacyNote: {
    fontSize: 12,
    color: '#737373',
  },
  privacyHighlight: {
    color: '#a3a3a3',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  topRedShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 420,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  redGlowOrb: {
    position: 'absolute',
    top: -110,
    alignSelf: 'center',
    width: 360,
    height: 240,
    borderRadius: 180,
    backgroundColor: 'rgba(229, 9, 20, 0.28)',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 35 },
    shadowOpacity: 0.9,
    shadowRadius: 85,
    elevation: 25,
  },
});
