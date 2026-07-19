import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSearchMarketplace } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { ListingCard } from '@/components/ListingCard';
import { ListingCardSkeleton } from '@/components/SkeletonLoader';

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Sessions', value: 'service_offer' },
  { label: 'Courses', value: 'recorded_course' },
  { label: 'Products', value: 'digital_product' },
  { label: 'Groups', value: 'group_session' },
] as const;

const SORT_OPTIONS = [
  { label: 'Recommended', value: 'recommended' },
  { label: 'Rating', value: 'rating' },
  { label: 'Newest', value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
] as const;

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<string>('recommended');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data, isLoading } = useSearchMarketplace({
    q: query || undefined,
    type: activeType as any,
    sort: sort as any,
    limit: 30,
  });

  const results = data?.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: topPad + 8,
          },
        ]}
      >
        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search subjects, tutors, topics…"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== 'ios' && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort button */}
        <TouchableOpacity
          style={[styles.sortBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowSortMenu(!showSortMenu)}
          activeOpacity={0.75}
        >
          <Ionicons name="funnel-outline" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Sort dropdown */}
      {showSortMenu && (
        <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sortItem, sort === opt.value && { backgroundColor: colors.secondary }]}
              onPress={() => { setSort(opt.value); setShowSortMenu(false); }}
            >
              <Text style={[styles.sortItemText, { color: sort === opt.value ? colors.primary : colors.foreground }]}>
                {opt.label}
              </Text>
              {sort === opt.value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Type filter chips */}
      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.label}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => {
            const active = item.value === activeType;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveType(item.value as any)}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.filterText, { color: active ? '#fff' : colors.foreground }]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Results */}
      <FlatList
        data={isLoading ? [] : results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.resultsList,
          {
            paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12, padding: 16 }}>
              {[1, 2, 3].map((k) => <ListingCardSkeleton key={k} />)}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
              <Ionicons name="search-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {query ? `Nothing found for "${query}"` : 'No listings available yet'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ListingCard
            id={item.id}
            title={item.title}
            type={item.type}
            averageRating={item.averageRating}
            reviewCount={item.reviewCount}
            priceMinorUnits={(item as any).activePrice?.amountMinorUnits}
            currency={(item as any).activePrice?.currency}
            creatorName={(item as any).creator?.displayName}
            tags={item.tags}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  sortBtn: {
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortMenu: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sortItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filtersWrapper: {
    paddingVertical: 10,
  },
  filtersList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resultsList: {
    padding: 16,
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
