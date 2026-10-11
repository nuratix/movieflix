import React from 'react';
import { Platform, TouchableOpacity, Linking, StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import {
  NOWPAYMENTS_DONATION_URL,
  NOWPAYMENTS_BUTTON_IMG,
  NOWPAYMENTS_BUTTON_ALT,
} from '../donationConfig';

export default function NowPaymentsButton({ style, imageStyle }) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <a
          href={NOWPAYMENTS_DONATION_URL}
          target="_blank"
          rel="noreferrer noopener"
          style={{ display: 'inline-block', lineHeight: 0, textDecoration: 'none' }}
        >
          <img
            src={NOWPAYMENTS_BUTTON_IMG}
            alt={NOWPAYMENTS_BUTTON_ALT}
            style={{
              height: 44,
              width: 'auto',
              display: 'block',
              borderRadius: 8,
              transition: 'opacity 0.2s ease',
            }}
          />
        </a>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => Linking.openURL(NOWPAYMENTS_DONATION_URL)}
      activeOpacity={0.8}
      accessibilityLabel={NOWPAYMENTS_BUTTON_ALT}
    >
      <ExpoImage
        source={{ uri: NOWPAYMENTS_BUTTON_IMG }}
        style={[styles.nativeImage, imageStyle]}
        contentFit="contain"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeImage: {
    width: 200,
    height: 44,
  },
});
