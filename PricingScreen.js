import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchSubscriptionPlans,
  createSubscriptionInvoice,
  simulateSandboxPayment,
  formatExpirationDate,
} from './subscriptionService';

export default function PricingScreen({
  onClose,
  authUser,
  authAccessToken,
  subscriptionStatus,
  onSubscriptionUpdated,
  onOpenAuth,
}) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const topInset = Math.max(insets?.top || 0, Platform.OS === 'android' ? 24 : 16);
  const bottomInset = Math.max(insets?.bottom || 0, 24);

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('3_months'); // Default to Most Popular
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingPay, setLoadingPay] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isPremium = Boolean(subscriptionStatus?.is_premium);
  const daysLeft = subscriptionStatus?.days_left || 0;

  useEffect(() => {
    let isCancelled = false;
    async function loadPlans() {
      try {
        const data = await fetchSubscriptionPlans();
        if (!isCancelled && data?.plans && data.plans.length > 0) {
          setPlans(data.plans);
        }
      } catch (e) {
        console.warn('Failed to load pricing plans:', e);
      } finally {
        if (!isCancelled) setLoadingPlans(false);
      }
    }
    loadPlans();
    return () => { isCancelled = true; };
  }, []);

  const handleCheckout = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!authUser || !authAccessToken) {
      if (onOpenAuth) {
        onOpenAuth('login');
      } else {
        setErrorMessage('Please sign in or create an account to activate Movieflix Pro.');
      }
      return;
    }

    setLoadingPay(true);
    try {
      const res = await createSubscriptionInvoice(selectedPlanId, authAccessToken, {
        userEmail: authUser?.email,
      });
      if (res.invoiceUrl) {
        setSuccessMessage('Redirecting to NOWPayments hosted checkout...');
        if (isWeb && typeof window !== 'undefined') {
          window.location.href = res.invoiceUrl;
        } else {
          await Linking.openURL(res.invoiceUrl);
        }
      } else {
        setErrorMessage(res.error || 'Failed to generate crypto payment invoice.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Payment initiation failed. Please check network.');
    } finally {
      setLoadingPay(false);
    }
  };

  const handleSimulateSandboxPayment = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setSimulating(true);
    try {
      const userMail = (authUser?.email || 'sandbox_test_user@movieflix.lol').toLowerCase().trim();
      const res = await fetch(`${API_BASE}/api/subscription?action=sandbox_simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authAccessToken ? { Authorization: `Bearer ${authAccessToken}` } : {}),
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          userId: userMail,
          userEmail: userMail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to simulate payment in sandbox.');
      }

      setSuccessMessage('✓ Sandbox test payment successful ($0.00)! Movieflix Pro has been activated on your account.');
      if (typeof onSubscriptionUpdated === 'function') {
        onSubscriptionUpdated({
          is_premium: true,
          plan_name: data.planName || 'Movieflix Pro',
          expires_at: data.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(),
          days_left: 30,
        });
      }
    } catch (err) {
      setErrorMessage(err.message || 'Sandbox simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  const defaultPlans = [
    {
      id: '1_month',
      name: '1 Month Pro',
      price: 1.0,
      currency: 'USD',
      durationDays: 30,
      badge: 'STARTER',
      description: 'Stream 4K & zero ads for 30 days',
      period: '/ 1 month',
    },
    {
      id: '3_months',
      name: '3 Months Pro',
      price: 3.0,
      currency: 'USD',
      durationDays: 90,
      badge: 'MOST POPULAR',
      isPopular: true,
      description: 'Stream 4K & zero ads for 90 days',
      period: '/ 3 months',
    },
    {
      id: '6_months',
      name: '6 Months Pro',
      price: 5.0,
      currency: 'USD',
      durationDays: 180,
      badge: 'BEST VALUE · SAVE 17%',
      description: 'Stream 4K & zero ads for 180 days',
      period: '/ 6 months',
    },
  ];

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent />

      {/* ─── TOP HEADER BAR ─── */}
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

          <View style={styles.headerBrandCol}>
            <Text style={styles.headerBrandTitle}>MOVIE<Text style={styles.headerBrandRed}>FLIX</Text></Text>
            <View style={styles.proPill}>
              <Text style={styles.proPillText}>PRO</Text>
            </View>
          </View>

          <View style={{ width: 60 }} />
        </View>
      </View>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO TITLE */}
        <View style={styles.heroSection}>
          <View style={styles.heroBadge}>
            <MaterialIcons name="workspace-premium" size={16} color="#e50914" />
            <Text style={styles.heroBadgeText}>MOVIEFLIX PREMIUM MEMBERSHIP</Text>
          </View>
          <Text style={styles.heroHeadline}>
            Stream in <Text style={styles.heroHighlight}>4K Ultra HD</Text> with Zero Ads
          </Text>
          <Text style={styles.heroSubheadline}>
            Unlock 1080p & 4K quality, bypass all ads in movies & shorts, and get access to all premium episodes.
          </Text>
        </View>

        {/* ACTIVE STATUS CARD IF USER IS CURRENTLY PRO */}
        {isPremium && (
          <View style={styles.activeStatusCard}>
            <View style={styles.activeStatusLeft}>
              <View style={styles.activeStatusDot} />
              <View>
                <Text style={styles.activeStatusTitle}>Your Movieflix Pro is Active</Text>
                <Text style={styles.activeStatusSubtitle}>
                  Expires {formatExpirationDate(subscriptionStatus?.expires_at)} · {daysLeft} days remaining
                </Text>
              </View>
            </View>
            <View style={styles.activeStatusPill}>
              <Text style={styles.activeStatusPillText}>ACTIVE</Text>
            </View>
          </View>
        )}

        {/* ─── FEATURE COMPARISON GRID (FREE VS PRO) ─── */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresSectionTitle}>Included in Movieflix Pro</Text>

          <View style={styles.featureItem}>
            <View style={styles.featureIconBox}>
              <Feather name="tv" size={18} color="#e50914" />
            </View>
            <View style={styles.featureTextCol}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>4K & 1080p Ultra HD Quality</Text>
                <Text style={styles.featureTagPro}>PRO ONLY</Text>
              </View>
              <Text style={styles.featureSubtitle}>
                Basic users are capped at 720p. Pro unlocks crisp 1080p and 4K Ultra HD bitrate.
              </Text>
            </View>
          </View>

          <View style={styles.featureDivider} />

          <View style={styles.featureItem}>
            <View style={styles.featureIconBox}>
              <Feather name="slash" size={18} color="#e50914" />
            </View>
            <View style={styles.featureTextCol}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>100% Zero Ads Anywhere</Text>
                <Text style={styles.featureTagPro}>PRO ONLY</Text>
              </View>
              <Text style={styles.featureSubtitle}>
                No pre-roll video ads, no 30-minute mid-roll interruptions, and zero ads in Shorts reels.
              </Text>
            </View>
          </View>

          <View style={styles.featureDivider} />

          <View style={styles.featureItem}>
            <View style={styles.featureIconBox}>
              <Feather name="film" size={18} color="#e50914" />
            </View>
            <View style={styles.featureTextCol}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>Watch All Premium Episodes</Text>
                <Text style={styles.featureTagPro}>UNLOCKED</Text>
              </View>
              <Text style={styles.featureSubtitle}>
                Instant access to all exclusive web series, latest seasons, and VIP episodes without delay.
              </Text>
            </View>
          </View>

          <View style={styles.featureDivider} />

          <View style={styles.featureItem}>
            <View style={styles.featureIconBox}>
              <Feather name="zap" size={18} color="#e50914" />
            </View>
            <View style={styles.featureTextCol}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>Priority Streaming Speed</Text>
                <Text style={styles.featureTagPro}>FAST CDN</Text>
              </View>
              <Text style={styles.featureSubtitle}>
                Dedicated high-bandwidth edge servers for instant seek and bufferless playback.
              </Text>
            </View>
          </View>
        </View>

        {/* ─── PRICING PLAN SELECTOR ─── */}
        <View style={styles.plansSection}>
          <Text style={styles.plansHeaderTitle}>Choose Your Plan</Text>
          <Text style={styles.plansHeaderSub}>
            One-time payment. Never automatically rebilled — you renew only when you want.
          </Text>

          {loadingPlans ? (
            <ActivityIndicator size="small" color="#e50914" style={{ marginVertical: 20 }} />
          ) : (
            displayPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isPopular = plan.id === '3_months';

              return (
                <TouchableOpacity
                  key={`plan-${plan.id}`}
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    isPopular && styles.planCardPopularBorder,
                  ]}
                  onPress={() => setSelectedPlanId(plan.id)}
                  activeOpacity={0.85}
                >
                  {isPopular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                    </View>
                  )}

                  <View style={styles.planCardHeader}>
                    <View style={styles.planRadioRow}>
                      <View style={[styles.planRadioCircle, isSelected && styles.planRadioCircleActive]}>
                        {isSelected && <View style={styles.planRadioInner} />}
                      </View>
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.planCardName}>{plan.name}</Text>
                        <Text style={styles.planCardDays}>
                          {plan.durationDays} Days Unlimited Access
                        </Text>
                      </View>
                    </View>

                    <View style={styles.planPriceCol}>
                      <Text style={styles.planPriceText}>${plan.price}</Text>
                      <Text style={styles.planCurrencyText}>USD</Text>
                    </View>
                  </View>

                  <Text style={styles.planDescText}>{plan.description}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ERROR OR SUCCESS FEEDBACK */}
        {errorMessage ? (
          <View style={styles.alertBoxError}>
            <Feather name="alert-triangle" size={16} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.alertTextError}>{errorMessage}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.alertBoxSuccess}>
            <Feather name="check-circle" size={16} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.alertTextSuccess}>{successMessage}</Text>
          </View>
        ) : null}

        {/* ─── SANDBOX TEST MODE (LIKE PAYPAL SANDBOX - $0.00 FREE TEST) ─── */}
        <View style={styles.sandboxBox}>
          <View style={styles.sandboxHeaderRow}>
            <View style={styles.sandboxBadge}>
              <Feather name="shield" size={13} color="#10b981" style={{ marginRight: 5 }} />
              <Text style={styles.sandboxBadgeText}>SANDBOX TEST MODE · $0.00</Text>
            </View>
            <Text style={styles.sandboxFreeText}>Free Test (No Real Money)</Text>
          </View>
          <Text style={styles.sandboxDescriptionText}>
            Test subscribing to Movieflix Pro without paying real crypto (just like PayPal Sandbox test mode). Clicking below simulates an approved payment webhook and instantly activates Pro on your account.
          </Text>

          <TouchableOpacity
            style={styles.sandboxActionButton}
            onPress={handleSimulateSandboxPayment}
            disabled={simulating || loadingPay}
            activeOpacity={0.8}
          >
            {simulating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.sandboxActionInner}>
                <Feather name="zap" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.sandboxActionText}>
                  Complete Sandbox Test Payment ($0.00)
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── LIVE CRYPTO PAYMENT (REAL MONEY VIA NOWPAYMENTS) ─── */}
        <TouchableOpacity
          style={[styles.checkoutBtn, loadingPay && styles.btnDisabled]}
          onPress={handleCheckout}
          disabled={loadingPay || simulating}
          activeOpacity={0.85}
        >
          {loadingPay ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.checkoutBtnContent}>
              <Ionicons name="card-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.checkoutBtnText}>
                {isPremium ? 'Extend with Real Crypto' : 'Pay with Real Crypto (Live)'}
              </Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.liveNoticeText}>
          * Live payment opens the NOWPayments hosted website and requires real crypto (BTC, USDT, ETH, etc.).
        </Text>

        {/* CRYPTO ICONS ROW */}
        <View style={styles.cryptoRow}>
          <Text style={styles.cryptoRowLabel}>Accepted Cryptocurrencies (NOWPayments):</Text>
          <View style={styles.cryptoBadgeList}>
            <View style={styles.coinBadge}><Text style={styles.coinBadgeText}>BTC</Text></View>
            <View style={styles.coinBadge}><Text style={styles.coinBadgeText}>USDT</Text></View>
            <View style={styles.coinBadge}><Text style={styles.coinBadgeText}>ETH</Text></View>
            <View style={styles.coinBadge}><Text style={styles.coinBadgeText}>SOL</Text></View>
            <View style={styles.coinBadge}><Text style={styles.coinBadgeText}>LTC</Text></View>
            <View style={styles.coinBadge}><Text style={styles.coinBadgeText}>TRX</Text></View>
          </View>
        </View>

        {/* SECURITY & MANUAL RENEWAL ASSURANCE */}
        <View style={styles.assuranceBox}>
          <View style={styles.assuranceItem}>
            <Feather name="shield" size={14} color="#a3a3a3" style={{ marginRight: 6 }} />
            <Text style={styles.assuranceText}>
              Cryptographically verified via signed IPN webhook.
            </Text>
          </View>
          <View style={styles.assuranceItem}>
            <Feather name="lock" size={14} color="#a3a3a3" style={{ marginRight: 6 }} />
            <Text style={styles.assuranceText}>
              Stored in secure AWS DynamoDB. No client-side tampering possible.
            </Text>
          </View>
          <View style={styles.assuranceItem}>
            <Feather name="refresh-cw" size={14} color="#a3a3a3" style={{ marginRight: 6 }} />
            <Text style={styles.assuranceText}>
              Zero recurring debits. When your time ends, you choose whether to renew manually.
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
    backgroundColor: '#0a0a0a',
  },
  headerBar: {
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerBrandCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBrandTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headerBrandRed: {
    color: '#e50914',
  },
  proPill: {
    backgroundColor: '#e50914',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 24,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 6,
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroHighlight: {
    color: '#e50914',
  },
  heroSubheadline: {
    color: '#a3a3a3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 500,
  },
  activeStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  activeStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    marginRight: 10,
  },
  activeStatusTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  activeStatusSubtitle: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 2,
  },
  activeStatusPill: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeStatusPillText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  featuresCard: {
    backgroundColor: '#141414',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    marginBottom: 24,
  },
  featuresSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  featureTagPro: {
    color: '#e50914',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  featureSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
    lineHeight: 17,
  },
  featureDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  plansSection: {
    marginBottom: 20,
  },
  plansHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  plansHeaderSub: {
    color: '#8e8e93',
    fontSize: 13,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#e50914',
    backgroundColor: 'rgba(229, 9, 20, 0.04)',
  },
  planCardPopularBorder: {
    borderColor: 'rgba(229, 9, 20, 0.4)',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#e50914',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#525252',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioCircleActive: {
    borderColor: '#e50914',
  },
  planRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e50914',
  },
  planCardName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  planCardDays: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  planPriceCol: {
    alignItems: 'flex-end',
  },
  planPriceText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  planCurrencyText: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
  },
  planDescText: {
    color: '#a3a3a3',
    fontSize: 12,
    marginTop: 4,
  },
  checkoutBtn: {
    backgroundColor: '#e50914',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  checkoutBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cryptoRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cryptoRowLabel: {
    color: '#737373',
    fontSize: 11,
    marginBottom: 6,
  },
  cryptoBadgeList: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  coinBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  coinBadgeText: {
    color: '#d4d4d4',
    fontSize: 10,
    fontWeight: '700',
  },
  sandboxBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sandboxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sandboxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sandboxBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sandboxFreeText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },
  sandboxDescriptionText: {
    color: '#a3a3a3',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  sandboxActionButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  sandboxActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sandboxActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveNoticeText: {
    color: '#737373',
    fontSize: 11,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 15,
  },
  alertBoxError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  alertTextError: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  alertBoxSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  alertTextSuccess: {
    color: '#10b981',
    fontSize: 12,
    flex: 1,
  },
  assuranceBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 16,
    marginTop: 8,
  },
  assuranceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  assuranceText: {
    color: '#737373',
    fontSize: 11,
    flex: 1,
  },
});
