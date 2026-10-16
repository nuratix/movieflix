import { Platform } from 'react-native';

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
 * Create a NOWPayments invoice for a chosen plan ($1/mo, $3/3mo, $5/6mo)
 */
export async function createSubscriptionInvoice(planKey = '1_month', authToken) {
  if (!authToken) {
    throw new Error('Please sign in to your Movieflix account before subscribing.');
  }

  const res = await fetch(`${API_BASE}/api/subscription?action=create_invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ plan: planKey }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.detail || 'Failed to generate crypto payment invoice.');
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
