import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Modal, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';
import { BellIcon } from '../../lib/icons';

type Post = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { display_name: string | null; username: string | null };
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PostCard({ post }: { post: Post }) {
  const name = post.profile?.display_name ?? post.profile?.username ?? 'Golfer';
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Text style={styles.postAvatarText}>{initials}</Text>
        </View>
        <View style={styles.postMeta}>
          <Text style={styles.postName}>{name}</Text>
          {post.profile?.username && <Text style={styles.postHandle}>@{post.profile.username}</Text>}
        </View>
        <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
      </View>
      <Text style={styles.postContent}>{post.content}</Text>
    </View>
  );
}

function NewPostModal({ visible, onClose, onPosted }: { visible: boolean; onClose: () => void; onPosted: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('posts').insert({ user_id: user.id, content: text.trim() });
    }
    setLoading(false);
    setText('');
    onPosted();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Post</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <TextInput
            style={styles.postInput}
            placeholder="What's happening on the course?"
            placeholderTextColor="#A8B89A"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={280}
            autoFocus
          />
          <Text style={styles.charCount}>{text.length}/280</Text>
          <TouchableOpacity
            style={[styles.postBtn, !text.trim() && styles.postBtnDisabled]}
            onPress={submit} disabled={loading || !text.trim()} activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={palette.bunkerSand} /> : <Text style={styles.postBtnText}>Post</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostVisible, setNewPostVisible] = useState(false);

  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, user_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); setRefreshing(false); return; }

    // Fetch profiles separately
    const userIds = [...new Set(data.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .in('id', userIds);

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
    setPosts(data.map(p => ({ ...p, profile: profileMap[p.user_id] })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  function onRefresh() { setRefreshing(true); loadPosts(); }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setNewPostVisible(true)} style={styles.newPostBtn} activeOpacity={0.85}>
            <Text style={styles.newPostBtnText}>+ Post</Text>
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8}>
            <BellIcon color={palette.graphiteShaft} size={24} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={palette.fairwayGreen} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={posts.length === 0 ? styles.emptyContent : styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.fairwayGreen} />}
        >
          {posts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🌍</Text>
              <Text style={styles.emptyTitle}>Your feed is empty</Text>
              <Text style={styles.emptySubtitle}>Follow friends and complete rounds to see activity here.</Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(tabs)/friends')} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Find Friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map(p => <PostCard key={p.id} post={p} />)
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <NewPostModal
        visible={newPostVisible}
        onClose={() => setNewPostVisible(false)}
        onPosted={loadPosts}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bunkerSand },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  logoImage: { width: 110, height: 40 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  newPostBtn: { backgroundColor: palette.highVisLime, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  newPostBtnText: { fontSize: 13, fontWeight: '700', color: palette.graphiteShaft },
  divider: { height: 2, backgroundColor: palette.highVisLime },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 80 },
  listContent: { paddingHorizontal: 20, paddingTop: 16 },
  emptyWrap: { alignItems: 'center', gap: 10 },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: palette.graphiteShaft, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  ctaBtn: { marginTop: 12, backgroundColor: palette.highVisLime, borderRadius: 100, paddingHorizontal: 28, paddingVertical: 12 },
  ctaText: { fontSize: 14, fontWeight: '700', color: palette.graphiteShaft },
  postCard: { backgroundColor: '#F5F7F0', borderRadius: 16, padding: 16, marginBottom: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.graphiteShaft, alignItems: 'center', justifyContent: 'center' },
  postAvatarText: { color: palette.bunkerSand, fontWeight: '700', fontSize: 14 },
  postMeta: { flex: 1 },
  postName: { fontSize: 14, fontWeight: '700', color: palette.graphiteShaft },
  postHandle: { fontSize: 12, color: '#7A8C5A' },
  postTime: { fontSize: 11, color: '#9CA3AF' },
  postContent: { fontSize: 15, color: palette.graphiteShaft, lineHeight: 22 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: palette.bunkerSand, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#C8CEBC', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: palette.graphiteShaft },
  modalClose: { fontSize: 16, color: palette.graphiteShaft },
  postInput: { backgroundColor: '#EEF3E8', borderRadius: 12, padding: 16, fontSize: 15, color: palette.graphiteShaft, minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  postBtn: { height: 52, backgroundColor: palette.graphiteShaft, borderRadius: 100, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  postBtnDisabled: { opacity: 0.45 },
  postBtnText: { color: palette.bunkerSand, fontSize: 16, fontWeight: '700' },
});
