import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { triggerHaptic } from '../hapticService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Apple-grade Spring Pressable with fluid physics scaling and crisp haptics.
 * Uses Animated.createAnimatedComponent(Pressable) directly to preserve exact
 * parent flexbox layout, padding, dimensions, and border radius.
 */
export function AppleSpringPressable({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.96,
  haptic = 'light',
  disabled = false,
  activeOpacity = 0.9,
  hitSlop,
  ...rest
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e) => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      tension: 340,
      friction: 22,
      useNativeDriver: true,
    }).start();
    if (rest.onPressIn) rest.onPressIn(e);
  };

  const handlePressOut = (e) => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 18,
      useNativeDriver: true,
    }).start();
    if (rest.onPressOut) rest.onPressOut(e);
  };

  const handlePress = (e) => {
    if (disabled) return;
    if (haptic) triggerHaptic(haptic);
    if (onPress) onPress(e);
  };

  const handleLongPress = (e) => {
    if (disabled) return;
    triggerHaptic('medium');
    if (onLongPress) onLongPress(e);
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={(state) => [
        { transform: [{ scale: scaleAnim }] },
        state.pressed && activeOpacity ? { opacity: activeOpacity } : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export default AppleSpringPressable;
