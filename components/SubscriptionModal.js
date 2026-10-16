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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createSubscriptionInvoice,
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
  const [pendingOrder, setPendingOrder] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (visible) {
      setErrorMessage('');
      setPendingOrder(null);
      setSuccessInfo(null);
    }
  }, [visible]);

  const isPremium = Boolean(subscriptionStatus?.is_premium);
  const daysLeft = subscriptionStatus?.days_left || 0;
  const expiresAtFormatted = formatExpirationDate(subscriptionStatus?.expires_at);

  const plans = [
    {
      id: '1_month',
      name: '1 Month',
      price: '$1',
      unit: '/ 30 days',
      badge: 'Starter',
      badgeBg: 'rgba(255, 255, 255, 0.1)',
      desc: '30 days completely ad-free streaming & downloads.',
      highlight: false,
    },
    {
      id: '3_months',
      name: '3 Months',
      price: '$3',
      unit: '/ 90 days',
      badge: 'Most Popular',
      badgeBg: 'linear-gradient(135deg, #e50914, #b91c1c)',
      desc: '90 days ad-free uninterrupted PRO access.',
      highlight: true,
    },
    {
      id: '6_months',
      name: '6 Months',
      price: '$5',
      unit: '/ 180 days',
      badge: 'Save 17%',
      badgeBg: 'linear-gradient(135deg, #10b981, #059669)',
      desc: 'Best value! 180 days of premium ad-free cinema.',
      highlight: false,
    },
  ];

  const handleSubscribe = async () => {
    if (!authUser || !authAccessToken) {
      onClose();
      if (typeof onOpenAuth === 'function') {
        onOpenAuth('login');
      }
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const result = await createSubscriptionInvoice(selectedPlan, authAccessToken);
      setPendingOrder(result);

      if (result.invoiceUrl) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Open NOWPayments hosted checkout
          window.open(result.invoiceUrl, '_blank');
        } else {
          Linking.openURL(result.invoiceUrl).catch(() => {});
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create payment invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!pendingOrder?.orderId) return;
    setSimulating(true);
    setErrorMessage('');
    try {
      const res = await simulateSandboxPayment(pendingOrder.orderId, authAccessToken);
      setSuccessInfo(res);
      setPendingOrder(null);
      if (typeof onSubscriptionUpdated === 'function') {
        onSubscriptionUpdated();
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

            <Text style={styles.title}>
              {isPremium ? 'Extend Ad-Free PRO' : 'Upgrade to Ad-Free PRO'}
            </Text>
            <Text style={styles.subtitle}>
              Enjoy movies, series & shorts with zero ads and instant playback.
            </Text>

            {isPremium && (
              <View style={styles.activePill}>
                <Feather name="check-circle" size={14} color="#10b981" />
                <Text style={styles.activePillText}>
                  Active until {expiresAtFormatted} ({daysLeft} days left)
                </Text>
              </View>
            )}
          </LinearGradient>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            {/* Feature List */}
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Feather name="slash" size={15} color="#ef4444" style={styles.featureIcon} />
                <Text style={styles.featureText}>No pre-roll, mid-roll, or player ads</Text>
              </View>
              <View style={styles.featureItem}>
                <Feather name="zap" size={15} color="#e50914" style={styles.featureIcon} />
                <Text style={styles.featureText}>Zero shorts feed ads & instant playback</Text>
              </View>
              <View style={styles.featureItem}>
                <Feather name="shield" size={15} color="#3b82f6" style={styles.featureIcon} />
                <Text style={styles.featureText}>One-time manual payment. No auto-debit renewals</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="bitcoin" size={16} color="#f97316" style={styles.featureIcon} />
                <Text style={styles.featureText}>Pay with BTC, USDT, ETH, SOL, LTC, etc.</Text>
              </View>
            </View>

            {/* Error Message */}
            {Boolean(errorMessage) && (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={16} color="#f87171" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Success Celebration */}
            {Boolean(successInfo) && (
              <View style={styles.successBox}>
                <Feather name="check-circle" size={24} color="#10b981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>PRO Activated Successfully!</Text>
                  <Text style={styles.successDesc}>
                    Your ad-free status is now active until {formatExpirationDate(successInfo.expiresAt)}.
                  </Text>
                </View>
              </View>
            )}

            {/* Plan Selector */}
            <Text style={styles.sectionHeader}>SELECT YOUR DURATION</Text>
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
                    <View style={styles.planHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                          {p.name}
                        </Text>
                        <Text style={styles.planDesc}>{p.desc}</Text>
                      </View>
                      <View style={styles.priceWrap}>
                        <Text style={styles.planPrice}>{p.price}</Text>
                        <Text style={styles.planUnit}>{p.unit}</Text>
                      </View>
                    </View>

                    <View style={styles.planFooter}>
                      <View
                        style={[
                          styles.badge,
                          p.id === '3_months'
                            ? { backgroundColor: '#b91c1c' }
                            : p.id === '6_months'
                            ? { backgroundColor: '#059669' }
                            : { backgroundColor: '#374151' },
                        ]}
                      >
                        <Text style={styles.badgeText}>{p.badge}</Text>
                      </View>

                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pending Order / Sandbox Simulation Box */}
            {pendingOrder && (
              <View style={styles.pendingBox}>
                <View style={styles.pendingHeader}>
                  <Feather name="clock" size={16} color="#e50914" />
                  <Text style={styles.pendingTitle}>Invoice Generated: {pendingOrder.orderId}</Text>
                </View>
                <Text style={styles.pendingNotice}>
                  Complete payment in the NOWPayments window, or click below to simulate an immediate verified webhook confirmation in Sandbox:
                </Text>

                <TouchableOpacity
                  style={styles.sandboxSimulateBtn}
                  onPress={handleSimulatePayment}
                  disabled={simulating}
                  activeOpacity={0.85}
                >
                  {simulating ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Feather name="zap" size={16} color="#000" />
                      <Text style={styles.sandboxSimulateBtnText}>
                        Simulate Instant Sandbox Payment
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Crypto Badges */}
            <View style={styles.cryptoRow}>
              <Text style={styles.cryptoLabel}>Accepted via NOWPayments:</Text>
              <Text style={styles.cryptoCoins}>USDT · BTC · ETH · SOL · LTC · TRX · DOGE</Text>
            </View>
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
                style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
                onPress={handleSubscribe}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color="#000" />
                    <Text style={styles.actionBtnText}>
                      {isPremium ? 'Extend Ad-Free PRO' : 'Continue to Crypto Payment'}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: '#a8a29e',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  activePillText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  bodyScroll: {
    flexGrow: 1,
  },
  bodyContent: {
    padding: 20,
  },
  featuresList: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    marginBottom: 18,
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    width: 18,
  },
  featureText: {
    color: '#d6d3d1',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  sectionHeader: {
    color: '#78716c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  plansContainer: {
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  planCardSelected: {
    borderColor: '#e50914',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  planCardHighlight: {
    borderLeftWidth: 4,
    borderLeftColor: '#e50914',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  planName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  planNameSelected: {
    color: '#e50914',
  },
  planDesc: {
    color: '#a8a29e',
    fontSize: 12,
    lineHeight: 16,
  },
  priceWrap: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  planPrice: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  planUnit: {
    color: '#78716c',
    fontSize: 10,
    fontWeight: '600',
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#57534e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#e50914',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e50914',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successTitle: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '800',
  },
  successDesc: {
    color: '#d1fae5',
    fontSize: 12,
    marginTop: 2,
  },
  pendingBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pendingTitle: {
    color: '#e50914',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingNotice: {
    color: '#d6d3d1',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  sandboxSimulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sandboxSimulateBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  cryptoRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cryptoLabel: {
    color: '#78716c',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  cryptoCoins: {
    color: '#a8a29e',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#171412',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    borderRadius: 12,
    paddingVertical: 13,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
