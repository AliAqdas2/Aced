import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useGetCreatorDashboard,
  useGetCreatorEarnings,
  useGetCreatorBookings,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

function formatAmount(minor: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(minor / 100);
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

function KPICard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {accent && (
        <LinearGradient
          colors={[colors.gradientStart + '18', colors.gradientEnd + '08']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[styles.kpiIcon, { backgroundColor: accent ? colors.secondary : colors.muted }]}>
        <Ionicons name={icon as any} size={18} color={accent ? colors.primary : colors.mutedForeground} />
      </View>
      <Text style={[styles.kpiValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function StudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isCreator =
    user?.role === 'creator' || user?.role === 'admin' || user?.role === 'super_admin';

  const { data: dashData, refetch: refetchDash } = useGetCreatorDashboard();
  const { data: earningsData, refetch: refetchEarnings } = useGetCreatorEarnings();
  const { data: bookingsData, refetch: refetchBookings } = useGetCreatorBookings();

  const dash = (dashData as any)?.data ?? {};
  const earnings: any[] = earningsData?.data ?? [];
  const bookings: any[] = bookingsData?.data ?? [];

  const now = new Date();
  const upcomingBookings = bookings
    .filter((b: any) => new Date(b.scheduledStartAt) > now && b.status === 'confirmed')
    .sort((a: any, b: any) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime())
    .slice(0, 5);

  // Calculate earnings totals
  const totalEarned = earnings.reduce((sum: number, e: any) => sum + (e.creatorAmountMinorUnits ?? 0), 0);
  const thisMonth = earnings
    .filter((e: any) => {
      const d = new Date(e.createdAt ?? 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum: number, e: any) => sum + (e.creatorAmountMinorUnits ?? 0), 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDash(), refetchEarnings(), refetchBookings()]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.centerState, { paddingTop: topPad + 40 }]}>
          <Ionicons name="briefcase-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>Tutor Studio</Text>
          <Text style={[styles.stateSub, { color: colors.mutedForeground }]}>
            Sign in to manage your listings and earnings
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!isCreator) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={[colors.navy, colors.gradientStart, '#4B0FB0']}
          style={[styles.applyHero, { paddingTop: topPad + 20 }]}
        >
          <Ionicons name="diamond-outline" size={48} color="rgba(255,255,255,0.9)" />
          <Text style={styles.applyTitle}>Share your{'\n'}expertise</Text>
          <Text style={styles.applySub}>
            Tutor, sell notes, or run group sessions. Apply to become a creator today.
          </Text>
        </LinearGradient>
        <View style={styles.applyBody}>
          {[
            { icon: 'cash-outline', text: 'Earn from sessions, notes & courses' },
            { icon: 'calendar-outline', text: 'Set your own availability' },
            { icon: 'people-outline', text: 'Build your student community' },
          ].map((item) => (
            <View key={item.text} style={styles.applyFeature}>
              <View style={[styles.featureIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name={item.icon as any} size={20} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.foreground }]}>{item.text}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={styles.applyBtnText}>Apply to become a creator</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 90 }}
      >
        {/* Studio header */}
        <LinearGradient
          colors={[colors.navy, colors.gradientStart]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.studioHeader, { paddingTop: topPad + 16 }]}
        >
          <Text style={styles.studioLabel}>Creator Studio</Text>
          <Text style={styles.studioGreet}>
            Welcome back{user.email ? `, ${user.email.split('@')[0]}` : ''}
          </Text>
          <Text style={styles.studioSub}>Here's your performance overview</Text>
        </LinearGradient>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KPICard label="Total earned" value={formatAmount(totalEarned)} icon="wallet-outline" accent />
          <KPICard label="This month" value={formatAmount(thisMonth)} icon="trending-up-outline" />
          <KPICard
            label="Bookings"
            value={String(dash.totalBookings ?? bookings.length)}
            icon="calendar-outline"
          />
          <KPICard
            label="Listings"
            value={String(dash.activeListings ?? '—')}
            icon="grid-outline"
          />
        </View>

        {/* Upcoming bookings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Upcoming sessions</Text>
          {upcomingBookings.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.muted }]}>
              <Ionicons name="calendar-outline" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No upcoming sessions</Text>
            </View>
          ) : (
            upcomingBookings.map((b: any) => {
              const dt = formatDateTime(b.scheduledStartAt);
              return (
                <View
                  key={b.id}
                  style={[styles.sessionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.dateBox, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.dateDay, { color: colors.primary }]}>
                      {dt.date.split(' ')[1]}
                    </Text>
                    <Text style={[styles.dateMon, { color: colors.primary }]}>
                      {dt.date.split(' ')[2]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {b.listingTitle ?? 'Session'}
                    </Text>
                    <Text style={[styles.sessionSub, { color: colors.mutedForeground }]}>
                      {dt.time} · {b.durationMinutes ?? 60}min · {b.learnerDisplayName ?? 'Student'}
                    </Text>
                  </View>
                  {b.meetingLink && (
                    <TouchableOpacity
                      onPress={() => require('react-native').Linking.openURL(b.meetingLink)}
                      style={[styles.joinIcon, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="videocam" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Recent earnings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent earnings</Text>
          {earnings.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.muted }]}>
              <Ionicons name="cash-outline" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No earnings yet</Text>
            </View>
          ) : (
            earnings.slice(0, 5).map((e: any, idx: number) => (
              <View
                key={e.id ?? idx}
                style={[styles.earningsRow, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.earnIcon, { backgroundColor: colors.muted }]}>
                  <Ionicons name="arrow-down-outline" size={16} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.earnTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {e.description ?? 'Session payment'}
                  </Text>
                  <Text style={[styles.earnDate, { color: colors.mutedForeground }]}>
                    {e.createdAt ? formatDateTime(e.createdAt).date : ''}
                  </Text>
                </View>
                <Text style={[styles.earnAmount, { color: colors.success }]}>
                  +{formatAmount(e.creatorAmountMinorUnits ?? 0, e.currency)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerState: { flex: 1, alignItems: 'center', padding: 32, gap: 12 },
  stateTitle: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  stateSub: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
  actionBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  applyHero: { padding: 28, alignItems: 'center', gap: 10 },
  applyTitle: { fontSize: 34, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 40 },
  applySub: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 },
  applyBody: { padding: 24, gap: 16 },
  applyFeature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 15, flex: 1 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, marginTop: 8 },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  studioHeader: { paddingHorizontal: 20, paddingBottom: 24 },
  studioLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  studioGreet: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 4, letterSpacing: -0.5 },
  studioSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    overflow: 'hidden',
  },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  kpiLabel: { fontSize: 12, fontWeight: '500' },

  section: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateBox: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 18, fontWeight: '700' },
  dateMon: { fontSize: 11, fontWeight: '600', marginTop: -2 },
  sessionTitle: { fontSize: 14, fontWeight: '600' },
  sessionSub: { fontSize: 12, marginTop: 2 },
  joinIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  earningsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  earnIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  earnTitle: { fontSize: 14, fontWeight: '500' },
  earnDate: { fontSize: 12, marginTop: 2 },
  earnAmount: { fontSize: 15, fontWeight: '700' },

  emptyCard: { alignItems: 'center', padding: 28, borderRadius: 12, gap: 8 },
  emptyText: { fontSize: 14 },
});
