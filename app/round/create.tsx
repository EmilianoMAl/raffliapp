import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../lib/theme/colors';

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

const GOLF_API_KEY = process.env.EXPO_PUBLIC_GOLF_API_KEY ?? '';

type Course = {
  id: number;
  club_name: string;
  course_name: string;
  location: { city: string; state: string; country: string };
};

const GAME_MODES = [
  { id: 'skins', label: 'Skins', emoji: '🏆' },
  { id: 'nassau', label: 'Nassau', emoji: '🔱' },
  { id: 'match', label: 'Match Play', emoji: '⚔️' },
  { id: 'bestball', label: 'Best Ball', emoji: '🎯' },
  { id: 'scramble', label: 'Scramble', emoji: '🌀' },
  { id: 'wolf', label: 'Wolf', emoji: '🐺' },
];

const QUICK_AMOUNTS = [5, 10, 20, 50];

const FRIENDS = [
  { id: '1', name: 'Carlos M.', initials: 'CM' },
  { id: '2', name: 'Diego R.', initials: 'DR' },
  { id: '3', name: 'Sofía L.', initials: 'SL' },
];

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <View style={styles.stepper}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        return (
          <View key={step} style={styles.stepperRow}>
            <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
              {done ? (
                <Ionicons name="checkmark" size={12} color={palette.bunkerSand} />
              ) : (
                <Text style={[styles.stepNum, active && styles.stepNumActive]}>{step}</Text>
              )}
            </View>
            {step < TOTAL_STEPS && (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Step 1: Select Course ────────────────────────────────────────────────────
function StepCourse({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string, label: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 3) {
      setCourses([]);
      setError('');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Key ${GOLF_API_KEY}` } }
        );
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        setCourses(data.courses ?? []);
      } catch {
        setError('Could not load courses. Check your connection.');
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Course</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search golf course..."
        placeholderTextColor="#9CA3AF"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />

      {loading && (
        <Text style={styles.courseStatusText}>Searching...</Text>
      )}

      {!loading && error !== '' && (
        <Text style={[styles.courseStatusText, styles.courseStatusError]}>{error}</Text>
      )}

      {!loading && error === '' && query.length >= 3 && courses.length === 0 && (
        <Text style={styles.courseStatusText}>No courses found. Try another search.</Text>
      )}

      <View style={styles.courseList}>
        {courses.map((course) => {
          const courseId = String(course.id);
          const isSelected = courseId === selected;
          const locationParts = [course.location.city, course.location.country].filter(Boolean);
          const showCourseName = course.course_name && course.course_name !== course.club_name;
          return (
            <TouchableOpacity
              key={courseId}
              style={[styles.courseCard, isSelected && styles.courseCardSelected]}
              onPress={() => onSelect(courseId, course.club_name)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="golf-outline"
                size={20}
                color={isSelected ? palette.fairwayGreen : palette.graphiteShaft}
              />
              <View style={styles.courseInfo}>
                <Text style={[styles.courseLabel, isSelected && styles.courseLabelSelected]}>
                  {course.club_name}
                </Text>
                {showCourseName && (
                  <Text style={styles.courseSubLabel}>{course.course_name}</Text>
                )}
                {locationParts.length > 0 && (
                  <Text style={styles.courseLocation}>{locationParts.join(', ')}</Text>
                )}
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={20} color={palette.fairwayGreen} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 2: Game Mode ────────────────────────────────────────────────────────
function StepGameMode({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Game Mode</Text>
      <View style={styles.modeGrid}>
        {GAME_MODES.map((mode) => {
          const isSelected = mode.id === selected;
          return (
            <TouchableOpacity
              key={mode.id}
              style={[styles.modeCard, isSelected && styles.modeCardSelected]}
              onPress={() => onSelect(mode.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.modeEmoji}>{mode.emoji}</Text>
              <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 3: Wager ────────────────────────────────────────────────────────────
function StepWager({
  quickAmount,
  customAmount,
  onQuickSelect,
  onCustomChange,
}: {
  quickAmount: number | null;
  customAmount: string;
  onQuickSelect: (a: number) => void;
  onCustomChange: (v: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Set your wager amount</Text>
      <View style={styles.quickAmounts}>
        {QUICK_AMOUNTS.map((amt) => {
          const isSelected = quickAmount === amt && customAmount === '';
          return (
            <TouchableOpacity
              key={amt}
              style={[styles.amountPill, isSelected && styles.amountPillSelected]}
              onPress={() => onQuickSelect(amt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.amountPillText, isSelected && styles.amountPillTextSelected]}>
                ${amt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.orDivider}>or enter a custom amount</Text>
      <TextInput
        style={styles.amountInput}
        placeholder="$0"
        placeholderTextColor="#9CA3AF"
        value={customAmount}
        onChangeText={onCustomChange}
        keyboardType="numeric"
      />
    </View>
  );
}

// ─── Step 4: Invite Friends ───────────────────────────────────────────────────
function StepFriends({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Invite Friends</Text>
      <View style={styles.friendList}>
        {FRIENDS.map((friend) => {
          const isSelected = selected.has(friend.id);
          return (
            <TouchableOpacity
              key={friend.id}
              style={[styles.friendRow, isSelected && styles.friendRowSelected]}
              onPress={() => onToggle(friend.id)}
              activeOpacity={0.8}
            >
              <View style={styles.friendAvatar}>
                <Text style={styles.friendInitials}>{friend.initials}</Text>
              </View>
              <Text style={styles.friendName}>{friend.name}</Text>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Ionicons name="checkmark" size={14} color={palette.bunkerSand} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Create Round Screen ──────────────────────────────────────────────────────
export default function CreateRoundScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // State per step
  const [course, setCourse] = useState(''); // stores course id
  const [courseLabel, setCourseLabel] = useState('');
  const [gameMode, setGameMode] = useState('');
  const [quickAmount, setQuickAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());

  const canContinue = () => {
    if (step === 1) return course !== '';
    if (step === 2) return gameMode !== '';
    if (step === 3) return quickAmount !== null || customAmount !== '';
    return true;
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      Alert.alert('¡Ronda creada! 🏌️', 'Próximamente');
    }
  };

  const toggleFriend = (id: string) => {
    setInvitedFriends((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleQuickAmount = (amt: number) => {
    setQuickAmount(amt);
    setCustomAmount('');
  };

  const handleCustomAmount = (val: string) => {
    setCustomAmount(val);
    setQuickAmount(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* ── Nav bar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={palette.graphiteShaft} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <Stepper current={step} />
        <View style={styles.navbarSpacer} />
      </View>

      {/* ── Step content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <StepCourse
            selected={course}
            onSelect={(id, label) => { setCourse(id); setCourseLabel(label); }}
          />
        )}
        {step === 2 && (
          <StepGameMode selected={gameMode} onSelect={setGameMode} />
        )}
        {step === 3 && (
          <StepWager
            quickAmount={quickAmount}
            customAmount={customAmount}
            onQuickSelect={handleQuickAmount}
            onCustomChange={handleCustomAmount}
          />
        )}
        {step === 4 && (
          <StepFriends selected={invitedFriends} onToggle={toggleFriend} />
        )}
      </ScrollView>

      {/* ── Continue button ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue() && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue()}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>
            {step === TOTAL_STEPS ? 'Start Round' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bunkerSand,
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0E8',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  backLabel: {
    fontSize: 15,
    color: palette.graphiteShaft,
    fontWeight: '500',
  },
  navbarSpacer: {
    minWidth: 64,
  },

  // Stepper
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: palette.graphiteShaft,
  },
  stepDotDone: {
    backgroundColor: palette.fairwayGreen,
  },
  stepNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepNumActive: {
    color: palette.bunkerSand,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 2,
  },
  stepLineDone: {
    backgroundColor: palette.fairwayGreen,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 16,
  },

  // Shared step styles
  stepContent: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.graphiteShaft,
    marginBottom: 4,
  },

  // Step 1 — Course
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: palette.graphiteShaft,
  },
  courseList: {
    gap: 10,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bunkerSand,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  courseCardSelected: {
    borderColor: palette.highVisLime,
    backgroundColor: '#F7F9E8',
  },
  courseLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: palette.graphiteShaft,
  },
  courseLabelSelected: {
    fontWeight: '700',
  },
  courseInfo: {
    flex: 1,
    gap: 2,
  },
  courseSubLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  courseLocation: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  courseStatusText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
  },
  courseStatusError: {
    color: palette.sundayRed,
  },
  checkIcon: {
    marginLeft: 'auto',
  },

  // Step 2 — Game Mode
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modeCard: {
    width: '47%',
    backgroundColor: palette.bunkerSand,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  modeCardSelected: {
    backgroundColor: palette.graphiteShaft,
    borderColor: palette.graphiteShaft,
  },
  modeEmoji: {
    fontSize: 28,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.graphiteShaft,
  },
  modeLabelSelected: {
    color: palette.highVisLime,
  },

  // Step 3 — Wager
  quickAmounts: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  amountPill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: palette.bunkerSand,
  },
  amountPillSelected: {
    backgroundColor: palette.graphiteShaft,
    borderColor: palette.graphiteShaft,
  },
  amountPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.graphiteShaft,
  },
  amountPillTextSelected: {
    color: palette.highVisLime,
  },
  orDivider: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 4,
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.graphiteShaft,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 20,
    fontWeight: '600',
    color: palette.graphiteShaft,
    textAlign: 'center',
  },

  // Step 4 — Friends
  friendList: {
    gap: 10,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bunkerSand,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 12,
  },
  friendRowSelected: {
    borderColor: palette.highVisLime,
    backgroundColor: '#F7F9E8',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.graphiteShaft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.bunkerSand,
  },
  friendName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: palette.graphiteShaft,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: palette.fairwayGreen,
    borderColor: palette.fairwayGreen,
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0E8',
  },
  continueBtn: {
    backgroundColor: palette.highVisLime,
    borderRadius: 100,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.graphiteShaft,
  },
});
