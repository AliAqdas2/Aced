import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

export interface PdfWebViewProps {
  source: { uri: string };
  style?: object;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: () => void;
  onHttpError?: (e: { nativeEvent: { statusCode: number } }) => void;
  /** Unused on web — accepted for API parity with the native implementation. */
  allowsInlineMediaPlayback?: boolean;
  scalesPageToFit?: boolean;
  bounces?: boolean;
  showsHorizontalScrollIndicator?: boolean;
}

/**
 * Web implementation — renders a full-size <iframe> inside a React Native View.
 * Metro picks this file up automatically when bundling for the web target.
 * The iframe loads the Google Docs viewer URL (or the direct PDF URL for iOS,
 * but on web the caller always passes the Google Docs URL).
 */
export function PdfWebView({
  source,
  style,
  onLoadStart,
  onLoadEnd,
  onError,
}: PdfWebViewProps) {
  // In React Native Web, a View renders as a <div>, so the ref gives us a real
  // DOM element we can append children to.
  const containerRef = useRef<View>(null);

  useEffect(() => {
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const iframe = document.createElement('iframe');
    iframe.src = source.uri;
    iframe.setAttribute(
      'style',
      'width:100%;height:100%;border:none;display:block;',
    );
    iframe.onload = () => onLoadEnd?.();
    iframe.onerror = () => onError?.();
    node.appendChild(iframe);
    onLoadStart?.();

    return () => {
      try {
        node.removeChild(iframe);
      } catch {
        // already removed
      }
    };
  // Re-mount iframe whenever the URL changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.uri]);

  return <View ref={containerRef} style={[styles.container, style]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
