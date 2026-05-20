import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';
import { BellIcon } from '../../lib/icons';

type Rivalry = {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_wins: number;
  player2_wins: number;
  total_rounds: number;
  opponent_name: string | null;
  opponent_username: string | null;
};

function RivalryCard({ item, myId }: { item: Rivalry; myId: string }) {
  const isPlayer1 = item.player1_id === myId;
  const myWins = isPlayer1 ? item.player1_wins : item.player2_wins;
  const theirWins = isPlayer1 ? item.player2_wins : item.player1_wins;
  const name = item.opponent_name ?? item.opponent_username ?? 'Golfer';
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const leading = myWins > theirWins ? 'You lead' : myWins < theirWins ? 'They lead' : 'Tied';
  const leadColor = myWins > theirWins ? palette.fairwayGreen : myWins < theirWins ? palette.sundayRed : palette.skyBlue;

  return (
    <View style={styles.card}>
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>{initials}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{name}</Text>
        {item.opponent_username && <Text style={styles.cardHandle}>@{item.opponent_username}</Text>}
        <Text style={styles.cardRounds}>{item.total_rounds} rounds played</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardScore}>{myWins}–{theirWins}</Text>
        <Text style={[styles.cardLeading, { color: leadColor }]}>{leading}</Text>
      </View>
    </View>
  );
}

export default function RivalryScreen() {
  const router = useRouter();
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [myId, setMyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRivalries = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setMyId(user.id);

    const { data } = await supabase
      .from('rivalries')
      .select('*')
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .order('total_rounds', { ascending: false });

    if (!data) { setLoading(false); setRefreshing(false); return; }

    // Fetch opponent profiles
    const opponentIds = data.map(r => r.player1_id === user.id ? r.player2_id : r.player1_id);
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, username').in('id', opponentIds);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    setRivalries(data.map(r => {
      const oppId = r.player1_id === user.id ? r.player2_id : r.player1_id;
      const opp = profileMap[oppId];
      return { ...r, opponent_name: opp?.display_name ?? null, opponent_username: opp?.username ?? null };
    }));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadRivalries(); }, [loadRivalries]);

  function onRefresh() { setRefreshing(true); loadRivalries(); }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        <TouchableOpacity hitSlop={8}><BellIcon color={palette.graphiteShaft} size={24} /></TouchableOpacity>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={palette.fairwayGreen} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.fairwayGreen} />}
        >
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Rivalry</Text>
            <Text style={styles.pageSubtitle}>Your head-to-head records</Text>
          </View>

          {rivalries.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>⚔️</Text>
              <Text style={styles.emptyTitle}>No rivalries yet</Text>
              <Text style={styles.emptySubtitle}>Play rounds with friends to build your rivalry records.</Text>
              <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={() => router.push('/round/create')}>
                <Text style={styles.ctaText}>Create Round</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {rivalries.map(r => <RivalryCard key={r.id} item={r} myId={myId} />)}
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bunkerSand },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  logoImage: { width: 110, height: 40 },
  divider: { height: 2, backgroundColor: palette.highVisLime },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 26, fontWeight: '700', color: palette.graphiteShaft, marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: '#9CA3AF' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: palette.graphiteShaft, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  ctaBtn: { marginTop: 12, backgroundColor: palette.highVisLime, borderRadius: 100, paddingHorizontal: 28, paddingVertical: 12 },
  ctaText: { fontSize: 14, fontWeight: '700', color: palette.graphiteShaft },
  list: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7F0', borderRadius: 14, padding: 14, gap: 12 },
  cardAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: palette.graphiteShaft, alignItems: 'center', justifyContent: 'center' },
  cardAvatarText: { color: palette.bunkerSand, fontWeight: '700', fontSize: 15 },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 15, fontWeight: '700', color: palette.graphiteShaft },
  cardHandle: { fontSize: 12, color: '#7A8C5A' },
  cardRounds: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 2 },
  cardScore: { fontSize: 20, fontWeight: '800', color: palette.graphiteShaft },
  cardLeading: { fontSize: 11, fontWeight: '600' },
});
