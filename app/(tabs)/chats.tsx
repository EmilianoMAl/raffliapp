import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';

type Conversation = {
  id: string;
  last_message: string | null;
  updated_at: string;
  other_user_id: string;
  other_name: string | null;
  other_username: string | null;
  unread: number;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ChatRow({ item }: { item: Conversation }) {
  const name = item.other_name ?? item.other_username ?? 'Golfer';
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <TouchableOpacity style={styles.chatRow} activeOpacity={0.7}>
      <View style={styles.chatAvatar}>
        <Text style={styles.chatAvatarText}>{initials}</Text>
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{name}</Text>
        <Text style={styles.chatLast} numberOfLines={1}>{item.last_message ?? 'No messages yet'}</Text>
      </View>
      <View style={styles.chatMeta}>
        <Text style={styles.chatTime}>{timeAgo(item.updated_at)}</Text>
        {item.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadConversations = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('conversations')
      .select('id, last_message, updated_at, player1_id, player2_id')
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .order('updated_at', { ascending: false });

    if (!data) { setLoading(false); setRefreshing(false); return; }

    const otherIds = data.map(c => c.player1_id === user.id ? c.player2_id : c.player1_id);
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, username').in('id', otherIds);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    setConversations(data.map(c => {
      const otherId = c.player1_id === user.id ? c.player2_id : c.player1_id;
      const opp = profileMap[otherId];
      return {
        id: c.id,
        last_message: c.last_message,
        updated_at: c.updated_at,
        other_user_id: otherId,
        other_name: opp?.display_name ?? null,
        other_username: opp?.username ?? null,
        unread: 0,
      };
    }));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  function onRefresh() { setRefreshing(true); loadConversations(); }

  const filtered = search.trim()
    ? conversations.filter(c => {
        const name = (c.other_name ?? c.other_username ?? '').toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : conversations;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        <Text style={styles.headerTitle}>Chats</Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={palette.fairwayGreen} size="large" /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.fairwayGreen} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                Start a round and chat with your playing partners!
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map(c => <ChatRow key={c.id} item={c} />)}
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: palette.graphiteShaft },
  divider: { height: 2, backgroundColor: palette.highVisLime },
  searchWrap: { paddingHorizontal: 20, paddingVertical: 12 },
  searchInput: { backgroundColor: '#EDEAE6', borderRadius: 12, paddingHorizontal: 16, height: 42, fontSize: 14, color: palette.graphiteShaft },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 10 },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: palette.graphiteShaft, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  list: { paddingHorizontal: 20 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EDEAE6', gap: 12 },
  chatAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.graphiteShaft, alignItems: 'center', justifyContent: 'center' },
  chatAvatarText: { color: palette.bunkerSand, fontWeight: '700', fontSize: 16 },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 15, fontWeight: '700', color: palette.graphiteShaft },
  chatLast: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  chatMeta: { alignItems: 'flex-end', gap: 4 },
  chatTime: { fontSize: 11, color: '#9CA3AF' },
  badge: { backgroundColor: palette.highVisLime, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 11, fontWeight: '700', color: palette.graphiteShaft },
});
