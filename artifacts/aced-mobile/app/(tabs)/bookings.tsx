import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetMyBookings } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | string;

function statusColor(status: BookingStatus, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case 'confirmed': return colors.primary;
    case 'pending': return colors.warning;
    case 'cancelled': return colors.destructive;
    case 'completed': return colors.success;
    default: return colors.mutedForeground;
  }
}

function statusBg(status: BookingStatus, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case 'confirmed': return colors.secondary;
    case 'cancelled': return colors.destructive + '22';
    case 'completed': return colors.success + '22';
    default: return colors.muted;
  }
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

function BookingCard({ booking }: { booking: any }) {
  const colors = useColors();
  const start = formatDateTime(booking.scheduledStartAt);
  const isUpcoming = new Date(booking.scheduledStartAt) > new Date();

  return (
    <View
      style={[
        styles.bookingCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Status bar */}
      <View style={[styles.statusBar, { backgroundColor: statusColor(booking.status, colors) }]} />

      <View style={styles.cardBody}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.listingTitle, { color: colors.foreground }]} numberOfLines={2}>
              {booking.listingTitle ?? 'Session'}
            </Text>
            {booking.creatorDisplayName && (
              <Text style={[styles.creatorName, { color: colors.mutedForeground }]}>
                with {booking.creatorDisplayName}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg(booking.status, colors) }]}>
            <Text style={[styles.statusText, { color: statusColor(booking.status, colors) }]}>
              {booking.status}
            </Text>
          </View>
        </View>

        {/* Time */}
        <View style={styles.timeRow}>
          <Ionicons name="calendar-outline" size={15} color={colors.mutedForeground} />
          <Text style={[styles.timeText, { color: colors.foreground }]}>
            {start.date}
          </Text>
          <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
          <Text style={[styles.timeText, { color: colors.foreground }]}>
            {start.time}
          </Text>
          {booking.durationMinutes && (
            <Text style={[styles.duration, { color: colors.mutedForeground }]}>
              · {booking.durationMinutes}min
            </Text>
          )}
        </View>

        {/* Join button */}
        {isUpcoming && booking.meetingLink && booking.status === 'confirmed' && (
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: colors.primary }]}
            onPress={() => Linking.openURL(booking.meetingLink)}
            activeOpacity={0.85}
          >
            <Ionicons name="videocam" size={16} color="#fff" />
            <Text style={styles.joinText}>Join session</Text>
          </TouchableOpacity>
        )}

        {/* Cancellation reason */}
        {booking.status === 'cancelled' && booking.cancellationReason && (
          <Text style={[styles.cancelReason, { color: colors.mutedForeground }]}>
            Reason: {booking.cancellationReason}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useGetMyBookings();

  const allBookings: any[] = data?.data ?? [];
  const now = new Date();

  const upcoming = allBookings.filter(
    (b) => new Date(b.scheduledStartAt) > now && b.status !== 'cancelled'
  );
  const past = allBookings.filter(
    (b) => new Date(b.scheduledStartAt) <= now || b.status === 'cancelled'
  );
  const shown = tab === 'upcoming' ? upcoming : past;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loginPrompt, { paddingTop: topPad + 40 }]}>
          <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.loginTitle, { color: colors.foreground }]}>Your bookings</Text>
          <Text style={[styles.loginSub, { color: colors.mutedForeground }]}>
            Sign in to see your upcoming sessions
          </Text>
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
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Bookings</Text>
        {/* Tab toggle */}
        <View style={[styles.segmented, { backgroundColor: colors.muted }]}>
          {(['upcoming', 'past'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.segItem, tab === t && { backgroundColor: colors.card }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.segText, { color: tab === t ? colors.foreground : colors.mutedForeground }]}>
                {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(b) => b.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
            <Ionicons
              name={tab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
              size={36}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {tab === 'upcoming' ? 'Book a session from the Discover tab' : 'Your completed sessions appear here'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <BookingCard booking={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  segItem: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: { padding: 16 },
  bookingCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  statusBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  creatorName: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  duration: {
    fontSize: 13,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  joinText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelReason: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  loginSub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  signInBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  signInText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 14,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
