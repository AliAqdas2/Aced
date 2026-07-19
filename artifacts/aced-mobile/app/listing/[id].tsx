import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import {
  useGetListing,
  useGetServiceAvailability,
  useCreateBookingHold,
  useCreateCheckoutSession,
  useConfirmFreeBooking,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/SkeletonLoader';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getDatesForRange(numDays = 14) {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < numDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatPrice(minor: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(minor / 100);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function ListingDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingStep, setBookingStep] = useState<'idle' | 'holding' | 'checking-out'>('idle');

  const dates = getDatesForRange(14);

  const { data: listingData, isLoading: listingLoading } = useGetListing(id ?? '');
  const listing = listingData?.data?.listing;
  const price = listingData?.data?.price;
  const serviceOffer = listingData?.data?.serviceOffer as any;
  const reviews: any[] = listingData?.data?.reviews ?? [];

  const serviceOfferId = serviceOffer?.id;
  const isFree = !price || price.amountMinorUnits === 0;
  const isService = listing?.type === 'service_offer';

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data: availData, isLoading: availLoading } = useGetServiceAvailability(
    serviceOfferId ?? '',
    {
      timezone: tz,
      from: toDateStr(selectedDate),
      to: toDateStr(selectedDate),
    }
  );

  const availableSlots = (availData?.data?.slots ?? []).filter((s: any) => s.available);

  const holdMutation = useCreateBookingHold();
  const checkoutMutation = useCreateCheckoutSession();
  const confirmMutation = useConfirmFreeBooking();

  const handlePurchase = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!listing) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBookingStep('checking-out');

    try {
      if (isFree) {
        // Free digital product — confirm directly
        await confirmMutation.mutateAsync({
          data: { listingId: listing.id } as any,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Added to library!', 'Find it in your profile under My library.', [
          { text: 'OK', onPress: () => router.push('/(tabs)/profile') },
        ]);
      } else {
        const session = await checkoutMutation.mutateAsync({
          data: { listingId: listing.id } as any,
        });
        if (session.data?.checkoutUrl) {
          await WebBrowser.openBrowserAsync(session.data.checkoutUrl);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not complete purchase');
    } finally {
      setBookingStep('idle');
    }
  };

  const handleBook = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!selectedSlot) {
      Alert.alert('Select a time', 'Please pick an available time slot first.');
      return;
    }
    if (!listing || !serviceOfferId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBookingStep('holding');

    try {
      if (isFree) {
        // Confirm immediately
        const result = await confirmMutation.mutateAsync({
          data: {
            listingId: listing.id,
            serviceOfferId,
            startAt: selectedSlot,
            timezone: tz,
          },
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Booked!', 'Your session has been confirmed.', [
          { text: 'OK', onPress: () => router.push('/(tabs)/bookings') },
        ]);
      } else {
        // Create hold then checkout
        const hold = await holdMutation.mutateAsync({
          data: {
            listingId: listing.id,
            serviceOfferId,
            startAt: selectedSlot,
            timezone: tz,
          },
        });

        setBookingStep('checking-out');

        const session = await checkoutMutation.mutateAsync({
          data: {
            listingId: listing.id,
            holdId: hold.data?.id,
          },
        });

        if (session.data?.checkoutUrl) {
          await WebBrowser.openBrowserAsync(session.data.checkoutUrl);
          router.push('/(tabs)/bookings');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not complete booking');
    } finally {
      setBookingStep('idle');
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (listingLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingHeader, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Skeleton height={28} width="80%" />
          <Skeleton height={16} />
          <Skeleton height={16} width="60%" />
          <View style={{ height: 16 }} />
          <Skeleton height={180} borderRadius={12} />
        </ScrollView>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { position: 'absolute', top: topPad + 8, left: 16 }]}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Ionicons name="alert-circle-outline" size={40} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Listing not found</Text>
      </View>
    );
  }

  const isBooking = bookingStep !== 'idle' || holdMutation.isPending || checkoutMutation.isPending || confirmMutation.isPending;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky back button */}
      <View style={[styles.stickyHeader, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === 'web' ? 34 + 100 : insets.bottom + 100,
        }}
      >
        {/* Color hero */}
        <LinearGradient
          colors={[colors.navy, colors.gradientStart, '#4B0FB0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroGradient, { paddingTop: topPad + 56 }]}
        >
          {/* Type badge */}
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{listing.type.replace('_', ' ')}</Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={3}>{listing.title}</Text>
          {listing.averageRating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FBBF24" />
              <Text style={styles.ratingText}>{(listing.averageRating / 10).toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({listing.reviewCount ?? 0} reviews)</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {/* Price + booking info */}
          <View style={[styles.priceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Price per session</Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>
                {price
                  ? price.amountMinorUnits === 0
                    ? 'Free'
                    : formatPrice(price.amountMinorUnits, price.currency)
                  : 'Contact'}
              </Text>
            </View>
            {serviceOffer?.durationMinutes && (
              <View style={[styles.durationPill, { backgroundColor: colors.secondary }]}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={[styles.durationText, { color: colors.primary }]}>
                  {serviceOffer.durationMinutes}min
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {listing.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
              <Text style={[styles.description, { color: colors.foreground }]}>{listing.description}</Text>
            </View>
          )}

          {/* Tags */}
          {(listing.tags?.length ?? 0) > 0 && (
            <View style={styles.tagsRow}>
              {(listing.tags ?? []).map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Slot picker (service offer only) */}
          {isService && serviceOfferId && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pick a time</Text>

              {/* Date scroller */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                {dates.map((d) => {
                  const isSelected = toDateStr(d) === toDateStr(selectedDate);
                  return (
                    <TouchableOpacity
                      key={toDateStr(d)}
                      style={[
                        styles.dateChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.card,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        setSelectedDate(d);
                        setSelectedSlot(null);
                      }}
                    >
                      <Text style={[styles.dateDow, { color: isSelected ? 'rgba(255,255,255,0.75)' : colors.mutedForeground }]}>
                        {DAYS[d.getDay()]}
                      </Text>
                      <Text style={[styles.dateNum, { color: isSelected ? '#fff' : colors.foreground }]}>
                        {d.getDate()}
                      </Text>
                      <Text style={[styles.dateMon, { color: isSelected ? 'rgba(255,255,255,0.75)' : colors.mutedForeground }]}>
                        {MONTHS[d.getMonth()]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time slots */}
              {availLoading ? (
                <View style={styles.slotsGrid}>
                  {[1, 2, 3, 4, 5, 6].map((k) => (
                    <Skeleton key={k} width={90} height={40} borderRadius={10} />
                  ))}
                </View>
              ) : availableSlots.length === 0 ? (
                <View style={[styles.noSlots, { backgroundColor: colors.muted }]}>
                  <Ionicons name="calendar-clear-outline" size={24} color={colors.mutedForeground} />
                  <Text style={[styles.noSlotsText, { color: colors.mutedForeground }]}>
                    No slots available on this day
                  </Text>
                </View>
              ) : (
                <View style={styles.slotsGrid}>
                  {availableSlots.map((slot: any) => {
                    const isSelected = slot.startAt === selectedSlot;
                    return (
                      <TouchableOpacity
                        key={slot.startAt}
                        style={[
                          styles.slotChip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          setSelectedSlot(slot.startAt);
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text style={[styles.slotTime, { color: isSelected ? '#fff' : colors.foreground }]}>
                          {formatTime(slot.startAt)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reviews</Text>
              {reviews.slice(0, 3).map((review: any) => (
                <View
                  key={review.id}
                  style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.starsRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name="star"
                          size={13}
                          color={i < review.overallRating ? '#FBBF24' : colors.muted}
                        />
                      ))}
                    </View>
                    <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>
                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : ''}
                    </Text>
                  </View>
                  {review.body && (
                    <Text style={[styles.reviewBody, { color: colors.foreground }]} numberOfLines={4}>
                      {review.body}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[
          styles.bottomCta,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 8,
          },
        ]}
      >
        {isService ? (
          <TouchableOpacity
            style={[
              styles.bookBtn,
              {
                backgroundColor: selectedSlot ? colors.primary : colors.muted,
                opacity: isBooking ? 0.7 : 1,
              },
            ]}
            onPress={handleBook}
            disabled={isBooking || !selectedSlot}
            activeOpacity={0.85}
          >
            {isBooking ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name={isFree ? 'calendar-outline' : 'cart-outline'}
                  size={20}
                  color={selectedSlot ? '#fff' : colors.mutedForeground}
                />
                <Text style={[styles.bookBtnText, { color: selectedSlot ? '#fff' : colors.mutedForeground }]}>
                  {!selectedSlot
                    ? 'Select a slot'
                    : isFree
                    ? 'Book free session'
                    : `Book · ${price ? formatPrice(price.amountMinorUnits, price.currency) : ''}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.bookBtn, { backgroundColor: colors.primary, opacity: isBooking ? 0.7 : 1 }]}
            onPress={handlePurchase}
            disabled={isBooking}
            activeOpacity={0.85}
          >
            {isBooking ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="cart-outline" size={20} color="#fff" />
                <Text style={styles.bookBtnText}>
                  {price
                    ? price.amountMinorUnits === 0
                      ? 'Get for free'
                      : `Buy · ${formatPrice(price.amountMinorUnits, price.currency)}`
                    : 'Get'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16 },

  loadingHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroGradient: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 8,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  ratingCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },

  content: { padding: 16, gap: 20 },

  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  priceLabel: { fontSize: 12, fontWeight: '500' },
  priceValue: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  durationText: { fontSize: 13, fontWeight: '600' },

  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 23 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  tagText: { fontSize: 13 },

  dateScroll: { marginBottom: 4 },
  dateChip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 60,
  },
  dateDow: { fontSize: 11, fontWeight: '600' },
  dateNum: { fontSize: 20, fontWeight: '700', marginVertical: 2 },
  dateMon: { fontSize: 10 },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  slotTime: { fontSize: 14, fontWeight: '600' },
  noSlots: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    gap: 8,
  },
  noSlotsText: { fontSize: 14 },

  reviewCard: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewDate: { fontSize: 12 },
  reviewBody: { fontSize: 14, lineHeight: 21 },

  bottomCta: {
    borderTopWidth: 1,
    padding: 16,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  bookBtnText: { fontSize: 16, fontWeight: '700' },
});
