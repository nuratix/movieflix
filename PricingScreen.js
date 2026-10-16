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
  TextInput,
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchSubscriptionPlans,
  fetchTelegramUserCode,
  getTelegramBotUrl,
  formatExpirationDate,
  redeemPromoCode,
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
  const [loadingCode, setLoadingCode] = useState(false);
  const [userCode, setUserCode] = useState('749215');
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [redeemingPromo, setRedeemingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  const isPremium = Boolean(subscriptionStatus?.is_premium);
  const daysLeft = subscriptionStatus?.days_left || 0;

  // 1. Load Subscription Plans
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

  // 2. Fetch or Generate 6-Digit User Account ID
  useEffect(() => {
    let isCancelled = false;
    async function loadUserCode() {
      setLoadingCode(true);

      // Fast local cache check
      try {
        const cached = await AsyncStorage.getItem('@mf_telegram_account_code');
        if (!isCancelled && cached && /^\d{6}$/.test(cached)) {
          setUserCode(cached);
        }
      } catch (_) {}

      try {
        const data = await fetchTelegramUserCode(authAccessToken, authUser?.email, userCode);
        if (!isCancelled && data?.code) {
          setUserCode(String(data.code));
          try {
            await AsyncStorage.setItem('@mf_telegram_account_code', String(data.code));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Failed to fetch user telegram code:', err?.message);
        if (!isCancelled && !userCode) {
          const fallback = Math.floor(100000 + Math.random() * 900000).toString();
          setUserCode(fallback);
          try {
            await AsyncStorage.setItem('@mf_telegram_account_code', fallback);
          } catch (_) {}
        }
      } finally {
        if (!isCancelled) setLoadingCode(false);
      }
    }

    loadUserCode();
    return () => { isCancelled = true; };
  }, [authAccessToken, authUser?.email]);

  // Copy 6-digit Code to Clipboard
  const handleCopyCode = async () => {
    if (!userCode) return;
    try {
      if (isWeb && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(userCode);
      }
    } catch (_) {}
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Launch Telegram Stars Bot
  const handleSubscribeViaTelegram = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const targetCode = userCode || '749215';
    const botUrl = getTelegramBotUrl(targetCode);

    try {
      if (isWeb && typeof window !== 'undefined') {
        window.open(botUrl, '_blank');
      } else {
        const supported = await Linking.canOpenURL(botUrl);
        if (supported) {
          await Linking.openURL(botUrl);
        } else {
          await Linking.openURL(`https://t.me/movieflix_pro_bot?start=${targetCode}`);
        }
      }
      setSuccessMessage('Redirecting to @movieflix_pro_bot on Telegram...');
    } catch (err) {
      setErrorMessage(`Open Telegram, search for @movieflix_pro_bot and send your Account ID: ${targetCode}`);
    }
  };
 
  // Redeem VIP Promo Code
  const handleRedeemPromo = async () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) {
      setPromoError('Please enter your promo code.');
      return;
    }

    setPromoError('');
    setPromoSuccess('');
    setRedeemingPromo(true);

    try {
      const res = await redeemPromoCode(
        code,
        userCode,
        authUser?.email,
        authAccessToken
      );
      setPromoSuccess(res.message || `Promo code claimed! ${res.duration_months} month(s) VIP Pro activated.`);
      setPromoCodeInput('');
      if (onSubscriptionUpdated) {
        onSubscriptionUpdated();
      }
    } catch (err) {
      setPromoError(err.message || 'Failed to redeem promo code. Please check and try again.');
    } finally {
      setRedeemingPromo(false);
    }
  };

  const defaultPlans = [
    {
      id: '1_month',
      name: '1 Month Pro',
      price: 1.0,
      stars: 50,
      currency: 'USD',
      durationDays: 30,
      badge: 'Starter',
      description: '30 days full access',
    },
    {
      id: '3_months',
      name: '3 Months Pro',
      price: 3.0,
      stars: 150,
      currency: 'USD',
      durationDays: 90,
      badge: 'Popular',
      isPopular: true,
      description: '90 days full access',
    },
    {
      id: '6_months',
      name: '6 Months Pro',
      price: 5.0,
      stars: 250,
      currency: 'USD',
      durationDays: 180,
      badge: 'Best Value',
      description: '180 days full access',
    },
  ];

  const displayPlans = plans.length > 0 ? plans : defaultPlans;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0b0d" translucent />

      {/* ─── HEADER BAR ─── */}
      <View style={[styles.headerBar, { paddingTop: topInset + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={17} color="#d4d4d8" style={{ marginRight: 6 }} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerBrandRow}>
            <Text style={styles.headerBrandText}>MOVIE<Text style={styles.headerBrandAccent}>FLIX</Text></Text>
            <View style={styles.brandProBadge}>
              <Text style={styles.brandProBadgeText}>PRO</Text>
            </View>
          </View>

          <View style={{ width: 64 }} />
        </View>
      </View>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO TITLE */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Upgrade to Movieflix Pro</Text>
          <Text style={styles.heroSubtitle}>
            Stream all movies & series in 4K Ultra HD with zero ads and unlimited VIP episodes.
          </Text>
        </View>

        {/* ACTIVE STATUS BANNER */}
        {isPremium && (
          <View style={styles.activeBanner}>
            <View style={styles.activeBannerLeft}>
              <View style={styles.activeDot} />
              <View>
                <Text style={styles.activeBannerTitle}>Movieflix Pro is Active</Text>
                <Text style={styles.activeBannerSub}>
                  Expires {formatExpirationDate(subscriptionStatus?.expires_at)} ({daysLeft} days remaining)
                </Text>
              </View>
            </View>
            <View style={styles.activeBadgePill}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          </View>
        )}

        {/* ─── CLEAN ACCOUNT ID BAR ─── */}
        <View style={styles.accountBar}>
          <View style={styles.accountBarLeft}>
            <Text style={styles.accountBarLabel}>YOUR ACCOUNT ID</Text>
            <View style={styles.accountIdRow}>
              {loadingCode && !userCode ? (
                <ActivityIndicator size="small" color="#e50914" />
              ) : (
                <Text style={styles.accountIdText}>
                  {userCode || '749215'}
                </Text>
              )}
              <Text style={styles.accountBarSub}>
                {authUser?.email ? ` · ${authUser.email}` : ' · Guest device'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.copyBtn, copiedCode && styles.copyBtnDone]}
            onPress={handleCopyCode}
            activeOpacity={0.75}
          >
            <Feather
              name={copiedCode ? 'check' : 'copy'}
              size={13}
              color={copiedCode ? '#10b981' : '#ffffff'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.copyBtnText, copiedCode && styles.copyBtnTextDone]}>
              {copiedCode ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── MINIMAL PLAN SELECTION ─── */}
        <View style={styles.plansContainer}>
          {loadingPlans ? (
            <ActivityIndicator size="small" color="#e50914" style={{ marginVertical: 24 }} />
          ) : (
            displayPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isPopular = plan.id === '3_months';
              const stars = plan.stars || (plan.price === 1 ? 50 : plan.price === 3 ? 150 : 250);

              return (
                <TouchableOpacity
                  key={`plan-${plan.id}`}
                  style={[
                    styles.planRow,
                    isSelected && styles.planRowSelected,
                  ]}
                  onPress={() => setSelectedPlanId(plan.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.planRadioCol}>
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </View>

                  <View style={styles.planInfoCol}>
                    <View style={styles.planNameRow}>
                      <Text style={[styles.planName, isSelected && styles.planNameActive]}>
                        {plan.name}
                      </Text>
                      {isPopular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>POPULAR</Text>
                        </View>
                      )}
                      {plan.id === '6_months' && (
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsBadgeText}>SAVE 17%</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planDuration}>
                      {plan.durationDays} days unlimited 4K streaming
                    </Text>
                  </View>

                  <View style={styles.planPricingCol}>
                    <Text style={styles.planPriceStars}>
                      ⭐️ {stars}
                    </Text>
                    <Text style={styles.planPriceUsd}>
                      ${plan.price} USD
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ERROR / SUCCESS ALERTS */}
        {errorMessage ? (
          <View style={styles.alertError}>
            <Feather name="alert-circle" size={15} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.alertErrorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.alertSuccess}>
            <Feather name="check-circle" size={15} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.alertSuccessText}>{successMessage}</Text>
          </View>
        ) : null}

        {/* ─── PRIMARY TELEGRAM STARS BUTTON ─── */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleSubscribeViaTelegram}
          activeOpacity={0.85}
        >
          <View style={styles.primaryBtnContent}>
            <FontAwesome5 name="telegram-plane" size={18} color="#FFFFFF" style={{ marginRight: 10 }} />
            <Text style={styles.primaryBtnTitle}>
              Pay with Telegram Stars
            </Text>
          </View>
          <Text style={styles.primaryBtnSub}>
            Opens @movieflix_pro_bot · Instant account activation
          </Text>
        </TouchableOpacity>

        {/* ─── VIP PROMO CODE SECTION ─── */}
        <View style={styles.promoCard}>
          <View style={styles.promoHeaderRow}>
            <View style={styles.promoIconCircle}>
              <Feather name="gift" size={15} color="#e50914" />
            </View>
            <View style={styles.promoTitleCol}>
              <Text style={styles.promoTitle}>Have a VIP Promo Code?</Text>
              <Text style={styles.promoSubtitle}>
                Enter your code below for instant VIP Pro subscription activation.
              </Text>
            </View>
          </View>

          <View style={styles.promoInputRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="e.g. VIP-PRO-2026"
              placeholderTextColor="#71717a"
              value={promoCodeInput}
              onChangeText={(text) => {
                setPromoCodeInput(text.toUpperCase());
                if (promoError) setPromoError('');
                if (promoSuccess) setPromoSuccess('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!redeemingPromo}
            />
            <TouchableOpacity
              style={[
                styles.promoSubmitBtn,
                (!promoCodeInput.trim() || redeemingPromo) && styles.promoSubmitBtnDisabled,
              ]}
              onPress={handleRedeemPromo}
              disabled={!promoCodeInput.trim() || redeemingPromo}
              activeOpacity={0.8}
            >
              {redeemingPromo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.promoSubmitBtnText}>Redeem</Text>
              )}
            </TouchableOpacity>
          </View>

          {Boolean(promoError) && (
            <View style={styles.promoErrorRow}>
              <Feather name="alert-circle" size={13} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={styles.promoErrorText}>{promoError}</Text>
            </View>
          )}

          {Boolean(promoSuccess) && (
            <View style={styles.promoSuccessRow}>
              <Feather name="check-circle" size={13} color="#10b981" style={{ marginRight: 6 }} />
              <Text style={styles.promoSuccessText}>{promoSuccess}</Text>
            </View>
          )}
        </View>

        {/* ─── MINIMAL FEATURES LIST ─── */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresHeader}>Included with your membership</Text>

          <View style={styles.featureLine}>
            <Feather name="check" size={15} color="#e50914" style={styles.featureCheckIcon} />
            <View style={styles.featureLineTextCol}>
              <Text style={styles.featureLineTitle}>4K Ultra HD & 1080p</Text>
              <Text style={styles.featureLineDesc}>Highest available video resolution with premium bitrates</Text>
            </View>
          </View>

          <View style={styles.featureLine}>
            <Feather name="check" size={15} color="#e50914" style={styles.featureCheckIcon} />
            <View style={styles.featureLineTextCol}>
              <Text style={styles.featureLineTitle}>100% Ad-Free Experience</Text>
              <Text style={styles.featureLineDesc}>No pre-roll ads, no mid-roll interruptions, no Shorts promo banners</Text>
            </View>
          </View>

          <View style={styles.featureLine}>
            <Feather name="check" size={15} color="#e50914" style={styles.featureCheckIcon} />
            <View style={styles.featureLineTextCol}>
              <Text style={styles.featureLineTitle}>All VIP Series & Episodes</Text>
              <Text style={styles.featureLineDesc}>Immediate access to all locked and new web series releases</Text>
            </View>
          </View>

          <View style={styles.featureLine}>
            <Feather name="check" size={15} color="#e50914" style={styles.featureCheckIcon} />
            <View style={styles.featureLineTextCol}>
              <Text style={styles.featureLineTitle}>One-Time Payment</Text>
              <Text style={styles.featureLineDesc}>No recurring debits or automatic renewals. You control your plan.</Text>
            </View>
          </View>
        </View>

        {/* FOOTER GUARANTEE */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            Payments are securely processed via Telegram Stars Bot API and verified in real time on our AWS infrastructure.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  headerBar: {
    backgroundColor: '#0a0a0c',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtnText: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '500',
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBrandText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerBrandAccent: {
    color: '#e50914',
  },
  brandProBadge: {
    backgroundColor: '#e50914',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  brandProBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    marginBottom: 20,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 10,
  },
  activeBannerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  activeBannerSub: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 1,
  },
  activeBadgePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  accountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  accountBarLeft: {
    flex: 1,
  },
  accountBarLabel: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  accountIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIdText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  accountBarSub: {
    color: '#71717a',
    fontSize: 12,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  copyBtnDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  copyBtnTextDone: {
    color: '#10b981',
  },
  plansContainer: {
    gap: 8,
    marginBottom: 16,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  planRowSelected: {
    borderColor: '#e50914',
    backgroundColor: 'rgba(229, 9, 20, 0.03)',
  },
  planRadioCol: {
    marginRight: 12,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#e50914',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e50914',
  },
  planInfoCol: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  planNameActive: {
    color: '#FFFFFF',
  },
  popularBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularBadgeText: {
    color: '#e50914',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  savingsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  planDuration: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 2,
  },
  planPricingCol: {
    alignItems: 'flex-end',
  },
  planPriceStars: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
  planPriceUsd: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: '#0088cc', // Sleek Telegram Blue
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  primaryBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtnTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  primaryBtnSub: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    marginTop: 3,
  },
  featuresSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 18,
    marginBottom: 24,
  },
  featuresHeader: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  featureLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureCheckIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  featureLineTextCol: {
    flex: 1,
  },
  featureLineTitle: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '600',
  },
  featureLineDesc: {
    color: '#71717a',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  alertErrorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  alertSuccessText: {
    color: '#10b981',
    fontSize: 12,
    flex: 1,
  },
  footerWrap: {
    paddingTop: 14,
    alignItems: 'center',
  },
  footerText: {
    color: '#52525b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },

  // ─── PROMO CODE CARD STYLES ───
  promoCard: {
    backgroundColor: '#121216',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  promoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  promoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  promoTitleCol: {
    flex: 1,
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  promoSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#1a1a20',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  promoSubmitBtn: {
    backgroundColor: '#e50914',
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoSubmitBtnDisabled: {
    backgroundColor: 'rgba(229, 9, 20, 0.35)',
  },
  promoSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  promoErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  promoErrorText: {
    color: '#ef4444',
    fontSize: 11.5,
    flex: 1,
  },
  promoSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  promoSuccessText: {
    color: '#10b981',
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
});
