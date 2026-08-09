import React from 'react';
import { WebView, type WebViewProps } from 'react-native-webview';

/**
 * Native (iOS / Android) implementation — thin wrapper around react-native-webview.
 * Metro picks this file up automatically when bundling for native targets.
 */
export function PdfWebView(props: WebViewProps) {
  return <WebView {...props} />;
}
