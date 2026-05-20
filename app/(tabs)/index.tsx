import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';
import { BellIcon, CalDayShape, CardTrophyIcon } from '../../lib/icons';
import type { User } from '@supabase/supabase-js';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 52) / 2; // 2 cards with gap + padding

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getFirstName(user: User): string {
  const meta = user.user_metadata;
  if (meta?.full_name) return meta.full_name.split(' ')[0];
  if (user.email) {
    const base = user.email.split('@')[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return 'Golfer';
}

function getInitials(user: User): string {
  const meta = user.user_metadata;
  if (meta?.full_name) {
    return meta.full_name
      .split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return (user.email?.[0] ?? '?').toUpperCase();
}

function getWeekDays(count = 7) {
  const LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { num: d.getDate(), label: LABELS[d.getDay()], isToday: i === 0 };
  });
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
const DAY_SIZE = 50;

function DayCard({ num, label, isToday }: { num: number; label: string; isToday: boolean }) {
  return (
    <TouchableOpacity style={styles.dayWrap} activeOpacity={0.7}>
      <View style={{ width: DAY_SIZE, height: DAY_SIZE, position: 'relative' }}>
        <CalDayShape type={isToday ? 'selected' : 'default'} size={DAY_SIZE} />
        <View style={styles.dayOverlay}>
          <Text style={styles.dayNum}>{num}</Text>
          <Text style={styles.dayLabel}>{label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Flag icon (inline for card) ─────────────────────────────────────────────
function FlagIcon({ size = 40 }: { size?: number }) {
  const D =
    'M10 56.0001V10.0987C10 9.17565 10.4252 8.304 11.1523 7.73542C15.2025 4.5685 19.1986 3.67817 23.0801 4.09675C26.7446 4.49203 30.1882 6.05939 33.0977 7.35945C36.1935 8.74277 38.7563 9.85922 41.3115 10.1348C43.6497 10.387 46.0876 9.93482 48.9004 7.73542C49.8041 7.02894 51.0314 6.89983 52.0625 7.40242C53.0936 7.90508 53.748 8.95159 53.748 10.0987V36.9317C53.748 37.8548 53.3229 38.7264 52.5957 39.295C48.5455 42.4618 44.5494 43.3522 40.668 42.9337C37.0033 42.5385 33.5599 40.9709 30.6504 39.671C27.5547 38.2879 24.9925 37.1722 22.4375 36.8966C20.4239 36.6794 18.3373 36.986 16 38.4796V56.0001C16 57.6569 14.6569 59.0001 13 59.0001C11.3431 59.0001 10 57.6569 10 56.0001ZM22.4375 10.0626C20.4239 9.84538 18.3372 10.1521 16 11.6456V31.793C18.3925 30.8984 20.7568 30.6802 23.0801 30.9307C26.7446 31.3259 30.1882 32.8925 33.0977 34.1925C36.1935 35.5757 38.7563 36.6923 41.3115 36.9678C43.325 37.1849 45.4109 36.8774 47.748 35.3839V15.2374C45.3555 16.1321 42.9913 16.3512 40.668 16.1007C37.0034 15.7054 33.5599 14.138 30.6504 12.838C27.5548 11.4547 24.9925 10.3383 22.4375 10.0626Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d={D} fill="#4D7500" />
    </Svg>
  );
}

// ─── Camera icon (inline for card) ───────────────────────────────────────────
function CameraIcon({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Body */}
      <Path
        d="M3 28.15C3 24.51 3 22.69 3.71 21.3C4.33 20.08 5.33 19.08 6.55 18.46C7.94 17.75 9.76 17.75 13.4 17.75H51.11C54.74 17.75 56.56 17.75 57.95 18.46C59.17 19.08 60.17 20.08 60.79 21.3C61.5 22.69 61.5 24.51 61.5 28.14V46.36C61.5 49.99 61.5 51.81 60.79 53.2C60.17 54.42 59.17 55.42 57.95 56.04C56.56 56.75 54.74 56.75 51.11 56.75H13.39C9.76 56.75 7.94 56.75 6.55 56.04C5.33 55.42 4.33 54.42 3.71 53.2C3 51.81 3 49.99 3 46.35V28.15Z"
        stroke="#4D7500"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lens */}
      <Circle cx={32.25} cy={37.25} r={9.75} stroke="#4D7500" strokeWidth={5} />
      {/* Top bump */}
      <Path
        d="M21 17.75C21.02 15.39 22.3 9 27.74 8H36.76C42.2 8.99 43.49 15.39 43.5 17.75"
        stroke="#4D7500"
        strokeWidth={5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [handicap, setHandicap] = useState<number | null | 'new'>(undefined as any);
  const days = getWeekDays(7);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('handicap_index, is_new_to_golf')
          .eq('id', data.user.id)
          .single();
        if (profile?.is_new_to_golf) setHandicap('new');
        else setHandicap(profile?.handicap_index ?? null);
      }
    });
  }, []);

  const firstName = user ? getFirstName(user) : '...';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
          <Text style={styles.avatarText}>{user ? getInitials(user) : '?'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Home</Text>
        <TouchableOpacity hitSlop={8}>
          <BellIcon color={palette.graphiteShaft} size={24} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Greeting ── */}
        <View style={styles.greeting}>
          <Text style={styles.greetingHey}>Hey,</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
          <Text style={styles.handicapText}>
            {handicap === 'new' ? 'Handicap: New to Golf' : handicap != null ? `Handicap: ${handicap}` : 'Handicap: N/A'}
          </Text>
        </View>

        {/* ── Schedule ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SCHEDULE YOUR PLAY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarRow}
          >
            {days.map((d) => (
              <DayCard key={d.num} num={d.num} label={d.label} isToday={d.isToday} />
            ))}
          </ScrollView>
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No activity yet.</Text>
            <Text style={styles.emptyStateSub}>Schedule your first game and get on the board.</Text>
          </View>
          <View style={styles.activityRow}>
            <TouchableOpacity
              style={styles.activityCard}
              onPress={() => router.push('/round/create')}
              activeOpacity={0.85}
            >
              <FlagIcon size={48} />
              <Text style={styles.activityText}>Start a play</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.activityCard} activeOpacity={0.85}>
              <CameraIcon size={48} />
              <Text style={styles.activityText}>Make a post</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Win Performance ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WIN PERFORMANCE</Text>
          <View style={styles.perfCard}>
            <View style={styles.perfLeft}>
              <Text style={styles.perfPercent}>0%</Text>
              <Text style={styles.perfStats}>Matches: 0   Total Wins: 0</Text>
            </View>
            <CardTrophyIcon size={52} color="#E0E561" />
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bunkerSand,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.graphiteShaft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.bunkerSand,
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.graphiteShaft,
  },
  headerDivider: {
    height: 2,
    backgroundColor: palette.highVisLime,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // Greeting
  greeting: {
    marginBottom: 32,
  },
  greetingHey: {
    fontSize: 36,
    fontWeight: '700',
    color: palette.graphiteShaft,
    lineHeight: 40,
  },
  greetingName: {
    fontSize: 52,
    fontWeight: '800',
    color: palette.graphiteShaft,
    lineHeight: 56,
  },
  handicapText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7860',
    marginTop: 4,
  },

  // Section
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7A8C5A',
    letterSpacing: 1.2,
    marginBottom: 14,
  },

  // Calendar
  calendarRow: {
    gap: 10,
    paddingRight: 4,
  },
  dayWrap: {
    alignItems: 'center',
  },
  dayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  dayNum: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 12,
  },

  // Empty state
  emptyState: {
    backgroundColor: '#EEF3E8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.graphiteShaft,
    marginBottom: 2,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#6B7860',
    lineHeight: 18,
  },

  // Recent Activity
  activityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  activityCard: {
    width: CARD_W,
    aspectRatio: 1,
    backgroundColor: palette.highVisLime,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.graphiteShaft,
  },

  // Win Performance
  perfCard: {
    backgroundColor: '#3A5C10',
    borderRadius: 20,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  perfLeft: {
    gap: 6,
  },
  perfPercent: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 48,
  },
  perfStats: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
});
