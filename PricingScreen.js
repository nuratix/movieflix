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
import { Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchSubscriptionPlans,
  fetchTelegramUserCode,
  getTelegramBotUrl,
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
  const [loadingCode, setLoadingCode] = useState(false);
  const [userCode, setUserCode] = useState('749215');
  const [copiedCode, setCopiedCode] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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

  // 2. Fetch or Generate 6-Digit User Account ID (Always available for every user)
  useEffect(() => {
    let isCancelled = false;
    async function loadUserCode() {
      setLoadingCode(true);

      // Check fast local cache first
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
        // Fallback to random 6-digit code if nothing loaded yet
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
    setTimeout(() => setCopiedCode(false), 2200);
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
      setSuccessMessage('Opening @movieflix_pro_bot on Telegram...');
    } catch (err) {
      setErrorMessage(`Could not open Telegram directly. Open Telegram, search for @movieflix_pro_bot and send your Account ID: ${targetCode}`);
    }
  };

  // Sandbox Test Payment ($0.00 Free Instant Test)
  const handleSimulateSandboxPayment = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setSimulating(true);
    try {
      const res = await simulateSandboxPayment(
        `mf_sim_${Date.now()}`,
        authAccessToken
      );

      setSuccessMessage('✓ Sandbox test payment successful ($0.00)! Movieflix Pro has been activated on your account.');
      if (typeof onSubscriptionUpdated === 'function') {
        onSubscriptionUpdated({
          is_premium: true,
          plan_name: res.planName || 'Movieflix Pro',
          expires_at: res.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(),
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
      stars: 50,
      currency: 'USD',
      durationDays: 30,
      badge: 'STARTER',
      description: 'Stream 4K & zero ads for 30 days (50 Stars)',
    },
    {
      id: '3_months',
      name: '3 Months Pro',
      price: 3.0,
      stars: 150,
      currency: 'USD',
      durationDays: 90,
      badge: 'MOST POPULAR',
      isPopular: true,
      description: 'Stream 4K & zero ads for 90 days (150 Stars)',
    },
    {
      id: '6_months',
      name: '6 Months Pro',
      price: 5.0,
      stars: 250,
      currency: 'USD',
      durationDays: 180,
      badge: 'BEST VALUE · SAVE 17%',
      description: 'Stream 4K & zero ads for 180 days (250 Stars)',
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
            <Text style={styles.heroBadgeText}>MOVIEFLIX PRO MEMBERSHIP</Text>
          </View>
          <Text style={styles.heroHeadline}>
            Stream in <Text style={styles.heroHighlight}>4K Ultra HD</Text> with Zero Ads
          </Text>
          <Text style={styles.heroSubheadline}>
            Unlock crisp 1080p & 4K quality, bypass all ads in movies & shorts, and get instant access to all premium episodes.
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

        {/* ─── USER 6-DIGIT ACCOUNT ID LINK CARD (ALWAYS VISIBLE) ─── */}
        <View style={styles.accountCard}>
          <View style={styles.accountCardHeader}>
            <View style={styles.accountCardIconWrap}>
              <Feather name="shield" size={18} color="#e50914" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountCardTitle}>YOUR MOVIEFLIX ACCOUNT ID</Text>
              <Text style={styles.accountCardEmail}>
                {authUser?.email ? authUser.email : 'Guest Device ID (Ready to Link)'}
              </Text>
            </View>
          </View>

          {/* 6-Digit ID Box */}
          <View style={styles.codeRow}>
            <View style={styles.codeBadge}>
              {loadingCode && !userCode ? (
                <ActivityIndicator size="small" color="#e50914" />
              ) : (
                <Text style={styles.codeDigits}>
                  {(userCode || '748192').split('').join('  ')}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.copyBtn, copiedCode && styles.copyBtnSuccess]}
              onPress={handleCopyCode}
              activeOpacity={0.75}
            >
              <Feather
                name={copiedCode ? 'check' : 'copy'}
                size={15}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.copyBtnText}>
                {copiedCode ? 'Copied!' : 'Copy ID'}
              </Text>
            </TouchableOpacity>
          </View>

          {!authUser ? (
            <View style={styles.guestLinkRow}>
              <Text style={styles.guestLinkText}>
                Not logged in yet? You can sign in now or link your email inside Telegram bot.
              </Text>
              <TouchableOpacity
                style={styles.signInSmallBtn}
                onPress={() => onOpenAuth && onOpenAuth('login')}
              >
                <Text style={styles.signInSmallBtnText}>Sign In / Register</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.accountCardHint}>
              ⭐️ This 6-digit Account ID automatically links your Telegram Stars payment to your account (<Text style={{ color: '#fff', fontWeight: '700' }}>{authUser.email}</Text>).
            </Text>
          )}
        </View>

        {/* ─── FEATURE COMPARISON GRID (FREE VS PRO) ─── */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresSectionTitle}>Included with Movieflix Pro</Text>

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
                Zero pre-roll video ads, zero mid-roll pauses, and zero promotional ads in Shorts reels.
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

        {/* ─── PRICING PLAN SELECTOR (TELEGRAM STARS) ─── */}
        <View style={styles.plansSection}>
          <Text style={styles.plansHeaderTitle}>Choose Your Plan</Text>
          <Text style={styles.plansHeaderSub}>
            Pay easily with Telegram Stars ⭐️ inside Telegram. One-time payment, no surprise renewals.
          </Text>

          {loadingPlans ? (
            <ActivityIndicator size="small" color="#e50914" style={{ marginVertical: 20 }} />
          ) : (
            displayPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isPopular = plan.id === '3_months';
              const starsAmount = plan.stars || (plan.price === 1 ? 50 : plan.price === 3 ? 150 : 250);

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
                          {plan.durationDays} Days Unlimited 4K & No Ads
                        </Text>
                      </View>
                    </View>

                    <View style={styles.planPriceCol}>
                      <View style={styles.starsRow}>
                        <Text style={styles.starEmoji}>⭐️</Text>
                        <Text style={styles.planStarsText}>{starsAmount}</Text>
                        <Text style={styles.planStarsUnit}>Stars</Text>
                      </View>
                      <Text style={styles.planUsdText}>(${plan.price} USD)</Text>
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

        {/* ─── PRIMARY TELEGRAM STARS SUBSCRIBE BUTTON ─── */}
        <TouchableOpacity
          style={styles.telegramSubscribeBtn}
          onPress={handleSubscribeViaTelegram}
          activeOpacity={0.85}
        >
          <View style={styles.telegramBtnInner}>
            <FontAwesome5 name="telegram-plane" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={styles.telegramBtnTitle}>
                Subscribe with Telegram Stars ⭐️
              </Text>
              <Text style={styles.telegramBtnSubtitle}>
                Opens @movieflix_pro_bot (ID: {userCode || '...'}) · Instant activation
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
          </View>
        </TouchableOpacity>

        {/* HOW TELEGRAM STARS SUBSCRIPTION WORKS */}
        <View style={styles.howItWorksCard}>
          <Text style={styles.howItWorksTitle}>How Telegram Stars Payment Works</Text>

          <View style={styles.howStepRow}>
            <View style={styles.howStepNum}><Text style={styles.howStepNumText}>1</Text></View>
            <Text style={styles.howStepText}>
              Tap the button above to launch <Text style={{ color: '#2AABEE', fontWeight: '700' }}>@movieflix_pro_bot</Text> in Telegram.
            </Text>
          </View>

          <View style={styles.howStepRow}>
            <View style={styles.howStepNum}><Text style={styles.howStepNumText}>2</Text></View>
            <Text style={styles.howStepText}>
              Bot automatically detects your Account ID (<Text style={{ color: '#fff', fontWeight: '700' }}>{userCode || 'your 6-digit ID'}</Text>), confirms your account, and sends plan cards.
            </Text>
          </View>

          <View style={styles.howStepRow}>
            <View style={styles.howStepNum}><Text style={styles.howStepNumText}>3</Text></View>
            <Text style={styles.howStepText}>
              Pay with native Telegram Stars with 1 tap. Subscription activates instantly on Movieflix!
            </Text>
          </View>
        </View>

        {/* ─── SANDBOX TEST MODE ($0.00 FREE TEST) ─── */}
        <View style={styles.sandboxBox}>
          <View style={styles.sandboxHeaderRow}>
            <View style={styles.sandboxBadge}>
              <Feather name="shield" size={13} color="#10b981" style={{ marginRight: 5 }} />
              <Text style={styles.sandboxBadgeText}>SANDBOX TEST MODE · $0.00</Text>
            </View>
            <Text style={styles.sandboxFreeText}>Free Developer / Demo Test</Text>
          </View>
          <Text style={styles.sandboxDescriptionText}>
            Test subscribing to Movieflix Pro instantly without spending real Stars. Clicking below simulates an approved payment webhook and immediately unlocks 4K streaming & zero ads on your account.
          </Text>

          <TouchableOpacity
            style={styles.sandboxActionButton}
            onPress={handleSimulateSandboxPayment}
            disabled={simulating}
            activeOpacity={0.8}
          >
            {simulating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.sandboxActionInner}>
                <Feather name="zap" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.sandboxActionText}>
                  Activate Sandbox Test ($0.00 Free)
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* SECURITY ASSURANCE */}
        <View style={styles.assuranceBox}>
          <View style={styles.assuranceItem}>
            <Feather name="shield" size={14} color="#a3a3a3" style={{ marginRight: 6 }} />
            <Text style={styles.assuranceText}>
              Official Telegram Stars API payment verified by Telegram Bot webhook.
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
              Zero recurring debits. When your period ends, you choose whether to renew manually.
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
    marginBottom: 20,
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
    maxWidth: 520,
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
    marginBottom: 20,
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
  accountCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    padding: 16,
    marginBottom: 22,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountCardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountCardTitle: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  accountCardEmail: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  codeBadge: {
    flex: 1,
  },
  codeDigits: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  copyBtnSuccess: {
    backgroundColor: '#10b981',
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  guestLinkRow: {
    paddingVertical: 6,
  },
  guestLinkText: {
    color: '#a3a3a3',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  signInSmallBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  signInSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  accountCardHint: {
    color: '#8e8e93',
    fontSize: 11,
    lineHeight: 16,
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
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  planStarsText: {
    color: '#FBBF24',
    fontSize: 20,
    fontWeight: '900',
  },
  planStarsUnit: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  planUsdText: {
    color: '#8e8e93',
    fontSize: 11,
    marginTop: 2,
  },
  planDescText: {
    color: '#a3a3a3',
    fontSize: 12,
    marginTop: 4,
  },
  telegramSubscribeBtn: {
    backgroundColor: '#2AABEE', // Official Telegram Blue
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#2AABEE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  telegramBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  telegramBtnTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  telegramBtnSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  howItWorksCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 20,
  },
  howItWorksTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  howStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  howStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  howStepNumText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  howStepText: {
    color: '#a3a3a3',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
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
