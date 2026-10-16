import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE =
  Platform.OS === 'web'
    ? ''
    : (process.env.EXPO_PUBLIC_API_BASE || 'https://mws.wallpaperdomain.xyz').trim().replace(/\/+$/, '');

/**
 * Fetch available Ad-Free subscription plans
 */
export async function fetchSubscriptionPlans() {
  try {
    const res = await fetch(`${API_BASE}/api/subscription?action=plans`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[SubscriptionService] fetchPlans note:', err?.message);
    return null;
  }
}

/**
 * Fetch current user's Ad-Free VIP subscription status
 */
export async function fetchSubscriptionStatus(authToken = null) {
  if (!authToken) {
    return {
      success: true,
      authenticated: false,
      is_premium: false,
      days_left: 0,
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/subscription?action=status&_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!res.ok) {
      return {
        success: false,
        authenticated: true,
        is_premium: false,
        days_left: 0,
      };
    }

    return await res.json();
  } catch (err) {
    console.warn('[SubscriptionService] fetchStatus note:', err?.message);
    return {
      success: false,
      authenticated: true,
      is_premium: false,
      days_left: 0,
    };
  }
}

/**
 * Fetch or generate the user's 6-digit Account ID for Telegram Stars bot subscription
 * Supports fallback endpoints and persistent local cache so it NEVER fails.
 */
export async function fetchTelegramUserCode(authToken = null, email = null, existingCode = null) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Check local cache if no code passed
  let fallbackCode = existingCode;
  if (!fallbackCode) {
    try {
      fallbackCode = await AsyncStorage.getItem('@mf_telegram_account_code');
    } catch (_) {}
  }
  if (!fallbackCode || !/^\d{6}$/.test(fallbackCode)) {
    fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
  }

  const payload = JSON.stringify({ email, guest_code: fallbackCode });

  // 1. Try /api/telegram?action=get_user_code
  try {
    const res = await fetch(`${API_BASE}/api/telegram?action=get_user_code`, {
      method: 'POST',
      headers,
      body: payload,
    });
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data && data.code) {
        await AsyncStorage.setItem('@mf_telegram_account_code', String(data.code));
        return data;
      }
    } catch (_) {}
  } catch (err) {
    console.warn('[SubscriptionService] /api/telegram note:', err?.message);
  }

  // 2. Fallback to /api/subscription?action=get_user_code
  try {
    const res2 = await fetch(`${API_BASE}/api/subscription?action=get_user_code`, {
      method: 'POST',
      headers,
      body: payload,
    });
    const text2 = await res2.text();
    try {
      const data2 = JSON.parse(text2);
      if (data2 && data2.code) {
        await AsyncStorage.setItem('@mf_telegram_account_code', String(data2.code));
        return data2;
      }
    } catch (_) {}
  } catch (err2) {
    console.warn('[SubscriptionService] /api/subscription note:', err2?.message);
  }

  // 3. Fallback to cached/generated code so UI is NEVER empty
  await AsyncStorage.setItem('@mf_telegram_account_code', fallbackCode);
  return {
    success: true,
    code: fallbackCode,
    email: email || '',
    isGuest: !email,
    botUsername: process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || 'movieflix_pro_bot',
    botUrl: `https://t.me/${process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || 'movieflix_pro_bot'}?start=${fallbackCode}`,
  };
}

/**
 * Generate deep link to the Telegram Stars Bot
 */
export function getTelegramBotUrl(code) {
  const botUsername = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || 'movieflix_pro_bot';
  if (code) {
    return `https://t.me/${botUsername}?start=${encodeURIComponent(code)}`;
  }
  return `https://t.me/${botUsername}`;
}

/**
 * Redeem VIP Promo Code via /api/subscription?action=redeem_promo
 */
export async function redeemPromoCode(code, userCode = null, email = null, authToken = null) {
  if (!code || !code.trim()) {
    throw new Error('Please enter a valid promo code.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/api/subscription?action=redeem_promo`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      promo_code: code.trim().toUpperCase(),
      userCode,
      email,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to redeem promo code.');
  }

  return data;
}

/**
 * Sandbox Only: Simulate Instant Crypto Payment via signed IPN webhook
 */
export async function simulateSandboxPayment(orderId, authToken) {
  if (!orderId) throw new Error('Missing orderId for simulation');

  const res = await fetch(`${API_BASE}/api/subscription?action=sandbox_simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ orderId }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to simulate payment in sandbox.');
  }

  return data;
}

/**
 * Format ISO expiration date nicely (e.g. "15 Nov 2026")
 */
export function formatExpirationDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (_) {
    return '';
  }
}
