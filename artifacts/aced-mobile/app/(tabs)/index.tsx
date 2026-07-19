import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetFeatured } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { ListingCard } from '@/components/ListingCard';
import { ListingCardSkeleton } from '@/components/SkeletonLoader';
import { useAuth } from '@/contexts/AuthContext';

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useGetFeatured();
  const featured = data?.data;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 90 }}
      >
        {/* Hero header */}
        <LinearGradient
          colors={[colors.navy, colors.gradientStart, '#4B0FB0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topPad + 16 }]}
        >
          <View style={styles.heroContent}>
            <View style={styles.logoRow}>
              <View style={[styles.logoMark, { borderColor: 'rgba(255,255,255,0.3)' }]}>
                <Ionicons name="diamond-outline" size={20} color="#fff" />
              </View>
              <Text style={styles.logoText}>aced</Text>
              {user && (
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{user.role}</Text>
                </View>
              )}
            </View>

            <Text style={styles.heroTitle}>
              Find your{'\n'}perfect tutor
            </Text>
            <Text style={styles.heroSub}>
              Expert sessions, notes & courses from top graduates
            </Text>

            {/* Search CTA */}
            <TouchableOpacity
              style={styles.heroSearch}
              onPress={() => router.push('/(tabs)/search')}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={18} color={colors.mutedForeground} />
              <Text style={[styles.heroSearchText, { color: colors.mutedForeground }]}>
                Search subjects, topics…
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Featured universities */}
        {(featured?.universities?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Universities</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.uniScroll}>
              {(featured?.universities ?? []).map((uni) => (
                <TouchableOpacity
                  key={uni.id}
                  style={[styles.uniChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.75}
                >
                  <Ionicons name="school-outline" size={16} color={colors.primary} />
                  <Text style={[styles.uniChipText, { color: colors.foreground }]} numberOfLines={1}>
                    {uni.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent listings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent listings</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.listingsGrid}>
              {[1, 2, 3, 4].map((k) => (
                <ListingCardSkeleton key={k} />
              ))}
            </View>
          ) : (featured?.recentListings?.length ?? 0) === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
              <Ionicons name="layers-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No listings yet
              </Text>
            </View>
          ) : (
            <View style={styles.listingsGrid}>
              {(featured?.recentListings ?? []).map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  title={listing.title}
                  type={listing.type}
                  averageRating={listing.averageRating}
                  reviewCount={listing.reviewCount}
                  tags={listing.tags}
                />
              ))}
            </View>
          )}
        </View>

        {/* CTA for non-creators */}
        {user && user.role === 'student' && (
          <TouchableOpacity
            style={[styles.ctaBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/studio')}
          >
            <LinearGradient
              colors={[colors.gradientStart + '22', colors.gradientEnd + '11']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Ionicons name="rocket-outline" size={28} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Share your expertise</Text>
                <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>Apply to become a creator</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingBottom: 28,
  },
  heroContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 21,
  },
  heroSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  heroSearchText: {
    fontSize: 15,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  uniScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  uniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 200,
  },
  uniChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listingsGrid: {
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
  },
  ctaBanner: {
    margin: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  ctaSub: {
    fontSize: 13,
    marginTop: 2,
  },
});
