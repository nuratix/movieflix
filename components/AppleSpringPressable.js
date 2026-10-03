import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { triggerHaptic } from '../hapticService';

/**
 * Apple-grade Spring Pressable with fluid physics scaling and crisp haptics
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

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      tension: 340,
      friction: 22,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 18,
      useNativeDriver: true,
    }).start();
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
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        { opacity: pressed && activeOpacity ? activeOpacity : 1 },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...rest}
    >
      <Animated.View style={[styles.innerContainer, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});

export default AppleSpringPressable;
