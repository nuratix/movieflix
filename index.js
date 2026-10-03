// Enable Fast Refresh and HMR runtime in development for Web & Native
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// Register Android Home Screen Widget task handler
if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('./widget/widgetTaskHandler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (widgetErr) {
    // Graceful fallback if native widget module is not yet compiled
    console.log('[Widget] Android widget registration standby:', widgetErr?.message);
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
