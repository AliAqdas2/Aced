import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';

const TYPE_LABELS: Record<string, string> = {
  service_offer: 'Session',
  digital_product: 'Digital',
  recorded_course: 'Course',
  group_session: 'Group',
};

const TYPE_ICONS: Record<string, string> = {
  service_offer: 'videocam-outline',
  digital_product: 'document-outline',
  recorded_course: 'play-circle-outline',
  group_session: 'people-outline',
};

interface ListingCardProps {
  id: string;
  title: string;
  type: string;
  averageRating?: number | null;
  reviewCount?: number;
  priceMinorUnits?: number | null;
  currency?: string;
  creatorName?: string;
  tags?: string[];
  style?: object;
}

function formatPrice(minor: number, currency: string): string {
  const major = minor / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(major);
}

export function ListingCard({
  id,
  title,
  type,
  averageRating,
  reviewCount,
  priceMinorUnits,
  currency = 'GBP',
  creatorName,
  tags = [],
  style,
}: ListingCardProps) {
  const colors = useColors();

  const handlePress = () => router.push(`/listing/${id}`);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}
    >
      {/* Color bar top */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topBar}
      />

      <View style={styles.body}>
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: colors.secondary }]}>
          <Ionicons
            name={(TYPE_ICONS[type] ?? 'grid-outline') as any}
            size={11}
            color={colors.primary}
          />
          <Text style={[styles.typeText, { color: colors.primary }]}>
            {TYPE_LABELS[type] ?? type}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {title}
        </Text>

        {/* Creator */}
        {creatorName && (
          <Text style={[styles.creator, { color: colors.mutedForeground }]} numberOfLines={1}>
            {creatorName}
          </Text>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <View style={styles.tagsRow}>
            {tags.slice(0, 2).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={[styles.ratingText, { color: colors.foreground }]}>
              {averageRating != null ? (averageRating / 10).toFixed(1) : 'New'}
            </Text>
            {reviewCount != null && reviewCount > 0 && (
              <Text style={[styles.reviewCount, { color: colors.mutedForeground }]}>
                ({reviewCount})
              </Text>
            )}
          </View>

          {priceMinorUnits != null && priceMinorUnits >= 0 ? (
            <Text style={[styles.price, { color: colors.primary }]}>
              {priceMinorUnits === 0 ? 'Free' : formatPrice(priceMinorUnits, currency)}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }
      : { elevation: 2 }),
  },
  topBar: {
    height: 3,
  },
  body: {
    padding: 14,
    gap: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  creator: {
    fontSize: 13,
    fontWeight: '400',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 12,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
  },
});
