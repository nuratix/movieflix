import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  fetchTelegramUserCode,
  getTelegramBotUrl,
  simulateSandboxPayment,
  formatExpirationDate,
} from '../subscriptionService';

export default function SubscriptionModal({
  visible,
  onClose,
  authUser,
  authAccessToken,
  subscriptionStatus,
  onSubscriptionUpdated,
  onOpenAuth,
}) {
  const [selectedPlan, setSelectedPlan] = useState('3_months'); // default to most popular
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [userCode, setUserCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (visible) {
      setErrorMessage('');
      setSuccessInfo(null);
      if (authAccessToken || authUser?.email) {
        fetchTelegramUserCode(authAccessToken, authUser?.email)
          .then((d) => {
            if (d?.code) setUserCode(d.code);
          })
          .catch((e) => console.warn('Modal code fetch note:', e.message));
      }
    }
  }, [visible, authAccessToken, authUser?.email]);

  const isPremium = Boolean(subscriptionStatus?.is_premium);
  const daysLeft = subscriptionStatus?.days_left || 0;
  const expiresAtFormatted = formatExpirationDate(subscriptionStatus?.expires_at);

  const plans = [
    {
      id: '1_month',
      name: '1 Month',
      price: '$1',
      stars: 50,
      unit: '/ 30 days',
      badge: 'Starter',
      desc: '30 days 4K Ultra HD & zero ads (50 Stars)',
      highlight: false,
    },
    {
      id: '3_months',
      name: '3 Months',
      price: '$3',
      stars: 150,
      unit: '/ 90 days',
      badge: 'Most Popular',
      desc: '90 days 4K Ultra HD & zero ads (150 Stars)',
      highlight: true,
    },
    {
      id: '6_months',
      name: '6 Months',
      price: '$5',
      stars: 250,
      unit: '/ 180 days',
      badge: 'Save 17%',
      desc: '180 days best value VIP cinema (250 Stars)',
      highlight: false,
    },
  ];

  const handleCopyCode = async () => {
    if (!userCode) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(userCode);
      }
    } catch (_) {}
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  const handleSubscribe = async () => {
    if (!authUser && !authAccessToken) {
      onClose();
      if (typeof onOpenAuth === 'function') {
        onOpenAuth('login');
      }
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const botUrl = getTelegramBotUrl(userCode);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(botUrl, '_blank');
      } else {
        await Linking.openURL(botUrl);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Could not open Telegram bot.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    setSimulating(true);
    setErrorMessage('');
    try {
      const res = await simulateSandboxPayment(`mf_ord_sim_${Date.now()}`, authAccessToken);
      setSuccessInfo(res);
      if (typeof onSubscriptionUpdated === 'function') {
        onSubscriptionUpdated({
          is_premium: true,
          plan_name: 'Movieflix Pro',
          expires_at: res.expiresAt,
          days_left: 30,
        });
      }
    } catch (err) {
      setErrorMessage(err.message || 'Sandbox simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <LinearGradient
            colors={['#1c1917', '#0c0a09']}
            style={styles.headerGradient}
          >
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="x" size={20} color="#a8a29e" />
            </TouchableOpacity>

            <View style={styles.crownWrap}>
              <MaterialCommunityIcons name="crown" size={32} color="#e50914" />
            </View>

            <Text style={styles.modalTitle}>Movieflix Pro</Text>
            <Text style={styles.modalSubtitle}>
              Stream 4K Ultra HD · 100% Zero Ads · VIP Episodes
            </Text>

            {isPremium && (
              <View style={styles.activeBanner}>
                <Feather name="check-circle" size={14} color="#10b981" />
                <Text style={styles.activeBannerText}>
                  Active · {daysLeft} days left (until {expiresAtFormatted})
                </Text>
              </View>
            )}
          </LinearGradient>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* Account ID Link Box */}
            {authUser && (
              <View style={styles.accountBox}>
                <View style={styles.accountBoxTop}>
                  <Text style={styles.accountBoxLabel}>YOUR 6-DIGIT ACCOUNT ID</Text>
                  <Text style={styles.accountBoxEmail}>{authUser.email}</Text>
                </View>
                <View style={styles.accountCodeRow}>
                  <Text style={styles.codeDigits}>
                    {userCode ? userCode.split('').join('  ') : '— — — — — —'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.copyBtn, copiedCode && styles.copyBtnSuccess]}
                    onPress={handleCopyCode}
                    disabled={!userCode}
                  >
                    <Feather name={copiedCode ? 'check' : 'copy'} size={14} color="#fff" />
                    <Text style={styles.copyBtnText}>{copiedCode ? 'Copied' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={15} color="#ef4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Success Message */}
            {successInfo ? (
              <View style={styles.successBox}>
                <Feather name="check-circle" size={16} color="#10b981" />
                <Text style={styles.successText}>
                  🎉 Movieflix Pro activated successfully!
                </Text>
              </View>
            ) : null}

            {/* Plans List */}
            <View style={styles.plansContainer}>
              {plans.map((p) => {
                const isSelected = selectedPlan === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                      p.highlight && styles.planCardHighlight,
                    ]}
                    onPress={() => setSelectedPlan(p.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.planCardTop}>
                      <View style={styles.planRadioRow}>
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.planName}>{p.name}</Text>
                        <View style={styles.planBadge}>
                          <Text style={styles.planBadgeText}>{p.badge}</Text>
                        </View>
                      </View>

                      <View style={styles.starsWrap}>
                        <Text style={styles.starsText}>⭐️ {p.stars} Stars</Text>
                        <Text style={styles.starsSub}>({p.price} USD)</Text>
                      </View>
                    </View>
                    <Text style={styles.planDesc}>{p.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sandbox Simulation Button */}
            <TouchableOpacity
              style={styles.sandboxBtn}
              onPress={handleSimulatePayment}
              disabled={simulating}
              activeOpacity={0.85}
            >
              {simulating ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <>
                  <Feather name="zap" size={14} color="#10b981" />
                  <Text style={styles.sandboxBtnText}>
                    Free Instant Test ($0.00 Sandbox)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            {!authUser ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  onClose();
                  if (typeof onOpenAuth === 'function') onOpenAuth('login');
                }}
                activeOpacity={0.85}
              >
                <Feather name="log-in" size={16} color="#000" />
                <Text style={styles.actionBtnText}>Sign In to Subscribe</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.telegramBtn, loading && styles.actionBtnDisabled]}
                onPress={handleSubscribe}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <FontAwesome5 name="telegram-plane" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.telegramBtnText}>
                      Pay with Telegram Stars ⭐️
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  headerGradient: {
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  crownWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#a8a29e',
    marginTop: 4,
    textAlign: 'center',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 10,
    gap: 6,
  },
  activeBannerText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  bodyScroll: {
    maxHeight: 460,
  },
  bodyContent: {
    padding: 20,
  },
  accountBox: {
    backgroundColor: 'rgba(229, 9, 20, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  accountBoxTop: {
    marginBottom: 6,
  },
  accountBoxLabel: {
    color: '#a3a3a3',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  accountBoxEmail: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  accountCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  codeDigits: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  copyBtnSuccess: {
    backgroundColor: '#10b981',
  },
  copyBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  successText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  plansContainer: {
    gap: 10,
    marginBottom: 14,
  },
  planCard: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  planCardSelected: {
    borderColor: '#e50914',
    backgroundColor: 'rgba(229, 9, 20, 0.04)',
  },
  planCardHighlight: {
    borderColor: 'rgba(229, 9, 20, 0.4)',
  },
  planCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#78716c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#e50914',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e50914',
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  planBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e50914',
  },
  starsWrap: {
    alignItems: 'flex-end',
  },
  starsText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FBBF24',
  },
  starsSub: {
    fontSize: 11,
    color: '#a8a29e',
  },
  planDesc: {
    fontSize: 12,
    color: '#a8a29e',
    marginLeft: 28,
  },
  sandboxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    gap: 6,
    marginBottom: 4,
  },
  sandboxBtnText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0c0a09',
  },
  actionBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  telegramBtn: {
    backgroundColor: '#2AABEE',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  telegramBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
