import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogout } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

interface SettingRowProps {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  badge?: string;
}

function SettingRow({ icon, label, onPress, destructive, badge }: SettingRowProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: destructive ? colors.destructive + '18' : colors.muted }]}>
        <Ionicons
          name={icon as any}
          size={18}
          color={destructive ? colors.destructive : colors.mutedForeground}
        />
      </View>
      <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      {badge && (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      {!destructive && (
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={{ marginLeft: 'auto' }} />
      )}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, clearUser } = useAuth();

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: async () => {
        await clearUser();
      },
      onError: async () => {
        await clearUser();
      },
    },
  });

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => logoutMutation.mutate(),
      },
    ]);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.guestState, { paddingTop: topPad + 40 }]}>
          {/* Avatar placeholder */}
          <View style={[styles.guestAvatar, { backgroundColor: colors.muted }]}>
            <Ionicons name="person-outline" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.guestTitle, { color: colors.foreground }]}>Hello there!</Text>
          <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
            Sign in to access your profile, bookings, and more
          </Text>
          <TouchableOpacity
            style={[styles.signInBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth')}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/auth')}
            style={styles.registerLink}
          >
            <Text style={[styles.registerText, { color: colors.mutedForeground }]}>
              New to Aced?{' '}
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Create account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Initials for avatar
  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'AC';

  const roleBadgeColor =
    user.role === 'admin'
      ? colors.destructive
      : user.role === 'creator'
      ? colors.primary
      : colors.mutedForeground;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 90,
        }}
      >
        {/* Profile header */}
        <LinearGradient
          colors={[colors.navy, colors.gradientStart]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.profileHeader, { paddingTop: topPad + 20 }]}
        >
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>
          </View>
          <Text style={styles.profileEmail}>{user.email}</Text>
          <View style={[styles.rolePill, { borderColor: 'rgba(255,255,255,0.3)' }]}>
            <Text style={styles.rolePillText}>{user.role}</Text>
          </View>
          {!user.emailVerified && (
            <View style={styles.verifyBanner}>
              <Ionicons name="warning-outline" size={14} color="#FCD34D" />
              <Text style={styles.verifyText}>Email not verified</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {/* Account */}
          <Section title="ACCOUNT">
            <SettingRow icon="receipt-outline" label="My orders" onPress={() => {}} />
            <SettingRow icon="library-outline" label="My library" onPress={() => router.push('/library')} />
            <SettingRow icon="card-outline" label="Subscriptions" onPress={() => {}} />
            <SettingRow icon="notifications-outline" label="Notifications" onPress={() => {}} />
          </Section>

          {/* Creator */}
          {(user.role === 'creator' || user.role === 'admin') && (
            <Section title="CREATOR">
              <SettingRow
                icon="storefront-outline"
                label="My storefront"
                onPress={() => router.push('/(tabs)/studio')}
              />
              <SettingRow icon="list-outline" label="My listings" onPress={() => {}} />
              <SettingRow icon="calendar-outline" label="Availability" onPress={() => {}} />
              <SettingRow icon="logo-usd" label="Stripe payouts" onPress={() => {}} />
            </Section>
          )}

          {/* Support */}
          <Section title="SUPPORT">
            <SettingRow icon="help-circle-outline" label="Help & support" onPress={() => {}} />
            <SettingRow icon="document-text-outline" label="Terms of service" onPress={() => {}} />
            <SettingRow icon="shield-outline" label="Privacy policy" onPress={() => {}} />
          </Section>

          {/* Sign out */}
          <Section title="">
            <SettingRow
              icon="log-out-outline"
              label="Sign out"
              onPress={handleLogout}
              destructive
            />
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  guestState: { flex: 1, alignItems: 'center', padding: 32, gap: 12 },
  guestAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  guestTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  guestSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  signInText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  registerLink: { marginTop: 8 },
  registerText: { fontSize: 14 },

  profileHeader: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 8,
  },
  avatarWrapper: { marginBottom: 4 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  profileEmail: { color: '#fff', fontSize: 16, fontWeight: '500' },
  rolePill: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  rolePillText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  verifyText: { color: '#FCD34D', fontSize: 12, fontWeight: '500' },

  content: { padding: 16, gap: 4 },
  sectionContainer: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
