// ─── MovieFlix System Status Service ─────────────────────────────────────────
// Checks Vercel environment flags (MANTANANCE and DONATE) via /api/status.
// When MANTANANCE=true -> maintenance: true
// When DONATE=true -> donate: true
// Defaults to false on network failures or missing env.

import { Platform } from 'react-native';

const STATUS_ENDPOINT =
  Platform.OS === 'web'
    ? '/api/status'
    : 'https://mws.wallpaperdomain.xyz/api/status';

export async function checkSystemStatusAsync() {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

    const res = await fetch(STATUS_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller ? controller.signal : undefined,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      return { maintenance: false, donate: false };
    }

    const data = await res.json();
    return {
      maintenance: Boolean(data?.maintenance),
      donate: Boolean(data?.donate),
    };
  } catch (err) {
    // Fail-open: if status check fails, do not block the user
    return { maintenance: false, donate: false };
  }
}
