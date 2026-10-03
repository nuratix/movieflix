import React from 'react';
import { Platform } from 'react-native';
import { getRandomWidgetPosters } from './widgetData';

/**
 * Triggers a live update for the Android Home Screen 2x4 Widget
 * Updates the widget posters with a fresh random local selection.
 */
export async function updateHomeScreenWidgetAsync() {
  if (Platform.OS !== 'android') return;

  try {
    const { requestWidgetUpdate } = require('react-native-android-widget');
    const { MovieFlixAndroidWidget } = require('./MovieFlixAndroidWidget');
    const posters = getRandomWidgetPosters();

    await requestWidgetUpdate({
      widgetName: 'MovieFlixWidget',
      renderWidget: () => <MovieFlixAndroidWidget posters={posters} />,
    });
  } catch (err) {
    // If native widget module is not yet compiled or running in Expo Go, fail gracefully
  }
}

/**
 * Requests the Android launcher to pin the MovieFlix 2x4 widget to the home screen
 * Returns true if supported and requested, false otherwise.
 */
export async function pinWidgetToHomeScreenAsync() {
  if (Platform.OS !== 'android') return false;

  try {
    const { requestPinWidget } = require('react-native-android-widget');
    return await requestPinWidget({ widgetName: 'MovieFlixWidget' });
  } catch (err) {
    console.warn('[Widget] Pin widget request error:', err?.message);
    return false;
  }
}
