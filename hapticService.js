// ─── Movieflix Apple-Grade Haptics Engine ─────────────────────────────────────
// Tactile, crisp haptic feedback for iOS, Android, and Web Vibration API
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Trigger subtle, crisp haptic feedback
 * @param {'light'|'medium'|'heavy'|'selection'|'success'|'warning'|'error'} type
 */
export function triggerHaptic(type = 'light') {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
        const pattern =
          type === 'heavy' || type === 'error'
            ? [20, 40, 20]
            : type === 'medium' || type === 'warning'
            ? 16
            : type === 'success'
            ? [10, 30, 15]
            : 8;
        window.navigator.vibrate(pattern);
      }
      return;
    }

    switch (type) {
      case 'selection':
        Haptics.selectionAsync().catch(() => {});
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        break;
      case 'light':
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
    }
  } catch (_) {
    // Fail silently on unsupported devices
  }
}

export const hapticLight = () => triggerHaptic('light');
export const hapticMedium = () => triggerHaptic('medium');
export const hapticHeavy = () => triggerHaptic('heavy');
export const hapticSelection = () => triggerHaptic('selection');
export const hapticSuccess = () => triggerHaptic('success');
export const hapticWarning = () => triggerHaptic('warning');
export const hapticError = () => triggerHaptic('error');

export default {
  triggerHaptic,
  hapticLight,
  hapticMedium,
  hapticHeavy,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
  hapticError,
};
