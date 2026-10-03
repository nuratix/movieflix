import React from 'react';
import { MovieFlixAndroidWidget } from './MovieFlixAndroidWidget';
import { getRandomWidgetPosters } from './widgetData';

/**
 * Android Widget Background Task Handler
 * Responds to system widget lifecycle events:
 * WIDGET_ADDED, WIDGET_UPDATE, WIDGET_RESIZED, WIDGET_CLICK
 */
export async function widgetTaskHandler(props) {
  const widgetInfo = props.widgetInfo;
  if (!widgetInfo || widgetInfo.widgetName === 'MovieFlixWidget') {
    switch (props.widgetAction) {
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED': {
        const freshPosters = getRandomWidgetPosters();
        props.renderWidget(<MovieFlixAndroidWidget posters={freshPosters} />);
        break;
      }
      case 'WIDGET_CLICK':
        // Clicks set with clickAction="OPEN_APP" are automatically routed to launch the app
        break;
      default:
        break;
    }
  }
}
