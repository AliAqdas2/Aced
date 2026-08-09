import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
  StatusBar,
} from 'react-native';
import { PdfWebView } from '@/components/PdfWebView';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  useGetMyLibrary,
  useGetAssetDownloadUrl,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LibraryItem {
  id: string;
  assetId?: string;
  listingId?: string;
  status?: string;
  accessCount?: number;
  listing?: {
    id?: string;
    title?: string;
    type?: string;
  };
  product?: {
    id?: string;
    fileType?: string;
    fileName?: string;
  };
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileTypeIcon(fileType?: string): string {
  const t = (fileType ?? '').toLowerCase();
  if (t === 'pdf') return 'document-text-outline';
  if (t === 'video' || t === 'mp4' || t === 'mov') return 'videocam-outline';
  if (t === 'audio' || t === 'mp3') return 'musical-notes-outline';
  if (t === 'zip') return 'archive-outline';
  return 'document-outline';
}

function fileTypeLabel(fileType?: string): string {
  const t = (fileType ?? '').toLowerCase();
  if (t === 'pdf') return 'PDF';
  if (t === 'video' || t === 'mp4' || t === 'mov') return 'Video';
  if (t === 'audio' || t === 'mp3') return 'Audio';
  return fileType ? fileType.toUpperCase() : 'Document';
}

function listingTypeLabel(type?: string): string {
  if (type === 'digital_product') return 'Digital product';
  if (type === 'course') return 'Course';
  return type ?? 'Content';
}

/** Returns true for file types that should open in the in-app viewer */
function isViewableInApp(fileType?: string): boolean {
  const t = (fileType ?? '').toLowerCase();
  return t === 'pdf' || t === 'doc' || t === 'docx' || t === 'ppt' || t === 'pptx';
}

/**
 * Build the URL to load inside WebView for a given signed download URL.
 * - PDFs on iOS: WKWebView renders them natively — load the URL directly.
 * - Office documents (doc, docx, ppt, pptx) on iOS: WKWebView cannot render
 *   these natively, so wrap in Google Docs viewer just like Android/web.
 * - Everything on Android / web: wrap in Google Docs viewer.
 */
function buildViewerUrl(url: string, fileType?: string): string {
  const t = (fileType ?? '').toLowerCase();
  const isPdf = t === 'pdf';
  if (Platform.OS === 'ios' && isPdf) {
    // WKWebView renders PDFs natively with pinch-to-zoom and scroll
    return url;
  }
  // Google Docs viewer handles PDF + Office formats on all other paths
  return `https://docs.google.com/gviewer?embedded=true&url=${encodeURIComponent(url)}`;
}

// ─── PDF / Document viewer modal ─────────────────────────────────────────────

interface PdfViewerModalProps {
  visible: boolean;
  url: string;
  title: string;
  fileType?: string;
  onClose: () => void;
}

function PdfViewerModal({ visible, url, title, fileType, onClose }: PdfViewerModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const viewerUrl = url ? buildViewerUrl(url, fileType) : '';

  const headerTop = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={[styles.viewerContainer, { backgroundColor: colors.background }]}>
        {/* Viewer header */}
        <View
          style={[
            styles.viewerHeader,
            {
              paddingTop: headerTop + 8,
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.viewerBackBtn}
            onPress={onClose}
            hitSlop={8}
          >
            <Ionicons name="chevron-down" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text
            style={[styles.viewerTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Loading overlay */}
        {loading && !error && (
          <View style={[styles.viewerLoading, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.viewerLoadingText, { color: colors.mutedForeground }]}>
              Loading document…
            </Text>
          </View>
        )}

        {/* Error state */}
        {error && (
          <View style={[styles.viewerLoading, { backgroundColor: colors.background }]}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.viewerErrorTitle, { color: colors.foreground }]}>
              Could not load document
            </Text>
            <Text style={[styles.viewerLoadingText, { color: colors.mutedForeground }]}>
              The file may be unavailable. Try again later.
            </Text>
            <TouchableOpacity
              style={[styles.viewerRetryBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                setError(false);
                setLoading(true);
              }}
            >
              <Text style={styles.viewerRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Document viewer */}
        {!error && viewerUrl ? (
          <PdfWebView
            source={{ uri: viewerUrl }}
            style={styles.webView}
            onLoadStart={() => {
              setLoading(true);
              setError(false);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            onHttpError={(e: { nativeEvent: { statusCode: number } }) => {
              if (e.nativeEvent.statusCode >= 400) {
                setLoading(false);
                setError(true);
              }
            }}
            allowsInlineMediaPlayback
            scalesPageToFit={Platform.OS === 'android'}
            bounces={false}
            showsHorizontalScrollIndicator={false}
          />
        ) : null}
      </View>
    </Modal>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function LibraryCard({ item }: { item: LibraryItem }) {
  const colors = useColors();
  const [opening, setOpening] = useState(false);
  const [pdfVisible, setPdfVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFileType, setPdfFileType] = useState<string | undefined>(undefined);

  const downloadMutation = useGetAssetDownloadUrl();

  const fileType = item.product?.fileType;
  const iconName = fileTypeIcon(fileType);
  const hasAsset = Boolean(item.assetId);
  const title = item.listing?.title ?? 'Document';

  const handleOpen = async () => {
    if (!item.assetId) {
      Alert.alert(
        'No downloadable content',
        'This item does not have a file attached yet.',
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpening(true);
    try {
      const result = await downloadMutation.mutateAsync({ id: item.assetId });
      const url = result?.data?.url;
      if (!url) throw new Error('No URL returned');

      if (isViewableInApp(fileType)) {
        // Open in-app viewer
        setPdfUrl(url);
        setPdfFileType(fileType);
        setPdfVisible(true);
      } else {
        // Open other types (video, audio, zip) in the system browser
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      }
    } catch (err: any) {
      Alert.alert(
        'Could not open file',
        err?.message ?? 'Please try again in a moment.',
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name={iconName as any} size={26} color={colors.primary} />
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            {fileType ? (
              <View style={[styles.typePill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.typePillText, { color: colors.mutedForeground }]}>
                  {fileTypeLabel(fileType)}
                </Text>
              </View>
            ) : (
              <View style={[styles.typePill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.typePillText, { color: colors.mutedForeground }]}>
                  {listingTypeLabel(item.listing?.type)}
                </Text>
              </View>
            )}
            {(item.accessCount ?? 0) > 0 && (
              <Text style={[styles.accessCount, { color: colors.mutedForeground }]}>
                Opened {item.accessCount} {item.accessCount === 1 ? 'time' : 'times'}
              </Text>
            )}
          </View>
        </View>

        {/* Open button */}
        <TouchableOpacity
          style={[
            styles.openBtn,
            {
              backgroundColor: hasAsset ? colors.primary : colors.muted,
            },
          ]}
          onPress={handleOpen}
          disabled={opening || !hasAsset}
          activeOpacity={0.8}
        >
          {opening ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={hasAsset ? 'open-outline' : 'lock-closed-outline'}
              size={16}
              color={hasAsset ? '#fff' : colors.mutedForeground}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* In-app PDF/document viewer */}
      <PdfViewerModal
        visible={pdfVisible}
        url={pdfUrl}
        title={title}
        fileType={pdfFileType}
        onClose={() => {
          setPdfVisible(false);
          setPdfUrl('');
          setPdfFileType(undefined);
        }}
      />
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useGetMyLibrary();

  const items: LibraryItem[] = (data?.data ?? []) as LibraryItem[];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>My library</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="library-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to view your library</Text>
          <TouchableOpacity
            style={[styles.signInBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth')}
            activeOpacity={0.85}
          >
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>My library</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Loading */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        // Empty state
        <View style={styles.centered}>
          <Ionicons name="library-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Your library is empty
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Purchase notes, slides, or courses to find them here
          </Text>
          <TouchableOpacity
            style={[styles.browseBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/search')}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={16} color="#fff" />
            <Text style={styles.browseBtnText}>Browse marketplace</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Content list
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            gap: 12,
            paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 24,
          }}
          renderItem={({ item }) => <LibraryCard item={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </Text>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  screenTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  browseBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  signInBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  signInText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  itemCount: { fontSize: 12, fontWeight: '600', marginBottom: 4, letterSpacing: 0.4 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  typePillText: { fontSize: 11, fontWeight: '600' },
  accessCount: { fontSize: 11 },

  openBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // PDF Viewer modal
  viewerContainer: { flex: 1 },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  viewerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  viewerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  webView: { flex: 1 },
  viewerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  viewerLoadingText: { fontSize: 14, textAlign: 'center' },
  viewerErrorTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  viewerRetryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  viewerRetryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
