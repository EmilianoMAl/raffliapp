import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';

const INPUT_BG = '#EEF3E8';

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  handicap_index: number | null;
  is_new_to_golf: boolean;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function EditIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={palette.graphiteShaft} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={palette.graphiteShaft} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function ChevronRight({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 18L15 12L9 6" stroke="#A0A898" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function LogOutIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={palette.sundayRed} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ profile, size = 80 }: { profile: Profile | null; size?: number }) {
  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : profile?.username?.[0]?.toUpperCase() ?? '?';

  if (profile?.avatar_url) {
    return <Image source={{ uri: profile.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSaved: (updated: Partial<Profile>) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [handicap, setHandicap] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setDisplayName(profile?.display_name ?? '');
      setUsername(profile?.username ?? '');
      setHandicap(profile?.handicap_index ?? null);
      setIsNew(profile?.is_new_to_golf ?? false);
      setError('');
    }
  }, [visible, profile]);

  async function handleSave() {
    if (!displayName.trim()) { setError('Name is required.'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    setLoading(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const updates: Partial<Profile> = {
      display_name: displayName.trim(),
      username: username.trim().toLowerCase(),
      handicap_index: isNew ? null : handicap,
      is_new_to_golf: isNew,
    };
    const { error: err } = await supabase.from('profiles').update(updates).eq('id', user.id);
    setLoading(false);
    if (err) { setError(err.message); return; }
    onSaved(updates);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={editStyles.overlay}>
        <View style={editStyles.sheet}>
          <View style={editStyles.handle} />
          <View style={editStyles.headerRow}>
            <Text style={editStyles.sheetTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={editStyles.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <View style={editStyles.fields}>
            <View style={editStyles.fieldGroup}>
              <Text style={editStyles.label}>Full Name</Text>
              <TextInput style={editStyles.input} value={displayName} onChangeText={t => { setDisplayName(t); setError(''); }}
                placeholder="John Doe" placeholderTextColor="#A8B89A" autoCapitalize="words" />
            </View>

            <View style={editStyles.fieldGroup}>
              <Text style={editStyles.label}>Username</Text>
              <TextInput style={editStyles.input} value={username}
                onChangeText={t => { setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)); setError(''); }}
                placeholder="johndoe1" placeholderTextColor="#A8B89A" autoCapitalize="none" autoCorrect={false} />
            </View>

            <View style={editStyles.fieldGroup}>
              <Text style={editStyles.label}>Handicap Index</Text>
              <View style={editStyles.stepperRow}>
                <TouchableOpacity style={editStyles.stepperBtn} onPress={() => setHandicap(h => Math.max(-10, (h ?? 1) - 1))} disabled={isNew}>
                  <Text style={editStyles.stepperSym}>−</Text>
                </TouchableOpacity>
                <View style={editStyles.stepperVal}>
                  <Text style={editStyles.stepperText}>{isNew || handicap === null ? '- -' : String(handicap)}</Text>
                </View>
                <TouchableOpacity style={editStyles.stepperBtn} onPress={() => setHandicap(h => Math.min(54, (h ?? -1) + 1))} disabled={isNew}>
                  <Text style={editStyles.stepperSym}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={editStyles.toggleRow}>
                <Text style={editStyles.toggleText}>New to golf / No official index</Text>
                <Switch value={isNew} onValueChange={v => { setIsNew(v); if (v) setHandicap(null); }}
                  trackColor={{ false: '#D0D8C8', true: palette.highVisLime }} thumbColor="#FFF" ios_backgroundColor="#D0D8C8" />
              </View>
            </View>

            {!!error && <View style={editStyles.errorBox}><Text style={editStyles.errorText}>{error}</Text></View>}

            <TouchableOpacity style={editStyles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color={palette.bunkerSand} /> : <Text style={editStyles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Menu Item ────────────────────────────────────────────────────────────────

function MenuItem({ label, sublabel, onPress }: { label: string; sublabel?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuItemContent}>
        <Text style={styles.menuItemLabel}>{label}</Text>
        {sublabel && <Text style={styles.menuItemSublabel}>{sublabel}</Text>}
      </View>
      <ChevronRight />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rounds, setRounds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) setProfile(data as Profile);
    const { count } = await supabase.from('game_players').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    setRounds(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const handicapLabel = profile?.is_new_to_golf
    ? 'New to Golf'
    : profile?.handicap_index != null
    ? `HCP ${profile.handicap_index}`
    : 'HCP N/A';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={palette.fairwayGreen} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => setEditVisible(true)} style={styles.editHeaderBtn} hitSlop={8}>
          <EditIcon size={18} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerDivider} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={styles.profileBlock}>
          <View style={styles.avatarWrapper}>
            <Avatar profile={profile} size={88} />
            <TouchableOpacity style={styles.editAvatarBtn} onPress={() => setEditVisible(true)}>
              <EditIcon size={12} />
            </TouchableOpacity>
          </View>
          <Text style={styles.displayName}>{profile?.display_name ?? 'Your Name'}</Text>
          {profile?.username && <Text style={styles.usernameText}>@{profile.username}</Text>}
          <View style={styles.handicapBadge}>
            <Text style={styles.handicapBadgeText}>{handicapLabel}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{rounds}</Text>
            <Text style={styles.statLabel}>Rounds</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>0%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionLabel}>ACCOUNT</Text>
          <MenuItem label="Edit Profile" sublabel="Name, username, handicap" onPress={() => setEditVisible(true)} />
          <MenuItem label="Friends" sublabel="Manage your connections" onPress={() => router.push('/(tabs)/friends')} />
          <MenuItem label="My Rounds" sublabel="View past rounds" onPress={() => {}} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <LogOutIcon size={20} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <EditProfileModal
        visible={editVisible}
        profile={profile}
        onClose={() => setEditVisible(false)}
        onSaved={(updates) => setProfile(prev => prev ? { ...prev, ...updates } : prev)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bunkerSand },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: palette.graphiteShaft },
  editHeaderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: INPUT_BG, alignItems: 'center', justifyContent: 'center' },
  headerDivider: { height: 2, backgroundColor: palette.highVisLime },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 28 },
  profileBlock: { alignItems: 'center', marginBottom: 28 },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarCircle: { backgroundColor: palette.graphiteShaft, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: palette.bunkerSand, fontWeight: '700' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: palette.highVisLime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.bunkerSand },
  displayName: { fontSize: 24, fontWeight: '800', color: palette.graphiteShaft, marginBottom: 4 },
  usernameText: { fontSize: 15, color: '#7A8C5A', marginBottom: 12 },
  handicapBadge: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: INPUT_BG, borderRadius: 100, borderWidth: 1.5, borderColor: '#C8CEBC' },
  handicapBadgeText: { fontSize: 13, fontWeight: '600', color: palette.graphiteShaft },
  statsRow: { flexDirection: 'row', backgroundColor: '#F5F7F0', borderRadius: 16, padding: 20, marginBottom: 28 },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 26, fontWeight: '800', color: palette.graphiteShaft },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#7A8C5A', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: '#D8DDD0', marginVertical: 4 },
  menuSection: { marginBottom: 24 },
  menuSectionLabel: { fontSize: 11, fontWeight: '700', color: '#7A8C5A', letterSpacing: 1.2, marginBottom: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#F5F7F0', borderRadius: 12, marginBottom: 8 },
  menuItemContent: { gap: 2 },
  menuItemLabel: { fontSize: 15, fontWeight: '600', color: palette.graphiteShaft },
  menuItemSublabel: { fontSize: 12, color: '#8A9680' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 100, borderWidth: 1.5, borderColor: '#F5C2BC', backgroundColor: '#FEF0EE' },
  logoutText: { fontSize: 16, fontWeight: '700', color: palette.sundayRed },
});

const editStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.bunkerSand, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#C8CEBC', alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: palette.graphiteShaft },
  closeBtn: { fontSize: 16, color: palette.graphiteShaft },
  fields: { gap: 14 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: palette.fairwayGreen },
  input: { height: 52, backgroundColor: INPUT_BG, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: palette.graphiteShaft },
  stepperRow: { flexDirection: 'row', gap: 10 },
  stepperBtn: { width: 56, height: 56, borderRadius: 10, borderWidth: 1.5, borderColor: '#C8CEBC', backgroundColor: INPUT_BG, alignItems: 'center', justifyContent: 'center' },
  stepperSym: { fontSize: 22, fontWeight: '300', color: palette.graphiteShaft },
  stepperVal: { flex: 1, height: 56, borderRadius: 10, borderWidth: 1.5, borderColor: '#C8CEBC', backgroundColor: INPUT_BG, alignItems: 'center', justifyContent: 'center' },
  stepperText: { fontSize: 22, fontWeight: '700', color: palette.graphiteShaft },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  toggleText: { fontSize: 14, color: palette.graphiteShaft, flex: 1 },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 10 },
  errorText: { fontSize: 13, color: palette.sundayRed, textAlign: 'center' },
  saveBtn: { height: 56, backgroundColor: palette.graphiteShaft, borderRadius: 100, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText: { color: palette.bunkerSand, fontSize: 17, fontWeight: '700' },
});
